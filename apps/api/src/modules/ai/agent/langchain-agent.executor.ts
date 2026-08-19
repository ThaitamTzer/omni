import { createAgent } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { createHash } from 'node:crypto';
import type { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { Injectable, Logger } from '@nestjs/common';
import { AgentExecutor, AgentInput } from './agent-executor';
import { AgentRuntimeContext } from './runtime-context';
import { AgentDecision, AgentDecisionSchema } from './agent-decision';
import type { AiModelConfig } from '../ai.config';
import { buildTools, ToolDeps } from './tools';
import { OutputPolicyService } from './output-policy.service';
import { AgentLogService } from './agent-log.service';
import { AGENT_LIMITS, withTimeout } from './guardrails';

export interface LangChainAgentExecutorOptions {
  config: AiModelConfig;
  checkpointer: PostgresSaver;
  /** Dependency cho tools (prisma/knowledge/logs). */
  toolDeps?: ToolDeps;
  logs?: AgentLogService;
  systemPrompt?: string;
  /** Output policy — backend quyết định cuối. Mặc định dùng service thật. */
  policy?: OutputPolicyService;
  /** Inject để test (mock createAgent). */
  agentFactory?: typeof createAgent;
}

@Injectable()
export class LangChainAgentExecutor implements AgentExecutor {
  private readonly logger = new Logger(LangChainAgentExecutor.name);
  private readonly config: AiModelConfig;
  private agent: ReturnType<typeof createAgent>;
  private readonly policy: OutputPolicyService;
  private readonly logs?: AgentLogService;

  constructor(opts: LangChainAgentExecutorOptions) {
    const {
      config,
      checkpointer,
      toolDeps,
      logs,
      systemPrompt,
      policy = new OutputPolicyService(),
      agentFactory = createAgent,
    } = opts;
    this.config = config;
    this.policy = policy;
    this.logs = logs;

    this.agent = agentFactory({
      model: new ChatOpenAI({
        model: config.chatModel,
        temperature: config.temperature,
        timeout: config.timeoutMs,
        maxRetries: config.maxRetries,
      }),
      tools: toolDeps ? (buildTools(toolDeps) as never) : [],
      systemPrompt:
        systemPrompt ??
        `Bạn là trợ lý CSKH của shop, tên là Omni Bot.
- Ngôn ngữ: tiếng Việt. Giọng điệu thân thiện, lịch sự, xưng hô dạ/ạ.
- Trả lời ngắn gọn, đúng trọng tâm.
- KHÔNG hứa hẹn điều gì ngoài chính sách của shop.
- Nếu không chắc chắn, hãy trả về action HANDOFF để chuyển nhân viên.`,
      checkpointer,
      // Structured output: agent phải trả AgentDecision hợp lệ (Zod validate).
      responseFormat: AgentDecisionSchema,
    });
  }

  async invoke(input: AgentInput, ctx: AgentRuntimeContext): Promise<AgentDecision> {
    const threadId = createHash('sha256')
      .update(`facebook:${ctx.pageId}:${ctx.conversationId}`)
      .digest('hex');

    // Run timeout — nếu quá hạn → HANDOFF (không crash, không reply rác).
    const start = Date.now();
    let result: { structuredResponse?: unknown } | null = null;
    try {
      result = await withTimeout(
        this.agent.invoke(
          { messages: [{ role: 'user', content: input.customerMessage }] },
          {
            configurable: {
              thread_id: threadId,
              // Giới hạn số vòng model/tool (LangGraph throw khi vượt recursion limit).
              recursion_limit: AGENT_LIMITS.maxModelSteps + 5,
            },
          },
        ),
        AGENT_LIMITS.runTimeoutMs,
        'AGENT_RUN',
      );
    } catch (e) {
      this.logger.error(`Agent run failed: ${(e as Error).message}`);
      void this.logs?.logError(ctx.conversationId, `agent_invoke: ${(e as Error).message}`);
      return { action: 'HANDOFF', reply: '', reasonCode: 'TOOL_FAILED' };
    }

    const latencyMs = Date.now() - start;
    void this.logs?.logModelCall(ctx.conversationId, {
      model: this.config.chatModel,
      latencyMs,
    });

    const structured = result?.structuredResponse;

    // Model không tuân schema → không tự bịa reply, bàn giao an toàn.
    if (!structured || typeof structured !== 'object') {
      return { action: 'HANDOFF', reply: '', reasonCode: 'UNSUPPORTED_ACTION' };
    }

    const decision = structured as AgentDecision;
    const verdict = this.policy.evaluate({
      decision,
      ctx,
      steps: 1, // P7: recursion_limit đã giới hạn vòng lặp; steps đo thật khó — dùng 1
      toolErrors: [],
    });

    void this.logs?.logPolicyDecision(ctx.conversationId, {
      verdict,
      reasonCode: decision.reasonCode,
      steps: 1,
    });

    if (verdict === 'HANDOFF') {
      return {
        action: 'HANDOFF',
        reply: decision.reply ?? '',
        reasonCode: decision.reasonCode ?? 'INSUFFICIENT_KNOWLEDGE',
      };
    }

    return decision;
  }
}

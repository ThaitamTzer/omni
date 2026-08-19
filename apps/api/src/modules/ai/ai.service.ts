import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { LangGraphWorkflow } from './langgraph/workflow';
import { ReplyService } from './agent/reply.service';
import { HandoffService } from './agent/handoff.service';
import { AgentLogService } from './agent/agent-log.service';
import { LangChainAgentExecutor } from './agent/langchain-agent.executor';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly workflow: LangGraphWorkflow,
    private readonly executor: LangChainAgentExecutor,
    private readonly reply: ReplyService,
    private readonly handoff: HandoffService,
    private readonly logs: AgentLogService,
  ) {}

  /**
   * Main entry: run the AI pipeline for one conversation.
   * Decision Graph (tầng 1) quyết định action → AgentExecutor (tầng 2) trả lời.
   */
  async processConversation(conversationId: string, pageId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { page: true },
    });
    if (!conversation || conversation.deletedAt || !conversation.aiEnabled) return;

    // --- Rate limit: global per-hour cap (across all pages) ---
    const settings = await this.settings.getAll();
    const maxPerHour = Number(settings.ai_max_replies_per_hour ?? 10);
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const repliesThisHour = await this.prisma.agentLog.count({
      where: { event: 'reply_sent', createdAt: { gte: hourAgo } },
    });
    if (repliesThisHour >= maxPerHour) {
      await this.logs.log(conversationId, 'rate_limited', { reason: 'global_hourly_cap', maxPerHour });
      await this.handoff.handoff(conversationId, 'rate_limited_global');
      this.logger.warn(`AI rate limit hit (${repliesThisHour}/${maxPerHour}/h) — conversation ${conversationId} escalated`);
      return;
    }

    // --- Rate limit: per-conversation cap (avoid AI replying endlessly to spam) ---
    const perConvMax = Number(settings.ai_max_replies_per_conversation ?? 10);
    // Reset the per-conversation window if it rolled over an hour
    const windowStart = conversation.aiReplyWindowStart;
    const windowExpired = !windowStart || windowStart.getTime() < hourAgo.getTime();
    const convReplies = windowExpired ? 0 : conversation.aiReplyCount;
    if (convReplies >= perConvMax) {
      await this.logs.log(conversationId, 'rate_limited', { reason: 'conversation_cap', maxPerConv: perConvMax });
      await this.handoff.handoff(conversationId, 'rate_limited_conversation');
      this.logger.warn(`Per-conversation AI limit hit (${convReplies}/${perConvMax}) — escalated ${conversationId}`);
      return;
    }

    const history = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 40,
    });

    // 1) Decision Graph decides what to do (rule templates take priority over LLM)
    const aiRules = await this.settings.getAiRules();
    const decision = await this.workflow.run({
      conversationId,
      history: history.map((m: { senderType: string; text: string | null }) => ({
        role: m.senderType === 'CUSTOMER' ? 'user' : 'assistant',
        content: m.text ?? '',
      })),
      settings,
      aiRules: aiRules.map((r) => ({
        id: r.id,
        name: r.name,
        keywords: r.keywords as string[],
        responseTemplate: r.responseTemplate,
        enabled: r.enabled,
        priority: r.priority,
      })),
    });
    await this.logs.log(conversationId, 'decision', decision);

    switch (decision.action) {
      case 'IGNORE':
        return;
      case 'RETRY_LATER':
        await this.logs.log(conversationId, 'retry_later', { reasonCode: decision.reasonCode });
        return;
      case 'HANDOFF':
        await this.handoff.handoff(conversationId, decision.reasonCode, decision);
        return;
      case 'RULE_REPLY':
        if (decision.reply) {
          await this.reply.sendReplyAndStore(pageId, conversation, decision.reply);
          await this.logs.log(conversationId, 'reply_sent', { text: decision.reply, source: 'ai_rule' });
          await this.bumpAiReplyCount(conversationId, windowExpired, windowStart, conversation.aiReplyCount);
        }
        return;
      case 'RUN_AGENT':
        break;
    }

    // 2) RUN_AGENT — nếu thiếu API key, không thể sinh LLM reply → bàn giao.
    if (!process.env.OPENAI_API_KEY) {
      await this.logs.log(conversationId, 'escalated_no_api_key', { reason: 'missing OPENAI_API_KEY' });
      await this.handoff.handoff(conversationId, 'escalated_no_api_key');
      this.logger.warn(`No OPENAI_API_KEY — conversation ${conversationId} escalated (LLM branch)`);
      return;
    }

    // 3) Agent trả lời (createAgent + tools). Decision đã qua Output Policy.
    const agentDecision = await this.executor.invoke(
      {
        customerMessage: history.at(-1)?.text ?? '',
        history: history.map((m: { senderType: string; text: string | null }) => ({
          role: m.senderType === 'CUSTOMER' ? 'user' : 'assistant',
          content: m.text ?? '',
        })),
      },
      {
        pageId,
        conversationId,
        customerFbId: conversation.customerFbId ?? '',
        customerName: conversation.customerName,
        settings,
      },
    );

    if (agentDecision.action === 'REPLY' && agentDecision.reply) {
      await this.reply.sendReplyAndStore(pageId, conversation, agentDecision.reply);
      await this.logs.log(conversationId, 'reply_sent', { text: agentDecision.reply, source: 'agent' });
      await this.bumpAiReplyCount(conversationId, windowExpired, windowStart, conversation.aiReplyCount);
    } else {
      await this.handoff.handoff(conversationId, agentDecision.reasonCode, agentDecision);
    }
  }

  private async bumpAiReplyCount(
    conversationId: string,
    windowExpired: boolean,
    windowStart: Date | null,
    current: number,
  ): Promise<void> {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        aiReplyCount: windowExpired ? 1 : current + 1,
        aiReplyWindowStart: windowStart && !windowExpired ? windowStart : new Date(),
      },
    });
  }
}

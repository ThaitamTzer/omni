import { Injectable, Logger } from '@nestjs/common';
import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { DecisionResult, DecisionAction } from './types';
import type { AiModelConfig } from '../ai.config';

/**
 * Conversation state shared across the graph.
 */
const ConversationState = Annotation.Root({
  conversationId: Annotation<string>,
  history: Annotation<Array<{ role: string; content: string }>>,
  settings: Annotation<Record<string, string>>,
  aiRules: Annotation<
    Array<{
      id: string;
      name: string;
      keywords: string[];
      responseTemplate: string | null;
      enabled: boolean;
      priority: number;
    }>
  >,
  intent: Annotation<string>,
  confidence: Annotation<number>,
  action: Annotation<DecisionAction>,
  replyText: Annotation<string | null>,
  matchedRuleId: Annotation<string>,
  reasonCode: Annotation<string>,
  confidenceBand: Annotation<'high' | 'medium' | 'low'>,
});

type State = typeof ConversationState.State;

const ESCALATE_KEYWORDS = [
  'khiếu nại', 'phàn nàn', 'bực', 'tệ', 'tệ quá', 'lừa đảo',
  'complaint', 'scam', 'không hài lòng', 'trả lại', 'hoàn tiền', 'refund',
  'luật sư', 'báo công an', 'kiện', 'tòa án', 'bồi thường',
];

/** Schema cho LLM classifier (structured output). */
const ClassifySchema = z.object({
  intent: z.enum([
    'greeting', 'price', 'order', 'shipping', 'product', 'thanks', 'faq',
    'escalate', 'unknown',
  ]),
  band: z.enum(['high', 'medium', 'low']),
});

export interface ClassifyLlmInput {
  text: string;
  config: AiModelConfig;
}

@Injectable()
export class LangGraphWorkflow {
  private readonly logger = new Logger(LangGraphWorkflow.name);
  private readonly graph;

  constructor(
    private readonly config: AiModelConfig,
    /** Inject để test — hàm classify bằng LLM (hybrid). */
    private readonly classifyWithLlmImpl?: (input: ClassifyLlmInput) => Promise<{
      intent: string;
      band: 'high' | 'medium' | 'low';
    }>,
  ) {
    this.graph = this.buildGraph();
  }

  /**
   * Rule-based intent classification (fast, no LLM cost).
   */
  private classifyIntent(text: string): { intent: string; confidence: number } {
    const lower = text.toLowerCase();

    if (ESCALATE_KEYWORDS.some((k) => lower.includes(k))) {
      return { intent: 'escalate', confidence: 0.95 };
    }

    const patterns: Array<[string, RegExp]> = [
      ['greeting', /^(chào|hello|hi|hey|alo|em chào|dạ chào)/i],
      ['price', /(giá|bao nhiêu tiền|bảng giá|chi phí|cost|price|bán bao nhiêu)/i],
      ['order', /(đơn hàng|mã đơn|đơn của|order|trạng thái đơn|khi nào giao|đã gửi chưa)/i],
      ['shipping', /(giao hàng|ship|vận chuyển|bao lâu|nhận hàng|giao tận nơi)/i],
      ['product', /(sản phẩm|mặt hàng|còn hàng|size|màu|kích thước|mẫu|model)/i],
      ['thanks', /(cảm ơn|thank|cám ơn)/i],
      ['faq', /(đổi trả|bảo hành|thanh toán|hóa đơn|chính sách|cách thức|hướng dẫn)/i],
    ];

    for (const [intent, re] of patterns) {
      if (re.test(lower)) return { intent, confidence: 0.9 };
    }

    return { intent: 'unknown', confidence: 0.3 };
  }

  /**
   * LLM classifier (small model) — chỉ gọi khi regex không chắc (unknown).
   * Trả intent + confidence band. Model từ config (AI_CLASSIFY_MODEL).
   */
  private async classifyWithLlm(text: string): Promise<{
    intent: string;
    band: 'high' | 'medium' | 'low';
  }> {
    if (this.classifyWithLlmImpl) {
      return this.classifyWithLlmImpl({ text, config: this.config });
    }

    const model = new ChatOpenAI({
      model: this.config.classifyModel,
      temperature: 0,
      timeout: this.config.timeoutMs,
      maxRetries: this.config.maxRetries,
    }).withStructuredOutput(ClassifySchema);

    const result = await model.invoke([
      {
        role: 'system',
        content:
          'Phân loại ý định tin nhắn khách hàng CSKH tiếng Việt. ' +
          'intent: greeting|price|order|shipping|product|thanks|faq|escalate|unknown. ' +
          'Escalate khi khách bực bội/khiếu nại/hoàn tiền/lừa đảo/kiện tụng. ' +
          'band: high nếu chắc chắn, low nếu mơ hồ.',
      },
      { role: 'user', content: text },
    ]);

    return { intent: result.intent, band: result.band };
  }

  private async classifyNode(state: State): Promise<Partial<State>> {
    const lastUserText = [...state.history].reverse().find((m) => m.role === 'user')?.content ?? '';

    // Rule đã khớp (RULE_REPLY) — không ghi đè reasonCode/intent của rule.
    if (state.replyText) {
      return {};
    }

    const { intent, confidence } = this.classifyIntent(lastUserText);

    // Regex chắc (0.9+) → dùng luôn, không tốn LLM.
    if (confidence >= 0.7) {
      return {
        intent,
        confidence,
        reasonCode: intent === 'escalate' ? 'escalate_keyword' : intent,
        confidenceBand: confidence >= 0.9 ? 'high' : 'medium',
      };
    }

    // Mơ hồ (unknown 0.3) → gọi LLM classifier nhỏ.
    try {
      const llm = await this.classifyWithLlm(lastUserText);
      return {
        intent: llm.intent,
        confidence: llm.band === 'high' ? 0.9 : llm.band === 'medium' ? 0.7 : 0.5,
        reasonCode: llm.intent === 'escalate' ? 'escalate_keyword' : llm.intent,
        confidenceBand: llm.band,
      };
    } catch (e) {
      this.logger.warn(`LLM classify failed: ${(e as Error).message}`);
      // Fallback an toàn: RUN_AGENT (agent tự xử lý, không HANDOFF mù).
      return { intent: 'unknown', confidence: 0.3, reasonCode: 'unknown', confidenceBand: 'low' };
    }
  }

  /**
   * Match the last customer message against enabled AiRules (keywords → template).
   */
  private async ruleMatchNode(state: State): Promise<Partial<State>> {
    const lastUserText = [...state.history].reverse().find((m) => m.role === 'user')?.content ?? '';
    const lower = lastUserText.toLowerCase();

    const rules = (state.aiRules ?? [])
      .filter((r) => r.enabled && r.responseTemplate)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of rules) {
      const kws = (rule.keywords ?? []).map((k) => k.toLowerCase());
      if (kws.some((k) => lower.includes(k))) {
        return {
          action: 'RULE_REPLY',
          replyText: rule.responseTemplate,
          matchedRuleId: rule.id,
          intent: rule.name,
          confidence: 1,
          reasonCode: 'rule_match',
          confidenceBand: 'high',
        };
      }
    }
    return {};
  }

  private async decideNode(state: State): Promise<Partial<State>> {
    const { intent } = state;

    // Rule đã có template reply chính xác — gửi thẳng, không xuống agent.
    if (state.replyText) {
      return { action: 'RULE_REPLY' };
    }
    // Escalate keywords (khiếu nại, hoàn tiền, pháp lý...) → luôn bàn giao người.
    if (intent === 'escalate') {
      return { action: 'HANDOFF' };
    }
    // Mọi intent khác (kể cả unknown) → cho agent xử lý.
    // Output Policy sẽ bàn giao nếu agent không trả lời được.
    return { action: 'RUN_AGENT' };
  }

  private buildGraph() {
    const g = new StateGraph(ConversationState)
      .addNode('ruleMatch', this.ruleMatchNode.bind(this))
      .addNode('classify', this.classifyNode.bind(this))
      .addNode('decide', this.decideNode.bind(this))
      .addEdge(START, 'ruleMatch')
      .addEdge('ruleMatch', 'classify')
      .addEdge('classify', 'decide')
      .addEdge('decide', END);

    return g.compile();
  }

  /**
   * Run the pipeline for a conversation, returning the AI decision.
   */
  async run(input: {
    conversationId: string;
    history: Array<{ role: string; content: string }>;
    settings: Record<string, string>;
    aiRules?: Array<{
      id: string;
      name: string;
      keywords: string[];
      responseTemplate: string | null;
      enabled: boolean;
      priority: number;
    }>;
  }): Promise<DecisionResult> {
    const result = await this.graph.invoke({
      conversationId: input.conversationId,
      history: input.history,
      settings: input.settings,
      aiRules: input.aiRules ?? [],
    });

    return {
      action: result.action,
      reasonCode: result.reasonCode ?? result.intent ?? 'unknown',
      reply: result.replyText ?? undefined,
      matchedRuleId: result.matchedRuleId,
      intent: result.intent,
      confidenceBand: result.confidenceBand ?? (result.confidence >= 0.7 ? 'high' : 'low'),
    };
  }
}

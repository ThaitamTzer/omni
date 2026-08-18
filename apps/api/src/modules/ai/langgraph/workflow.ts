import { Injectable, Logger } from '@nestjs/common';
import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { AiDecision } from '../ai.service';

/**
 * Conversation state shared across the graph.
 */
const ConversationState = Annotation.Root({
  conversationId: Annotation<string>,
  history: Annotation<Array<{ role: string; content: string }>>,
  settings: Annotation<Record<string, string>>,
  intent: Annotation<string>,
  confidence: Annotation<number>,
  action: Annotation<'reply' | 'escalate' | 'skip'>,
  replyText: Annotation<string | null>,
});

type State = typeof ConversationState.State;

const ESCALATE_KEYWORDS = [
  'khiếu nại', 'phàn nàn', 'bực', 'tệ', 'tệ quá', 'lừa đảo',
  'complaint', 'scam', 'không hài lòng', 'trả lại', 'hoàn tiền', 'refund',
  'luật sư', 'báo công an', 'kiện', 'tòa án', 'bồi thường',
];

@Injectable()
export class LangGraphWorkflow {
  private readonly logger = new Logger(LangGraphWorkflow.name);
  private readonly graph;

  constructor() {
    this.graph = this.buildGraph();
  }

  /**
   * Rule-based intent classification (fast, no LLM cost).
   * Extend with LLM classification later if needed.
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

  private async classifyNode(state: State): Promise<Partial<State>> {
    const lastUserText = [...state.history].reverse().find((m) => m.role === 'user')?.content ?? '';
    const { intent, confidence } = this.classifyIntent(lastUserText);
    return { intent, confidence };
  }

  private async decideNode(state: State): Promise<Partial<State>> {
    const { intent, confidence } = state;

    if (intent === 'escalate') {
      return { action: 'escalate' };
    }
    if (confidence >= 0.7) {
      return { action: 'reply' };
    }
    // Unknown/low-confidence — ask a human
    return { action: 'escalate' };
  }

  private buildGraph() {
    const g = new StateGraph(ConversationState)
      .addNode('classify', this.classifyNode.bind(this))
      .addNode('decide', this.decideNode.bind(this))
      .addEdge(START, 'classify')
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
  }): Promise<AiDecision> {
    const result = await this.graph.invoke({
      conversationId: input.conversationId,
      history: input.history,
      settings: input.settings,
    });

    return {
      intent: result.intent,
      confidence: result.confidence,
      action: result.action,
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Agent, tool, configureLogging } from '@strands-agents/sdk';
import { OpenAIModel } from '@strands-agents/sdk/openai';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { MessengerService } from '../../messenger/messenger.service';
import { AiDecision } from '../ai.service';

interface GenerateReplyArgs {
  pageId: string;
  conversationId: string;
  customerName: string;
  history: string[];
  decision: AiDecision;
}

interface ChatHistoryMessage {
  role: string;
  content: Array<{ type: string; text: string }>;
}

@Injectable()
export class StrandsAgentService {
  private readonly logger = new Logger(StrandsAgentService.name);
  private readonly agents = new Map<string, Agent>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly messenger: MessengerService,
  ) {
    if (process.env.STRANDS_DEBUG === '1') {
      configureLogging({ level: 'debug' } as never);
    }
  }

  /**
   * Build the tool list for the agent. Tools that need DB access are created
   * per-instance so they can use Prisma.
   */
  private buildTools() {
    return [
      tool({
        name: 'lookup_product',
        description:
          'Tra cứu thông tin sản phẩm trong kho hàng của shop theo từ khóa (tên, mã sản phẩm). Trả về tên, giá, tồn kho, mô tả ngắn.',
        inputSchema: z.object({
          keyword: z.string().describe('Từ khóa tìm kiếm sản phẩm'),
        }),
        callback: (input: { keyword: string }) => {
          // TODO: replace with real product DB lookup
          return `Sản phẩm "Áo thun cotton cao cấp" — giá 299.000đ, còn 120 cái. Mô tả: chất cotton 100%, nhiều màu, form rộng thoáng.`;
        },
      }),
      tool({
        name: 'lookup_order',
        description:
          'Tra cứu trạng thái đơn hàng theo mã đơn (hoặc tên khách hàng). Trả về trạng thái hiện tại và thời gian giao dự kiến.',
        inputSchema: z.object({
          orderId: z.string().describe('Mã đơn hàng (VD: DH12345)'),
        }),
        callback: (input: { orderId: string }) => {
          // TODO: replace with real order DB lookup
          return `Đơn hàng ${input.orderId}: đang giao hàng, dự kiến đến 2 ngày nữa. Đơn vị vận chuyển: GHTK.`;
        },
      }),
      tool({
        name: 'lookup_faq',
        description: 'Tra cứu câu hỏi thường gặp (FAQ) của shop theo chủ đề (giao hàng, đổi trả, bảo hành, thanh toán...).',
        inputSchema: z.object({
          topic: z.string().describe('Chủ đề cần tra cứu'),
        }),
        callback: async (input: { topic: string }) => {
          const keyword = input.topic.trim().toLowerCase();
          if (!keyword) return 'Không tìm thấy FAQ phù hợp.';

          try {
            const faqs = await this.prisma.faq.findMany({
              where: { enabled: true },
              orderBy: { createdAt: 'asc' },
              take: 50,
            });

            // Filter in JS: array_contains không hỗ trợ case-insensitive,
            // nên so sánh lowercase cả keywords lẫn question
            const matched = faqs
              .filter((f) => {
                const kws = (f.keywords as string[]) ?? [];
                const kwMatch = kws.some((k) => k.toLowerCase().includes(keyword));
                const qMatch = f.question.toLowerCase().includes(keyword);
                return kwMatch || qMatch;
              })
              .slice(0, 3);

            if (matched.length === 0) return 'Không tìm thấy FAQ phù hợp.';

            return matched.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');
          } catch (e) {
            this.logger.error(`lookup_faq failed: ${(e as Error).message}`);
            return 'Không tìm thấy FAQ phù hợp.';
          }
        },
      }),
    ];
  }

  /**
   * Build (or reuse) a Strands agent for a conversation. Agents keep their own
   * message history so context carries across messages within a conversation.
   */
  private getAgent(conversationId: string, systemPrompt: string, history: string[]): Agent {
    const existing = this.agents.get(conversationId);
    if (existing) return existing;

    const model = new OpenAIModel({
      modelId: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      apiKey: process.env.OPENAI_API_KEY,
      temperature: 0.4,
      maxTokens: 1024,
    });

    const agent = new Agent({
      model,
      tools: this.buildTools(),
      systemPrompt,
      printer: false,
    });

    // Seed conversation history so the agent has context from the start
    const seed: ChatHistoryMessage[] = history
      .filter((line) => line.trim())
      .map((line) => ({ role: 'user', content: [{ type: 'textBlock', text: line }] }));
    (agent.messages as ChatHistoryMessage[]).push(...seed);

    this.agents.set(conversationId, agent);
    // Simple bound on agent count to avoid unbounded memory
    if (this.agents.size > 500) {
      const firstKey = this.agents.keys().next().value;
      if (firstKey) this.agents.delete(firstKey);
    }
    return agent;
  }

  /**
   * Generate a reply for a conversation using the Strands agent.
   */
  async generateReply(args: GenerateReplyArgs): Promise<string | null> {
    const settings = await this.getSettings();
    const tone = settings.ai_tone ?? 'Thân thiện, lịch sự, xưng hô dạ/ạ với khách hàng.';

    const systemPrompt = `Bạn là trợ lý CSKH của shop, tên là Omni Bot.
- Ngôn ngữ: tiếng Việt. Giọng điệu: ${tone}
- Khách hàng: ${args.customerName}
- Trả lời ngắn gọn, tự nhiên, đúng trọng tâm câu hỏi.
- Dùng tool để tra cứu sản phẩm/đơn hàng/FAQ khi cần.
- KHÔNG hứa hẹn điều gì ngoài chính sách của shop.
- Nếu không chắc chắn hoặc khách yêu cầu điều ngoài phạm vi, trả lời là sẽ chuyển cho nhân viên hỗ trợ.`;

    const agent = this.getAgent(args.conversationId, systemPrompt, args.history);
    const prompt = `Khách vừa nhắn: "${args.history[args.history.length - 1] ?? ''}". Hãy trả lời khách.`;

    try {
      this.realtime.emitTyping(args.conversationId, true);
      const result = await agent.invoke(prompt);
      this.realtime.emitTyping(args.conversationId, false);

      const text = result.lastMessage?.content
        .map((b) => (b.type === 'textBlock' ? b.text : ''))
        .join(' ')
        .trim();

      return text && text.length > 0 ? text : null;
    } catch (e) {
      this.logger.error(`Strands agent invoke failed: ${(e as Error).message}`);
      this.realtime.emitTyping(args.conversationId, false);
      return null;
    }
  }

  /**
   * Send the AI reply through Messenger and persist it + notify dashboard.
   */
  async sendReplyAndStore(
    pageId: string,
    conversation: { id: string; customerFbId: string | null },
    text: string,
  ): Promise<void> {
    if (!conversation.customerFbId) {
      this.logger.warn(`Conversation ${conversation.id} has no customerFbId — cannot send`);
      return;
    }

    const messageId = await this.messenger.sendText(pageId, conversation.customerFbId, text);

    const saved = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: 'AGENT',
        senderId: pageId,
        fbMessageId: messageId,
        text,
        isSent: !!messageId,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), lastMessagePreview: text.slice(0, 160) },
    });

    this.realtime.emitNewMessage(conversation.id, saved);
  }

  private async getSettings(): Promise<Record<string, string>> {
    const rows = await this.prisma.setting.findMany();
    return Object.fromEntries(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
  }
}

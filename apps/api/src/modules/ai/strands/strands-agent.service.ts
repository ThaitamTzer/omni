import { Injectable, Logger } from '@nestjs/common';
import { Agent, tool, configureLogging } from '@strands-agents/sdk';
import { OpenAIModel } from '@strands-agents/sdk/openai';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { MessengerService } from '../../messenger/messenger.service';
import { SettingsService } from '../../settings/settings.service';
import { AiDecision } from '../ai.service';

interface GenerateReplyArgs {
  pageId: string;
  conversationId: string;
  customerName: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
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
  private readonly agentLastUsed = new Map<string, number>();

  /**
   * Log a tool lookup to AgentLog for audit. Fire-and-forget (never blocks the reply).
   */
  private async logToolCall(conversationId: string, tool: string, args: unknown, result: string) {
    try {
      await this.prisma.agentLog.create({
        data: {
          conversationId,
          event: 'tool_lookup',
          payload: { tool, args, result: result.slice(0, 500) } as object,
        },
      });
    } catch (e) {
      this.logger.warn(`logToolCall failed: ${(e as Error).message}`);
    }
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
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
  private buildTools(conversationId: string) {
    return [
      tool({
        name: 'lookup_product',
        description:
          'Tra cứu thông tin sản phẩm trong kho hàng của shop theo từ khóa (tên, mã sản phẩm). Trả về tên, giá, tồn kho, mô tả ngắn.',
        inputSchema: z.object({
          keyword: z.string().describe('Từ khóa tìm kiếm sản phẩm'),
        }),
        callback: async (input: { keyword: string }) => {
          const keyword = input.keyword.trim().toLowerCase();
          if (!keyword) return 'Vui lòng nhập từ khóa sản phẩm cần tra cứu.';
          try {
            const products = await this.prisma.product.findMany({
              where: { active: true },
              orderBy: { createdAt: 'asc' },
              take: 50,
            });
            const matched = products
              .filter(
                (p) =>
                  p.sku.toLowerCase().includes(keyword) ||
                  p.name.toLowerCase().includes(keyword) ||
                  (p.description ?? '').toLowerCase().includes(keyword),
              )
              .slice(0, 3);

            if (matched.length === 0) return 'Không tìm thấy sản phẩm phù hợp.';

            const result = matched
              .map(
                (p) =>
                  `- ${p.name} (mã ${p.sku}): ${p.price.toLocaleString('vi-VN')}đ, còn ${p.stock} cái. ${p.description ?? ''}`,
              )
              .join('\n');
            void this.logToolCall(conversationId, 'lookup_product', input, result);
            return result;
          } catch (e) {
            this.logger.error(`lookup_product failed: ${(e as Error).message}`);
            return 'Không tra cứu được sản phẩm lúc này.';
          }
        },
      }),
      tool({
        name: 'lookup_order',
        description:
          'Tra cứu trạng thái đơn hàng theo mã đơn (VD: DH12345). Trả về trạng thái hiện tại và thời gian giao dự kiến.',
        inputSchema: z.object({
          orderId: z.string().describe('Mã đơn hàng (VD: DH12345)'),
        }),
        callback: async (input: { orderId: string }) => {
          const orderCode = input.orderId.trim().toUpperCase();
          if (!orderCode) return 'Vui lòng nhập mã đơn hàng cần tra cứu.';
          try {
            const order = await this.prisma.order.findUnique({ where: { orderCode } });
            if (!order) return `Không tìm thấy đơn hàng ${orderCode}.`;

            const statusText: Record<string, string> = {
              pending: 'đang chờ xử lý',
              processing: 'đang xử lý',
              shipping: 'đang giao hàng',
              delivered: 'đã giao thành công',
              cancelled: 'đã hủy',
            };
            const eta = order.estimatedDelivery
              ? ` Dự kiến giao: ${order.estimatedDelivery.toLocaleDateString('vi-VN')}.`
              : '';
            const result = `Đơn hàng ${order.orderCode} (${order.customerName}): ${statusText[order.status] ?? order.status}.${order.carrier ? ` Đơn vị vận chuyển: ${order.carrier}.` : ''}${eta}`;
            void this.logToolCall(conversationId, 'lookup_order', input, result);
            return result;
          } catch (e) {
            this.logger.error(`lookup_order failed: ${(e as Error).message}`);
            return 'Không tra cứu được đơn hàng lúc này.';
          }
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

            const result = matched.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');
            void this.logToolCall(conversationId, 'lookup_faq', input, result);
            return result;
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
  private getAgent(conversationId: string, systemPrompt: string, history: GenerateReplyArgs['history']): Agent {
    const existing = this.agents.get(conversationId);
    if (existing) {
      this.agentLastUsed.set(conversationId, Date.now());
      return existing;
    }

    const model = new OpenAIModel({
      modelId: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      apiKey: process.env.OPENAI_API_KEY,
      temperature: 0.4,
      maxTokens: 1024,
    });

    const agent = new Agent({
      model,
      tools: this.buildTools(conversationId),
      systemPrompt,
      printer: false,
    });

    // Seed conversation history so the agent has context from the start.
    // Preserve the real role (customer → user, bot/staff → assistant) so the
    // model can tell who said what.
    const seed: ChatHistoryMessage[] = history
      .filter((line) => line.content.trim())
      .map((line) => ({ role: line.role, content: [{ type: 'textBlock', text: line.content }] }));
    (agent.messages as ChatHistoryMessage[]).push(...seed);

    this.agents.set(conversationId, agent);
    this.agentLastUsed.set(conversationId, Date.now());

    // Bound on agent count: evict the least-recently-used agent (LRU), not the oldest-inserted.
    if (this.agents.size > 500) {
      let lruKey: string | undefined;
      let lruTime = Infinity;
      for (const [key, t] of this.agentLastUsed) {
        if (t < lruTime) {
          lruTime = t;
          lruKey = key;
        }
      }
      if (lruKey) {
        this.agents.delete(lruKey);
        this.agentLastUsed.delete(lruKey);
      }
    }
    return agent;
  }

  /**
   * Generate a reply for a conversation using the Strands agent.
   */
  async generateReply(args: GenerateReplyArgs): Promise<string | null> {
    const settings = await this.settings.getAll();
    const tone = settings.ai_tone ?? 'Thân thiện, lịch sự, xưng hô dạ/ạ với khách hàng.';

    const systemPrompt = `Bạn là trợ lý CSKH của shop, tên là Omni Bot.
- Ngôn ngữ: tiếng Việt. Giọng điệu: ${tone}
- Khách hàng: ${args.customerName}
- Trả lời ngắn gọn, tự nhiên, đúng trọng tâm câu hỏi.
- Dùng tool để tra cứu sản phẩm/đơn hàng/FAQ khi cần.
- KHÔNG hứa hẹn điều gì ngoài chính sách của shop.
- Nếu không chắc chắn hoặc khách yêu cầu điều ngoài phạm vi, trả lời là sẽ chuyển cho nhân viên hỗ trợ.`;

    const agent = this.getAgent(args.conversationId, systemPrompt, args.history);
    const last = args.history[args.history.length - 1];
    const prompt = `Khách vừa nhắn: "${last?.content ?? ''}". Hãy trả lời khách.`;

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
}

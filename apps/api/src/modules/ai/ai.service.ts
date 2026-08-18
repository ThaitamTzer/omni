import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StrandsAgentService } from './strands/strands-agent.service';
import { LangGraphWorkflow } from './langgraph/workflow';

export interface AiDecision {
  intent: string;
  confidence: number;
  action: 'reply' | 'escalate' | 'skip';
  replyText?: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly strands: StrandsAgentService,
    private readonly workflow: LangGraphWorkflow,
  ) {}

  /**
   * Main entry: run the AI pipeline for one conversation.
   * Orchestrates LangGraph (classification + decision) and Strands (reply generation).
   */
  async processConversation(conversationId: string, pageId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { page: true },
    });
    if (!conversation || conversation.deletedAt || !conversation.aiEnabled) return;

    // --- Rate limit: global per-hour cap (across all pages) ---
    const settings = await this.getAiSettings();
    const maxPerHour = Number(settings.ai_max_replies_per_hour ?? 10);
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const repliesThisHour = await this.prisma.agentLog.count({
      where: { event: 'reply_sent', createdAt: { gte: hourAgo } },
    });
    if (repliesThisHour >= maxPerHour) {
      await this.logAgentEvent(conversationId, 'rate_limited', { reason: 'global_hourly_cap', maxPerHour });
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { status: 'pending' },
      });
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
      await this.logAgentEvent(conversationId, 'rate_limited', { reason: 'conversation_cap', maxPerConv: perConvMax });
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { status: 'pending' },
      });
      this.logger.warn(`Per-conversation AI limit hit (${convReplies}/${perConvMax}) — escalated ${conversationId}`);
      return;
    }

    const history = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 40,
    });

    // 1) LangGraph decides what to do
    const decision = await this.workflow.run({
      conversationId,
      history: history.map((m: { senderType: string; text: string | null }) => ({
        role: m.senderType === 'CUSTOMER' ? 'user' : 'assistant',
        content: m.text ?? '',
      })),
      settings,
    });
    await this.logAgentEvent(conversationId, 'decision', decision);

    if (decision.action === 'skip') return;

    if (decision.action === 'escalate') {
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { status: 'pending' },
      });
      this.logger.log(`Conversation ${conversationId} escalated to human`);
      return;
    }

    // 2) Strands generates the actual reply (with tools)
    const reply = await this.strands.generateReply({
      pageId,
      conversationId,
      customerName: conversation.customerName,
      history: history.map((m: { text: string | null }) => m.text ?? '').filter(Boolean),
      decision,
    });

    if (!reply) {
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { status: 'pending' },
      });
      return;
    }

    // 3) Send the reply via Messenger and store it
    await this.strands.sendReplyAndStore(pageId, conversation, reply);
    await this.logAgentEvent(conversationId, 'reply_sent', { text: reply });

    // 4) Count the reply for rate limiting
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        aiReplyCount: windowExpired ? 1 : conversation.aiReplyCount + 1,
        aiReplyWindowStart: windowStart && !windowExpired ? windowStart : new Date(),
      },
    });
  }

  private async getAiSettings() {
    const rows = await this.prisma.setting.findMany();
    return Object.fromEntries(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
  }

  private async logAgentEvent(conversationId: string, event: string, payload: unknown) {
    await this.prisma.agentLog.create({
      data: { conversationId, event, payload: payload as object },
    });
  }
}

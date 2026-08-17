import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async list(query: { status?: string; pageId?: string; search?: string; limit?: number }) {
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.pageId) where.pageId = query.pageId;
    if (query.search) {
      where.OR = [
        { customerName: { contains: query.search, mode: 'insensitive' } },
        { lastMessagePreview: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const limit = Math.min(Number(query.limit ?? 50), 200);

    const conversations = await this.prisma.conversation.findMany({
      where,
      include: { page: { select: { id: true, name: true } } },
      orderBy: { lastMessageAt: 'desc' },
      take: limit,
    });

    return conversations.map((c: {
      id: string;
      pageId: string;
      page: { id: string; name: string };
      fbConversationId: string;
      customerName: string;
      customerFbId: string | null;
      status: string;
      aiEnabled: boolean;
      assignedStaffId: string | null;
      lastMessageAt: Date | null;
      lastMessagePreview: string | null;
      unreadCount: number;
      updatedAt: Date;
    }) => ({
      id: c.id,
      pageId: c.pageId,
      pageName: c.page.name,
      fbConversationId: c.fbConversationId,
      customerName: c.customerName,
      customerFbId: c.customerFbId,
      status: c.status,
      aiEnabled: c.aiEnabled,
      assignedStaffId: c.assignedStaffId,
      lastMessageAt: c.lastMessageAt,
      lastMessagePreview: c.lastMessagePreview,
      unreadCount: c.unreadCount,
      updatedAt: c.updatedAt,
    }));
  }

  async getMessages(conversationId: string) {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async markRead(conversationId: string) {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 },
    });
  }

  async setAiEnabled(conversationId: string, enabled: boolean) {
    const conv = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { aiEnabled: enabled },
    });
    this.realtime.emitConversationUpdate(conversationId, { aiEnabled: enabled });
    return conv;
  }

  async takeOver(conversationId: string, staffId: string) {
    const conv = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { assignedStaffId: staffId, aiEnabled: false, status: 'open' },
    });
    this.realtime.emitConversationUpdate(conversationId, { assignedStaffId: staffId, aiEnabled: false });
    return conv;
  }

  async close(conversationId: string) {
    const conv = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'closed' },
    });
    this.realtime.emitConversationUpdate(conversationId, { status: 'closed' });
    return conv;
  }
}

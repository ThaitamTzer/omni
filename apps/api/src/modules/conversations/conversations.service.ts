import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

type ConversationRow = Prisma.ConversationGetPayload<{
  include: { page: { select: { id: true; name: true } } };
}>;

function toDto(c: ConversationRow) {
  const { page, ...rest } = c;
  return { ...rest, pageName: page.name };
}

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async list(query: { status?: string; pageId?: string; search?: string; limit?: number }) {
    const where: Record<string, unknown> = { deletedAt: null };
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

    return conversations.map(toDto);
  }

  async listDeleted() {
    const conversations = await this.prisma.conversation.findMany({
      where: { deletedAt: { not: null } },
      include: { page: { select: { id: true, name: true } } },
      orderBy: { deletedAt: 'desc' },
    });

    return conversations.map(toDto);
  }

  private async findActiveOrThrow(conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv || conv.deletedAt) throw new NotFoundException('Conversation not found');
    return conv;
  }

  private async findAnyOrThrow(conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    return conv;
  }

  async getMessages(conversationId: string) {
    await this.findActiveOrThrow(conversationId);
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async markRead(conversationId: string) {
    await this.findActiveOrThrow(conversationId);
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 },
    });
  }

  async setAiEnabled(conversationId: string, enabled: boolean) {
    await this.findActiveOrThrow(conversationId);
    const conv = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { aiEnabled: enabled },
    });
    this.realtime.emitConversationUpdate(conversationId, { aiEnabled: enabled });
    return conv;
  }

  async takeOver(conversationId: string, staffId: string) {
    await this.findActiveOrThrow(conversationId);
    const conv = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { assignedStaffId: staffId, aiEnabled: false, status: 'open' },
    });
    this.realtime.emitConversationUpdate(conversationId, { assignedStaffId: staffId, aiEnabled: false });
    return conv;
  }

  async close(conversationId: string) {
    await this.findActiveOrThrow(conversationId);
    const conv = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'closed' },
    });
    this.realtime.emitConversationUpdate(conversationId, { status: 'closed' });
    return conv;
  }

  async softDelete(conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv || conv.deletedAt) return { id: conversationId };
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { deletedAt: new Date() },
    });
    this.realtime.emitConversationDeleted(conversationId);
    return { id: updated.id };
  }

  async bulkSoftDelete(ids: string[]) {
    const result = await this.prisma.conversation.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    for (const id of ids) this.realtime.emitConversationDeleted(id);
    return { count: result.count };
  }

  async bulkRestore(ids: string[]) {
    const result = await this.prisma.conversation.updateMany({
      where: { id: { in: ids }, deletedAt: { not: null } },
      data: { deletedAt: null, unreadCount: 0 },
    });
    for (const id of ids) this.realtime.emitConversationRestored(id);
    return { count: result.count };
  }

  async bulkPermanentDelete(ids: string[]) {
    const result = await this.prisma.conversation.deleteMany({
      where: { id: { in: ids } },
    });
    for (const id of ids) this.realtime.emitConversationDeleted(id);
    return { count: result.count };
  }

  async restore(conversationId: string) {
    await this.findAnyOrThrow(conversationId);
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { deletedAt: null, unreadCount: 0 },
    });
    this.realtime.emitConversationRestored(conversationId);
    return { id: updated.id };
  }

  async permanentDelete(conversationId: string) {
    await this.prisma.conversation.delete({
      where: { id: conversationId },
    });
    this.realtime.emitConversationDeleted(conversationId);
    return { id: conversationId };
  }
}

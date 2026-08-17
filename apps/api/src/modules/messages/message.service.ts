import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { MessengerService } from '../messenger/messenger.service';
import { InboundMessage, InboundDeliveryEvent } from '../webhook/inbound-message';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly messenger: MessengerService,
    @InjectQueue('ai-replies') private readonly aiQueue: Queue,
  ) {}

  /**
   * Persist an inbound message (customer or page echo), find-or-create the
   * conversation, update counters, notify the dashboard, then enqueue AI
   * processing for customer messages.
   */
  async processInbound(msg: InboundMessage): Promise<void> {
    const page = await this.prisma.page.findUnique({ where: { fbPageId: msg.pageFbId } });
    if (!page) return;

    const isEcho = msg.sender === 'page';

    // Find or create conversation (unique per page + customer)
    let conversation = await this.prisma.conversation.findUnique({
      where: { pageId_fbConversationId: { pageId: page.id, fbConversationId: msg.customerFbId } },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          pageId: page.id,
          fbConversationId: msg.customerFbId,
          customerFbId: msg.customerFbId,
          customerName: `Khách ${msg.customerFbId.slice(-4)}`,
          status: 'open',
          aiEnabled: true,
          lastMessageAt: new Date(),
        },
      });
      this.logger.log(`New conversation ${conversation.id} for customer ${msg.customerFbId}`);
    }

    const text = msg.text ?? '';
    const saved = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: isEcho ? 'AGENT' : 'CUSTOMER',
        senderId: isEcho ? page.id : msg.customerFbId,
        fbMessageId: msg.externalId || null,
        text: text || null,
        attachments: (msg.attachments as unknown as object[]) ?? [],
        isSent: isEcho,
        deliveredAt: isEcho ? new Date() : undefined,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: text.slice(0, 160) || '[Hình ảnh/tệp]',
        ...(isEcho ? {} : { unreadCount: { increment: 1 } }),
        status: conversation.status === 'closed' ? 'open' : conversation.status,
      },
    });

    this.realtime.emitNewMessage(conversation.id, saved);
    this.realtime.emitConversationUpdate(conversation.id, { status: 'open' });

    // Enqueue AI processing for customer messages
    if (!isEcho && conversation.aiEnabled) {
      await this.aiQueue.add(
        'process-conversation',
        { conversationId: conversation.id, pageId: page.id, customerFbId: msg.customerFbId },
        { attempts: 3, backoff: { type: 'exponential', delay: 3000 }, removeOnComplete: 200 },
      );
    }
  }

  /**
   * Mark messages as delivered based on a delivery event (maps fb page → local page).
   */
  async markDeliveredFromEvent(event: InboundDeliveryEvent): Promise<void> {
    if (!event.mids.length) return;
    const page = await this.prisma.page.findUnique({ where: { fbPageId: event.pageFbId } });
    if (!page) return;
    await this.prisma.message.updateMany({
      where: { fbMessageId: { in: event.mids } },
      data: { deliveredAt: new Date() },
    });
  }

  /**
   * Send a message as a staff member (human) — used by the dashboard.
   */
  async sendStaffMessage(staffId: string, conversationId: string, text: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { page: true },
    });
    if (!conversation || !conversation.customerFbId) throw new Error('Conversation not found');
    if (!text?.trim()) throw new Error('Message text is required');

    const messageId = await this.messenger.sendText(conversation.pageId, conversation.customerFbId, text);

    const saved = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: 'STAFF',
        senderId: staffId,
        fbMessageId: messageId,
        text,
        isSent: !!messageId,
        deliveredAt: messageId ? null : undefined,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: text.slice(0, 160),
        unreadCount: 0,
      },
    });

    this.realtime.emitNewMessage(conversation.id, saved);
    return saved;
  }
}

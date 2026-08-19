import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { MessengerService } from '../../messenger/messenger.service';

@Injectable()
export class ReplyService {
  private readonly logger = new Logger(ReplyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly messenger: MessengerService,
  ) {}

  /**
   * Gửi reply qua Messenger + lưu Message + cập nhật conversation + realtime.
   * Dùng chung cho cả rule reply lẫn agent reply.
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
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: text.slice(0, 160),
      },
    });

    this.realtime.emitNewMessage(conversation.id, saved);
  }
}

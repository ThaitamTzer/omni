import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { AgentLogService } from './agent-log.service';

@Injectable()
export class HandoffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly logs: AgentLogService,
  ) {}

  /**
   * Bàn giao hội thoại cho nhân viên: set status pending + log reason + realtime.
   * (Không tạo ticket — chưa có model Ticket, phase sau.)
   */
  async handoff(conversationId: string, reasonCode: string, detail?: unknown): Promise<void> {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'pending' },
    });
    await this.logs.log(conversationId, 'handoff', { reasonCode, detail });
    this.realtime.emitConversationUpdate(conversationId, { status: 'pending' });
  }
}

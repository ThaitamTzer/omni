import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AgentLogsService {
  constructor(private readonly prisma: PrismaService) {}

  /** List AI audit logs for a conversation (or all, when no conversationId). */
  async list(conversationId?: string, take = 100) {
    return this.prisma.agentLog.findMany({
      where: conversationId ? { conversationId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(take, 1), 500),
    });
  }
}

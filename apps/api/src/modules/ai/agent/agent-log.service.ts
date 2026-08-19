import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Ghi AgentLog (audit AI) dùng chung. Mọi event đều fire-and-forget —
 * lỗi log không bao giờ chặn luồng AI.
 */
@Injectable()
export class AgentLogService {
  private readonly logger = new Logger(AgentLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(conversationId: string, event: string, payload: unknown): Promise<void> {
    try {
      await this.prisma.agentLog.create({
        data: {
          conversationId,
          event,
          payload: payload as object,
        },
      });
    } catch (e) {
      this.logger.warn(`AgentLog write failed: ${(e as Error).message}`);
    }
  }

  logToolCall(conversationId: string, tool: string, args: unknown, result: string): Promise<void> {
    return this.log(conversationId, 'tool_lookup', { tool, args, result: result.slice(0, 500) });
  }

  logModelCall(
    conversationId: string,
    data: { model: string; latencyMs: number; steps?: number },
  ): Promise<void> {
    return this.log(conversationId, 'model_call', data);
  }

  logToolResult(conversationId: string, tool: string, result: string): Promise<void> {
    return this.log(conversationId, 'tool_result', { tool, result: result.slice(0, 500) });
  }

  logPolicyDecision(
    conversationId: string,
    data: { verdict: 'REPLY' | 'HANDOFF'; reasonCode?: string; steps: number },
  ): Promise<void> {
    return this.log(conversationId, 'policy_decision', data);
  }

  logError(conversationId: string, message: string): Promise<void> {
    return this.log(conversationId, 'error', { message: message.slice(0, 500) });
  }
}

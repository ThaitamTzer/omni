import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { AiService } from './ai.service';
import { ConversationLock } from './agent/conversation-lock';

export interface AiJobData {
  conversationId: string;
  pageId: string;
}

@Processor('ai-replies')
export class AiProcessor extends WorkerHost {
  private readonly logger = new Logger(AiProcessor.name);

  constructor(
    private readonly aiService: AiService,
    private readonly lock: ConversationLock,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const data = job.data as AiJobData;

    // Conversation lock — chống 2 job cùng hội thoại chạy chồng.
    // Không acquire được → skip (tin mới sẽ enqueue job mới).
    const acquired = await this.lock.acquire(data.conversationId);
    if (!acquired) {
      this.logger.log(`Conversation ${data.conversationId} already processing — skip`);
      return;
    }

    try {
      await this.aiService.processConversation(data.conversationId, data.pageId);
    } catch (e) {
      this.logger.error(`AI processing failed: ${(e as Error).message}`);
      throw e;
    } finally {
      await this.lock.release(data.conversationId);
    }
  }
}

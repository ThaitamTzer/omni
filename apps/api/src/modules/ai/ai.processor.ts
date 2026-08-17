import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { AiService } from './ai.service';

export interface AiJobData {
  conversationId: string;
  pageId: string;
}

@Processor('ai-replies')
export class AiProcessor extends WorkerHost {
  private readonly logger = new Logger(AiProcessor.name);

  constructor(private readonly aiService: AiService) {
    super();
  }

  async process(job: Job): Promise<void> {
    const data = job.data as AiJobData;
    try {
      await this.aiService.processConversation(data.conversationId, data.pageId);
    } catch (e) {
      this.logger.error(`AI processing failed: ${(e as Error).message}`);
      throw e;
    }
  }
}

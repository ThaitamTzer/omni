import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessageService } from '../messages/message.service';
import {
  WebhookInboundAdapter,
  MessengerWebhookPayload,
} from './webhook-inbound.adapter';
import { InboundMessage } from './inbound-message';

@Processor('webhook-events')
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messageService: MessageService,
    private readonly inbound: WebhookInboundAdapter,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const events = this.inbound.toInternal(job.data as MessengerWebhookPayload);

    for (const event of events) {
      try {
        if ('sender' in event) {
          await this.handleMessage(event);
        } else {
          await this.messageService.markDeliveredFromEvent(event);
        }
      } catch (e) {
        this.logger.error(`Event handling failed: ${(e as Error).message}`);
      }
    }
  }

  private async handleMessage(event: InboundMessage) {
    const page = await this.prisma.page.findUnique({ where: { fbPageId: event.pageFbId } });
    if (!page) {
      this.logger.warn(`Webhook for unregistered page ${event.pageFbId} — ignoring`);
      return;
    }
    await this.messageService.processInbound(event);
  }
}

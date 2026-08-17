import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { WebhookProcessor } from './webhook.processor';
import { WebhookInboundAdapter } from './webhook-inbound.adapter';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [BullModule.registerQueue({ name: 'webhook-events' }), MessagesModule],
  controllers: [WebhookController],
  providers: [WebhookService, WebhookProcessor, WebhookInboundAdapter],
})
export class WebhookModule {}

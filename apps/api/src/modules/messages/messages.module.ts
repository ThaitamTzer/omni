import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MessagesController } from './messages.controller';
import { MessageService } from './message.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'ai-replies' })],
  controllers: [MessagesController],
  providers: [MessageService],
  exports: [MessageService],
})
export class MessagesModule {}

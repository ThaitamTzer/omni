import { Controller, Post, Body, Param } from '@nestjs/common';
import { MessageService } from './message.service';

@Controller('conversations/:conversationId/messages')
export class MessagesController {
  constructor(private readonly messageService: MessageService) {}

  @Post()
  async send(
    @Param('conversationId') conversationId: string,
    @Body() body: { text: string; staffId: string },
  ) {
    return this.messageService.sendStaffMessage(body.staffId, conversationId, body.text);
  }
}

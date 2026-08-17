import { Controller, Get, Query, Param, Patch, Body } from '@nestjs/common';
import { ConversationsService } from './conversations.service';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  list(@Query() query: { status?: string; pageId?: string; search?: string; limit?: string }) {
    return this.conversationsService.list({
      status: query.status,
      pageId: query.pageId,
      search: query.search,
      limit: query.limit ? Number(query.limit) : undefined,
    });
  }

  @Get(':id/messages')
  getMessages(@Param('id') id: string) {
    return this.conversationsService.getMessages(id);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string) {
    return this.conversationsService.markRead(id);
  }

  @Patch(':id/ai')
  setAiEnabled(@Param('id') id: string, @Body() body: { enabled: boolean }) {
    return this.conversationsService.setAiEnabled(id, body.enabled);
  }

  @Patch(':id/takeover')
  takeOver(@Param('id') id: string, @Body() body: { staffId: string }) {
    return this.conversationsService.takeOver(id, body.staffId);
  }

  @Patch(':id/close')
  close(@Param('id') id: string) {
    return this.conversationsService.close(id);
  }
}

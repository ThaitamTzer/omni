import { Controller, Get, Query, Param, Patch, Body, Delete, Post } from '@nestjs/common';
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

  @Get('deleted')
  listDeleted() {
    return this.conversationsService.listDeleted();
  }

  @Post('bulk/delete')
  bulkSoftDelete(@Body() body: { ids: string[] }) {
    return this.conversationsService.bulkSoftDelete(body.ids);
  }

  @Post('bulk/restore')
  bulkRestore(@Body() body: { ids: string[] }) {
    return this.conversationsService.bulkRestore(body.ids);
  }

  @Post('bulk/permanent-delete')
  bulkPermanentDelete(@Body() body: { ids: string[] }) {
    return this.conversationsService.bulkPermanentDelete(body.ids);
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

  @Delete(':id')
  softDelete(@Param('id') id: string) {
    return this.conversationsService.softDelete(id);
  }

  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.conversationsService.restore(id);
  }

  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string) {
    return this.conversationsService.permanentDelete(id);
  }
}

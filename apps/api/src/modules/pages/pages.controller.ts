import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { PagesService } from './pages.service';

@Controller('pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Get()
  list() {
    return this.pagesService.list();
  }

  @Post()
  create(@Body() body: { fbPageId: string; name: string; accessToken: string; verifyToken?: string }) {
    return this.pagesService.create(body);
  }

  @Patch(':id/subscribed')
  setSubscribed(@Param('id') id: string, @Body() body: { subscribed: boolean }) {
    return this.pagesService.setSubscribed(id, body.subscribed);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pagesService.remove(id);
  }
}

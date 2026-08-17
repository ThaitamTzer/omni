import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getAll() {
    return this.settingsService.getAll();
  }

  @Post()
  set(@Body() body: { key: string; value: string }) {
    return this.settingsService.set(body.key, body.value);
  }

  @Get('ai-rules')
  getAiRules() {
    return this.settingsService.getAiRules();
  }

  @Post('ai-rules')
  createAiRule(@Body() body: { name: string; keywords: string[]; responseTemplate?: string; priority?: number }) {
    return this.settingsService.createAiRule(body);
  }

  @Patch('ai-rules/:id')
  toggleAiRule(@Param('id') id: string, @Body() body: { enabled: boolean }) {
    return this.settingsService.toggleAiRule(id, body.enabled);
  }

  @Delete('ai-rules/:id')
  deleteAiRule(@Param('id') id: string) {
    return this.settingsService.deleteAiRule(id);
  }

  @Get('faqs')
  listFaqs() {
    return this.settingsService.listFaqs();
  }

  @Post('faqs')
  createFaq(@Body() body: { question: string; answer: string; keywords: string[]; category?: string; enabled?: boolean }) {
    return this.settingsService.createFaq(body);
  }

  @Patch('faqs/:id')
  updateFaq(
    @Param('id') id: string,
    @Body() body: Partial<{ question: string; answer: string; keywords: string[]; category: string | null; enabled: boolean }>,
  ) {
    return this.settingsService.updateFaq(id, body);
  }

  @Delete('faqs/:id')
  deleteFaq(@Param('id') id: string) {
    return this.settingsService.deleteFaq(id);
  }
}

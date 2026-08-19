import { Controller, Delete, Get, Param, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { KnowledgeService, UploadedFile } from './knowledge.service';

@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Post('files')
  @UseInterceptors(FilesInterceptor('files', 20))
  async upload(@UploadedFiles() files: UploadedFile[]) {
    await this.knowledge.ingestFiles(files ?? []);
    return { ok: true, count: files?.length ?? 0 };
  }

  @Get('files')
  listFiles() {
    return this.knowledge.listFiles();
  }

  @Delete('files/:id')
  async deleteFile(@Param('id') id: string) {
    await this.knowledge.deleteFile(id);
    return { ok: true };
  }
}

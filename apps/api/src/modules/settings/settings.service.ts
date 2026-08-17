import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(): Promise<Record<string, string>> {
    const rows = await this.prisma.setting.findMany();
    return Object.fromEntries(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
  }

  async set(key: string, value: string) {
    return this.prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  async getAiRules() {
    return this.prisma.aiRule.findMany({ orderBy: { priority: 'desc' } });
  }

  async createAiRule(data: { name: string; keywords: string[]; responseTemplate?: string; priority?: number }) {
    return this.prisma.aiRule.create({
      data: {
        name: data.name,
        keywords: data.keywords as unknown as object,
        responseTemplate: data.responseTemplate ?? null,
        priority: data.priority ?? 0,
      },
    });
  }

  async toggleAiRule(id: string, enabled: boolean) {
    return this.prisma.aiRule.update({ where: { id }, data: { enabled } });
  }

  async deleteAiRule(id: string) {
    await this.prisma.aiRule.delete({ where: { id } });
    return { ok: true };
  }

  async listFaqs() {
    return this.prisma.faq.findMany({ orderBy: [{ category: 'asc' }, { createdAt: 'asc' }] });
  }

  async createFaq(data: { question: string; answer: string; keywords: string[]; category?: string; enabled?: boolean }) {
    return this.prisma.faq.create({
      data: {
        question: data.question,
        answer: data.answer,
        keywords: data.keywords as unknown as object,
        category: data.category ?? null,
        enabled: data.enabled ?? true,
      },
    });
  }

  async updateFaq(
    id: string,
    data: Partial<{ question: string; answer: string; keywords: string[]; category: string | null; enabled: boolean }>,
  ) {
    return this.prisma.faq.update({
      where: { id },
      data: {
        ...(data.question !== undefined && { question: data.question }),
        ...(data.answer !== undefined && { answer: data.answer }),
        ...(data.keywords !== undefined && { keywords: data.keywords as unknown as object }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
      },
    });
  }

  async deleteFaq(id: string) {
    await this.prisma.faq.delete({ where: { id } });
    return { ok: true };
  }
}

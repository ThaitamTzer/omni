import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import OpenAI from 'openai';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

/** Minimal shape of a multer-uploaded file (avoids Express.Multer namespace issues). */
export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

// Resolve from the compiled dist/ to the repo root regardless of cwd
// (npm workspace runs with cwd=apps/api).
const UPLOAD_DIR = resolve(__dirname, '../../../../uploads');
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 100;
const EMBEDDING_MODEL = 'text-embedding-3-small';

export type KnowledgeKind = 'text' | 'pdf' | 'docx' | 'xlsx' | 'image';

export interface KnowledgeSearchResult {
  content: string;
  /** KnowledgeFile id chứa chunk (để trích dẫn nguồn). */
  sourceId: string;
  similarity: number;
}

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);
  private readonly openai: OpenAI | null;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const apiKey = config.get('OPENAI_API_KEY');
    this.openai = apiKey ? new OpenAI({ apiKey }) : null;
  }

  // ---------- Upload & processing ----------

  /**
   * Save uploaded files to disk, create KnowledgeFile rows (status=processing),
   * then kick off parse → chunk → embed in the background.
   */
  async ingestFiles(files: UploadedFile[]): Promise<void> {
    await mkdir(UPLOAD_DIR, { recursive: true });

    for (const file of files) {
      const ext = this.detectKind(file.mimetype, file.originalname);
      const savedPath = `${randomUUID()}${this.extensionFor(file.originalname)}`;
      await this.writeFile(join(UPLOAD_DIR, savedPath), file.buffer);

      const record = await this.prisma.knowledgeFile.create({
        data: {
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          path: savedPath,
          kind: ext,
          status: 'processing',
        },
      });

      // Process in background — never block the upload response.
      void this.processFile(record.id, savedPath, ext).catch((e) => {
        this.logger.error(`Knowledge processing failed for ${record.id}: ${(e as Error).message}`);
      });
    }
  }

  private async processFile(fileId: string, path: string, kind: KnowledgeKind): Promise<void> {
    try {
      let text = '';
      if (kind !== 'image') {
        const buffer = await readFile(join(UPLOAD_DIR, path));
        text = await this.parseText(kind, buffer, path);
      }

      // Images have no text to embed; mark ready so the file is usable (vision later).
      if (kind === 'image' || !text.trim()) {
        await this.prisma.knowledgeFile.update({
          where: { id: fileId },
          data: { status: 'ready', error: null },
        });
        return;
      }

      const chunks = this.chunkText(text);
      const vectors = await this.embed(chunks);

      // Prisma can't type Unsupported("vector") columns, so insert via raw SQL.
      await this.prisma.$transaction(
        chunks.map((content, i) =>
          this.prisma.$executeRaw`
            INSERT INTO "KnowledgeChunk" ("id", "fileId", "content", "vector", "createdAt")
            VALUES (${`c_${randomUUID()}`}, ${fileId}, ${content}, ${vectors[i]}::vector, NOW())
          `,
        ),
      );

      await this.prisma.knowledgeFile.update({
        where: { id: fileId },
        data: { status: 'ready', error: null },
      });
    } catch (e) {
      const message = (e as Error).message;
      this.logger.error(`Knowledge parse failed for ${fileId}: ${message}`);
      await this.prisma.knowledgeFile.update({
        where: { id: fileId },
        data: { status: 'failed', error: message.slice(0, 500) },
      });
    }
  }

  private detectKind(mime: string, name: string): KnowledgeKind {
    const lower = name.toLowerCase();
    if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/.test(lower)) return 'image';
    if (mime === 'application/pdf' || lower.endsWith('.pdf')) return 'pdf';
    if (mime.includes('word') || lower.endsWith('.docx')) return 'docx';
    if (mime.includes('spreadsheet') || lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'xlsx';
    return 'text';
  }

  private extensionFor(name: string): string {
    const m = name.match(/\.[a-z0-9]+$/i);
    return m ? m[0].toLowerCase() : '';
  }

  private async writeFile(path: string, buffer: Buffer): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const ws = createWriteStream(path);
      ws.on('finish', resolve);
      ws.on('error', reject);
      ws.end(buffer);
    });
  }

  // ---------- Parsing ----------

  private async parseText(kind: KnowledgeKind, buffer: Buffer, path: string): Promise<string> {
    switch (kind) {
      case 'pdf': {
        const pdf = await import('pdf-parse');
        // pdf-parse@2 exports the parser as the module itself (CJS interop).
        const parser = (pdf as unknown as { default?: (b: Buffer) => Promise<{ text?: string }> }).default ?? (pdf as unknown as (b: Buffer) => Promise<{ text?: string }>);
        const parsed = await parser(buffer);
        return parsed.text ?? '';
      }
      case 'docx': {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      }
      case 'xlsx': {
        const xlsx = await import('xlsx');
        const wb = xlsx.read(buffer, { type: 'buffer' });
        return wb.SheetNames.map((name) => {
          const sheet = wb.Sheets[name];
          return xlsx.utils.sheet_to_csv(sheet);
        }).join('\n');
      }
      default: {
        return buffer.toString('utf-8');
      }
    }
  }

  // ---------- Chunking ----------

  chunkText(text: string): string[] {
    const cleaned = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!cleaned) return [];

    const chunks: string[] = [];
    let start = 0;
    while (start < cleaned.length) {
      let end = Math.min(start + CHUNK_SIZE, cleaned.length);
      // Try to break at a newline/space near the boundary for cleaner chunks.
      if (end < cleaned.length) {
        const boundary = cleaned.lastIndexOf('\n', end);
        const space = cleaned.lastIndexOf(' ', end);
        const cut = Math.max(boundary, space);
        if (cut > start + CHUNK_SIZE / 2) end = cut;
      }
      chunks.push(cleaned.slice(start, end).trim());
      if (end >= cleaned.length) break;
      start = Math.max(end - CHUNK_OVERLAP, start + 1);
    }
    return chunks.filter(Boolean);
  }

  // ---------- Embedding ----------

  private async embed(texts: string[]): Promise<string[]> {
    if (!this.openai) throw new Error('OPENAI_API_KEY not configured — cannot embed');
    const res = await this.openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
    });
    return res.data.map((d) => `[${d.embedding.join(',')}]`);
  }

  // ---------- Retrieval ----------

  /**
   * Semantic search: embed the query, then cosine-search top-K chunks via pgvector.
   */
  async search(query: string, topK = 5): Promise<KnowledgeSearchResult[]> {
    if (!this.openai || !query.trim()) return [];
    const [res] = await this.embed([query]);
    const rows = await this.prisma.$queryRaw<
      Array<{ content: string; sourceId: string; similarity: number }>
    >`
      SELECT content, "fileId" AS "sourceId", 1 - (vector <=> ${res}::vector) AS similarity
      FROM "KnowledgeChunk"
      WHERE vector IS NOT NULL
      ORDER BY vector <=> ${res}::vector
      LIMIT ${topK}
    `;
    return rows
      .filter((r) => r.similarity > 0.3)
      .map((r) => ({ content: r.content, sourceId: r.sourceId, similarity: r.similarity }));
  }

  // ---------- Admin ----------

  async listFiles() {
    return this.prisma.knowledgeFile.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        size: true,
        kind: true,
        status: true,
        error: true,
        createdAt: true,
      },
    });
  }

  async deleteFile(id: string): Promise<void> {
    const file = await this.prisma.knowledgeFile.findUnique({ where: { id } });
    if (!file) return;
    await this.prisma.knowledgeChunk.deleteMany({ where: { fileId: id } });
    await this.prisma.knowledgeFile.delete({ where: { id } });
    await unlink(join(UPLOAD_DIR, file.path)).catch(() => {
      // File may already be gone — ignore.
    });
  }
}

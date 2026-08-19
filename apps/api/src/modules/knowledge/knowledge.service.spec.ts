import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KnowledgeService } from './knowledge.service';

function makeService(overrides: Record<string, unknown> = {}) {
  const prismaMock = {
    knowledgeFile: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), delete: vi.fn() },
    knowledgeChunk: { deleteMany: vi.fn() },
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  };
  const configMock = { get: vi.fn((k: string) => (k === 'OPENAI_API_KEY' ? 'test-key' : undefined)) };
  const service = new KnowledgeService(prismaMock as never, configMock as never);
  // Mock the OpenAI client's embeddings call — service creates it internally.
  (service as unknown as { openai: { embeddings: { create: ReturnType<typeof vi.fn> } } }).openai = {
    embeddings: { create: vi.fn() },
  } as never;
  return { service, prismaMock };
}

describe('KnowledgeService', () => {
  describe('chunkText', () => {
    const { service } = makeService();

    it('tách text dài thành nhiều chunk ~1000 ký tự', () => {
      const text = 'a'.repeat(2500);
      const chunks = service.chunkText(text);
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].length).toBeLessThanOrEqual(1000);
    });

    it('chunk có overlap giữa các phần', () => {
      const text = 'x'.repeat(1800);
      const chunks = service.chunkText(text);
      expect(chunks.length).toBe(2);
      // overlap ~100 ký tự: tổng độ dài > nội dung gốc
      expect(chunks[0].length + chunks[1].length).toBeGreaterThan(1800);
    });

    it('text ngắn → 1 chunk', () => {
      const chunks = service.chunkText('Chính sách đổi trả trong 7 ngày.');
      expect(chunks).toHaveLength(1);
    });

    it('text rỗng/whitespace → []', () => {
      expect(service.chunkText('')).toEqual([]);
      expect(service.chunkText('   \n  ')).toEqual([]);
    });

    it('chunk đầu không vượt quá CHUNK_SIZE kể cả khi có ranh giới dòng', () => {
      const text = 'line one\n' + 'b'.repeat(950) + '\n' + 'c'.repeat(600);
      const chunks = service.chunkText(text);
      expect(chunks.length).toBeGreaterThan(1);
      for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('search', () => {
    it('không gọi embedding khi không có API key', async () => {
      const prismaMock = {
        $queryRaw: vi.fn(),
      };
      const configMock = { get: vi.fn(() => undefined) };
      const service = new KnowledgeService(prismaMock as never, configMock as never);
      const result = await service.search('hello');
      expect(result).toEqual([]);
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });

    it('trả chunk liên quan từ pgvector (similarity > 0.3)', async () => {
      const { service, prismaMock } = makeService();
      const openai = (service as unknown as { openai: { embeddings: { create: ReturnType<typeof vi.fn> } } }).openai;
      openai.embeddings.create.mockResolvedValue({
        data: [{ embedding: Array(1536).fill(0.01) }],
      });
      prismaMock.$queryRaw.mockResolvedValue([
        { content: 'Chính sách bảo hành 12 tháng', similarity: 0.85 },
        { content: 'nội dung không liên quan', similarity: 0.1 },
      ]);
      const result = await service.search('bảo hành bao lâu?');
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Chính sách bảo hành 12 tháng');
      expect(prismaMock.$queryRaw).toHaveBeenCalled();
    });
  });
});

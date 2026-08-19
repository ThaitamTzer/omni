import { describe, it, expect, vi } from 'vitest';
import { buildTools } from './tools';
import type { ToolDeps } from './tools';
import type { AgentRuntimeContext } from './runtime-context';

/** Cast tool union type để gọi invoke trong test (type quá phức tạp). */
type InvokableTool = {
  invoke: (input: unknown, cfg?: unknown) => Promise<unknown>;
};

const ctx: AgentRuntimeContext = {
  pageId: 'page-1',
  conversationId: 'conv-1',
  customerFbId: 'fb-customer-1',
  customerName: 'Khách A',
  settings: {},
};

function makeDeps(overrides: Record<string, unknown> = {}): ToolDeps {
  return {
    prisma: {
      product: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'p1', sku: 'TSHIRT', name: 'Áo thun trắng', price: 199000, stock: 10, description: 'Áo cotton', active: true, createdAt: new Date() },
          { id: 'p2', sku: 'QUAN', name: 'Quần jean', price: 399000, stock: 5, description: 'Quần denim', active: true, createdAt: new Date() },
        ]),
      },
      order: {
        findFirst: vi.fn(),
      },
    } as never,
    knowledge: {
      search: vi.fn().mockResolvedValue([
        { content: 'Chính sách bảo hành 12 tháng', sourceId: 'kb-file-1', similarity: 0.85 },
      ]),
    } as never,
    logs: {
      logToolCall: vi.fn(),
      logToolResult: vi.fn(),
    } as never,
    ...overrides,
  };
}

describe('buildTools', () => {
  it('tạo đủ 3 tools', () => {
    const tools = buildTools(makeDeps());
    expect(tools).toHaveLength(3);
    const names = tools.map((t) => t.name);
    expect(names).toContain('search_products');
    expect(names).toContain('get_order');
    expect(names).toContain('search_knowledge');
  });

  it('search_products: filter theo keyword và trả cấu trúc documents', async () => {
    const deps = makeDeps();
    const [searchProducts] = buildTools(deps);
    const result = await (searchProducts as unknown as {
      invoke: (input: unknown, cfg?: unknown) => Promise<unknown>;
    }).invoke({ keyword: 'áo' }, { context: ctx } as never);
    expect(result).toEqual({
      documents: [
        expect.objectContaining({ sku: 'TSHIRT', name: 'Áo thun trắng', price: 199000, stock: 10 }),
      ],
    });
    expect(deps.logs.logToolCall).toHaveBeenCalledWith(
      'conv-1',
      'search_products',
      { keyword: 'áo' },
      expect.stringContaining('TSHIRT'),
    );
  });

  it('get_order: chỉ trả đơn của đúng customerFbId (scope)', async () => {
    const deps = makeDeps({
      prisma: {
        product: { findMany: vi.fn().mockResolvedValue([]) },
        order: {
          findFirst: vi.fn().mockResolvedValue({
            orderCode: 'DH12345',
            status: 'shipping',
            carrier: 'GHN',
            estimatedDelivery: new Date(),
            items: [],
          }),
        },
      },
    });
    const [, getOrder] = buildTools(deps);
    const result = await (getOrder as unknown as InvokableTool).invoke(
      { orderId: 'DH12345' },
      { context: ctx } as never,
    );
    expect(result).toMatchObject({ found: true, order: { orderCode: 'DH12345', status: 'shipping' } });
    // Assert scope được truyền vào query
    const findFirstMock = (deps.prisma as never as { order: { findFirst: ReturnType<typeof vi.fn> } }).order.findFirst;
    expect(findFirstMock).toHaveBeenCalledWith({
      where: { orderCode: 'DH12345', customerFbId: 'fb-customer-1' },
    });
  });

  it('get_order: đơn không tồn tại của khách → found false', async () => {
    const deps = makeDeps({
      prisma: {
        product: { findMany: vi.fn().mockResolvedValue([]) },
        order: { findFirst: vi.fn().mockResolvedValue(null) },
      },
    });
    const [, getOrder] = buildTools(deps);
    const result = await (getOrder as unknown as InvokableTool).invoke(
      { orderId: 'DH999' },
      { context: ctx } as never,
    );
    expect(result).toEqual({ found: false });
  });

  it('search_knowledge: trả documents với sourceId + score, có log', async () => {
    const deps = makeDeps();
    const tools = buildTools(deps);
    const searchKnowledge = tools[2];
    const result = await (searchKnowledge as unknown as InvokableTool).invoke(
      { query: 'bảo hành bao lâu' },
      { context: ctx } as never,
    );
    expect(result).toEqual({
      documents: [
        { content: 'Chính sách bảo hành 12 tháng', sourceId: 'kb-file-1', score: 0.85 },
      ],
    });
    expect(deps.logs.logToolCall).toHaveBeenCalledWith(
      'conv-1',
      'search_knowledge',
      { query: 'bảo hành bao lâu' },
      expect.stringContaining('kb-file-1'),
    );
  });
});

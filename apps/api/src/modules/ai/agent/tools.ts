import { tool } from 'langchain';
import { z } from 'zod';
import type { PrismaService } from '../../prisma/prisma.service';
import type { KnowledgeService } from '../../knowledge/knowledge.service';
import type { AgentLogService } from './agent-log.service';
import type { AgentRuntimeContext } from './runtime-context';
import { AGENT_LIMITS, withTimeout } from './guardrails';

export interface ToolDeps {
  prisma: PrismaService;
  knowledge: KnowledgeService;
  logs: AgentLogService;
}

/** Cắt chuỗi dài (tool result giới hạn context). */
function truncate(s: string | null | undefined, max = 200): string {
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/**
 * Xây tools LangChain cho agent CSKH.
 * - Scope (pageId/customerFbId) do backend inject qua `runtime.context`
 *   (contextSchema của createAgent) — model KHÔNG truyền scope.
 * - Tool trả object có cấu trúc (documents/order), không phải chuỗi.
 * - Mọi tool call ghi AgentLog `tool_lookup`.
 */
export function buildTools({ prisma, knowledge, logs }: ToolDeps) {
  const searchProducts = tool(
    async ({ keyword }, runtime) => {
      const ctx = runtime.context as AgentRuntimeContext;
      const products = await withTimeout(
        prisma.product.findMany({
          where: { active: true },
          orderBy: { createdAt: 'asc' },
          take: 50,
        }),
        AGENT_LIMITS.toolTimeoutMs,
        'search_products',
      );
      const matched = products
        .filter(
          (p) =>
            p.sku.toLowerCase().includes(keyword.toLowerCase()) ||
            p.name.toLowerCase().includes(keyword.toLowerCase()) ||
            (p.description ?? '').toLowerCase().includes(keyword.toLowerCase()),
        )
        .slice(0, 3);
      const result = {
        documents: matched.map((p) => ({
          productId: p.id,
          sku: p.sku,
          name: p.name,
          price: p.price,
          stock: p.stock,
          description: truncate(p.description),
        })),
      };
      void logs.logToolCall(ctx.conversationId, 'search_products', { keyword }, JSON.stringify(result));
      void logs.logToolResult(ctx.conversationId, 'search_products', JSON.stringify(result));
      return result;
    },
    {
      name: 'search_products',
      description:
        'Tra cứu sản phẩm trong kho theo từ khóa (tên/mã). Trả về giá, tồn kho, mô tả.',
      schema: z.object({ keyword: z.string().describe('Từ khóa tìm kiếm sản phẩm') }),
    },
  );

  const getOrder = tool(
    async ({ orderId }, runtime) => {
      const ctx = runtime.context as AgentRuntimeContext;
      // BẮT BUỘC filter theo customerFbId — chỉ trả đơn của chính khách đang hỏi
      const order = await withTimeout(
        prisma.order.findFirst({
          where: { orderCode: orderId.trim().toUpperCase(), customerFbId: ctx.customerFbId },
        }),
        AGENT_LIMITS.toolTimeoutMs,
        'get_order',
      );
      if (!order) return { found: false };
      const result = {
        found: true,
        order: {
          orderCode: order.orderCode,
          status: order.status,
          carrier: order.carrier,
          estimatedDelivery: order.estimatedDelivery,
          items: order.items,
        },
      };
      void logs.logToolCall(ctx.conversationId, 'get_order', { orderId }, JSON.stringify(result));
      void logs.logToolResult(ctx.conversationId, 'get_order', JSON.stringify(result));
      return result;
    },
    {
      name: 'get_order',
      description:
        'Tra cứu đơn hàng theo mã đơn (VD: DH12345). Chỉ trả đơn của chính khách đang hỏi.',
      schema: z.object({ orderId: z.string().describe('Mã đơn hàng (VD: DH12345)') }),
    },
  );

  const searchKnowledge = tool(
    async ({ query }, runtime) => {
      const ctx = runtime.context as AgentRuntimeContext;
      const results = await withTimeout(
        knowledge.search(query, 5),
        AGENT_LIMITS.toolTimeoutMs,
        'search_knowledge',
      );
      const docs = results.map((r) => ({
        content: truncate(r.content, 1000),
        sourceId: r.sourceId ?? 'kb',
        score: r.similarity,
      }));
      void logs.logToolCall(ctx.conversationId, 'search_knowledge', { query }, JSON.stringify(docs));
      void logs.logToolResult(ctx.conversationId, 'search_knowledge', JSON.stringify(docs));
      return { documents: docs };
    },
    {
      name: 'search_knowledge',
      description:
        'Tra cứu knowledgebase (chính sách, bảo hành, hướng dẫn...) theo câu hỏi.',
      // Lưu ý: không khai báo field optional trong schema — OpenAI strict mode
      // yêu cầu mọi key trong required; categories chưa dùng nên bỏ hẳn.
      schema: z.object({ query: z.string().describe('Câu hỏi/cụm từ cần tra cứu') }),
    },
  );

  return [searchProducts, getOrder, searchKnowledge];
}

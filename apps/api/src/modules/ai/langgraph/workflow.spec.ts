import { describe, it, expect, vi } from 'vitest';
import { LangGraphWorkflow } from './workflow';
import type { AiModelConfig } from '../ai.config';

const config: AiModelConfig = {
  chatModel: 'gpt-4o-mini',
  classifyModel: 'gpt-4o-mini',
  temperature: 0.2,
  timeoutMs: 20000,
  maxRetries: 2,
};

/** LLM classifier mock mặc định — trả unknown để test regex-first. */
function makeWorkflow(classifyImpl?: (input: { text: string }) => Promise<{ intent: string; band: 'high' | 'medium' | 'low' }>) {
  return new LangGraphWorkflow(
    config,
    classifyImpl
      ? (input: { text: string; config: AiModelConfig }) => classifyImpl(input)
      : undefined,
  );
}

const run = (workflow: LangGraphWorkflow, text: string) =>
  workflow.run({
    conversationId: 'test',
    history: [{ role: 'user', content: text }],
    settings: {},
  });

const runWithRules = (workflow: LangGraphWorkflow, text: string, rules: Array<Record<string, unknown>>) =>
  workflow.run({
    conversationId: 'test',
    history: [{ role: 'user', content: text }],
    settings: {},
    aiRules: rules as never,
  });

describe('LangGraphWorkflow v2', () => {
  it('price question → RUN_AGENT + intent price', async () => {
    const w = makeWorkflow();
    const d = await run(w, 'Áo thun này giá bao nhiêu ạ?');
    expect(d.intent).toBe('price');
    expect(d.confidenceBand).toBe('high');
    expect(d.action).toBe('RUN_AGENT');
  });

  it('order tracking → RUN_AGENT', async () => {
    const w = makeWorkflow();
    const d = await run(w, 'Cho em hỏi đơn hàng DH12345 giao khi nào ạ?');
    expect(d.intent).toBe('order');
    expect(d.action).toBe('RUN_AGENT');
  });

  it('escalate keyword → HANDOFF', async () => {
    const w = makeWorkflow();
    const d = await run(w, 'Dịch vụ của shop tệ quá, tôi muốn khiếu nại!');
    expect(d.intent).toBe('escalate');
    expect(d.action).toBe('HANDOFF');
    expect(d.reasonCode).toBe('escalate_keyword');
  });

  it('unknown/low-confidence → RUN_AGENT (agent thử, không HANDOFF mù)', async () => {
    const w = makeWorkflow();
    const d = await run(w, 'xyz qwerty');
    expect(d.intent).toBe('unknown');
    expect(d.confidenceBand).toBe('low');
    expect(d.action).toBe('RUN_AGENT');
  });

  it('REGRESSION: follow-up questions sau greeting vẫn được xử lý (RUN_AGENT)', async () => {
    const w = makeWorkflow();
    const cases = [
      'tên gì vậy em',
      'em làm việc từ giờ nào đến giờ nào?',
      'có ai đang online không',
      'bạn tên là gì ?',
      'mình muốn mua đồ thì liên hệ ai ?',
    ];
    for (const text of cases) {
      const d = await run(w, text);
      expect(d.action, `"${text}" should go to agent`).toBe('RUN_AGENT');
    }
  });

  it('greeting → RUN_AGENT', async () => {
    const w = makeWorkflow();
    const d = await run(w, 'Chào shop, cho em hỏi chút');
    expect(d.intent).toBe('greeting');
    expect(d.action).toBe('RUN_AGENT');
  });

  it('shipping → RUN_AGENT', async () => {
    const w = makeWorkflow();
    const d = await run(w, 'Giao hàng nội thành mất bao lâu vậy?');
    expect(d.intent).toBe('shipping');
    expect(d.action).toBe('RUN_AGENT');
  });

  it('matching AiRule → RULE_REPLY + matchedRuleId + reply (no LLM)', async () => {
    const w = makeWorkflow();
    const d = await runWithRules(w, 'giá áo thun bao nhiêu vậy?', [
      { id: 'rule-1', name: 'Hỏi giá', keywords: ['giá', 'bao nhiêu'], responseTemplate: 'Dạ, giá sản phẩm là 299.000đ ạ.', enabled: true, priority: 1 },
    ]);
    expect(d.action).toBe('RULE_REPLY');
    expect(d.reply).toBe('Dạ, giá sản phẩm là 299.000đ ạ.');
    expect(d.matchedRuleId).toBe('rule-1');
    expect(d.reasonCode).toBe('rule_match');
  });

  it('disabled rule → ignored, RUN_AGENT', async () => {
    const w = makeWorkflow();
    const d = await runWithRules(w, 'giá áo thun bao nhiêu vậy?', [
      { id: 'rule-1', name: 'Hỏi giá', keywords: ['giá'], responseTemplate: 'Dạ giá là...', enabled: false, priority: 1 },
    ]);
    expect(d.reply).toBeUndefined();
    expect(d.action).toBe('RUN_AGENT');
    expect(d.intent).toBe('price');
  });

  it('higher priority rule wins when multiple match', async () => {
    const w = makeWorkflow();
    const d = await runWithRules(w, 'hoàn tiền đơn DH12345', [
      { id: 'r1', name: 'Hoàn tiền', keywords: ['hoàn tiền'], responseTemplate: 'Dạ shop sẽ hỗ trợ hoàn tiền ạ.', enabled: true, priority: 5 },
      { id: 'r2', name: 'Tra đơn', keywords: ['đơn'], responseTemplate: 'Đơn đang giao ạ.', enabled: true, priority: 1 },
    ]);
    expect(d.reply).toBe('Dạ shop sẽ hỗ trợ hoàn tiền ạ.');
    expect(d.matchedRuleId).toBe('r1');
  });

  it('refund keyword escalates → HANDOFF', async () => {
    const w = makeWorkflow();
    const d = await run(w, 'Tôi muốn hoàn tiền đơn hàng');
    expect(d.intent).toBe('escalate');
    expect(d.action).toBe('HANDOFF');
  });

  it('legal threat escalates → HANDOFF', async () => {
    const w = makeWorkflow();
    const d = await run(w, 'Tôi sẽ báo công an nếu không giải quyết');
    expect(d.action).toBe('HANDOFF');
  });

  it('product question → RUN_AGENT', async () => {
    const w = makeWorkflow();
    const d = await run(w, 'Còn hàng size L không ạ?');
    expect(d.intent).toBe('product');
    expect(d.action).toBe('RUN_AGENT');
  });

  it('faq question → RUN_AGENT', async () => {
    const w = makeWorkflow();
    const d = await run(w, 'Chính sách đổi trả của shop thế nào?');
    expect(d.intent).toBe('faq');
    expect(d.action).toBe('RUN_AGENT');
  });

  it('thanks → RUN_AGENT', async () => {
    const w = makeWorkflow();
    const d = await run(w, 'Cảm ơn shop nhiều nha');
    expect(d.intent).toBe('thanks');
    expect(d.action).toBe('RUN_AGENT');
  });

  describe('hybrid classifier', () => {
    it('regex chắc (price) → KHÔNG gọi LLM classifier', async () => {
      const llm = vi.fn().mockResolvedValue({ intent: 'price', band: 'high' });
      const w = makeWorkflow(llm);
      const d = await run(w, 'giá bao nhiêu?');
      expect(d.intent).toBe('price');
      expect(llm).not.toHaveBeenCalled();
    });

    it('unknown → gọi LLM classifier, dùng kết quả LLM', async () => {
      const llm = vi.fn().mockResolvedValue({ intent: 'order', band: 'high' });
      const w = makeWorkflow(llm);
      const d = await run(w, 'đơn em đâu rồi');
      // 'đơn' match regex order 0.9 → regex-first. Dùng text thật không match:
      // 'em chưa thấy hàng' → unknown → LLM
      const d2 = await run(w, 'em chưa thấy hàng đâu');
      expect(llm).toHaveBeenCalledWith(expect.objectContaining({ text: 'em chưa thấy hàng đâu' }));
      expect(d2.intent).toBe('order');
      expect(d2.action).toBe('RUN_AGENT');
    });

    it('LLM classifier lỗi → fallback RUN_AGENT (intent unknown)', async () => {
      const llm = vi.fn().mockRejectedValue(new Error('timeout'));
      const w = makeWorkflow(llm);
      const d = await run(w, 'em chưa thấy hàng đâu');
      expect(d.intent).toBe('unknown');
      expect(d.action).toBe('RUN_AGENT');
      expect(d.confidenceBand).toBe('low');
    });

    it('LLM classify ra escalate → HANDOFF', async () => {
      const llm = vi.fn().mockResolvedValue({ intent: 'escalate', band: 'high' });
      const w = makeWorkflow(llm);
      const d = await run(w, 'em chưa thấy hàng đâu');
      expect(d.intent).toBe('escalate');
      expect(d.action).toBe('HANDOFF');
    });
  });
});

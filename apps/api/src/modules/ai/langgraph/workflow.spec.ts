import { describe, it, expect, beforeAll, vi } from 'vitest';
import { LangGraphWorkflow } from './workflow';

describe('LangGraphWorkflow', () => {
  let workflow: LangGraphWorkflow;

  const knowledgeMock = {
    search: vi.fn().mockResolvedValue([]),
  };

  beforeAll(() => {
    workflow = new LangGraphWorkflow(knowledgeMock as never);
  });

  const run = (text: string) =>
    workflow.run({
      conversationId: 'test',
      history: [{ role: 'user', content: text }],
      settings: {},
    });

  const runWithRules = (text: string, rules: Array<Record<string, unknown>>) =>
    workflow.run({
      conversationId: 'test',
      history: [{ role: 'user', content: text }],
      settings: {},
      aiRules: rules as never,
    });

  it('classifies price questions as reply', async () => {
    const d = await run('Áo thun này giá bao nhiêu ạ?');
    expect(d.intent).toBe('price');
    expect(d.confidence).toBeGreaterThanOrEqual(0.7);
    expect(d.action).toBe('reply');
  });

  it('classifies order tracking as reply', async () => {
    const d = await run('Cho em hỏi đơn hàng DH12345 giao khi nào ạ?');
    expect(d.intent).toBe('order');
    expect(d.action).toBe('reply');
  });

  it('escalates complaints', async () => {
    const d = await run('Dịch vụ của shop tệ quá, tôi muốn khiếu nại!');
    expect(d.intent).toBe('escalate');
    expect(d.action).toBe('escalate');
  });

  it('unknown/low-confidence messages → LLM tries to reply (not escalated)', async () => {
    const d = await run('xyz qwerty');
    expect(d.intent).toBe('unknown');
    expect(d.confidence).toBeLessThan(0.7);
    expect(d.action).toBe('reply');
  });

  it('REGRESSION: follow-up questions after greeting are still replied', async () => {
    // Real customer messages from production logs — these were escalated
    // because they don't match any regex pattern, leaving the AI silent
    // after the first reply.
    const cases = [
      'tên gì vậy em',
      'em làm việc từ giờ nào đến giờ nào?',
      'có ai đang online không',
      'bạn tên là gì ?',
      'mình muốn mua đồ thì liên hệ ai ?',
    ];
    for (const text of cases) {
      const d = await run(text);
      expect(d.action, `"${text}" should be replied by LLM`).toBe('reply');
    }
  });

  it('RAG: reply action → retrieveKB node fetches knowledge for last user message', async () => {
    knowledgeMock.search.mockResolvedValue([{ content: 'Chính sách bảo hành 12 tháng', similarity: 0.85 }]);
    const d = await workflow.run({
      conversationId: 'test',
      history: [{ role: 'user', content: 'Bảo hành bao lâu vậy?' }],
      settings: {},
    });
    expect(knowledgeMock.search).toHaveBeenCalledWith('Bảo hành bao lâu vậy?', 5);
    expect(d.knowledge).toEqual([{ content: 'Chính sách bảo hành 12 tháng', similarity: 0.85 }]);
  });

  it('RAG: escalate action → no knowledge retrieval', async () => {
    knowledgeMock.search.mockClear();
    const d = await run('Tôi muốn khiếu nại!');
    expect(d.action).toBe('escalate');
    expect(knowledgeMock.search).not.toHaveBeenCalled();
  });

  it('classifies greetings as reply', async () => {
    const d = await run('Chào shop, cho em hỏi chút');
    expect(d.intent).toBe('greeting');
    expect(d.action).toBe('reply');
  });

  it('classifies shipping questions as reply', async () => {
    const d = await run('Giao hàng nội thành mất bao lâu vậy?');
    expect(d.intent).toBe('shipping');
    expect(d.action).toBe('reply');
  });

  it('TH#13: matching AiRule → returns template as replyText (no LLM)', async () => {
    const d = await runWithRules('giá áo thun bao nhiêu vậy?', [
      { name: 'Hỏi giá', keywords: ['giá', 'bao nhiêu'], responseTemplate: 'Dạ, giá sản phẩm là 299.000đ ạ.', enabled: true, priority: 1 },
    ]);
    expect(d.action).toBe('reply');
    expect(d.replyText).toBe('Dạ, giá sản phẩm là 299.000đ ạ.');
  });

  it('TH#13: disabled rule → ignored, falls back to classify', async () => {
    const d = await runWithRules('giá áo thun bao nhiêu vậy?', [
      { name: 'Hỏi giá', keywords: ['giá'], responseTemplate: 'Dạ giá là...', enabled: false, priority: 1 },
    ]);
    expect(d.replyText).toBeUndefined();
    expect(d.action).toBe('reply');
    expect(d.intent).toBe('price');
  });

  it('TH#13: higher priority rule wins when multiple match', async () => {
    const d = await runWithRules('hoàn tiền đơn DH12345', [
      { name: 'Hoàn tiền', keywords: ['hoàn tiền'], responseTemplate: 'Dạ shop sẽ hỗ trợ hoàn tiền ạ.', enabled: true, priority: 5 },
      { name: 'Tra đơn', keywords: ['đơn'], responseTemplate: 'Đơn đang giao ạ.', enabled: true, priority: 1 },
    ]);
    expect(d.replyText).toBe('Dạ shop sẽ hỗ trợ hoàn tiền ạ.');
  });

  it('TH#11: refund keyword escalates', async () => {
    const d = await run('Tôi muốn hoàn tiền đơn hàng');
    expect(d.intent).toBe('escalate');
    expect(d.action).toBe('escalate');
  });

  it('TH#11: legal threat escalates', async () => {
    const d = await run('Tôi sẽ báo công an nếu không giải quyết');
    expect(d.action).toBe('escalate');
  });

  it('TH#14: product question → reply', async () => {
    const d = await run('Còn hàng size L không ạ?');
    expect(d.intent).toBe('product');
    expect(d.action).toBe('reply');
  });

  it('TH#14: faq question → reply', async () => {
    const d = await run('Chính sách đổi trả của shop thế nào?');
    expect(d.intent).toBe('faq');
    expect(d.action).toBe('reply');
  });

  it('TH#14: thanks → reply', async () => {
    const d = await run('Cảm ơn shop nhiều nha');
    expect(d.intent).toBe('thanks');
    expect(d.action).toBe('reply');
  });
});

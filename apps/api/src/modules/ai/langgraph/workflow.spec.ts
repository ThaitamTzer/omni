import { describe, it, expect, beforeAll } from 'vitest';
import { LangGraphWorkflow } from './workflow';

describe('LangGraphWorkflow', () => {
  let workflow: LangGraphWorkflow;

  beforeAll(() => {
    workflow = new LangGraphWorkflow();
  });

  const run = (text: string) =>
    workflow.run({
      conversationId: 'test',
      history: [{ role: 'user', content: text }],
      settings: {},
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

  it('escalates unknown/low-confidence messages', async () => {
    const d = await run('xyz qwerty');
    expect(d.intent).toBe('unknown');
    expect(d.confidence).toBeLessThan(0.7);
    expect(d.action).toBe('escalate');
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
});

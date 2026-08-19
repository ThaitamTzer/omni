import { describe, it, expect, vi } from 'vitest';
import { withTimeout, AGENT_LIMITS } from './guardrails';

describe('guardrails', () => {
  it('withTimeout: resolve đúng khi trong hạn', async () => {
    const p = Promise.resolve('ok');
    await expect(withTimeout(p, 1000, 'T')).resolves.toBe('ok');
  });

  it('withTimeout: reject TIMEOUT khi quá hạn', async () => {
    vi.useFakeTimers();
    try {
      const p = new Promise<string>(() => {}); // never resolve
      const promise = withTimeout(p, 100, 'TOOL');
      const assertion = expect(promise).rejects.toThrow('TOOL_TIMEOUT');
      vi.advanceTimersByTime(101);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('AGENT_LIMITS có giá trị hợp lệ', () => {
    expect(AGENT_LIMITS.maxModelSteps).toBeGreaterThan(0);
    expect(AGENT_LIMITS.runTimeoutMs).toBeGreaterThan(0);
    expect(AGENT_LIMITS.toolTimeoutMs).toBeLessThan(AGENT_LIMITS.runTimeoutMs);
  });
});

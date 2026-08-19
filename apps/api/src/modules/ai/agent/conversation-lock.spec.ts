import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConversationLock } from './conversation-lock';

describe('ConversationLock', () => {
  let redisMock: { set: ReturnType<typeof vi.fn>; del: ReturnType<typeof vi.fn>; quit: ReturnType<typeof vi.fn> };
  let lock: ConversationLock;

  beforeEach(() => {
    redisMock = {
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      quit: vi.fn().mockResolvedValue(undefined),
    };
    lock = new ConversationLock({ get: vi.fn(() => undefined) } as never);
    // Inject redis mock
    (lock as unknown as { redis: typeof redisMock }).redis = redisMock;
  });

  it('acquire thành công khi Redis set NX trả OK', async () => {
    const ok = await lock.acquire('conv-1');
    expect(ok).toBe(true);
    expect(redisMock.set).toHaveBeenCalledWith('conv-lock:conv-1', '1', 'EX', 60000, 'NX');
  });

  it('acquire false khi Redis trả null (đã có lock)', async () => {
    redisMock.set.mockResolvedValue(null);
    const ok = await lock.acquire('conv-1');
    expect(ok).toBe(false);
  });

  it('Redis lỗi → fail-open (trả true, không chặn luồng)', async () => {
    redisMock.set.mockRejectedValue(new Error('connection lost'));
    const ok = await lock.acquire('conv-1');
    expect(ok).toBe(true);
  });

  it('release gọi del đúng key', async () => {
    await lock.release('conv-1');
    expect(redisMock.del).toHaveBeenCalledWith('conv-lock:conv-1');
  });
});

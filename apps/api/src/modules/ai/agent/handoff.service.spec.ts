import { describe, it, expect, vi } from 'vitest';
import { HandoffService } from './handoff.service';

function makeService() {
  const prismaMock = { conversation: { update: vi.fn().mockResolvedValue({}) } };
  const realtimeMock = { emitConversationUpdate: vi.fn() };
  const logsMock = { log: vi.fn().mockResolvedValue(undefined) };
  const service = new HandoffService(prismaMock as never, realtimeMock as never, logsMock as never);
  return { service, prismaMock, realtimeMock, logsMock };
}

describe('HandoffService', () => {
  it('handoff → set pending + log handoff + realtime', async () => {
    const { service, prismaMock, realtimeMock, logsMock } = makeService();
    await service.handoff('conv-1', 'INSUFFICIENT_KNOWLEDGE', { action: 'HANDOFF' });

    expect(prismaMock.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv-1' },
      data: { status: 'pending' },
    });
    expect(logsMock.log).toHaveBeenCalledWith('conv-1', 'handoff', {
      reasonCode: 'INSUFFICIENT_KNOWLEDGE',
      detail: { action: 'HANDOFF' },
    });
    expect(realtimeMock.emitConversationUpdate).toHaveBeenCalledWith('conv-1', { status: 'pending' });
  });
});

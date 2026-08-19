import { describe, expect, it } from 'vitest';
import { mergeMessages } from '@/lib/utils/mergeMessages';
import type { MessageDto } from '@omni/shared';

function msg(id: string, createdAt: string, text = 'hello'): MessageDto {
  return {
    id,
    conversationId: 'conv-1',
    senderType: 'CUSTOMER',
    senderId: 'fb-1',
    fbMessageId: null,
    text,
    attachments: [],
    isSent: true,
    deliveredAt: null,
    createdAt: new Date(createdAt),
  };
}

describe('mergeMessages', () => {
  it('gộp danh sách mới với cached, dedupe theo id', () => {
    const fresh = [msg('a', '2026-08-19T01:00:00Z'), msg('b', '2026-08-19T02:00:00Z')];
    const cached = [msg('b', '2026-08-19T02:00:00Z'), msg('c', '2026-08-19T03:00:00Z')];

    const merged = mergeMessages(fresh, cached);

    expect(merged.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('giữ tin từ socket khi server refetch chưa có (không shrink danh sách)', () => {
    const fresh = [msg('a', '2026-08-19T01:00:00Z')];
    const cached = [msg('a', '2026-08-19T01:00:00Z'), msg('socket-new', '2026-08-19T01:30:00Z')];

    const merged = mergeMessages(fresh, cached);

    expect(merged.map((m) => m.id)).toContain('socket-new');
    expect(merged).toHaveLength(2);
  });

  it('sort theo createdAt tăng dần', () => {
    const fresh = [msg('late', '2026-08-19T05:00:00Z')];
    const cached = [msg('early', '2026-08-19T01:00:00Z'), msg('mid', '2026-08-19T03:00:00Z')];

    const merged = mergeMessages(fresh, cached);

    expect(merged.map((m) => m.id)).toEqual(['early', 'mid', 'late']);
  });

  it('trả về cached nguyên vẹn khi fresh rỗng', () => {
    const cached = [msg('a', '2026-08-19T01:00:00Z')];
    expect(mergeMessages([], cached)).toHaveLength(1);
  });
});

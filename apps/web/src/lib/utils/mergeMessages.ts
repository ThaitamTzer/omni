import type { MessageDto } from '@omni/shared';

/**
 * Merge danh sách tin nhắn từ server (fresh) với tin đã có trong cache (cached),
 * dedupe theo id và sort theo createdAt tăng dần.
 * Dùng cho cả messagesQuery.select lẫn socket message:new.
 */
export function mergeMessages(fresh: MessageDto[], cached: MessageDto[]): MessageDto[] {
  const merged = [...fresh];
  for (const m of cached) {
    if (!merged.some((x) => x.id === m.id)) merged.push(m);
  }
  merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return merged;
}

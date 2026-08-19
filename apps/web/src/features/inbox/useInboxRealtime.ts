import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { getToken } from '@/lib/api';
import { conversationKeys, messageKeys } from '@/features/inbox/api';
import { mergeMessages } from '@/lib/utils/mergeMessages';
import type { ConversationDto, MessageDto } from '@omni/shared';
import type {
  ConversationTypingEvent,
  ConversationUpdateEvent,
  MessageNewEvent,
} from '@/features/inbox/realtimeEvents';

interface UseInboxRealtimeOptions {
  /** Callback khi có sự kiện typing (trang tự so với selectedId hiện tại). */
  onTyping: (conversationId: string, typing: boolean) => void;
}

/**
 * Kết nối socket.io và đẩy event realtime vào query cache.
 * Tách khỏi component để InboxPage chỉ cần gọi hook này.
 */
export function useInboxRealtime({ onTyping }: UseInboxRealtimeOptions) {
  const queryClient = useQueryClient();
  const onTypingRef = useRef(onTyping);
  onTypingRef.current = onTyping;

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL as string | undefined;
    const socket: Socket = wsUrl
      ? io(wsUrl, { auth: { token: getToken() } })
      : io({ auth: { token: getToken() } });

    socket.on('conversation:update', (payload: ConversationUpdateEvent) => {
      queryClient.setQueryData<ConversationDto[]>(conversationKeys.all, (old) => {
        const list = old ?? [];
        if (!list.some((c) => c.id === payload.conversationId)) {
          // Unknown conversation (e.g. newly created) — pull the full list
          queryClient.invalidateQueries({ queryKey: conversationKeys.all });
          return list;
        }
        return list.map((c) => (c.id === payload.conversationId ? { ...c, ...payload } : c));
      });
    });

    socket.on('conversation:deleted', (payload: { conversationId: string }) => {
      queryClient.setQueryData<ConversationDto[]>(conversationKeys.all, (old) =>
        (old ?? []).filter((c) => c.id !== payload.conversationId),
      );
    });

    socket.on('conversation:restored', () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
      queryClient.invalidateQueries({ queryKey: conversationKeys.deleted });
    });

    socket.on('message:new', (payload: MessageNewEvent) => {
      queryClient.setQueryData<ConversationDto[]>(conversationKeys.all, (old) => {
        const list = old ?? [];
        const exists = list.some((c) => c.id === payload.conversationId);
        if (!exists) {
          // New conversation arrived — refetch so we get the full DTO (pageName, etc.)
          queryClient.invalidateQueries({ queryKey: conversationKeys.all });
          return list;
        }
        return list.map((c) =>
          c.id === payload.conversationId
            ? {
                ...c,
                lastMessagePreview: payload.message.text?.slice(0, 160) ?? '[Hình ảnh/tệp]',
                lastMessageAt: payload.message.createdAt,
              }
            : c,
        );
      });
      queryClient.setQueryData<MessageDto[]>(messageKeys.of(payload.conversationId), (old) => {
        if (old && old.some((m) => m.id === payload.message.id)) return old;
        return mergeMessages([payload.message], old ?? []);
      });
    });

    socket.on('conversation:typing', (payload: ConversationTypingEvent) => {
      onTypingRef.current(payload.conversationId, payload.typing);
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient]);

  return null;
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { mergeMessages } from '@/lib/utils/mergeMessages';
import type { ConversationDto, MessageDto } from '@omni/shared';

// ---- Query keys (định danh duy nhất cho cache, dùng ở query + mutation + realtime) ----
export const conversationKeys = {
  all: ['conversations'] as const,
  deleted: ['conversations', 'deleted'] as const,
};

export const messageKeys = {
  all: ['messages'] as const,
  of: (conversationId: string) => ['messages', conversationId] as const,
};

// ---- Queries ----
export function useConversationsQuery() {
  return useQuery({
    queryKey: conversationKeys.all,
    queryFn: () => api.get<ConversationDto[]>('/conversations'),
  });
}

export function useDeletedConversationsQuery(enabled: boolean) {
  return useQuery({
    queryKey: conversationKeys.deleted,
    queryFn: () => api.get<ConversationDto[]>('/conversations/deleted'),
    enabled,
  });
}

export function useMessagesQuery(conversationId: string | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: messageKeys.of(conversationId ?? ''),
    queryFn: () => api.get<MessageDto[]>(`/conversations/${conversationId}/messages`),
    enabled: !!conversationId,
    // Server may lag behind realtime cache; never shrink the list when a refetch
    // returns fewer messages than what we already have from socket updates.
    placeholderData: (prev) => prev,
    select: (fresh) => {
      const cached =
        queryClient.getQueryData<MessageDto[]>(messageKeys.of(conversationId ?? '')) ?? [];
      return mergeMessages(fresh, cached);
    },
  });
}

// ---- Mutations ----
const invalidateConversations = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: conversationKeys.all });
};

const invalidateDeleted = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: conversationKeys.deleted });
};

export function useSendMessage(conversationId: string | null, staffId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ text }: { text: string }) =>
      api.post<MessageDto>(`/conversations/${conversationId}/messages`, { text, staffId }),
    onSuccess: (saved) => {
      queryClient.setQueryData<MessageDto[]>(messageKeys.of(conversationId ?? ''), (old) =>
        old && old.some((m) => m.id === saved.id) ? old : [...(old ?? []), saved],
      );
      invalidateConversations(queryClient);
    },
  });
}

export function useToggleAi() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, enabled }: { conversationId: string; enabled: boolean }) =>
      api.patch(`/conversations/${conversationId}/ai`, { enabled }),
    onSuccess: () => invalidateConversations(queryClient),
  });
}

export function useTakeOver(staffId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) =>
      api.patch(`/conversations/${conversationId}/takeover`, { staffId }),
    onSuccess: () => invalidateConversations(queryClient),
  });
}

export function useCloseConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => api.patch(`/conversations/${conversationId}/close`, {}),
    onSuccess: () => invalidateConversations(queryClient),
  });
}

export function useSoftDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => api.del(`/conversations/${conversationId}`),
    onSuccess: () => {
      invalidateConversations(queryClient);
      invalidateDeleted(queryClient);
    },
  });
}

export function useRestore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => api.post(`/conversations/${conversationId}/restore`, {}),
    onSuccess: () => {
      invalidateConversations(queryClient);
      invalidateDeleted(queryClient);
    },
  });
}

export function usePermanentDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => api.del(`/conversations/${conversationId}/permanent`),
    onSuccess: () => invalidateDeleted(queryClient),
  });
}

export function useBulkSoftDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.post(`/conversations/bulk/delete`, { ids }),
    onSuccess: () => {
      invalidateConversations(queryClient);
      invalidateDeleted(queryClient);
    },
  });
}

export function useBulkRestore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.post(`/conversations/bulk/restore`, { ids }),
    onSuccess: () => {
      invalidateConversations(queryClient);
      invalidateDeleted(queryClient);
    },
  });
}

export function useBulkPermanentDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.post(`/conversations/bulk/permanent-delete`, { ids }),
    onSuccess: () => invalidateDeleted(queryClient),
  });
}

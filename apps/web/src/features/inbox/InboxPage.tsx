import { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useStaff } from '@/lib/auth/authStore';
import { api } from '@/lib/api';
import { useToast } from '@/lib/hooks/useToast';
import {
  useConversationsQuery,
  useDeletedConversationsQuery,
  useMessagesQuery,
  useSendMessage,
  useToggleAi,
  useTakeOver,
  useCloseConversation,
  useSoftDelete,
  useRestore,
  usePermanentDelete,
  useBulkSoftDelete,
  useBulkRestore,
  useBulkPermanentDelete,
} from '@/features/inbox/api';
import { useInboxRealtime } from '@/features/inbox/useInboxRealtime';
import ConversationList from '@/features/inbox/components/ConversationList';
import ChatPane, { type PendingMessage } from '@/features/inbox/components/ChatPane';
import ConfirmDialogs from '@/features/inbox/components/ConfirmDialogs';
import Toast from '@/components/Toast';
import type { ConversationDto } from '@omni/shared';

export default function InboxPage() {
  const { t } = useTranslation();
  const staff = useStaff();
  const { showToast, toastProps } = useToast();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [confirmDeleteForever, setConfirmDeleteForever] = useState<ConversationDto | null>(null);
  const [confirmBulkDeleteForever, setConfirmBulkDeleteForever] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ---- TanStack Query ----
  const conversationsQuery = useConversationsQuery();
  const deletedQuery = useDeletedConversationsQuery(tab === 'deleted');
  const messagesQuery = useMessagesQuery(selectedId);

  // Mark read when opening a conversation
  useEffect(() => {
    if (selectedId) {
      api.patch(`/conversations/${selectedId}/read`, {}).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // ---- Mutations ----
  const sendMessageMutation = useSendMessage(selectedId, staff?.id);
  const toggleAiMutation = useToggleAi();
  const takeOverMutation = useTakeOver(staff?.id);
  const closeConvMutation = useCloseConversation();
  const softDeleteMutation = useSoftDelete();
  const restoreMutation = useRestore();
  const permanentDeleteMutation = usePermanentDelete();
  const bulkSoftDeleteMutation = useBulkSoftDelete();
  const bulkRestoreMutation = useBulkRestore();
  const bulkPermanentDeleteMutation = useBulkPermanentDelete();

  const conversations = conversationsQuery.data ?? [];
  const messages = messagesQuery.data ?? [];
  const deletedConversations = deletedQuery.data ?? [];
  const selected = (tab === 'deleted' ? deletedConversations : conversations).find((c) => c.id === selectedId) ?? null;

  // ---- Realtime socket (updates query cache) ----
  const selectedIdRef = useRef(selectedId);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useInboxRealtime({
    onTyping: (conversationId, isTyping) => {
      setTyping((prev) => (conversationId === selectedIdRef.current ? isTyping : prev));
    },
  });

  // Clear selection when switching tabs (list contents change entirely)
  useEffect(() => {
    setSelectedId(null);
    setSelectedIds(new Set());
  }, [tab]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  // ---- Send (optimistic) ----
  const sendMessage = () => {
    if (!draft.trim() || !selected || !staff) return;
    const text = draft.trim();
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setDraft('');
    setPendingMessages((prev) => [...prev.filter((p) => p.tempId !== tempId), { tempId, text, status: 'sending' }]);
    sendMessageMutation.mutate(
      { text },
      {
        onSuccess: () => {
          setPendingMessages((prev) => prev.filter((p) => p.tempId !== tempId));
        },
        onError: () => {
          setPendingMessages((prev) => prev.map((p) => (p.tempId === tempId ? { ...p, status: 'error' } : p)));
        },
      },
    );
  };

  const retryMessage = (p: PendingMessage) => {
    sendMessageMutation.mutate(
      { text: p.text },
      {
        onSuccess: () => setPendingMessages((prev) => prev.filter((x) => x.tempId !== p.tempId)),
        onError: () => setPendingMessages((prev) => prev.map((x) => (x.tempId === p.tempId ? { ...x, status: 'error' } : x))),
      },
    );
  };

  // ---- Bulk helpers ----
  const bulkDone = (msgFn: (count: number) => string, extra?: () => void) => (_data: unknown, ids: string[]) => {
    showToast(msgFn(ids.length));
    setSelectedIds(new Set());
    setSelectedId(null);
    extra?.();
  };

  const handleSoftDelete = (id: string) => {
    softDeleteMutation.mutate(id, {
      onSuccess: () => {
        showToast(t('inbox.deleted'));
        setSelectedId((cur) => (cur === id ? null : cur));
      },
    });
  };

  const handleRestore = (id: string) => {
    restoreMutation.mutate(id, {
      onSuccess: () => {
        showToast(t('inbox.restored'));
        setSelectedId(null);
      },
    });
  };

  const handlePermanentDelete = (id: string) => {
    permanentDeleteMutation.mutate(id, {
      onSuccess: () => {
        showToast(t('inbox.permanentlyDeleted'));
        setConfirmDeleteForever(null);
        setSelectedId(null);
      },
    });
  };

  const handleBulkSoftDelete = (ids: string[]) => {
    bulkSoftDeleteMutation.mutate(ids, { onSuccess: bulkDone((n) => t('inbox.deletedBulk', { count: n })) });
  };

  const handleBulkRestore = (ids: string[]) => {
    bulkRestoreMutation.mutate(ids, { onSuccess: bulkDone((n) => t('inbox.restoredBulk', { count: n })) });
  };

  const handleBulkPermanentDelete = () => {
    bulkPermanentDeleteMutation.mutate([...selectedIds], {
      onSuccess: bulkDone((n) => t('inbox.permanentlyDeletedBulk', { count: n }), () => setConfirmBulkDeleteForever(false)),
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const listLoading = tab === 'deleted' ? deletedQuery.isLoading : conversationsQuery.isLoading;

  return (
    <Box sx={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <ConversationList
        conversations={conversations}
        deletedConversations={deletedConversations}
        tab={tab}
        onTabChange={setTab}
        search={search}
        onSearchChange={setSearch}
        selectedId={selectedId}
        onSelect={setSelectedId}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={() => {
          setSelectedIds((prev) => {
            const items = tab === 'deleted' ? deletedConversations : conversations;
            const filtered = items.filter((c) =>
              tab === 'deleted' || tab === 'all' ? true : tab === 'pending' ? c.status === 'pending' : c.status === 'open',
            ).filter(
              (c) =>
                !search ||
                c.customerName.toLowerCase().includes(search.toLowerCase()) ||
                (c.lastMessagePreview ?? '').toLowerCase().includes(search.toLowerCase()),
            );
            const ids = filtered.map((c) => c.id);
            const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
            if (allSelected) return new Set<string>();
            return new Set(ids);
          });
        }}
        onClearSelection={() => setSelectedIds(new Set())}
        isLoading={listLoading}
        onSoftDelete={handleSoftDelete}
        onRestore={handleRestore}
        onDeleteForever={setConfirmDeleteForever}
        onBulkSoftDelete={handleBulkSoftDelete}
        onBulkRestore={handleBulkRestore}
        onBulkDeleteForever={() => setConfirmBulkDeleteForever(true)}
        busy={{
          softDelete: softDeleteMutation.isPending,
          restore: restoreMutation.isPending,
          permanentDelete: permanentDeleteMutation.isPending,
          bulkSoftDelete: bulkSoftDeleteMutation.isPending,
          bulkRestore: bulkRestoreMutation.isPending,
          bulkPermanentDelete: bulkPermanentDeleteMutation.isPending,
        }}
      />

      <ChatPane
        selected={selected}
        messages={messages}
        messagesLoading={messagesQuery.isLoading}
        pendingMessages={pendingMessages}
        typing={typing}
        draft={draft}
        onDraftChange={setDraft}
        onSend={sendMessage}
        onRetry={retryMessage}
        onToggleAi={(id, enabled) => toggleAiMutation.mutate({ conversationId: id, enabled })}
        onTakeOver={(id) => takeOverMutation.mutate(id)}
        onCloseConversation={(id) => closeConvMutation.mutate(id)}
        onSoftDelete={handleSoftDelete}
        onRestore={handleRestore}
        onDeleteForever={setConfirmDeleteForever}
        busy={{
          toggleAi: toggleAiMutation.isPending,
          takeOver: takeOverMutation.isPending,
          close: closeConvMutation.isPending,
          softDelete: softDeleteMutation.isPending,
          restore: restoreMutation.isPending,
          permanentDelete: permanentDeleteMutation.isPending,
          send: sendMessageMutation.isPending,
        }}
      />

      <ConfirmDialogs
        confirmDeleteForever={confirmDeleteForever}
        onCloseDeleteForever={() => setConfirmDeleteForever(null)}
        onConfirmDeleteForever={handlePermanentDelete}
        permanentDeletePending={permanentDeleteMutation.isPending}
        confirmBulkDeleteForever={confirmBulkDeleteForever}
        onCloseBulkDeleteForever={() => setConfirmBulkDeleteForever(false)}
        onConfirmBulkDeleteForever={handleBulkPermanentDelete}
        bulkPermanentDeletePending={bulkPermanentDeleteMutation.isPending}
        selectedCount={selectedIds.size}
      />

      <Toast {...toastProps} />
    </Box>
  );
}

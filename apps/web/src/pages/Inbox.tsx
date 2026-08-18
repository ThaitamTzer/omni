import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useTranslation } from 'react-i18next';
import {
  Box,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Typography,
  TextField,
  IconButton,
  InputAdornment,
  Button,
  Chip,
  Stack,
  Tooltip,
  Tabs,
  Tab,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Checkbox,
} from '@mui/material';
import {
  Search,
  Send,
  SmartToy,
  PersonAdd,
  Close,
  DeleteOutline,
  DeleteForever,
  RestoreFromTrash,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getToken } from '../lib/api';
import { useStaff } from '../lib/authStore';
import CustomerAvatar from '../components/CustomerAvatar';
import EmptyState from '../components/EmptyState';
import Toast from '../components/Toast';
import type { ConversationDto, MessageDto } from '@omni/shared';

function formatTime(d: string | Date | null): string {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDay(d: string | Date | null): string {
  if (!d) return '';
  const date = new Date(d);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return formatTime(date);
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

function statusChipColor(status: string): 'info' | 'warning' | 'default' {
  if (status === 'open') return 'info';
  if (status === 'pending') return 'warning';
  return 'default';
}

export default function Inbox() {
  const { t } = useTranslation();
  const staff = useStaff();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [confirmDeleteForever, setConfirmDeleteForever] = useState<ConversationDto | null>(null);
  const [confirmBulkDeleteForever, setConfirmBulkDeleteForever] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState('');
  const [msgError, setMsgError] = useState('');
  const [pendingMessages, setPendingMessages] = useState<
    { tempId: string; text: string; status: 'sending' | 'error' }[]
  >([]);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const showMsg = (ok: string, err?: unknown) => {
    setMsg(ok);
    setMsgError(err ? `Lỗi: ${(err as Error).message}` : '');
  };

  // ---- TanStack Query ----
  const conversationsQuery = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get<ConversationDto[]>('/conversations'),
  });

  const deletedQuery = useQuery({
    queryKey: ['conversations', 'deleted'],
    queryFn: () => api.get<ConversationDto[]>('/conversations/deleted'),
    enabled: tab === 'deleted',
  });

  const messagesQuery = useQuery({
    queryKey: ['messages', selectedId],
    queryFn: () => api.get<MessageDto[]>(`/conversations/${selectedId}/messages`),
    enabled: !!selectedId,
    // Server may lag behind realtime cache; never shrink the list when a refetch
    // returns fewer messages than what we already have from socket updates.
    placeholderData: (prev) => prev,
    select: (fresh) => {
      const cached = queryClient.getQueryData<MessageDto[]>(['messages', selectedId]) ?? [];
      const merged = [...fresh];
      for (const m of cached) {
        if (!merged.some((x) => x.id === m.id)) merged.push(m);
      }
      merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      return merged;
    },
  });

  // Mark read when opening a conversation
  useEffect(() => {
    if (selectedId) {
      api.patch(`/conversations/${selectedId}/read`, {}).catch(() => {});
    }
  }, [selectedId]);

  // ---- Mutations ----
  const invalidateConversations = () => queryClient.invalidateQueries({ queryKey: ['conversations'] });

  const sendMessageMutation = useMutation({
    mutationFn: ({ text }: { text: string; tempId: string }) =>
      api.post<MessageDto>(`/conversations/${selectedId}/messages`, { text, staffId: staff?.id }),
    onMutate: ({ text, tempId }) => {
      setPendingMessages((prev) => [...prev.filter((p) => p.tempId !== tempId), { tempId, text, status: 'sending' }]);
    },
    onSuccess: (saved, { tempId }) => {
      setPendingMessages((prev) => prev.filter((p) => p.tempId !== tempId));
      queryClient.setQueryData<MessageDto[]>(['messages', selectedId], (old) =>
        old && old.some((m) => m.id === saved.id) ? old : [...(old ?? []), saved],
      );
      invalidateConversations();
    },
    onError: (_e, { tempId }) => {
      setPendingMessages((prev) => prev.map((p) => (p.tempId === tempId ? { ...p, status: 'error' } : p)));
    },
  });

  const toggleAiMutation = useMutation({
    mutationFn: ({ conversationId, enabled }: { conversationId: string; enabled: boolean }) =>
      api.patch(`/conversations/${conversationId}/ai`, { enabled }),
    onSuccess: () => invalidateConversations(),
  });

  const takeOverMutation = useMutation({
    mutationFn: (conversationId: string) =>
      api.patch(`/conversations/${conversationId}/takeover`, { staffId: staff?.id }),
    onSuccess: () => invalidateConversations(),
  });

  const closeConvMutation = useMutation({
    mutationFn: (conversationId: string) => api.patch(`/conversations/${conversationId}/close`, {}),
    onSuccess: () => invalidateConversations(),
  });

  const softDeleteMutation = useMutation({
    mutationFn: (conversationId: string) => api.del(`/conversations/${conversationId}`),
    onSuccess: (_data, conversationId) => {
      showMsg(t('inbox.deleted'));
      invalidateConversations();
      queryClient.invalidateQueries({ queryKey: ['conversations', 'deleted'] });
      setSelectedId((cur) => (cur === conversationId ? null : cur));
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (conversationId: string) => api.post(`/conversations/${conversationId}/restore`, {}),
    onSuccess: () => {
      showMsg(t('inbox.restored'));
      invalidateConversations();
      queryClient.invalidateQueries({ queryKey: ['conversations', 'deleted'] });
      setSelectedId(null);
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: (conversationId: string) => api.del(`/conversations/${conversationId}/permanent`),
    onSuccess: () => {
      showMsg(t('inbox.permanentlyDeleted'));
      queryClient.invalidateQueries({ queryKey: ['conversations', 'deleted'] });
      setConfirmDeleteForever(null);
      setSelectedId(null);
    },
  });

  // ---- Bulk mutations ----
  const bulkDone = (msgFn: (count: number) => string, extra?: () => void) => (_data: unknown, ids: string[]) => {
    showMsg(msgFn(ids.length));
    invalidateConversations();
    queryClient.invalidateQueries({ queryKey: ['conversations', 'deleted'] });
    setSelectedIds(new Set());
    setSelectedId(null);
    extra?.();
  };

  const bulkSoftDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.post(`/conversations/bulk/delete`, { ids }),
    onSuccess: bulkDone((n) => t('inbox.deletedBulk', { count: n })),
  });

  const bulkRestoreMutation = useMutation({
    mutationFn: (ids: string[]) => api.post(`/conversations/bulk/restore`, { ids }),
    onSuccess: bulkDone((n) => t('inbox.restoredBulk', { count: n })),
  });

  const bulkPermanentDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.post(`/conversations/bulk/permanent-delete`, { ids }),
    onSuccess: bulkDone((n) => t('inbox.permanentlyDeletedBulk', { count: n }), () => setConfirmBulkDeleteForever(false)),
  });

  const conversations = conversationsQuery.data ?? [];
  const messages = messagesQuery.data ?? [];
  const deletedConversations = deletedQuery.data ?? [];
  const selected = (tab === 'deleted' ? deletedConversations : conversations).find((c) => c.id === selectedId) ?? null;

  // ---- Realtime socket (updates query cache) ----
  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL as string | undefined;
    const socket = wsUrl ? io(wsUrl, { auth: { token: getToken() } }) : io({ auth: { token: getToken() } });
    socketRef.current = socket;

    socket.on('conversation:update', (payload: { conversationId: string }) => {
      queryClient.setQueryData<ConversationDto[]>(['conversations'], (old) => {
        const list = old ?? [];
        if (!list.some((c) => c.id === payload.conversationId)) {
          // Unknown conversation (e.g. newly created) — pull the full list
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          return list;
        }
        return list.map((c) => (c.id === payload.conversationId ? { ...c, ...payload } : c));
      });
    });

    socket.on('conversation:deleted', (payload: { conversationId: string }) => {
      queryClient.setQueryData<ConversationDto[]>(['conversations'], (old) =>
        (old ?? []).filter((c) => c.id !== payload.conversationId),
      );
    });

    socket.on('conversation:restored', () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversations', 'deleted'] });
    });

    socket.on('message:new', (payload: { conversationId: string; message: MessageDto }) => {
      queryClient.setQueryData<ConversationDto[]>(['conversations'], (old) => {
        const list = old ?? [];
        const exists = list.some((c) => c.id === payload.conversationId);
        if (!exists) {
          // New conversation arrived — refetch so we get the full DTO (pageName, etc.)
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          return list;
        }
        return list.map((c) =>
          c.id === payload.conversationId
            ? {
                ...c,
                lastMessagePreview: payload.message.text?.slice(0, 160) ?? t('inbox.imageAttachment'),
                lastMessageAt: payload.message.createdAt,
              }
            : c,
        );
      });
      queryClient.setQueryData<MessageDto[]>(['messages', payload.conversationId], (old) =>
        old && old.some((m) => m.id === payload.message.id) ? old : [...(old ?? []), payload.message],
      );
    });

    socket.on('conversation:typing', (payload: { conversationId: string; typing: boolean }) => {
      setTyping((prev) => (payload.conversationId === selectedIdRef.current ? payload.typing : prev));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [queryClient]);

  // Keep latest selectedId for socket handlers without reconnecting
  const selectedIdRef = useRef(selectedId);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // Clear selection when switching tabs (list contents change entirely)
  useEffect(() => {
    setSelectedId(null);
    setSelectedIds(new Set());
  }, [tab]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = () => {
    if (!draft.trim() || !selected || !staff) return;
    const text = draft.trim();
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setDraft('');
    sendMessageMutation.mutate({ text, tempId });
  };

  const retryMessage = (p: { tempId: string; text: string }) => {
    sendMessageMutation.mutate({ text: p.text, tempId: p.tempId });
  };

  const filtered = conversations
    .filter((c) => (tab === 'all' ? true : tab === 'pending' ? c.status === 'pending' : c.status === 'open'))
    .filter(
      (c) =>
        !search ||
        c.customerName.toLowerCase().includes(search.toLowerCase()) ||
        (c.lastMessagePreview ?? '').toLowerCase().includes(search.toLowerCase()),
    );

  const listLoading = tab === 'deleted' ? deletedQuery.isLoading : conversationsQuery.isLoading;
  const listItems = tab === 'deleted' ? deletedConversations : filtered;

  // ---- Multi-select helpers ----
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const ids = listItems.map((c) => c.id);
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      if (allSelected) return new Set<string>();
      return new Set(ids);
    });
  };

  const selectedCount = selectedIds.size;
  const allSelected = listItems.length > 0 && listItems.every((c) => selectedIds.has(c.id));

  return (
    <Box sx={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {/* Conversation list */}
      <Box
        sx={{
          width: { xs: 0, sm: 280, md: 340 },
          flexShrink: 0,
          bgcolor: 'background.paper',
          borderRight: '1px solid',
          borderColor: 'divider',
          display: { xs: 'none', sm: 'flex' },
          flexDirection: 'column',
        }}
      >
        <Box sx={{ p: 1.5 }}>
          <TextField
            size="small"
            placeholder={t('inbox.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ bgcolor: 'background.default' }}
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', px: 1, minHeight: 36 }}>
          <Checkbox
            size="small"
            checked={allSelected}
            indeterminate={selectedCount > 0 && !allSelected}
            onChange={toggleSelectAll}
            disabled={listItems.length === 0}
            title={t('inbox.selectAll')}
            sx={{ p: 0.5 }}
          />
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            {selectedCount > 0 ? t('inbox.selected', { count: selectedCount }) : t('inbox.selectAll')}
          </Typography>
        </Box>

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ px: 1.5, minHeight: 40, '& .MuiTab-root': { minHeight: 36, fontSize: 13, fontWeight: 600 }, '& .MuiTabs-scrollButtons': { width: 24, '&.Mui-disabled': { opacity: 0.3 } } }}
        >
          <Tab label={t('inbox.all')} value="all" />
          <Tab label={t('inbox.needsHelp')} value="pending" />
          <Tab label={t('inbox.open')} value="open" />
          <Tab label={t('inbox.trash')} value="deleted" />
        </Tabs>

        {selectedCount > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, bgcolor: 'primary.main', color: '#fff' }}>
            <Typography sx={{ fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0 }}>
              {t('inbox.selected', { count: selectedCount })}
            </Typography>
            {tab === 'deleted' ? (
              <>
                <Button size="small" variant="text" sx={{ color: '#fff', fontSize: 12 }} startIcon={<RestoreFromTrash fontSize="small" />} onClick={() => bulkRestoreMutation.mutate([...selectedIds])} disabled={bulkRestoreMutation.isPending}>
                  {t('inbox.bulkRestore')}
                </Button>
                <Button size="small" variant="text" sx={{ color: '#fff', fontSize: 12 }} startIcon={<DeleteForever fontSize="small" />} onClick={() => setConfirmBulkDeleteForever(true)} disabled={bulkPermanentDeleteMutation.isPending}>
                  {t('inbox.bulkDeleteForever')}
                </Button>
              </>
            ) : (
              <Button size="small" variant="text" sx={{ color: '#fff', fontSize: 12 }} startIcon={<DeleteOutline fontSize="small" />} onClick={() => bulkSoftDeleteMutation.mutate([...selectedIds])} disabled={bulkSoftDeleteMutation.isPending}>
                {t('inbox.bulkDelete')}
              </Button>
            )}
            <IconButton size="small" sx={{ color: '#fff' }} onClick={() => setSelectedIds(new Set())}>
              <Close fontSize="small" />
            </IconButton>
          </Box>
        )}

        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {listLoading ? (
            <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
              <CircularProgress size={28} />
            </Box>
          ) : listItems.length === 0 ? (
            <EmptyState
              icon={tab === 'deleted' ? '🗑️' : '💬'}
              title={tab === 'deleted' ? t('inbox.trashEmpty') : search ? t('inbox.notFoundSearch') : t('inbox.noConversations')}
              hint={tab === 'deleted' ? t('inbox.trashEmptyDesc') : search ? t('inbox.notFoundSearchDesc') : t('inbox.noConversationsDesc')}
            />
          ) : (
            <List disablePadding>
              {listItems.map((c) => (
                <ListItemButton
                  key={c.id}
                  selected={c.id === selectedId}
                  onClick={() => setSelectedId(c.id)}
                  sx={{
                    px: 1.25,
                    py: 1,
                    borderRadius: 0,
                    borderLeft: '3px solid transparent',
                    '&.Mui-selected': {
                      bgcolor: '#eff4ff',
                      borderLeftColor: 'primary.main',
                      '&:hover': { bgcolor: '#e4edff' },
                    },
                    '&:hover': { bgcolor: '#f7f8fa' },
                    '& .conv-delete': { opacity: 0, transition: 'opacity 0.15s' },
                    '&:hover .conv-delete': { opacity: 1 },
                  }}
                >
                  <Checkbox
                    size="small"
                    checked={selectedIds.has(c.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleSelect(c.id)}
                    sx={{ p: 0.5, mr: 0.5 }}
                  />
                  <ListItemAvatar sx={{ minWidth: 42 }}>
                    <CustomerAvatar name={c.customerName} avatar={c.customerAvatar} size={36} />
                  </ListItemAvatar>
                  <ListItemText
                    disableTypography
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.customerName}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: 'text.secondary', flexShrink: 0 }}>
                          {formatDay(c.lastMessageAt)}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <Typography sx={{ fontSize: 13, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.lastMessagePreview ?? t('inbox.startConversation')}
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5, gap: 1 }}>
                          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{c.pageName}</Typography>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            {c.aiEnabled && (
                              <Chip
                                size="small"
                                icon={<SmartToy sx={{ fontSize: 13 }} />}
                                label="AI"
                                color="secondary"
                                sx={{ height: 20, fontSize: 10, bgcolor: 'secondary.main', color: 'white', '& .MuiChip-icon': { fontSize: 13 } }}
                              />
                            )}
                            {c.unreadCount > 0 && (
                              <Box
                                sx={{
                                  minWidth: 18,
                                  height: 18,
                                  borderRadius: '50%',
                                  bgcolor: 'primary.main',
                                  color: 'white',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  px: 0.5,
                                }}
                              >
                                {c.unreadCount}
                              </Box>
                            )}
                          </Stack>
                        </Box>
                      </Box>
                    }
                  />
                  {tab === 'deleted' ? (
                    <Stack direction="row" spacing={0.25} className="conv-delete" sx={{ ml: 0.5 }}>
                      <Tooltip title={t('inbox.restore')}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            restoreMutation.mutate(c.id);
                          }}
                          disabled={restoreMutation.isPending}
                        >
                          <RestoreFromTrash fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('inbox.deleteForever')}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteForever(c);
                          }}
                          disabled={permanentDeleteMutation.isPending}
                        >
                          <DeleteForever fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  ) : (
                    <Tooltip title={t('inbox.deleteConversation')}>
                      <IconButton
                        size="small"
                        color="error"
                        className="conv-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          softDeleteMutation.mutate(c.id);
                        }}
                        disabled={softDeleteMutation.isPending}
                        sx={{ ml: 0.5 }}
                      >
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>
      </Box>

      {/* Chat pane */}
      <Box
        sx={{ flex: 1, minWidth: 0, bgcolor: 'background.paper', display: 'flex', flexDirection: 'column' }}
      >
        {!selected ? (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <EmptyState icon="💬" title={t('inbox.selectConversation')} hint={t('inbox.selectConversationDesc')} />
          </Box>
        ) : (
          <>
            {/* Chat header */}
            <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                <CustomerAvatar name={selected.customerName} avatar={selected.customerAvatar} size={36} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{selected.customerName}</Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{selected.pageName}</Typography>
                    <Chip
                      size="small"
                      label={t(`inbox.${selected.status}`)}
                      color={statusChipColor(selected.status)}
                      sx={{ height: 20, fontSize: 11 }}
                    />
                  </Stack>
                </Box>
              </Box>
              <Stack direction="row" spacing={1}>
                {selected.deletedAt ? (
                  <>
                    <Tooltip title={t('inbox.restore')}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<RestoreFromTrash fontSize="small" />}
                        onClick={() => restoreMutation.mutate(selected.id)}
                        disabled={restoreMutation.isPending}
                      >
                        {t('inbox.restore')}
                      </Button>
                    </Tooltip>
                    <Tooltip title={t('inbox.deleteForever')}>
                      <IconButton size="small" color="error" onClick={() => setConfirmDeleteForever(selected)} disabled={permanentDeleteMutation.isPending}>
                        <DeleteForever fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </>
                ) : (
                  <>
                    <Tooltip title={selected.aiEnabled ? t('inbox.aiEnabled') : t('inbox.aiDisabled')}>
                      <Button
                        size="small"
                        variant={selected.aiEnabled ? 'contained' : 'outlined'}
                        startIcon={toggleAiMutation.isPending ? <CircularProgress size={14} /> : <SmartToy fontSize="small" />}
                        onClick={() => toggleAiMutation.mutate({ conversationId: selected.id, enabled: !selected.aiEnabled })}
                        color={selected.aiEnabled ? 'secondary' : 'primary'}
                        disabled={toggleAiMutation.isPending}
                      >
                        AI {selected.aiEnabled ? t('inbox.aiOn') : t('inbox.aiOff')}
                      </Button>
                    </Tooltip>
                    {selected.aiEnabled && (
                      <Tooltip title={t('inbox.takeOver')}>
                        <Button size="small" variant="outlined" startIcon={<PersonAdd fontSize="small" />} onClick={() => takeOverMutation.mutate(selected.id)} disabled={takeOverMutation.isPending}>
                          {t('inbox.takeOver')}
                        </Button>
                      </Tooltip>
                    )}
                    {selected.status !== 'closed' && (
                      <Tooltip title={t('inbox.conversationClosed')}>
                        <IconButton size="small" onClick={() => closeConvMutation.mutate(selected.id)} disabled={closeConvMutation.isPending}>
                          <Close fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title={t('inbox.deleteConversation')}>
                      <IconButton size="small" color="error" onClick={() => softDeleteMutation.mutate(selected.id)} disabled={softDeleteMutation.isPending}>
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </Stack>
            </Box>

            {/* Messages */}
            <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5, bgcolor: 'background.default', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {messagesQuery.isLoading ? (
                <Box sx={{ textAlign: 'center', color: 'text.secondary', py: 6 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : messages.length === 0 ? (
                <EmptyState icon="💬" title={t('inbox.noMessages')} hint={t('inbox.noMessagesDesc')} />
              ) : (
                <>
                  {messages.map((m) => {
                    const isCustomer = m.senderType === 'CUSTOMER';
                    const isAgent = m.senderType === 'AGENT';
                    const isStaff = m.senderType === 'STAFF';
                    return (
                      <Box
                        key={m.id}
                        sx={{
                          display: 'flex',
                          justifyContent: isCustomer ? 'flex-start' : 'flex-end',
                        }}
                      >
                        <Box
                          sx={{
                            maxWidth: '68%',
                            px: 1.25,
                            py: 0.75,
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: isCustomer ? '#d8dce2' : isStaff ? '#9cc0f8' : '#cabffd',
                            bgcolor: isCustomer ? '#f3f4f6' : isStaff ? '#dbeafe' : '#ede9fe',
                            fontSize: 13.5,
                            lineHeight: 1.5,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          <Box
                            sx={{
                              fontSize: 11,
                              fontWeight: 600,
                              mb: 0.25,
                              color: isCustomer ? 'text.secondary' : isStaff ? '#1d4ed8' : '#6d28d9',
                            }}
                          >
                            {isCustomer ? t('inbox.customer') : isStaff ? t('inbox.staff') : 'AI'}
                          </Box>
                          {m.text ?? t('inbox.imageAttachment')}
                          <Box
                            sx={{
                              fontSize: 10.5,
                              color: 'text.secondary',
                              mt: 0.5,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                              justifyContent: isCustomer ? 'flex-start' : 'flex-end',
                            }}
                          >
                            {isAgent && <SmartToy sx={{ fontSize: 11 }} />}
                            {formatTime(m.createdAt)}
                          </Box>
                        </Box>
                      </Box>
                    );
                  })}
                </>
              )}
              {/* Pending (sending / error) messages */}
              {pendingMessages.map((p) => (
                <Box key={p.tempId} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Box
                    sx={{
                      maxWidth: '68%',
                      px: 1.25,
                      py: 0.75,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: p.status === 'error' ? '#f0b8b8' : '#9cc0f8',
                      bgcolor: p.status === 'error' ? '#fef2f2' : '#dbeafe',
                      fontSize: 13.5,
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      opacity: p.status === 'sending' ? 0.75 : 1,
                    }}
                  >
                    <Box sx={{ fontSize: 11, fontWeight: 600, mb: 0.25, color: '#1d4ed8' }}>
                      {t('inbox.staff')}
                    </Box>
                    {p.text}
                    <Box sx={{ fontSize: 10.5, color: 'text.secondary', mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
                      {p.status === 'sending' ? (
                        <>
                          <CircularProgress size={10} />
                          {t('inbox.sending')}
                        </>
                      ) : (
                        <>
                          <Typography sx={{ fontSize: 10.5, color: 'error.main' }}>{t('inbox.errorSend')}</Typography>
                          <Button size="small" sx={{ fontSize: 11, minWidth: 0, px: 0.75, py: 0.25 }} onClick={() => retryMessage(p)}>
                            {t('inbox.retry')}
                          </Button>
                        </>
                      )}
                    </Box>
                  </Box>
                </Box>
              ))}
              {typing && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', fontSize: 12, px: 0.5 }}>
                  <SmartToy sx={{ fontSize: 14 }} />
                  {t('inbox.aiTyping')}
                  <Box sx={{ display: 'inline-flex', gap: 0.4 }}>
                    {[0, 1, 2].map((i) => (
                      <Box
                        key={i}
                        sx={{
                          width: 5,
                          height: 5,
                          borderRadius: '50%',
                          bgcolor: 'text.secondary',
                          animation: `bounce 1.2s ${i * 0.15}s infinite`,
                          '@keyframes bounce': {
                            '0%, 60%, 100%': { transform: 'translateY(0)', opacity: 0.5 },
                            '30%': { transform: 'translateY(-4px)', opacity: 1 },
                          },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
              <div ref={bottomRef} />
            </Box>

            {/* Input */}
            {!selected.deletedAt && (
              <Box sx={{ px: { xs: 1.25, sm: 2.5 }, py: 1.25, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 1, bgcolor: 'background.paper' }}>
                <TextField
                  size="small"
                  placeholder={t('inbox.typeMessage')}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  fullWidth
                  sx={{ bgcolor: 'background.default', '& .MuiInputBase-input': { fontSize: { xs: 14, sm: 13.5 } } }}
                />
                <Button
                  variant="contained"
                  onClick={sendMessage}
                  disabled={!draft.trim() || sendMessageMutation.isPending}
                  sx={{ minWidth: { xs: 44, sm: 90 }, px: { xs: 1, sm: 1.75 } }}
                >
                  {sendMessageMutation.isPending ? (
                    <CircularProgress size={16} />
                  ) : (
                    <>
                      <Send fontSize="small" sx={{ mr: { xs: 0, sm: 0.5 } }} />
                      <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                        {t('inbox.send')}
                      </Box>
                    </>
                  )}
                </Button>
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Delete forever confirmation dialog */}
      <Dialog open={!!confirmDeleteForever} onClose={() => setConfirmDeleteForever(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DeleteForever color="error" />
            <Typography sx={{ fontWeight: 700 }}>{t('inbox.deleteForeverConfirmTitle')}</Typography>
          </Box>
          <IconButton size="small" onClick={() => setConfirmDeleteForever(null)}>
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>
        <Divider />
        <DialogContent>
          {confirmDeleteForever && (
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
              {confirmDeleteForever.customerName}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            {t('inbox.deleteForeverConfirmDesc')}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setConfirmDeleteForever(null)}>{t('pages.cancel')}</Button>
          <Button
            variant="contained"
            color="error"
            startIcon={permanentDeleteMutation.isPending ? <CircularProgress size={14} /> : <DeleteForever fontSize="small" />}
            onClick={() => confirmDeleteForever && permanentDeleteMutation.mutate(confirmDeleteForever.id)}
            disabled={permanentDeleteMutation.isPending}
          >
            {t('inbox.deleteForever')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk delete forever confirmation dialog */}
      <Dialog open={confirmBulkDeleteForever} onClose={() => setConfirmBulkDeleteForever(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DeleteForever color="error" />
            <Typography sx={{ fontWeight: 700 }}>{t('inbox.bulkDeleteForeverConfirmTitle', { count: selectedCount })}</Typography>
          </Box>
          <IconButton size="small" onClick={() => setConfirmBulkDeleteForever(false)}>
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>
        <Divider />
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {t('inbox.bulkDeleteForeverConfirmDesc', { count: selectedCount })}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setConfirmBulkDeleteForever(false)}>{t('pages.cancel')}</Button>
          <Button
            variant="contained"
            color="error"
            startIcon={bulkPermanentDeleteMutation.isPending ? <CircularProgress size={14} /> : <DeleteForever fontSize="small" />}
            onClick={() => bulkPermanentDeleteMutation.mutate([...selectedIds])}
            disabled={bulkPermanentDeleteMutation.isPending || selectedCount === 0}
          >
            {t('inbox.bulkDeleteForever')}
          </Button>
        </DialogActions>
      </Dialog>

      <Toast message={msg} error={msgError} onClose={() => { setMsg(''); setMsgError(''); }} />
    </Box>
  );
}

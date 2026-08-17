import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Paper,
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
} from '@mui/material';
import {
  Search,
  Send,
  SmartToy,
  PersonAdd,
  Close,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getToken } from '../lib/api';
import { useStaff } from '../lib/authStore';
import InitialsAvatar from '../components/InitialsAvatar';
import EmptyState from '../components/EmptyState';
import type { ConversationDto, MessageDto } from '@omni/shared';

const STATUS_LABEL: Record<string, string> = { open: 'open', pending: 'needsHelp', closed: 'closed' };

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
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ---- TanStack Query ----
  const conversationsQuery = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get<ConversationDto[]>('/conversations'),
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
    mutationFn: (text: string) =>
      api.post<MessageDto>(`/conversations/${selectedId}/messages`, { text, staffId: staff?.id }),
    onSuccess: (saved) => {
      queryClient.setQueryData<MessageDto[]>(['messages', selectedId], (old) =>
        old && old.some((m) => m.id === saved.id) ? old : [...(old ?? []), saved],
      );
      invalidateConversations();
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

  const conversations = conversationsQuery.data ?? [];
  const messages = messagesQuery.data ?? [];
  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  // ---- Realtime socket (updates query cache) ----
  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL as string | undefined;
    const socket = wsUrl ? io(wsUrl, { auth: { token: getToken() } }) : io({ auth: { token: getToken() } });
    socketRef.current = socket;

    socket.on('conversation:update', (payload: { conversationId: string }) => {
      queryClient.setQueryData<ConversationDto[]>(['conversations'], (old) =>
        (old ?? []).map((c) => (c.id === payload.conversationId ? { ...c, ...payload } : c)),
      );
    });

    socket.on('message:new', (payload: { conversationId: string; message: MessageDto }) => {
      queryClient.setQueryData<ConversationDto[]>(['conversations'], (old) =>
        (old ?? []).map((c) =>
          c.id === payload.conversationId
            ? {
                ...c,
                lastMessagePreview: payload.message.text?.slice(0, 160) ?? t('inbox.imageAttachment'),
                lastMessageAt: payload.message.createdAt,
              }
            : c,
        ),
      );
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = () => {
    if (!draft.trim() || !selected || !staff) return;
    const text = draft.trim();
    sendMessageMutation.mutate(text, {
      onSuccess: () => setDraft(''),
    });
  };

  const filtered = conversations
    .filter((c) => (tab === 'all' ? true : tab === 'pending' ? c.status === 'pending' : c.status === 'open'))
    .filter(
      (c) =>
        !search ||
        c.customerName.toLowerCase().includes(search.toLowerCase()) ||
        (c.lastMessagePreview ?? '').toLowerCase().includes(search.toLowerCase()),
    );

  const listLoading = conversationsQuery.isLoading;

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 57px)' }}>
      {/* Conversation list */}
      <Paper
        elevation={0}
        sx={{
          width: 340,
          flexShrink: 0,
          borderRight: '1px solid',
          borderColor: 'divider',
          borderRadius: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
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

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 1.5, minHeight: 40, '& .MuiTab-root': { minHeight: 36, fontSize: 13, fontWeight: 600 } }}>
          <Tab label={t('inbox.all')} value="all" />
          <Tab label={t('inbox.needsHelp')} value="pending" />
          <Tab label={t('inbox.open')} value="open" />
        </Tabs>

        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {listLoading ? (
            <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
              <CircularProgress size={28} />
            </Box>
          ) : filtered.length === 0 ? (
            <EmptyState icon="💬" title={search ? t('inbox.notFoundSearch') : t('inbox.noConversations')} hint={search ? t('inbox.notFoundSearchDesc') : t('inbox.noConversationsDesc')} />
          ) : (
            <List disablePadding>
              {filtered.map((c) => (
                <ListItemButton
                  key={c.id}
                  selected={c.id === selectedId}
                  onClick={() => setSelectedId(c.id)}
                  sx={{ px: 1.5, py: 1.25, borderBottom: '1px solid', borderColor: 'divider', borderRadius: 0 }}
                >
                  <ListItemAvatar sx={{ minWidth: 46 }}>
                    <InitialsAvatar name={c.customerName} />
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
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>
      </Paper>

      {/* Chat pane */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!selected ? (
          <EmptyState icon="💬" title={t('inbox.selectConversation')} hint={t('inbox.selectConversationDesc')} />
        ) : (
          <>
            {/* Chat header */}
            <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                <InitialsAvatar name={selected.customerName} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{selected.customerName}</Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{selected.pageName}</Typography>
                    <Chip
                      size="small"
                      label={t(`inbox.${STATUS_LABEL[selected.status]}`)}
                      color={statusChipColor(selected.status)}
                      sx={{ height: 20, fontSize: 11 }}
                    />
                  </Stack>
                </Box>
              </Box>
              <Stack direction="row" spacing={1}>
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
                        px: 1.5,
                        py: 1,
                        borderRadius: 2,
                        bgcolor: isCustomer ? 'background.paper' : isStaff ? 'custom.staffBubble' : 'secondary.main',
                        color: isCustomer ? 'text.primary' : '#fff',
                        borderBottomLeftRadius: isCustomer ? 3 : 10,
                        borderBottomRightRadius: isCustomer ? 10 : 3,
                        boxShadow: 1,
                        fontSize: 14,
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {m.text ?? t('inbox.imageAttachment')}
                      <Box
                        sx={{
                          fontSize: 10,
                          opacity: 0.75,
                          mt: 0.5,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          justifyContent: isCustomer ? 'flex-start' : 'flex-end',
                        }}
                      >
                        {isAgent && <><SmartToy sx={{ fontSize: 11 }} /> AI</>}
                        {isStaff && t('inbox.staffShort')}
                        {formatTime(m.createdAt)}
                      </Box>
                    </Box>
                  </Box>
                );
                  })}
                </>
              )}
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
            <Box sx={{ px: 2.5, py: 1.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 1, bgcolor: 'background.paper' }}>
              <TextField
                size="small"
                placeholder={t('inbox.typeMessage')}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                fullWidth
                sx={{ bgcolor: 'background.default' }}
              />
              <Button variant="contained" onClick={sendMessage} disabled={!draft.trim() || sendMessageMutation.isPending} sx={{ minWidth: 90 }}>
                {sendMessageMutation.isPending ? t('inbox.sending') : (<><Send fontSize="small" sx={{ mr: 0.5 }} /> {t('inbox.send')}</>)}
              </Button>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}

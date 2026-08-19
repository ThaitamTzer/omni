import {
  Box,
  Typography,
  TextField,
  IconButton,
  Button,
  Chip,
  Stack,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Send,
  SmartToy,
  PersonAdd,
  Close,
  DeleteOutline,
  DeleteForever,
  RestoreFromTrash,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import CustomerAvatar from '@/features/inbox/components/CustomerAvatar';
import MessageBubble from '@/features/inbox/components/MessageBubble';
import EmptyState from '@/components/EmptyState';
import type { ConversationDto, MessageDto } from '@omni/shared';

function statusChipColor(status: string): 'info' | 'warning' | 'default' {
  if (status === 'open') return 'info';
  if (status === 'pending') return 'warning';
  return 'default';
}

export interface PendingMessage {
  tempId: string;
  text: string;
  status: 'sending' | 'error';
}

export interface ChatPaneProps {
  selected: ConversationDto | null;
  messages: MessageDto[];
  messagesLoading: boolean;
  pendingMessages: PendingMessage[];
  typing: boolean;
  draft: string;
  onDraftChange: (v: string) => void;
  onSend: () => void;
  onRetry: (p: PendingMessage) => void;
  onToggleAi: (id: string, enabled: boolean) => void;
  onTakeOver: (id: string) => void;
  onCloseConversation: (id: string) => void;
  onSoftDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onDeleteForever: (c: ConversationDto) => void;
  busy: {
    toggleAi?: boolean;
    takeOver?: boolean;
    close?: boolean;
    softDelete?: boolean;
    restore?: boolean;
    permanentDelete?: boolean;
    send?: boolean;
  };
}

export default function ChatPane({
  selected,
  messages,
  messagesLoading,
  pendingMessages,
  typing,
  draft,
  onDraftChange,
  onSend,
  onRetry,
  onToggleAi,
  onTakeOver,
  onCloseConversation,
  onSoftDelete,
  onRestore,
  onDeleteForever,
  busy,
}: ChatPaneProps) {
  const { t } = useTranslation();

  return (
    <Box sx={{ flex: 1, minWidth: 0, bgcolor: 'background.paper', display: 'flex', flexDirection: 'column' }}>
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
                      onClick={() => onRestore(selected.id)}
                      disabled={busy.restore}
                    >
                      {t('inbox.restore')}
                    </Button>
                  </Tooltip>
                  <Tooltip title={t('inbox.deleteForever')}>
                    <IconButton size="small" color="error" onClick={() => onDeleteForever(selected)} disabled={busy.permanentDelete}>
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
                      startIcon={busy.toggleAi ? <CircularProgress size={14} /> : <SmartToy fontSize="small" />}
                      onClick={() => onToggleAi(selected.id, !selected.aiEnabled)}
                      color={selected.aiEnabled ? 'secondary' : 'primary'}
                      disabled={busy.toggleAi}
                    >
                      AI {selected.aiEnabled ? t('inbox.aiOn') : t('inbox.aiOff')}
                    </Button>
                  </Tooltip>
                  {selected.aiEnabled && (
                    <Tooltip title={t('inbox.takeOver')}>
                      <Button size="small" variant="outlined" startIcon={<PersonAdd fontSize="small" />} onClick={() => onTakeOver(selected.id)} disabled={busy.takeOver}>
                        {t('inbox.takeOver')}
                      </Button>
                    </Tooltip>
                  )}
                  {selected.status !== 'closed' && (
                    <Tooltip title={t('inbox.conversationClosed')}>
                      <IconButton size="small" onClick={() => onCloseConversation(selected.id)} disabled={busy.close}>
                        <Close fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title={t('inbox.deleteConversation')}>
                    <IconButton size="small" color="error" onClick={() => onSoftDelete(selected.id)} disabled={busy.softDelete}>
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </Stack>
          </Box>

          {/* Messages */}
          <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5, bgcolor: 'background.default', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {messagesLoading ? (
              <Box sx={{ textAlign: 'center', color: 'text.secondary', py: 6 }}>
                <CircularProgress size={28} />
              </Box>
            ) : messages.length === 0 ? (
              <EmptyState icon="💬" title={t('inbox.noMessages')} hint={t('inbox.noMessagesDesc')} />
            ) : (
              messages.map((m) => <MessageBubble key={m.id} message={m} />)
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
                        <Button size="small" sx={{ fontSize: 11, minWidth: 0, px: 0.75, py: 0.25 }} onClick={() => onRetry(p)}>
                          {t('inbox.retry')}
                        </Button>
                      </>
                    )}
                  </Box>
                </Box>
              </Box>
            ))}
            {typing && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, color: 'text.secondary', fontSize: 12, px: 0.5, py: 0.5 }}>
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
                <SmartToy sx={{ fontSize: 14 }} />
                {t('inbox.aiTyping')}
              </Box>
            )}
            <div ref={(el) => el?.scrollIntoView({ behavior: 'smooth' })} />
          </Box>

          {/* Input */}
          {!selected.deletedAt && (
            <Box sx={{ px: { xs: 1.25, sm: 2.5 }, py: 1.25, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 1, bgcolor: 'background.paper' }}>
              <TextField
                size="small"
                placeholder={t('inbox.typeMessage')}
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSend()}
                fullWidth
                sx={{ bgcolor: 'background.default', '& .MuiInputBase-input': { fontSize: { xs: 14, sm: 13.5 } } }}
              />
              <Button
                variant="contained"
                onClick={onSend}
                disabled={!draft.trim() || busy.send}
                sx={{ minWidth: { xs: 44, sm: 90 }, px: { xs: 1, sm: 1.75 } }}
              >
                {busy.send ? (
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
  );
}

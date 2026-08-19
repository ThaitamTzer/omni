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
  Checkbox,
} from '@mui/material';
import {
  Search,
  SmartToy,
  Close,
  DeleteOutline,
  DeleteForever,
  RestoreFromTrash,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import CustomerAvatar from '@/features/inbox/components/CustomerAvatar';
import EmptyState from '@/components/EmptyState';
import type { ConversationDto } from '@omni/shared';

function formatDay(d: string | Date | null): string {
  if (!d) return '';
  const date = new Date(d);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

export interface ConversationListProps {
  conversations: ConversationDto[];
  deletedConversations: ConversationDto[];
  tab: string;
  onTabChange: (tab: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  isLoading: boolean;
  onSoftDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onDeleteForever: (c: ConversationDto) => void;
  onBulkSoftDelete: (ids: string[]) => void;
  onBulkRestore: (ids: string[]) => void;
  onBulkDeleteForever: () => void;
  onClearSelection: () => void;
  busy: {
    softDelete?: boolean;
    restore?: boolean;
    permanentDelete?: boolean;
    bulkSoftDelete?: boolean;
    bulkRestore?: boolean;
    bulkPermanentDelete?: boolean;
  };
}

export default function ConversationList({
  conversations,
  deletedConversations,
  tab,
  onTabChange,
  search,
  onSearchChange,
  selectedId,
  onSelect,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  isLoading,
  onSoftDelete,
  onRestore,
  onDeleteForever,
  onBulkSoftDelete,
  onBulkRestore,
  onBulkDeleteForever,
  onClearSelection,
  busy,
}: ConversationListProps) {
  const { t } = useTranslation();

  const listItems = tab === 'deleted' ? deletedConversations : conversations;
  const filtered = listItems
    .filter((c) => (tab === 'deleted' || tab === 'all' ? true : tab === 'pending' ? c.status === 'pending' : c.status === 'open'))
    .filter(
      (c) =>
        !search ||
        c.customerName.toLowerCase().includes(search.toLowerCase()) ||
        (c.lastMessagePreview ?? '').toLowerCase().includes(search.toLowerCase()),
    );

  const selectedCount = selectedIds.size;
  const allSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));

  return (
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
          onChange={(e) => onSearchChange(e.target.value)}
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
          onChange={onToggleSelectAll}
          disabled={filtered.length === 0}
          title={t('inbox.selectAll')}
          sx={{ p: 0.5 }}
        />
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
          {selectedCount > 0 ? t('inbox.selected', { count: selectedCount }) : t('inbox.selectAll')}
        </Typography>
      </Box>

      <Tabs
        value={tab}
        onChange={(_, v) => onTabChange(v)}
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
              <Button size="small" variant="text" sx={{ color: '#fff', fontSize: 12 }} startIcon={<RestoreFromTrash fontSize="small" />} onClick={() => onBulkRestore([...selectedIds])} disabled={busy.bulkRestore}>
                {t('inbox.bulkRestore')}
              </Button>
              <Button size="small" variant="text" sx={{ color: '#fff', fontSize: 12 }} startIcon={<DeleteForever fontSize="small" />} onClick={onBulkDeleteForever} disabled={busy.bulkPermanentDelete}>
                {t('inbox.bulkDeleteForever')}
              </Button>
            </>
          ) : (
            <Button size="small" variant="text" sx={{ color: '#fff', fontSize: 12 }} startIcon={<DeleteOutline fontSize="small" />} onClick={() => onBulkSoftDelete([...selectedIds])} disabled={busy.bulkSoftDelete}>
              {t('inbox.bulkDelete')}
            </Button>
          )}
          <IconButton size="small" sx={{ color: '#fff' }} onClick={onClearSelection}>
            <Close fontSize="small" />
          </IconButton>
        </Box>
      )}

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
            <CircularProgress size={28} />
          </Box>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={tab === 'deleted' ? '🗑️' : '💬'}
            title={tab === 'deleted' ? t('inbox.trashEmpty') : search ? t('inbox.notFoundSearch') : t('inbox.noConversations')}
            hint={tab === 'deleted' ? t('inbox.trashEmptyDesc') : search ? t('inbox.notFoundSearchDesc') : t('inbox.noConversationsDesc')}
          />
        ) : (
          <List disablePadding>
            {filtered.map((c) => (
              <ListItemButton
                key={c.id}
                selected={c.id === selectedId}
                onClick={() => onSelect(c.id)}
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
                  onChange={() => onToggleSelect(c.id)}
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
                          onRestore(c.id);
                        }}
                        disabled={busy.restore}
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
                          onDeleteForever(c);
                        }}
                        disabled={busy.permanentDelete}
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
                        onSoftDelete(c.id);
                      }}
                      disabled={busy.softDelete}
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
  );
}

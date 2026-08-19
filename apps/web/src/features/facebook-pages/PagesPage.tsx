import { useState } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { Add, HelpOutline, Link as LinkIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { usePagesQuery, useAddPage, useRemovePage } from '@/features/facebook-pages/api';
import PagesTable from '@/features/facebook-pages/components/PagesTable';
import AddPageDialog from '@/features/facebook-pages/components/AddPageDialog';
import HelpDialog from '@/features/facebook-pages/components/HelpDialog';
import DeletePageDialog from '@/features/facebook-pages/components/DeletePageDialog';
import Toast from '@/components/Toast';
import { useToast } from '@/lib/hooks/useToast';
import type { PageDto } from '@omni/shared';

export default function PagesPage() {
  const { t } = useTranslation();
  const { showToast, toastProps } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PageDto | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const pagesQuery = usePagesQuery();
  const addPageMutation = useAddPage();
  const removePageMutation = useRemovePage();

  const pages = pagesQuery.data ?? [];
  const connectedCount = pages.filter((p) => p.subscribed).length;

  const handleAdd = (input: { fbPageId: string; name: string; accessToken: string; verifyToken: string }) => {
    addPageMutation.mutate(input, {
      onSuccess: () => {
        showToast(`${t('pages.addSuccess')}: ${input.name}`);
        setAddOpen(false);
      },
      onError: (e) => showToast('', e),
    });
  };

  const handleRemove = (id: string) => {
    removePageMutation.mutate(id, {
      onSuccess: () => {
        setConfirmDelete(null);
        showToast(t('pages.deleteSuccess'));
      },
      onError: (e) => showToast('', e),
    });
  };

  const copyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      showToast(t('pages.verifyTokenCopied'));
    } catch {
      showToast(t('pages.error'));
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1100, mx: 'auto' }}>
      <Toast {...toastProps} />

      {/* Page header — light, enterprise */}
      <Box
        sx={{
          mb: 2.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, fontSize: 18, lineHeight: 1.3 }}>
            {t('pages.title')}
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
            {t('pages.subtitle')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<HelpOutline />} onClick={() => setHelpOpen(true)}>
            {t('pages.guide')}
          </Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => setAddOpen(true)}>
            {t('pages.addPage')}
          </Button>
        </Box>
      </Box>

      {/* Summary line */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          mb: 2.5,
          px: 0.5,
          color: 'text.secondary',
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="body2" sx={{ fontSize: 13 }}>
          <strong style={{ color: 'text.primary', fontWeight: 700 }}>{pages.length}</strong> {t('pages.total')} ·{' '}
          <strong style={{ color: 'success.main', fontWeight: 700 }}>{connectedCount}</strong> {t('pages.connected')} ·{' '}
          <strong style={{ color: 'warning.main', fontWeight: 700 }}>{pages.length - connectedCount}</strong> {t('pages.notConnected')}
        </Typography>
      </Box>

      <PagesTable
        pages={pages}
        isLoading={pagesQuery.isLoading}
        page={page}
        onPageChange={setPage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(n) => {
          setRowsPerPage(n);
          setPage(0);
        }}
        onDelete={setConfirmDelete}
        onAddFirst={() => setAddOpen(true)}
        onCopyToken={copyToken}
      />

      {/* Webhook hint */}
      <Paper
        elevation={0}
        sx={{
          mt: 3,
          p: 2,
          borderRadius: 1.5,
          bgcolor: '#f8f9fb',
          border: '1px dashed',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexWrap: 'wrap',
        }}
      >
        <LinkIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
          {t('pages.webhookHint1')} <code>https://YOUR_DOMAIN/api/webhook/messenger</code> — {t('pages.webhookHint2')}{' '}
          <code>omni_verify_token</code> {t('pages.webhookHint3')}
        </Typography>
      </Paper>

      <AddPageDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onHelp={() => setHelpOpen(true)}
        onAdd={handleAdd}
        pending={addPageMutation.isPending}
      />

      <HelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        onAddPage={() => setAddOpen(true)}
      />

      <DeletePageDialog
        page={confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleRemove}
        pending={removePageMutation.isPending}
      />
    </Box>
  );
}

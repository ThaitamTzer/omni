import { useState } from 'react';
import { Box, Typography, Card, CardContent, Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Divider } from '@mui/material';
import { Close } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useKnowledgeFilesQuery, useUploadFilesMutation, useDeleteKnowledgeFileMutation } from '@/features/knowledge/api';
import UploadZone from '@/features/knowledge/components/UploadZone';
import FileList from '@/features/knowledge/components/FileList';
import Toast from '@/components/Toast';
import { useToast } from '@/lib/hooks/useToast';

export default function KnowledgePage() {
  const { t } = useTranslation();
  const { showToast, toastProps } = useToast();

  const filesQuery = useKnowledgeFilesQuery();
  const uploadMutation = useUploadFilesMutation();
  const deleteMutation = useDeleteKnowledgeFileMutation();

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const files = filesQuery.data ?? [];

  const handleUpload = (list: File[]) => {
    uploadMutation.mutate(list, {
      onSuccess: () => showToast(t('knowledge.uploaded', { count: list.length })),
      onError: (e) => showToast('', e),
    });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        showToast(t('knowledge.deleted'));
        setConfirmDeleteId(null);
      },
      onError: (e) => showToast('', e),
    });
  };

  const confirmFile = files.find((f) => f.id === confirmDeleteId) ?? null;

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      <Toast {...toastProps} />

      {/* Page header */}
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, fontSize: 18, lineHeight: 1.3 }}>
          {t('knowledge.title')}
        </Typography>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
          {t('knowledge.subtitle')}
        </Typography>
      </Box>

      {/* Upload zone */}
      <Card elevation={0} sx={{ borderRadius: 1.5, border: '1px solid', borderColor: 'divider', mb: 3 }}>
        <CardContent sx={{ p: 2.5 }}>
          <UploadZone onUpload={handleUpload} pending={uploadMutation.isPending} />
        </CardContent>
      </Card>

      {/* File list */}
      <Card elevation={0} sx={{ borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 2.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1.5 }}>
            {t('knowledge.files')} ({files.length})
          </Typography>
          <FileList files={files} onDelete={setConfirmDeleteId} deleting={deleteMutation.isPending} />
        </CardContent>
      </Card>

      {/* Delete confirm dialog */}
      <Dialog open={!!confirmFile} onClose={() => setConfirmDeleteId(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography sx={{ fontWeight: 700 }}>{t('knowledge.deleteConfirmTitle')}</Typography>
          <IconButton size="small" onClick={() => setConfirmDeleteId(null)}>
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>
        <Divider />
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
            {confirmFile ? (
              <>
                <strong>{confirmFile.originalName}</strong> — {t('knowledge.deleteConfirmDesc')}
              </>
            ) : null}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setConfirmDeleteId(null)}>{t('pages.cancel')}</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => confirmFile && handleDelete(confirmFile.id)}
            disabled={deleteMutation.isPending}
          >
            {t('knowledge.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

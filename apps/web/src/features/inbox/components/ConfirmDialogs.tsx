import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  IconButton,
  Divider,
  Button,
  CircularProgress,
} from '@mui/material';
import { DeleteForever, Close } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { ConversationDto } from '@omni/shared';

export interface ConfirmDialogsProps {
  confirmDeleteForever: ConversationDto | null;
  onCloseDeleteForever: () => void;
  onConfirmDeleteForever: (id: string) => void;
  permanentDeletePending: boolean;
  confirmBulkDeleteForever: boolean;
  onCloseBulkDeleteForever: () => void;
  onConfirmBulkDeleteForever: () => void;
  bulkPermanentDeletePending: boolean;
  selectedCount: number;
}

export default function ConfirmDialogs({
  confirmDeleteForever,
  onCloseDeleteForever,
  onConfirmDeleteForever,
  permanentDeletePending,
  confirmBulkDeleteForever,
  onCloseBulkDeleteForever,
  onConfirmBulkDeleteForever,
  bulkPermanentDeletePending,
  selectedCount,
}: ConfirmDialogsProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Delete forever confirmation dialog */}
      <Dialog open={!!confirmDeleteForever} onClose={onCloseDeleteForever} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DeleteForever color="error" />
            <Typography sx={{ fontWeight: 700 }}>{t('inbox.deleteForeverConfirmTitle')}</Typography>
          </Box>
          <IconButton size="small" onClick={onCloseDeleteForever}>
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
          <Button onClick={onCloseDeleteForever}>{t('pages.cancel')}</Button>
          <Button
            variant="contained"
            color="error"
            startIcon={permanentDeletePending ? <CircularProgress size={14} /> : <DeleteForever fontSize="small" />}
            onClick={() => confirmDeleteForever && onConfirmDeleteForever(confirmDeleteForever.id)}
            disabled={permanentDeletePending}
          >
            {t('inbox.deleteForever')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk delete forever confirmation dialog */}
      <Dialog open={confirmBulkDeleteForever} onClose={onCloseBulkDeleteForever} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DeleteForever color="error" />
            <Typography sx={{ fontWeight: 700 }}>{t('inbox.bulkDeleteForeverConfirmTitle', { count: selectedCount })}</Typography>
          </Box>
          <IconButton size="small" onClick={onCloseBulkDeleteForever}>
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
          <Button onClick={onCloseBulkDeleteForever}>{t('pages.cancel')}</Button>
          <Button
            variant="contained"
            color="error"
            startIcon={bulkPermanentDeletePending ? <CircularProgress size={14} /> : <DeleteForever fontSize="small" />}
            onClick={onConfirmBulkDeleteForever}
            disabled={bulkPermanentDeletePending || selectedCount === 0}
          >
            {t('inbox.bulkDeleteForever')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

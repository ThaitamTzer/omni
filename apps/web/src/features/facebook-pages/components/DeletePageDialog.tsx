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
import { DeleteOutline, Close } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { PageDto } from '@omni/shared';

interface DeletePageDialogProps {
  page: PageDto | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
  pending: boolean;
}

export default function DeletePageDialog({ page, onClose, onConfirm, pending }: DeletePageDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={!!page} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteOutline color="error" />
          <Typography sx={{ fontWeight: 700 }}>{t('pages.deleteConfirm')}</Typography>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
          {page ? (
            <>
              <strong>{page.name}</strong> ({page.fbPageId}) sẽ bị xóa khỏi hệ thống. Hội thoại liên quan cũng sẽ bị xóa.
            </>
          ) : null}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>{t('pages.cancel')}</Button>
        <Button
          variant="contained"
          color="error"
          startIcon={pending ? <CircularProgress size={14} /> : <DeleteOutline fontSize="small" />}
          onClick={() => page && onConfirm(page.id)}
          disabled={pending}
        >
          {t('pages.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

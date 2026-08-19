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
} from '@mui/material';
import { HelpOutline, Close } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
  onAddPage: () => void;
}

export default function HelpDialog({ open, onClose, onAddPage }: HelpDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HelpOutline color="primary" />
          <Typography sx={{ fontWeight: 700 }}>{t('pages.guideTitle')}</Typography>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent>
        <Box component="ol" sx={{ pl: 2.5, m: 0, fontSize: 14, color: 'text.secondary', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <li>{t('pages.guide1')}</li>
          <li>{t('pages.guide2')}</li>
          <li>{t('pages.guide3')}</li>
          <li>{t('pages.guide4')}</li>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          variant="contained"
          onClick={() => {
            onClose();
            onAddPage();
          }}
        >
          {t('pages.guideCTA')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

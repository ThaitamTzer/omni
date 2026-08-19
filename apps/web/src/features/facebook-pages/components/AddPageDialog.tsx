import { useState } from 'react';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  TextField,
  IconButton,
  InputAdornment,
  Tooltip,
  Grid,
  Divider,
  Button,
  Link,
} from '@mui/material';
import { Facebook, ContentCopy, Refresh, Close, Storefront, Key, Add } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { AddPageInput } from '@/features/facebook-pages/api';

function generateVerifyToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

interface AddPageDialogProps {
  open: boolean;
  onClose: () => void;
  onHelp: () => void;
  onAdd: (input: AddPageInput) => void;
  pending: boolean;
}

export default function AddPageDialog({ open, onClose, onHelp, onAdd, pending }: AddPageDialogProps) {
  const { t } = useTranslation();
  const [fbPageId, setFbPageId] = useState('');
  const [pageName, setPageName] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState(generateVerifyToken());
  const [copiedMsg, setCopiedMsg] = useState(false);

  const copyVerifyToken = async () => {
    if (!verifyToken) return;
    try {
      await navigator.clipboard.writeText(verifyToken);
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 2000);
    } catch {
      // ignore clipboard failure
    }
  };

  const submit = () => {
    onAdd({ fbPageId, name: pageName, accessToken, verifyToken });
  };

  const reset = () => {
    setFbPageId('');
    setPageName('');
    setAccessToken('');
    setVerifyToken(generateVerifyToken());
    setCopiedMsg(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Facebook color="primary" />
          <Typography sx={{ fontWeight: 700 }}>{t('pages.addDialogTitle')}</Typography>
        </Box>
        <IconButton size="small" onClick={close}>
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent>
        <Box component="form" id="add-page-form" onSubmit={(e) => { e.preventDefault(); submit(); }} sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label={t('pages.name')}
            placeholder={t('pages.namePh')}
            value={pageName}
            onChange={(e) => setPageName(e.target.value)}
            required
            size="small"
            fullWidth
          />
          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={6}>
              <TextField
                label={t('pages.fbPageId')}
                placeholder={t('pages.fbPageIdPh')}
                value={fbPageId}
                onChange={(e) => setFbPageId(e.target.value)}
                required
                size="small"
                fullWidth
                InputProps={{ startAdornment: <InputAdornment position="start"><Storefront fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={`${t('pages.verifyToken')} (${t('pages.verifyTokenAuto')})`}
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                size="small"
                fullWidth
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={copiedMsg ? t('pages.verifyTokenCopied') : t('pages.copy')}>
                        <IconButton size="small" onClick={copyVerifyToken} edge="end">
                          <ContentCopy fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('pages.regenerate')}>
                        <IconButton size="small" onClick={() => setVerifyToken(generateVerifyToken())} edge="end">
                          <Refresh fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          </Grid>
          <TextField
            label={t('pages.accessToken')}
            placeholder="EAAG..."
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            required
            size="small"
            fullWidth
            type="password"
            InputProps={{ startAdornment: <InputAdornment position="start"><Key fontSize="small" /></InputAdornment> }}
          />
          <Typography variant="caption" color="text.secondary">
            {t('pages.seeGuide')}{' '}
            <Link component="button" type="button" onClick={onHelp} sx={{ fontWeight: 600 }}>
              {t('pages.guideTitle')}
            </Link>
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={close}>{t('pages.cancel')}</Button>
        <Button type="submit" form="add-page-form" variant="contained" startIcon={<Add />} disabled={pending}>
          {pending ? t('pages.adding') : t('pages.submit')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

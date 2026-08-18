import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Chip,
  InputAdornment,
  Tooltip,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Divider,
  Paper,
  Avatar,
  Skeleton,
  CircularProgress,
  Link,
  Table,
  TableContainer,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TablePagination,
} from '@mui/material';
import {
  Add,
  Facebook,
  ContentCopy,
  Refresh,
  DeleteOutline,
  HelpOutline,
  Close,
  Link as LinkIcon,
  Key,
  Storefront,
  CheckCircle,
  RadioButtonUnchecked,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { PageDto } from '@omni/shared';
import { avatarColor, initials } from '../components/InitialsAvatar';
import Toast from '../components/Toast';

export default function PagesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Dialogs
  const [addOpen, setAddOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Page form
  const [fbPageId, setFbPageId] = useState('');
  const [pageName, setPageName] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');

  const [msg, setMsg] = useState('');
  const [msgError, setMsgError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<PageDto | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const pagesQuery = useQuery({
    queryKey: ['pages'],
    queryFn: () => api.get<PageDto[]>('/pages'),
  });
  const pages = pagesQuery.data ?? [];
  const connectedCount = pages.filter((p) => p.subscribed).length;

  const showMsg = (ok: string, err?: unknown) => {
    setMsg(ok);
    setMsgError(err ? `Lỗi: ${(err as Error).message}` : '');
  };

  const addPageMutation = useMutation({
    mutationFn: () => api.post('/pages', { fbPageId, name: pageName, accessToken, verifyToken }),
    onSuccess: () => {
      showMsg(`${t('pages.addSuccess')}: ${pageName}`);
      setFbPageId('');
      setPageName('');
      setAccessToken('');
      setVerifyToken('');
      setAddOpen(false);
      queryClient.invalidateQueries({ queryKey: ['pages'] });
    },
    onError: (e) => showMsg('', e),
  });

  const removePageMutation = useMutation({
    mutationFn: (id: string) => api.del(`/pages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      setConfirmDelete(null);
      showMsg(t('pages.deleteSuccess'));
    },
  });

  const addPage = (e: FormEvent) => {
    e.preventDefault();
    addPageMutation.mutate();
  };

  // Pagination (client-side — page count is typically small)
  const pagedPages = pages.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const regenerateVerifyToken = () => {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    setVerifyToken(Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(''));
  };

  const openAddDialog = () => {
    regenerateVerifyToken();
    setAddOpen(true);
  };

  const copyVerifyToken = async () => {
    if (!verifyToken) return;
    try {
      await navigator.clipboard.writeText(verifyToken);
      showMsg(t('pages.verifyTokenCopied'));
    } catch {
      showMsg(t('pages.error'));
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1100, mx: 'auto' }}>
      <Toast message={msg} error={msgError} onClose={() => { setMsg(''); setMsgError(''); }} />

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
          <Button variant="contained" startIcon={<Add />} onClick={openAddDialog}>
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

      {/* Page cards */}
      {pagesQuery.isLoading ? (
        <Grid container spacing={2}>
          {[0, 1, 2].map((i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Card elevation={0} sx={{ borderRadius: 1.5 }}>
                <CardContent>
                  <Skeleton variant="circular" width={48} height={48} />
                  <Skeleton width="60%" sx={{ mt: 1.5 }} />
                  <Skeleton width="40%" />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : pages.length === 0 ? (
        <Card elevation={0} sx={{ borderRadius: 1.5 }}>
          <CardContent sx={{ textAlign: 'center', py: 7 }}>
            <Avatar sx={{ width: 72, height: 72, mx: 'auto', mb: 2, bgcolor: '#f0f2f5', color: 'text.secondary', fontSize: 36 }}>
              <Facebook />
            </Avatar>
            <Typography sx={{ fontWeight: 600, fontSize: 17, mb: 0.5 }}>{t('pages.emptyTitle')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
              {t('pages.emptyDesc')}
            </Typography>
            <Button variant="contained" startIcon={<Add />} onClick={openAddDialog}>
              {t('pages.addFirst')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'surface2' }}>
                <TableCell sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary' }}>Page</TableCell>
                <TableCell sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary' }}>Page ID</TableCell>
                <TableCell sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary' }}>Verify Token</TableCell>
                <TableCell sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary' }}>Trạng thái</TableCell>
                <TableCell sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary' }}>Ngày tạo</TableCell>
                <TableCell align="right" sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary' }}>Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pagedPages.map((p) => (
                <TableRow key={p.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                  <TableCell sx={{ py: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <Avatar sx={{ width: 30, height: 30, bgcolor: avatarColor(p.name), fontSize: 13, fontWeight: 700 }}>
                        {initials(p.name)}
                      </Avatar>
                      <Typography sx={{ fontWeight: 600, fontSize: 13.5 }}>{p.name}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                      {p.fbPageId}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    {p.verifyToken ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                          {p.verifyToken}
                        </Typography>
                        <Tooltip title={t('pages.copy')}>
                          <IconButton
                            size="small"
                            sx={{ p: 0.25 }}
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(p.verifyToken ?? '');
                                showMsg(t('pages.verifyTokenCopied'));
                              } catch {
                                showMsg(t('pages.error'));
                              }
                            }}
                          >
                            <ContentCopy sx={{ fontSize: 11 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    ) : (
                      <Typography variant="caption" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Chip
                      size="small"
                      icon={p.subscribed ? <CheckCircle sx={{ fontSize: 13 }} /> : <RadioButtonUnchecked sx={{ fontSize: 13 }} />}
                      label={p.subscribed ? t('pages.connectedStatus') : t('pages.notConnectedStatus')}
                      color={p.subscribed ? 'success' : 'default'}
                      variant={p.subscribed ? 'filled' : 'outlined'}
                      sx={{ height: 22, fontSize: 11 }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 12 }}>
                      {new Date(p.createdAt).toLocaleDateString('vi-VN')}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ py: 1 }}>
                    <Tooltip title={t('pages.delete')}>
                      <IconButton size="small" color="error" onClick={() => setConfirmDelete(p)}>
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {pages.length > rowsPerPage && (
        <TablePagination
          component="div"
          count={pages.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50]}
          labelRowsPerPage="Số dòng / trang"
          sx={{ fontSize: 13 }}
        />
      )}

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

      {/* Add page dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Facebook color="primary" />
            <Typography sx={{ fontWeight: 700 }}>{t('pages.addDialogTitle')}</Typography>
          </Box>
          <IconButton size="small" onClick={() => setAddOpen(false)}>
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>
        <Divider />
        <DialogContent>
          <Box component="form" id="add-page-form" onSubmit={addPage} sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
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
                    readOnly: false,
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title={t('pages.copy')}>
                          <IconButton size="small" onClick={copyVerifyToken} edge="end">
                            <ContentCopy fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('pages.regenerate')}>
                          <IconButton size="small" onClick={regenerateVerifyToken} edge="end">
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
              <Link component="button" type="button" onClick={() => setHelpOpen(true)} sx={{ fontWeight: 600 }}>
                {t('pages.guideTitle')}
              </Link>
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setAddOpen(false)}>{t('pages.cancel')}</Button>
          <Button type="submit" form="add-page-form" variant="contained" startIcon={<Add />} disabled={addPageMutation.isPending}>
            {addPageMutation.isPending ? t('pages.adding') : t('pages.submit')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Help dialog */}
      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HelpOutline color="primary" />
            <Typography sx={{ fontWeight: 700 }}>{t('pages.guideTitle')}</Typography>
          </Box>
          <IconButton size="small" onClick={() => setHelpOpen(false)}>
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
              setHelpOpen(false);
              openAddDialog();
            }}
          >
            {t('pages.guideCTA')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DeleteOutline color="error" />
            <Typography sx={{ fontWeight: 700 }}>{t('pages.deleteConfirm')}</Typography>
          </Box>
          <IconButton size="small" onClick={() => setConfirmDelete(null)}>
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>
        <Divider />
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
            {confirmDelete ? (
              <>
                <strong>{confirmDelete.name}</strong> ({confirmDelete.fbPageId}) sẽ bị xóa khỏi hệ thống. Hội thoại liên quan cũng sẽ bị xóa.
              </>
            ) : null}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setConfirmDelete(null)}>{t('pages.cancel')}</Button>
          <Button
            variant="contained"
            color="error"
            startIcon={removePageMutation.isPending ? <CircularProgress size={14} /> : <DeleteOutline fontSize="small" />}
            onClick={() => confirmDelete && removePageMutation.mutate(confirmDelete.id)}
            disabled={removePageMutation.isPending}
          >
            {t('pages.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

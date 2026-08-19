import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Tooltip,
  IconButton,
  Grid,
  Paper,
  Avatar,
  Skeleton,
  Button,
  Table,
  TableContainer,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TablePagination,
} from '@mui/material';
import { Facebook, ContentCopy, DeleteOutline, CheckCircle, RadioButtonUnchecked, Add } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { avatarColor, initials } from '@/lib/utils/avatar';
import type { PageDto } from '@omni/shared';

interface PagesTableProps {
  pages: PageDto[];
  isLoading: boolean;
  page: number;
  onPageChange: (p: number) => void;
  rowsPerPage: number;
  onRowsPerPageChange: (n: number) => void;
  onDelete: (p: PageDto) => void;
  onAddFirst: () => void;
  onCopyToken: (token: string) => void;
}

export default function PagesTable({
  pages,
  isLoading,
  page,
  onPageChange,
  rowsPerPage,
  onRowsPerPageChange,
  onDelete,
  onAddFirst,
  onCopyToken,
}: PagesTableProps) {
  const { t } = useTranslation();
  const pagedPages = pages.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  if (isLoading) {
    return (
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
    );
  }

  if (pages.length === 0) {
    return (
      <Card elevation={0} sx={{ borderRadius: 1.5 }}>
        <CardContent sx={{ textAlign: 'center', py: 7 }}>
          <Avatar sx={{ width: 72, height: 72, mx: 'auto', mb: 2, bgcolor: '#f0f2f5', color: 'text.secondary', fontSize: 36 }}>
            <Facebook />
          </Avatar>
          <Typography sx={{ fontWeight: 600, fontSize: 17, mb: 0.5 }}>{t('pages.emptyTitle')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            {t('pages.emptyDesc')}
          </Typography>
          <Button variant="contained" startIcon={<Add />} onClick={onAddFirst}>
            {t('pages.addFirst')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
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
                        <IconButton size="small" sx={{ p: 0.25 }} onClick={() => onCopyToken(p.verifyToken ?? '')}>
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
                    <IconButton size="small" color="error" onClick={() => onDelete(p)}>
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {pages.length > rowsPerPage && (
        <TablePagination
          component="div"
          count={pages.length}
          page={page}
          onPageChange={(_, newPage) => onPageChange(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => onRowsPerPageChange(parseInt(e.target.value, 10))}
          rowsPerPageOptions={[10, 25, 50]}
          labelRowsPerPage="Số dòng / trang"
          sx={{ fontSize: 13 }}
        />
      )}
    </>
  );
}

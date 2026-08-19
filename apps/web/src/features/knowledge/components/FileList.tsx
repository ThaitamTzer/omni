import {
  Box,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Typography,
  Avatar,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Description,
  PictureAsPdf,
  TableChart,
  Image,
  DeleteOutline,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import EmptyState from '@/components/EmptyState';
import type { KnowledgeFileDto } from '@omni/shared';

const KIND_ICON: Record<KnowledgeFileDto['kind'], React.ReactNode> = {
  text: <Description fontSize="small" />,
  pdf: <PictureAsPdf fontSize="small" />,
  docx: <Description fontSize="small" />,
  xlsx: <TableChart fontSize="small" />,
  image: <Image fontSize="small" />,
};

const KIND_COLOR: Record<KnowledgeFileDto['kind'], string> = {
  text: '#2563eb',
  pdf: '#dc2626',
  docx: '#2563eb',
  xlsx: '#16a34a',
  image: '#7c3aed',
};

interface FileListProps {
  files: KnowledgeFileDto[];
  onDelete: (id: string) => void;
  deleting: boolean;
}

export default function FileList({ files, onDelete, deleting }: FileListProps) {
  const { t } = useTranslation();

  if (files.length === 0) {
    return <EmptyState icon="📚" title={t('knowledge.emptyTitle')} hint={t('knowledge.emptyDesc')} />;
  }

  return (
    <List disablePadding>
      {files.map((f) => (
        <ListItem
          key={f.id}
          divider
          secondaryAction={
            <Tooltip title={t('knowledge.delete')}>
              <IconButton
                edge="end"
                size="small"
                color="error"
                onClick={() => onDelete(f.id)}
                disabled={deleting}
              >
                <DeleteOutline fontSize="small" />
              </IconButton>
            </Tooltip>
          }
        >
          <ListItemAvatar>
            <Avatar sx={{ width: 36, height: 36, bgcolor: `${KIND_COLOR[f.kind]}1a`, color: KIND_COLOR[f.kind] }}>
              {KIND_ICON[f.kind]}
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={
              <Typography sx={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.originalName}
              </Typography>
            }
            secondary={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                <Typography variant="caption" color="text.secondary">
                  {(f.size / 1024).toFixed(0)} KB · {new Date(f.createdAt).toLocaleDateString('vi-VN')}
                </Typography>
                {f.status === 'processing' && (
                  <Chip size="small" icon={<CircularProgress size={10} />} label={t('knowledge.processing')} sx={{ height: 20, fontSize: 10 }} />
                )}
                {f.status === 'ready' && (
                  <Chip size="small" label={t('knowledge.ready')} color="success" sx={{ height: 20, fontSize: 10 }} />
                )}
                {f.status === 'failed' && (
                  <Chip size="small" label={t('knowledge.failed')} color="error" sx={{ height: 20, fontSize: 10 }} />
                )}
              </Box>
            }
          />
        </ListItem>
      ))}
    </List>
  );
}

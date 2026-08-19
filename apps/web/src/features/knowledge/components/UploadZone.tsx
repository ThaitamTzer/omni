import { useRef, useState } from 'react';
import { Box, Typography, Button, IconButton } from '@mui/material';
import { CloudUpload, Close } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface UploadZoneProps {
  onUpload: (files: File[]) => void;
  pending: boolean;
}

export default function UploadZone({ onUpload, pending }: UploadZoneProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selected, setSelected] = useState<File[]>([]);

  const pick = (files: FileList | null) => {
    if (!files?.length) return;
    setSelected(Array.from(files));
  };

  const submit = () => {
    if (!selected.length) return;
    onUpload(selected);
    setSelected([]);
  };

  return (
    <Box>
      <Box
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pick(e.dataTransfer.files);
        }}
        sx={{
          border: '2px dashed',
          borderColor: dragOver ? 'primary.main' : 'divider',
          borderRadius: 2,
          p: 4,
          textAlign: 'center',
          cursor: 'pointer',
          bgcolor: dragOver ? 'primary.light' : 'background.paper',
          transition: 'all 0.15s',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = '';
          }}
        />
        <CloudUpload sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
        <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{t('knowledge.dropTitle')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5, mt: 0.5 }}>
          {t('knowledge.dropHint')}
        </Typography>
      </Box>

      {selected.length > 0 && (
        <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {selected.map((f) => (
            <Box key={`${f.name}-${f.size}`} sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 13 }}>
              <Typography sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {(f.size / 1024).toFixed(0)} KB
              </Typography>
              <IconButton
                size="small"
                onClick={() => setSelected((prev) => prev.filter((x) => x !== f))}
              >
                <Close fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
            <Button variant="contained" size="small" onClick={submit} disabled={pending}>
              {pending ? t('knowledge.uploading') : t('knowledge.upload')}
            </Button>
            <Button size="small" onClick={() => setSelected([])}>
              {t('pages.cancel')}
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}

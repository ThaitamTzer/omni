import { Box, Typography } from '@mui/material';

export default function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
      <Typography sx={{ fontSize: 30, mb: 1 }}>{icon}</Typography>
      <Typography variant="body2">{title}</Typography>
      {hint && (
        <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.8, maxWidth: 280, mx: 'auto' }}>
          {hint}
        </Typography>
      )}
    </Box>
  );
}

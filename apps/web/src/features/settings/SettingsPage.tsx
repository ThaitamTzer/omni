import { Box, Typography, Grid } from '@mui/material';
import { useTranslation } from 'react-i18next';
import AiRulesSection from '@/features/settings/components/AiRulesSection';
import AiSettingsSection from '@/features/settings/components/AiSettingsSection';
import FaqSection from '@/features/settings/components/FaqSection';
import Toast from '@/components/Toast';
import { useToast } from '@/lib/hooks/useToast';

export default function SettingsPage() {
  const { t } = useTranslation();
  const { toastProps } = useToast();

  return (
    <Box sx={{ p: 3, maxWidth: 1100, mx: 'auto' }}>
      <Toast {...toastProps} />

      {/* Page header — light, enterprise */}
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, fontSize: 18, lineHeight: 1.3 }}>
          {t('settings.title')}
        </Typography>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
          {t('settings.subtitle')}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={7}>
          <AiRulesSection />
        </Grid>
        <Grid item xs={12} lg={5}>
          <AiSettingsSection />
        </Grid>
        <Grid item xs={12}>
          <FaqSection />
        </Grid>
      </Grid>
    </Box>
  );
}

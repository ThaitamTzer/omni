import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Avatar,
  Divider,
} from '@mui/material';
import { Settings as SettingsIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSettingsQuery, useSaveSetting } from '@/features/settings/api';

export default function AiSettingsSection() {
  const { t } = useTranslation();

  const settingsQuery = useSettingsQuery();
  const saveSettingMutation = useSaveSetting();

  const [aiTone, setAiTone] = useState('');
  const [aiMaxReplies, setAiMaxReplies] = useState('10');

  // Sync local AI setting state when remote settings arrive
  useEffect(() => {
    if (settingsQuery.data) {
      setAiTone(settingsQuery.data.ai_tone ?? '');
      setAiMaxReplies(settingsQuery.data.ai_max_replies_per_hour ?? '10');
    }
  }, [settingsQuery.data]);

  const save = () => {
    // Gửi tuần tự 2 key, toast khi cả hai xong (tránh nested mutate trong onSuccess)
    saveSettingMutation.mutate({ key: 'ai_tone', value: aiTone });
    saveSettingMutation.mutate({ key: 'ai_max_replies_per_hour', value: aiMaxReplies });
  };

  return (
    <Card elevation={0} sx={{ borderRadius: 1.5, border: '1px solid', borderColor: 'divider', height: '100%' }}>
      <CardContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ width: 40, height: 40, bgcolor: '#eff6ff', color: 'primary.main' }}>
            <SettingsIcon fontSize="small" />
          </Avatar>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 16 }}>{t('settings.aiSettings')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>{t('settings.aiSettingsDesc')}</Typography>
          </Box>
        </Box>

        <Divider />

        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>{t('settings.aiTone')}</Typography>
          <TextField
            multiline
            rows={3}
            value={aiTone}
            onChange={(e) => setAiTone(e.target.value)}
            size="small"
            fullWidth
            placeholder={t('settings.aiTonePh')}
          />
        </Box>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>{t('settings.aiReplyLimit')}</Typography>
          <TextField
            type="number"
            value={aiMaxReplies}
            onChange={(e) => setAiMaxReplies(e.target.value)}
            size="small"
            fullWidth
          />
        </Box>
        <Button variant="contained" onClick={save} sx={{ alignSelf: 'flex-start' }} disabled={saveSettingMutation.isPending}>
          {saveSettingMutation.isPending ? t('settings.saving') : t('settings.save')}
        </Button>
      </CardContent>
    </Card>
  );
}

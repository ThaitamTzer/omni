import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  Alert,
  Avatar,
  Stack,
} from '@mui/material';
import { ChatBubbleOutline } from '@mui/icons-material';
import { useAuthStore } from '../lib/authStore';
import { api } from '../lib/api';
import type { Staff } from '../lib/authStore';

export default function Login() {
  const { t } = useTranslation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{ token: string; staff: Staff }>('/auth/login', {
        email,
        password,
      });
      setAuth(res);
      navigate('/');
    } catch {
      setError(t('login.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 60%)',
      }}
    >
      <Card sx={{ width: 380, p: 1 }} elevation={0}>
        <CardContent sx={{ px: 3.5, py: 4 }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
            <Avatar sx={{ width: 48, height: 48, bgcolor: 'primary.main', fontSize: 24 }}>
              <ChatBubbleOutline />
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {t('app.name')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('login.subtitle')}
              </Typography>
            </Box>
          </Stack>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <TextField
              label={t('login.email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              size="small"
              fullWidth
            />
            <TextField
              label={t('login.password')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              size="small"
              fullWidth
            />
            {error && <Alert severity="error" sx={{ fontSize: 13 }}>{error}</Alert>}
            <Button type="submit" variant="contained" size="large" disabled={loading} sx={{ mt: 1, minWidth: 140 }}>
              {loading ? t('common.loading') : t('login.submit')}
            </Button>
          </form>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 2.5 }}>
            Mặc định: admin@omni.local / admin123
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}

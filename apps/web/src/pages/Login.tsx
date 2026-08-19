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
} from '@mui/material';
import { useSetAuth } from '../lib/authStore';
import { api } from '../lib/api';
import type { Staff } from '../lib/authStore';

export default function Login() {
  const { t } = useTranslation();
  const setAuth = useSetAuth();
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
      setAuth({ staff: res.staff, accessToken: res.token });
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
        bgcolor: 'background.default',
      }}
    >
      <Card sx={{ width: 360, border: '1px solid', borderColor: 'divider' }} elevation={0}>
        <CardContent sx={{ px: 3.5, py: 4 }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, fontSize: 20 }}>
              {t('app.name')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: 13 }}>
              {t('login.subtitle')}
            </Typography>
          </Box>

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
        </CardContent>
      </Card>
    </Box>
  );
}

import { Routes, Route, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  AppBar,
  Toolbar,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Typography,
  IconButton,
  Tooltip,
  Stack,
} from '@mui/material';
import {
  ChatBubbleOutline,
  SettingsOutlined,
  Logout,
  Storefront,
  Facebook,
} from '@mui/icons-material';
import { useAuthStore, useStaff } from './lib/authStore';
import { api } from './lib/api';
import InitialsAvatar from './components/InitialsAvatar';
import Login from './pages/Login';
import Inbox from './pages/Inbox';
import PagesPage from './pages/PagesPage';
import SettingsPage from './pages/SettingsPage';

const NAV_ITEMS = [
  { to: '/', labelKey: 'nav.inbox', icon: <ChatBubbleOutline fontSize="small" />, end: true },
  { to: '/pages', labelKey: 'nav.pages', icon: <Facebook fontSize="small" />, end: false },
  { to: '/settings', labelKey: 'nav.settings', icon: <SettingsOutlined fontSize="small" />, end: false },
];

function Layout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const staff = useStaff();
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();

  if (!staff) return <Navigate to="/login" replace />;

  // Determine active nav item (supports end-exact and prefix matching)
  const isActive = (item: { to: string; end?: boolean }) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: 240,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 240,
            boxSizing: 'border-box',
            border: 'none',
            borderRight: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 2.5 }}>
          <Avatar
            sx={{
              width: 34,
              height: 34,
              borderRadius: 2,
              bgcolor: 'primary.main',
              fontSize: 17,
            }}
            variant="rounded"
          >
            💬
          </Avatar>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 17 }}>
            Omni Inbox
          </Typography>
        </Box>

        <Box sx={{ px: 1.5, pb: 1 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'text.secondary', px: 1, pb: 0.5 }}>
            {t('nav.inbox')}
          </Typography>
          <List disablePadding>
            {NAV_ITEMS.map((item) => {
              const active = isActive(item);
              return (
                <ListItem key={item.to} disablePadding>
                  <ListItemButton
                    component={NavLink}
                    to={item.to}
                    end={item.end}
                    selected={active}
                    sx={{
                      mb: 0.5,
                      borderRadius: 2,
                      color: active ? '#fff' : 'text.secondary',
                      // Override MUI default selected style (specificity-safe)
                      '&.Mui-selected': {
                        bgcolor: 'primary.main',
                        color: '#fff',
                        '&:hover': { bgcolor: 'primary.main' },
                        '& .MuiListItemIcon-root': { color: '#fff' },
                        '& .MuiListItemText-primary': { fontWeight: 600 },
                      },
                      '&:hover': {
                        bgcolor: active ? 'primary.main' : 'action.hover',
                        color: active ? '#fff' : 'text.primary',
                      },
                      '& .MuiListItemIcon-root': { color: active ? '#fff' : 'inherit' },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 34 }}>{item.icon}</ListItemIcon>
                    <ListItemText primary={t(item.labelKey)} primaryTypographyProps={{ fontSize: 14 }} />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Box>

        <Box sx={{ flex: 1 }} />

        <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <InitialsAvatar name={staff.name} size={34} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {staff.name}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
              {staff.role === 'ADMIN' ? t('nav.admin') : t('nav.staff')}
            </Typography>
          </Box>
          <Tooltip title={t('nav.logout')}>
            <IconButton
              size="small"
              onClick={async () => {
                // Revoke refresh cookie server-side, then clear local state
                try {
                  await api.post('/auth/logout', {});
                } catch {
                  // ignore — local logout still proceeds
                }
                await logout();
                navigate('/login');
              }}
            >
              <Logout fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Drawer>

      {/* Main */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <AppBar
          position="static"
          elevation={0}
          sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', color: 'text.primary' }}
        >
          <Toolbar sx={{ minHeight: 56, px: 2.5 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1 }}>
              <Storefront fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                {t('app.tagline')}
              </Typography>
            </Stack>
          </Toolbar>
        </AppBar>
        <Box component="main" sx={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Layout>
            <Inbox />
          </Layout>
        }
      />
      <Route
        path="/pages"
        element={
          <Layout>
            <PagesPage />
          </Layout>
        }
      />
      <Route
        path="/settings"
        element={
          <Layout>
            <SettingsPage />
          </Layout>
        }
      />
    </Routes>
  );
}

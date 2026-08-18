import { Routes, Route, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  IconButton,
  Tooltip,
  Stack,
} from '@mui/material';
import {
  ChatBubbleOutline,
  SettingsOutlined,
  Logout,
  Facebook,
} from '@mui/icons-material';
import { useAuthStore, useStaff } from './lib/authStore';
import { api } from './lib/api';
import InitialsAvatar from './components/InitialsAvatar';
import Login from './pages/Login';
import Inbox from './pages/Inbox';
import PagesPage from './pages/PagesPage';
import SettingsPage from './pages/SettingsPage';

const NAV_MAIN = [
  { to: '/', labelKey: 'nav.inbox', icon: <ChatBubbleOutline fontSize="small" />, end: true },
  { to: '/pages', labelKey: 'nav.pages', icon: <Facebook fontSize="small" />, end: false },
];

const NAV_SECONDARY = [
  { to: '/settings', labelKey: 'nav.settings', icon: <SettingsOutlined fontSize="small" />, end: false },
];

function NavGroup({ items, title }: { items: typeof NAV_MAIN; title?: string }) {
  const { t } = useTranslation();
  const location = useLocation();
  const isActive = (item: { to: string; end?: boolean }) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);

  return (
    <Box>
      {title && (
        <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'text.secondary', px: 1.5, pb: 0.5, pt: 1 }}>
          {title}
        </Typography>
      )}
      <List disablePadding>
        {items.map((item) => {
          const active = isActive(item);
          return (
            <ListItem key={item.to} disablePadding>
              <ListItemButton
                component={NavLink}
                to={item.to}
                end={item.end}
                selected={active}
                sx={{
                  height: 34,
                  mx: 1,
                  px: 1.25,
                  borderRadius: 1,
                  color: active ? 'primary.main' : 'text.secondary',
                  '&.Mui-selected': {
                    bgcolor: '#eff4ff',
                    color: 'primary.main',
                    '&:hover': { bgcolor: '#e4edff' },
                    '& .MuiListItemIcon-root': { color: 'primary.main' },
                    '& .MuiListItemText-primary': { fontWeight: 600, color: 'primary.main' },
                  },
                  '&:hover': {
                    bgcolor: active ? '#eff4ff' : '#f2f4f7',
                    color: active ? 'primary.main' : 'text.primary',
                  },
                  '& .MuiListItemIcon-root': { color: active ? 'primary.main' : 'inherit', minWidth: 30 },
                }}
              >
                <ListItemIcon sx={{ minWidth: 30 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={t(item.labelKey)} primaryTypographyProps={{ fontSize: 13 }} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const staff = useStaff();
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();

  if (!staff) return <Navigate to="/login" replace />;

  const pageTitle =
    location.pathname === '/' ? t('nav.inbox') : location.pathname.startsWith('/pages') ? t('nav.pages') : t('nav.settings');

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}>
      {/* Sidebar */}
      <Box
        component="aside"
        sx={{
          width: 220,
          flexShrink: 0,
          bgcolor: 'background.paper',
          borderRight: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ px: 2, py: 2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>
            Omni Inbox
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            {t('app.tagline')}
          </Typography>
        </Box>

        <NavGroup items={NAV_MAIN} title={t('nav.inbox')} />

        <Box sx={{ flex: 1 }} />

        <NavGroup items={NAV_SECONDARY} title="General" />

        <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
          <InitialsAvatar name={staff.name} size={30} />
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
      </Box>

      {/* Main */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <Box
          component="header"
          sx={{
            height: 56,
            flexShrink: 0,
            px: 2.5,
            bgcolor: 'background.paper',
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Typography sx={{ fontSize: 16, fontWeight: 600, flexShrink: 0 }}>
            {pageTitle}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Stack direction="row" spacing={1} alignItems="center">
            <InitialsAvatar name={staff.name} size={30} />
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>
                {staff.name}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                {staff.role === 'ADMIN' ? t('nav.admin') : t('nav.staff')}
              </Typography>
            </Box>
          </Stack>
        </Box>

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

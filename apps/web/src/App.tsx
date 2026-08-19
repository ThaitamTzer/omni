import { Routes, Route } from 'react-router-dom';
import AppLayout from '@/app/layout/AppLayout';
import LoginPage from '@/features/auth/LoginPage';
import InboxPage from '@/features/inbox/InboxPage';
import PagesPage from '@/features/facebook-pages/PagesPage';
import SettingsPage from '@/features/settings/SettingsPage';
import KnowledgePage from '@/features/knowledge/KnowledgePage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <AppLayout>
            <InboxPage />
          </AppLayout>
        }
      />
      <Route
        path="/pages"
        element={
          <AppLayout>
            <PagesPage />
          </AppLayout>
        }
      />
      <Route
        path="/knowledge"
        element={
          <AppLayout>
            <KnowledgePage />
          </AppLayout>
        }
      />
      <Route
        path="/settings"
        element={
          <AppLayout>
            <SettingsPage />
          </AppLayout>
        }
      />
    </Routes>
  );
}

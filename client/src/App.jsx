import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppShell } from './components/layout/AppShell';
import { OrganizationRoute, ProtectedRoute, PublicOnlyRoute } from './components/RouteGuards';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import ItemDetailPage from './pages/ItemDetailPage';
import ItemFormPage from './pages/ItemFormPage';
import OrganizationsPage from './pages/OrganizationsPage';
import OrganizationDetailPage from './pages/OrganizationDetailPage';
import OrganizationFormPage from './pages/OrganizationFormPage';
import ActivityPage from './pages/ActivityPage';
import InboxPage from './pages/InboxPage';
import ProfilePage from './pages/ProfilePage';
import UserProfilePage from './pages/UserProfilePage';
import HistoryPage from './pages/HistoryPage';
import BarterMatchPage from './pages/BarterMatchPage';
import { bootstrap } from './store/authSlice';
import { fetchNotifications } from './store/notificationsSlice';
import { useLiveReload } from './hooks/useLiveReload';

function MidtransScript() {
  useEffect(() => {
    const key = import.meta.env.VITE_MIDTRANS_CLIENT_KEY;
    if (!key || document.getElementById('midtrans-snap')) return;
    const script = document.createElement('script');
    script.id = 'midtrans-snap';
    const production = import.meta.env.VITE_MIDTRANS_IS_PRODUCTION === 'true';
    script.src = production
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js';
    script.setAttribute('data-client-key', key);
    document.head.appendChild(script);
  }, []);
  return null;
}

export default function App() {
  const dispatch = useDispatch();
  const token = useSelector((state) => state.auth.token);

  useEffect(() => {
    if (token) {
      dispatch(bootstrap());
      dispatch(fetchNotifications());
    }
  }, [token, dispatch]);

  useLiveReload(() => {
    if (!token) return;
    dispatch(bootstrap());
    dispatch(fetchNotifications());
  }, 10000);

  return (
    <>
      <MidtransScript />
      <Routes>
        <Route path="/" element={<PublicOnlyRoute><LandingPage /></PublicOnlyRoute>} />
        <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
        <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />

        <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
          <Route path="/home" element={<HomePage />} />
          <Route path="/items/new" element={<ItemFormPage />} />
          <Route path="/items/:id/edit" element={<ItemFormPage />} />
          <Route path="/items/:id" element={<ItemDetailPage />} />
          <Route path="/organizations" element={<OrganizationsPage />} />
          <Route
            path="/organizations/new"
            element={<OrganizationRoute><OrganizationFormPage /></OrganizationRoute>}
          />
          <Route path="/organizations/:id" element={<OrganizationDetailPage />} />
          <Route path="/requests" element={<ActivityPage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/inbox/:conversationId" element={<InboxPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/users/:id" element={<UserProfilePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/barter" element={<BarterMatchPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

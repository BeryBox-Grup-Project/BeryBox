import { Navigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { bootstrap } from '../store/authSlice';
import { Button } from './ui/Button';

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center text-on-surface-variant">Memuat...</div>
  );
}

export function ProtectedRoute({ children }) {
  const { token, user, status } = useSelector((state) => state.auth);
  const location = useLocation();
  const dispatch = useDispatch();

  if (!token) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user) return children;
  if (status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-on-surface">Tidak bisa memuat sesi. Pastikan server API berjalan.</p>
        <Button onClick={() => dispatch(bootstrap())}>Coba lagi</Button>
      </div>
    );
  }
  return <Loading />;
}

export function PublicOnlyRoute({ children }) {
  const { token, user, status } = useSelector((state) => state.auth);
  if (token && user) return <Navigate to="/home" replace />;
  if (token && status === 'loading') return <Loading />;
  return children;
}

export function OrganizationRoute({ children }) {
  const user = useSelector((state) => state.auth.user);
  if (!user) return <Loading />;
  if (user.role !== 'organization') return <Navigate to="/profile" replace />;
  return children;
}

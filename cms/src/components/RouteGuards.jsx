import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { bootstrap } from '../store';
import { Button } from './ui/Button';

function Loading() {
  return <div className="flex min-h-screen items-center justify-center text-on-surface-variant">Memuat...</div>;
}

export function PublicOnlyRoute({ children }) {
  const { token, user, status } = useSelector((state) => state.auth);
  if (token && user) return <Navigate to="/" replace />;
  if (token && status === 'loading') return <Loading />;
  return children;
}

export function AdminRoute({ children }) {
  const { token, user, status } = useSelector((state) => state.auth);
  const location = useLocation();
  const dispatch = useDispatch();

  if (!token) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user?.role === 'admin') return children || <Outlet />;
  if (status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-on-surface">Tidak bisa memuat sesi CMS. Pastikan server API berjalan.</p>
        <Button onClick={() => dispatch(bootstrap())}>Coba lagi</Button>
      </div>
    );
  }
  return <Loading />;
}

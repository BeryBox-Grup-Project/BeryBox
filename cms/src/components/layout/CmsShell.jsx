import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ChartBar, Flag, SignOut, UsersThree } from '@phosphor-icons/react';
import { logout } from '../../store';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import logo from '../../assets/Favicon.png';

const LINKS = [
  { to: '/', label: 'Dashboard', Icon: ChartBar, end: true },
  { to: '/organizations', label: 'Verifikasi', Icon: UsersThree },
  { to: '/reports', label: 'Laporan', Icon: Flag },
];

export function CmsShell() {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [logoutOpen, setLogoutOpen] = useState(false);

  function confirmLogout() {
    dispatch(logout());
    setLogoutOpen(false);
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r border-outline-variant/40 bg-surface-container-lowest p-6 md:flex">
        <div className="flex items-center gap-1">
          <img src={logo} alt="" className="h-9 w-auto object-contain" />
          <div>
            <p className="font-display text-2xl font-extrabold text-primary">BeryBox</p>
            <p className="text-xs text-on-surface-variant">CMS Admin</p>
          </div>
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `font-label flex items-center gap-3 rounded-full px-4 py-3 text-sm transition-colors ${
                  isActive ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'
                }`
              }
            >
              <link.Icon size={18} />
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto">
          <p className="mb-3 truncate text-xs text-on-surface-variant">{user?.email}</p>
          <Button variant="secondary" className="w-full" onClick={() => setLogoutOpen(true)}>
            <SignOut size={16} /> Keluar
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-outline-variant/40 bg-surface-container-lowest px-4 py-4 md:hidden">
          <p className="font-display text-lg font-extrabold text-primary">CMS</p>
          <button
            type="button"
            className="font-label text-sm text-on-surface-variant"
            onClick={() => setLogoutOpen(true)}
          >
            Keluar
          </button>
        </header>
        <nav className="flex gap-2 overflow-x-auto border-b border-outline-variant px-4 py-2 md:hidden">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `font-label shrink-0 rounded-full px-4 py-2 text-sm ${
                  isActive ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-10">
          <Outlet />
        </main>
      </div>

      <Modal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title="Keluar dari CMS?"
        description="Kamu perlu masuk lagi untuk verifikasi dan laporan."
        footer={
          <>
            <Button variant="secondary" onClick={() => setLogoutOpen(false)}>Batal</Button>
            <Button variant="danger" onClick={confirmLogout}>Ya, keluar</Button>
          </>
        }
      />
    </div>
  );
}

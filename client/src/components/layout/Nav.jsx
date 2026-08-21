import { useEffect, useRef, useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Bell,
  ChatCircle,
  HouseSimple,
  Package,
  User,
  UsersThree,
} from '@phosphor-icons/react';
import {
  fetchNotifications,
  isInboxNotification,
  isModeratorNotice,
  isUnread,
  markNotificationRead,
} from '../../store/notificationsSlice';
import { Avatar } from '../ui/Avatar';
import { ModeratorNotice } from '../ui/Feedback';
import logo from '../../assets/Favicon.png';

const TABS = [
  { to: '/home', label: 'Beranda', Icon: HouseSimple },
  { to: '/organizations', label: 'Organisasi', Icon: UsersThree },
  { to: '/requests', label: 'Aktivitas', Icon: Package },
  { to: '/inbox', label: 'Pesan', Icon: ChatCircle },
  { to: '/profile', label: 'Profil', Icon: User },
];

function NotificationTray() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const items = useSelector((state) => state.notifications.items);
  const unread = items.filter(isUnread).length;
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function onClick(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function openRow(row) {
    if (row.id && isUnread(row)) dispatch(markNotificationRead(row.id));
    setOpen(false);
    if (row.conversationId) navigate(`/inbox/${row.conversationId}`);
    else navigate('/requests');
  }

  return (
    <div ref={rootRef} className="relative hidden lg:block">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          dispatch(fetchNotifications());
        }}
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-on-surface"
        aria-label="Notifikasi"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] text-on-error">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="glass-panel absolute right-0 z-[30] mt-2 w-80 overflow-hidden rounded-2xl border border-outline-variant shadow-lg">
          <p className="font-label border-b border-outline-variant px-4 py-3 text-sm text-on-surface">Notifikasi</p>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-on-surface-variant">Belum ada notifikasi.</li>
            ) : (
              items.slice(0, 12).map((row, index) => (
                <li key={row.id || index} className={isModeratorNotice(row) ? 'px-2 py-1.5' : ''}>
                  <button
                    type="button"
                    onClick={() => openRow(row)}
                    className={`w-full text-left text-sm ${
                      isModeratorNotice(row)
                        ? ''
                        : `px-4 py-3 hover:bg-surface-container-low ${
                            isUnread(row) ? 'text-on-surface' : 'text-on-surface-variant'
                          }`
                    }`}
                  >
                    {isModeratorNotice(row) ? <ModeratorNotice message={row.message} /> : row.message}
                  </button>
                </li>
              ))
            )}
          </ul>
          <Link
            to="/requests"
            onClick={() => setOpen(false)}
            className="font-label block border-t border-outline-variant px-4 py-3 text-center text-xs text-primary"
          >
            Buka aktivitas
          </Link>
        </div>
      )}
    </div>
  );
}

export function TopNav() {
  const user = useSelector((state) => state.auth.user);
  const items = useSelector((state) => state.notifications.items);
  const unreadActivity = items.filter((row) => isUnread(row) && !isInboxNotification(row)).length;
  const unreadInbox = items.filter((row) => isUnread(row) && isInboxNotification(row)).length;

  return (
    <nav className="glass-panel fixed inset-x-0 top-0 z-[20] border-b border-outline-variant/40 shadow-sm">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-6 px-margin-mobile py-4 md:px-margin-desktop">
        <div className="flex items-center gap-8">
          <Link to="/home" className="flex items-center gap-1 font-display text-2xl font-extrabold tracking-tight text-primary">
            <img src={logo} alt="" className="h-9 w-auto object-contain" />
            BeryBox
          </Link>
          <div className="hidden items-center gap-6 lg:flex">
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  `font-label relative text-sm transition-colors ${
                    isActive
                      ? "text-primary font-bold after:absolute after:-bottom-2 after:left-1/2 after:h-1.5 after:w-1.5 after:-translate-x-1/2 after:rounded-full after:bg-primary after:content-['']"
                      : 'text-on-surface-variant hover:text-primary'
                  }`
                }
              >
                {tab.label}
                {tab.to === '/requests' && unreadActivity > 0 && (
                  <span className="absolute -right-2 top-0 h-2 w-2 rounded-full bg-error" />
                )}
                {tab.to === '/inbox' && unreadInbox > 0 && (
                  <span className="absolute -right-2 top-0 h-2 w-2 rounded-full bg-error" />
                )}
              </NavLink>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <NotificationTray />
          <Link to="/profile" aria-label="Halaman profil" className="block">
            <Avatar src={user?.photoUrl} name={user?.username} size="md" />
          </Link>
        </div>
      </div>
    </nav>
  );
}

export function BottomNav() {
  const items = useSelector((state) => state.notifications.items);
  const unreadActivity = items.filter((row) => isUnread(row) && !isInboxNotification(row)).length;
  const unreadInbox = items.filter((row) => isUnread(row) && isInboxNotification(row)).length;

  return (
    <nav className="glass-panel fixed inset-x-0 bottom-0 z-[20] border-t border-outline-variant/30 px-2 py-2 lg:hidden">
      <div className="flex items-center justify-around">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-2xl px-3 py-1 text-[11px] ${
                isActive ? 'text-primary' : 'text-on-surface-variant'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`relative rounded-full px-3 py-0.5 ${isActive ? 'bg-primary-container/15' : ''}`}>
                  <tab.Icon size={22} weight={isActive ? 'fill' : 'regular'} />
                  {tab.to === '/requests' && unreadActivity > 0 && (
                    <span className="absolute right-1 top-0 h-2 w-2 rounded-full bg-error" />
                  )}
                  {tab.to === '/inbox' && unreadInbox > 0 && (
                    <span className="absolute right-1 top-0 h-2 w-2 rounded-full bg-error" />
                  )}
                </span>
                <span className="font-label">{tab.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

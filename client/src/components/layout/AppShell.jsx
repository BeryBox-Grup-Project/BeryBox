import { Outlet, useLocation } from 'react-router-dom';
import { TopNav, BottomNav } from './Nav';
import { BeryBot } from '../BeryBot';

export function AppShell() {
  const location = useLocation();
  const hideBot = /^\/inbox\/\d+/.test(location.pathname);
  const isOrgMap = location.pathname === '/organizations';
  const isInbox = location.pathname.startsWith('/inbox');
  const flush = isOrgMap || isInbox;

  return (
    <div className={`flex min-h-screen flex-col pt-[76px] ${flush ? 'h-screen overflow-hidden pb-24 lg:pb-8' : 'pb-24 lg:pb-8'}`}>
      <TopNav />
      <main
        className={flush
          ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
          : 'mx-auto w-full max-w-[1280px] flex-1 px-margin-mobile py-stack-lg md:px-margin-desktop'}
      >
        <Outlet />
      </main>
      <BottomNav />
      {!hideBot && <BeryBot />}
    </div>
  );
}

import { useEffect, useRef } from 'react';

export function useLiveReload(callback, intervalMs = 8000) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    function refresh() {
      if (document.visibilityState === 'hidden') return;
      callbackRef.current();
    }

    const timer = window.setInterval(refresh, intervalMs);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [intervalMs]);
}

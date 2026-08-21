import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { applyUserSession, CMS_ORIGIN } from '../store/authSlice';
import { authApi } from '../api';
import { apiMessage } from '../api/http';
import { useUi } from '../context/UiContext';

export function GoogleButton({ coords }) {
  const dispatch = useDispatch();
  const { toast } = useUi();
  const ref = useRef(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId || !ref.current) return undefined;
    let cancelled = false;

    function render() {
      if (cancelled || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          try {
            const data = await authApi.googleLogin({
              id_token: response.credential,
              latitude: coords.latitude,
              longitude: coords.longitude,
            });
            dispatch(applyUserSession(data));
            window.location.assign('/home');
          } catch (error) {
            if (error.code === 'ADMIN_CMS') {
              toast(`Akun admin masuk lewat CMS di ${CMS_ORIGIN}`, 'error');
              return;
            }
            toast(apiMessage(error, 'Invalid google token'), 'error');
          }
        },
      });
      window.google.accounts.id.renderButton(ref.current, { theme: 'outline', size: 'large', width: 320 });
    }

    if (window.google?.accounts?.id) {
      render();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = render;
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, [clientId, coords, dispatch, toast]);

  if (!clientId) {
    return (
      <p className="rounded-2xl bg-surface-container px-4 py-3 text-xs text-on-surface-variant">
        Login Google nonaktif: isi <code>VITE_GOOGLE_CLIENT_ID</code> di <code>.env</code>.
      </p>
    );
  }

  return <div ref={ref} className="flex justify-center" />;
}

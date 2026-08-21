import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { authApi } from '../api';
import { apiMessage } from '../api/http';
import { applyUserSession, CMS_ORIGIN } from '../store/authSlice';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field, Input } from '../components/ui/Input';
import { GoogleButton } from '../components/GoogleButton';
import { useGeolocation } from '../hooks/useGeolocation';
import { useUi } from '../context/UiContext';
import heroImage from '../assets/herosection.jpg';

export default function LoginPage() {
  const location = useLocation();
  const [form, setForm] = useState({ email: location.state?.email || '', password: '' });
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { toast } = useUi();
  const { coords } = useGeolocation();

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const data = await authApi.login(form);
      dispatch(applyUserSession(data));
      navigate('/home');
    } catch (error) {
      if (error.code === 'ADMIN_CMS') {
        toast(`Akun admin masuk lewat CMS di ${CMS_ORIGIN}`, 'error');
        return;
      }
      toast(apiMessage(error, 'Invalid email or password'), 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="relative hidden md:block">
        <img src={heroImage} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-inverse-surface/40" />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <p className="font-display text-3xl font-extrabold">BeryBox</p>
          <p className="mt-2 text-white/90">Donasi dan barter barang layak pakai di sekitarmu.</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-margin-mobile py-12 md:px-margin-desktop">
        <Card className="w-full max-w-md p-8">
          <h1 className="font-display text-3xl font-extrabold text-on-surface">Masuk</h1>
          <p className="mt-2 text-on-surface-variant">Lanjutkan berbagi dengan komunitasmu.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Email">
              <Input
                type="email"
                required
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="alice@mail.com"
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                required
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder="••••••••"
              />
            </Field>
            <Button type="submit" className="w-full" size="lg" loading={loading}>
              Masuk
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-on-surface-variant">
            <span className="h-px flex-1 bg-outline-variant" /> atau <span className="h-px flex-1 bg-outline-variant" />
          </div>

          <GoogleButton coords={coords} />

          <p className="mt-6 text-center text-sm text-on-surface-variant">
            Belum punya akun?{' '}
            <Link to="/register" className="font-label text-primary underline">
              Daftar
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}

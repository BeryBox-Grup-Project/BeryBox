import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import { apiMessage } from '../api/http';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field, Input, Select } from '../components/ui/Input';
import { LocationPicker } from '../components/LocationPicker';
import { GoogleButton } from '../components/GoogleButton';
import { useSyncedMapPosition } from '../hooks/useGeolocation';
import { useUi } from '../context/UiContext';

export default function RegisterPage() {
  const location = useLocation();
  const { position, setPosition } = useSyncedMapPosition();
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    role: location.state?.role === 'organization' ? 'organization' : 'user',
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useUi();

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      await authApi.register({
        ...form,
        latitude: Number(position.latitude),
        longitude: Number(position.longitude),
      });
      toast('Akun dibuat. Silakan masuk.', 'success');
      navigate('/login', { state: { email: form.email } });
    } catch (error) {
      toast(apiMessage(error, 'Validation error'), 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-margin-mobile py-12 md:px-margin-desktop">
      <Card className="p-8">
        <h1 className="font-display text-3xl font-extrabold text-on-surface">Daftar</h1>
        <p className="mt-2 text-on-surface-variant">
          Satu akun untuk memberi dan menerima. Lokasi dipakai untuk mencari barang terdekat.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Username">
              <Input
                required
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
                placeholder="fitria"
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                required
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="fitria@mail.com"
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Password" hint="Minimal 8 karakter">
              <Input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            </Field>
            <Field label="Jenis akun">
              <Select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                <option value="user">Perorangan</option>
                <option value="organization">Organisasi</option>
              </Select>
            </Field>
          </div>

          <Field label="Lokasi" hint="Klik peta untuk menggeser titik lokasimu">
            <LocationPicker value={position} onChange={setPosition} />
          </Field>

          <Button type="submit" size="lg" className="w-full" loading={loading}>
            Buat akun
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-on-surface-variant">
          <span className="h-px flex-1 bg-outline-variant" /> atau <span className="h-px flex-1 bg-outline-variant" />
        </div>
        <GoogleButton coords={position} />

        <p className="mt-6 text-center text-sm text-on-surface-variant">
          Sudah punya akun?{' '}
          <Link to="/login" className="font-label text-primary underline">
            Masuk
          </Link>
        </p>
      </Card>
    </div>
  );
}

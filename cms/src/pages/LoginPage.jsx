import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { motion } from 'motion/react';
import { authApi, apiMessage } from '../api';
import { applyAdminSession } from '../store';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field, Input } from '../components/ui/Input';
import { useUi } from '../context/UiContext';
import { CLIENT_URL } from '../lib/config';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { toast } = useUi();

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const data = await authApi.login(form);
      dispatch(applyAdminSession(data));
      navigate('/');
    } catch (error) {
      if (error.code === 'NOT_ADMIN') {
        toast('CMS hanya untuk akun admin. User biasa masuk lewat aplikasi utama.', 'error');
        return;
      }
      toast(apiMessage(error, 'Invalid email or password'), 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-primary-container px-12 py-16 text-on-primary-container md:flex md:flex-col md:justify-between">
        <p className="font-display text-3xl font-extrabold text-white">BeryBox</p>
        <div>
          <h1 className="font-display text-4xl font-extrabold leading-tight text-white">
            Panel admin komunitas.
          </h1>
          <p className="mt-4 max-w-sm text-white/80">
            Verifikasi organisasi, pantau laporan, dan jaga agar donasi tetap aman.
          </p>
        </div>
        <p className="text-sm text-white/60">CMS · admin only</p>
      </div>

      <div className="flex items-center justify-center bg-background px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="p-8">
            <p className="font-display text-2xl font-extrabold text-primary md:hidden">BeryBox CMS</p>
            <h2 className="font-display text-3xl font-extrabold text-on-surface">Masuk admin</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              User biasa buka{' '}
              <a href={CLIENT_URL} className="text-primary underline">{CLIENT_URL}</a>.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <Field label="Email">
                <Input
                  type="email"
                  required
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  placeholder="admin@berybox.com"
                />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  required
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                />
              </Field>
              <Button type="submit" className="w-full" size="lg" loading={loading}>
                Masuk
              </Button>
            </form>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

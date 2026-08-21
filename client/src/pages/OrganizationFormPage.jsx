import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { orgsApi } from '../api';
import { apiMessage } from '../api/http';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field, Input, Select, Textarea } from '../components/ui/Input';
import { LocationPicker } from '../components/LocationPicker';
import { useSyncedMapPosition } from '../hooks/useGeolocation';
import { useImageKitUpload } from '../hooks/useImageKitUpload';
import { useUi } from '../context/UiContext';
import { ORG_TYPES, ORG_TYPE_LABELS } from '../lib/labels';
import { bootstrap } from '../store/authSlice';

export default function OrganizationFormPage() {
  const { position, setPosition } = useSyncedMapPosition();
  const { upload, uploading, configured } = useImageKitUpload();
  const [form, setForm] = useState({
    name: '',
    type: 'orphanage',
    description: '',
    email: '',
    phone: '',
    website: '',
    photoUrl: '',
  });
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { toast } = useUi();

  async function pickPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const url = await upload(file);
      setForm((prev) => ({ ...prev, photoUrl: url }));
      toast('Foto terunggah.', 'success');
    } catch (error) {
      toast(error.message || 'Gagal mengunggah gambar', 'error');
    }
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        type: form.type,
        description: form.description,
        latitude: Number(position.latitude),
        longitude: Number(position.longitude),
      };
      if (form.email.trim()) payload.email = form.email.trim();
      if (form.phone.trim()) payload.phone = form.phone.trim();
      if (form.website.trim()) payload.website = form.website.trim();
      if (form.photoUrl) payload.photoUrl = form.photoUrl;
      const created = await orgsApi.create(payload);
      await dispatch(bootstrap());
      toast('Pengajuan verifikasi terkirim ke CMS.', 'success');
      navigate(`/organizations/${created.id}`);
    } catch (error) {
      toast(apiMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[800px]">
      <div className="py-stack-lg text-center">
        <h1 className="font-display text-3xl font-extrabold text-primary">Ajukan verifikasi organisasi</h1>
        <p className="mt-2 text-on-surface-variant">
          Kirim profil ke CMS. Admin yang menyetujui, baru akun ini bisa menerima donasi.
        </p>
      </div>

      <Card className="p-6 md:p-8">
        <form onSubmit={submit} className="space-y-stack-md">
          <Field label="Nama organisasi">
            <Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Panti Asuhan Melati" />
          </Field>

          <Field label="Jenis">
            <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
              {ORG_TYPES.map((row) => (
                <option key={row} value={row}>{ORG_TYPE_LABELS[row]}</option>
              ))}
            </Select>
          </Field>

          <Field label="Deskripsi">
            <Textarea
              required
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Panti untuk anak sekolah dasar di Bandung."
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Email" hint="Opsional, untuk tawaran jika belum klaim inbox">
              <Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </Field>
            <Field label="Telepon" hint="Opsional">
              <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </Field>
          </div>
          <Field label="Situs web" hint="Opsional">
            <Input value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} placeholder="https://" />
          </Field>

          <Field label="Foto cover" hint={configured ? 'Unggah ke ImageKit' : 'Isi kunci ImageKit di .env'}>
            <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-outline-variant p-6">
              {form.photoUrl ? (
                <img src={form.photoUrl} alt="" className="max-h-40 rounded-xl object-contain" />
              ) : (
                <span className="text-sm text-on-surface-variant">{uploading ? 'Mengunggah...' : 'Klik untuk unggah foto'}</span>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={pickPhoto} disabled={!configured || uploading} />
            </label>
          </Field>

          <Field label="Lokasi" hint="Klik peta untuk menyesuaikan titik">
            <LocationPicker value={position} onChange={setPosition} />
          </Field>

          <Button type="submit" size="lg" className="w-full" loading={saving}>Ajukan verifikasi</Button>
        </form>
      </Card>
    </div>
  );
}

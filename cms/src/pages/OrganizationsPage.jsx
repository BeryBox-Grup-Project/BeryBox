import { Buildings, MapPin } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { adminApi, apiMessage } from '../api';
import { Button } from '../components/ui/Button';
import { Card, Badge } from '../components/ui/Card';
import { EmptyState, Skeleton } from '../components/ui/Feedback';
import { Modal } from '../components/ui/Modal';
import { Field, Input, Select, Textarea } from '../components/ui/Input';
import { useUi } from '../context/UiContext';

const TYPE_LABELS = {
  orphanage: 'Panti Asuhan',
  volunteer: 'Relawan',
  community: 'Komunitas',
  other: 'Lainnya',
};

const EMPTY_FORM = {
  name: '',
  type: 'orphanage',
  description: '',
  latitude: -6.9175,
  longitude: 107.6191,
  email: '',
  phone: '',
  website: '',
};

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [research, setResearch] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const { toast } = useUi();

  const load = useCallback(async () => {
    try {
      const rows = await adminApi.organizations(q ? { q } : undefined);
      setOrganizations(Array.isArray(rows) ? rows : []);
    } catch (error) {
      toast(apiMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [q, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(load, 6000);
    window.addEventListener('focus', load);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', load);
    };
  }, [load]);

  async function run(id, fn, message) {
    setBusyId(id);
    try {
      const result = await fn();
      toast(message, 'success');
      if (result?.reply) setResearch({ name: organizations.find((row) => row.id === id)?.name, ...result });
      await load();
    } catch (error) {
      toast(apiMessage(error, 'AI sedang sibuk'), 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function submitCreate(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        description: form.description.trim(),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
      };
      if (form.email.trim()) payload.email = form.email.trim();
      if (form.phone.trim()) payload.phone = form.phone.trim();
      if (form.website.trim()) payload.website = form.website.trim();
      await adminApi.createOrganization(payload);
      toast('Organisasi ditambahkan dan langsung terverifikasi.', 'success');
      setForm(EMPTY_FORM);
      setFormOpen(false);
      await load();
    } catch (error) {
      toast(apiMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-on-surface">Verifikasi organisasi</h1>
          <p className="mt-2 text-on-surface-variant">
            Tambah organisasi dari CMS, lalu setujui klaim akun jika ada.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>Tambah organisasi</Button>
      </div>

      <form
        className="mt-6 flex gap-2 rounded-3xl border border-surface-variant bg-surface-container-lowest p-4"
        onSubmit={(event) => {
          event.preventDefault();
          setLoading(true);
          setQ(search.trim());
        }}
      >
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari nama, alamat, atau deskripsi panti..."
        />
        <Button type="submit" variant="secondary">Cari</Button>
      </form>

      {loading ? (
        <div className="mt-8"><Skeleton className="h-64 w-full" /></div>
      ) : organizations.length === 0 ? (
        <div className="mt-8">
          <EmptyState title={q ? 'Tidak ada panti yang cocok' : 'Belum ada organisasi'} />
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {organizations.map((org) => (
            <Card key={org.id} className="overflow-hidden p-0">
              <div className="flex flex-col md:flex-row">
                <div className="h-40 w-full bg-surface-container-low md:h-auto md:w-56">
                  {org.photoUrl ? (
                    <img src={org.photoUrl} alt={org.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-primary">
                      <Buildings size={40} weight="duotone" />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-headline text-base text-on-surface">{org.name}</h3>
                      <Badge tone={org.verified === 'approved' ? 'success' : org.verified === 'rejected' ? 'danger' : 'warning'}>
                        {org.verified}
                      </Badge>
                      <Badge>{TYPE_LABELS[org.type] || org.type}</Badge>
                      <Badge tone="neutral">{org.source}</Badge>
                      {org.userId ? <Badge tone="primary">Sudah diklaim</Badge> : <Badge>Belum diklaim</Badge>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">{org.description}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-on-surface-variant">
                      <MapPin size={12} /> {org.addressLabel}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="success"
                      loading={busyId === org.id}
                      onClick={() => run(org.id, () => adminApi.verifyOrg(org.id, 'approved'), 'Organisasi disetujui.')}
                    >
                      Setujui
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={busyId === org.id}
                      onClick={() => run(org.id, () => adminApi.verifyOrg(org.id, 'rejected'), 'Organisasi ditolak.')}
                    >
                      Tolak
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={busyId === org.id}
                      onClick={() => run(org.id, () => adminApi.research(org.id), 'Riset AI selesai.')}
                    >
                      Riset AI
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Tambah organisasi"
        description="Organisasi yang ditambah admin langsung terverifikasi. Akun organisasi di client bisa mengklaim profil ini nanti."
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button onClick={submitCreate} loading={saving}>Simpan</Button>
          </>
        }
      >
        <form onSubmit={submitCreate} className="space-y-3">
          <Field label="Nama">
            <Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="Jenis">
            <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Deskripsi">
            <Textarea
              required
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude">
              <Input
                type="number"
                step="any"
                required
                value={form.latitude}
                onChange={(event) => setForm({ ...form, latitude: event.target.value })}
              />
            </Field>
            <Field label="Longitude">
              <Input
                type="number"
                step="any"
                required
                value={form.longitude}
                onChange={(event) => setForm({ ...form, longitude: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Email" hint="Opsional">
            <Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </Field>
          <Field label="Telepon" hint="Opsional">
            <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </Field>
          <Field label="Situs web" hint="Opsional">
            <Input value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} />
          </Field>
        </form>
      </Modal>

      <Modal
        open={Boolean(research)}
        onClose={() => setResearch(null)}
        title={`Riset: ${research?.name || 'Organisasi'}`}
        footer={<Button onClick={() => setResearch(null)}>Tutup</Button>}
      >
        <p className="whitespace-pre-line text-sm text-on-surface">{research?.reply}</p>
      </Modal>
    </div>
  );
}

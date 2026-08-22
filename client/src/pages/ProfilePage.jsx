import { Coins, MapPin, Star } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { authApi, itemsApi } from '../api';
import { apiMessage } from '../api/http';
import { Button } from '../components/ui/Button';
import { Card, Badge } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { Field, Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { EmptyState, Skeleton, Stars } from '../components/ui/Feedback';
import { ItemCard } from '../components/Cards';
import { LocationPicker } from '../components/LocationPicker';
import { useImageKitUpload } from '../hooks/useImageKitUpload';
import { useUi } from '../context/UiContext';
import { logout, setUser } from '../store/authSlice';
import { clearNotifications } from '../store/notificationsSlice';

export default function ProfilePage() {
  const me = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const { toast } = useUi();
  const { upload, uploading, configured } = useImageKitUpload();
  const [items, setItems] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ username: '', photoUrl: '', latitude: 0, longitude: 0 });
  const [completeItem, setCompleteItem] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!me?.id) return undefined;
    let active = true;
    Promise.all([itemsApi.mine(), authApi.userReviews(me.id), authApi.me()])
      .then(([mine, rows, fresh]) => {
        if (!active) return;
        setItems(Array.isArray(mine) ? mine : []);
        setReviews(Array.isArray(rows) ? rows : []);
        if (fresh) dispatch(setUser(fresh));
      })
      .catch((error) => toast(apiMessage(error), 'error'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [me?.id, toast, dispatch]);

  function openEdit() {
    setForm({
      username: me.username || '',
      photoUrl: me.photoUrl || '',
      latitude: me.latitude,
      longitude: me.longitude,
    });
    setEditOpen(true);
  }

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

  async function saveProfile() {
    setSaving(true);
    try {
      const updated = await authApi.updateMe({
        username: form.username.trim(),
        photoUrl: form.photoUrl || null,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
      });
      dispatch(setUser(updated));
      toast('Profil diperbarui.', 'success');
      setEditOpen(false);
    } catch (error) {
      toast(apiMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function confirmLogout() {
    dispatch(logout());
    dispatch(clearNotifications());
    setLogoutOpen(false);
    navigate('/');
  }

  async function completeNeed() {
    if (!completeItem) return;
    setCompleting(true);
    try {
      const updated = await itemsApi.complete(completeItem.id);
      setItems((prev) => prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
      setCompleteItem(null);
      toast('Kebutuhan ditandai selesai.', 'success');
    } catch (error) {
      toast(apiMessage(error, 'Kebutuhan ini belum bisa ditandai selesai.'), 'error');
    } finally {
      setCompleting(false);
    }
  }

  if (!me) return <Skeleton className="h-64 w-full" />;

  return (
    <div>
      <div className="mb-stack-lg grid gap-gutter md:grid-cols-12">
        <Card className="relative flex flex-col items-center gap-stack-md overflow-hidden p-stack-md sm:flex-row sm:items-start md:col-span-8">
          <span className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-primary-container opacity-10" />
          <Avatar src={me.photoUrl} name={me.username} size="3xl" className="border-4 border-surface" />
          <div className="flex-1 text-center sm:text-left">
            <h1 className="font-headline text-2xl text-on-surface">{me.username}</h1>
            <p className="text-on-surface-variant">{me.email}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Badge className="inline-flex items-center gap-1">
                <Star size={12} weight="fill" /> {(me.ratingAvg || 0).toFixed(1)} ({reviews.length} ulasan)
              </Badge>
              <Badge tone="success">{me.role === 'organization' ? 'Akun organisasi' : 'Anggota'}</Badge>
              {me.organization && (
                <Badge tone={me.organization.verified === 'approved' ? 'success' : 'warning'}>
                  {me.organization.name}: {me.organization.verified === 'approved' ? 'terverifikasi' : me.organization.verified}
                </Badge>
              )}
              <Badge tone="neutral" className="inline-flex items-center gap-1">
                <MapPin size={12} /> {me.addressLabel}
              </Badge>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto">
            <Button onClick={openEdit} variant="secondary">Ubah profil</Button>
            <Button as={Link} to="/items/new" variant="secondary">
              {me.role === 'organization' ? 'Unggah kebutuhan' : 'Unggah barang'}
            </Button>
            {me.role !== 'organization' && (
              <Button as={Link} to="/barter" variant="secondary">Cari barter AI</Button>
            )}
            {me.role === 'organization' && !me.organization && (
              <Button as={Link} to="/organizations/new" variant="secondary">Ajukan verifikasi</Button>
            )}
            {me.role === 'organization' && me.organization?.verified === 'pending' && (
              <Button as={Link} to={`/organizations/${me.organization.id}`} variant="secondary">
                Menunggu verifikasi
              </Button>
            )}
            {me.role === 'organization' && me.organization?.verified === 'rejected' && (
              <Button as={Link} to="/organizations/new" variant="secondary">Ajukan ulang verifikasi</Button>
            )}
            <Button variant="ghost" onClick={() => setLogoutOpen(true)}>Keluar</Button>
          </div>
        </Card>

        <div
          className="soft-shadow relative flex min-h-[180px] flex-col justify-between overflow-hidden rounded-3xl p-stack-md text-white md:col-span-4"
          style={{ backgroundColor: '#be185d' }}
        >
          <span className="pointer-events-none absolute -right-6 -bottom-8 h-28 w-28 rounded-full bg-white/15" />
          <Coins size={32} weight="duotone" className="relative text-white" />
          <div className="relative mt-4">
            <h2 className="font-label text-sm text-white/90">Kredit tersedia</h2>
            <p className="font-display mt-1 text-5xl font-extrabold tabular-nums text-white">
              {Number(me.creditBalance ?? 0)}
            </p>
          </div>
          <p className="font-label relative mt-stack-md max-w-[220px] text-xs text-white/80">
            Kredit menyeimbangkan nilai saat barter. Bukan uang dan tidak bisa dicairkan.
          </p>
        </div>
      </div>

      <section className="mb-stack-lg">
        <div className="mb-stack-md flex items-center justify-between">
          <h2 className="font-headline text-xl text-on-surface">
            {me.role === 'organization' ? 'Kebutuhan kami' : 'Barang saya'}
          </h2>
          <Link to="/history" className="font-label text-sm text-primary underline">Riwayat</Link>
        </div>
        {loading ? (
          <Skeleton className="h-56 w-full" />
        ) : items.length === 0 ? (
          <EmptyState
            title={me.role === 'organization' ? 'Belum ada kebutuhan' : 'Belum ada barang'}
            description={me.role === 'organization'
              ? 'Unggah barang yang dibutuhkan panti atau komunitasmu.'
              : 'Unggah barang pertamamu supaya bisa didonasikan atau dibarter.'}
            action={(
              <Button as={Link} to="/items/new">
                {me.role === 'organization' ? 'Unggah kebutuhan' : 'Unggah barang'}
              </Button>
            )}
          />
        ) : (
          <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item, index) => (
              <div key={item.id} className="flex h-full flex-col gap-2">
                <ItemCard item={{ ...item, owner: { id: me.id, username: me.username, ratingAvg: me.ratingAvg } }} index={index} />
                {me.role === 'organization' && item.type === 'organization' && item.status === 'available' && (
                  <Button variant="success" size="sm" onClick={() => setCompleteItem(item)}>
                    Selesai
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-headline mb-stack-md text-xl text-on-surface">Ulasan untukku</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Belum ada ulasan.</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <Card key={review.id} className="p-4">
                <Stars value={review.rating} readOnly size="text-base" />
                <p className="mt-2 text-sm text-on-surface">{review.comment}</p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Ubah profil"
        description="Username, foto, dan lokasi pengambilan."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Batal</Button>
            <Button onClick={saveProfile} loading={saving} disabled={!form.username.trim()}>Simpan</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Username">
            <Input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
          </Field>
          <Field label="Foto" hint={configured ? 'JPG/PNG' : 'Isi kunci ImageKit di .env untuk unggah foto'}>
            <label className="flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-outline-variant p-4">
              {form.photoUrl ? (
                <img src={form.photoUrl} alt="" className="h-24 w-24 rounded-full object-cover" />
              ) : (
                <span className="text-sm text-on-surface-variant">Pilih foto</span>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={pickPhoto} disabled={!configured || uploading} />
            </label>
          </Field>
          {form.latitude != null && form.longitude != null && (
            <Field label="Lokasi">
              <LocationPicker
                value={{ latitude: form.latitude, longitude: form.longitude }}
                onChange={(next) => setForm((prev) => ({ ...prev, ...next }))}
                height="h-48"
              />
            </Field>
          )}
        </div>
      </Modal>

      <Modal
        open={Boolean(completeItem)}
        onClose={() => !completing && setCompleteItem(null)}
        title="Tandai kebutuhan selesai?"
        description="Kebutuhan ini akan hilang dari beranda. Gunakan jika panti sudah mendapat barang yang dibutuhkan."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCompleteItem(null)} disabled={completing}>Belum</Button>
            <Button variant="success" onClick={completeNeed} loading={completing}>Ya, selesai</Button>
          </>
        }
      />

      <Modal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title="Keluar dari akun?"
        description="Kamu perlu masuk lagi untuk lanjut donasi, barter, atau melihat pesan."
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

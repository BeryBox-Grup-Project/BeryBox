import { Buildings, MapPin, Truck } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { itemsApi, orgsApi, requestsApi, inboxApi } from '../api';
import { apiMessage } from '../api/http';
import { Button } from '../components/ui/Button';
import { Card, Badge } from '../components/ui/Card';
import { Field, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Skeleton, EmptyState } from '../components/ui/Feedback';
import { ItemCard } from '../components/Cards';
import { ORG_TYPE_LABELS, formatDistance, isUnsplash } from '../lib/labels';
import { useGeolocation } from '../hooks/useGeolocation';
import { useLiveReload } from '../hooks/useLiveReload';
import { useUi } from '../context/UiContext';

export default function OrganizationDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const me = useSelector((state) => state.auth.user);
  const { coords } = useGeolocation();
  const { toast } = useUi();

  const preview = location.state?.organization;
  const [org, setOrg] = useState(() => (
    preview && String(preview.id) === String(id) ? preview : null
  ));
  const [needs, setNeeds] = useState([]);
  const [missing, setMissing] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [myItems, setMyItems] = useState([]);
  const [itemId, setItemId] = useState('');
  const [busy, setBusy] = useState(false);

  const lat = coords.latitude;
  const lng = coords.longitude;
  const visibleOrg = org && String(org.id) === String(id) ? org : null;

  useEffect(() => {
    let active = true;
    setMissing(false);
    setNeeds([]);
    orgsApi
      .detail(id, { lat, lng })
      .then((data) => {
        if (!active) return;
        setOrg(data);
        if (!data?.userId) return null;
        return itemsApi
          .list({ type: 'organization', ownerId: data.userId, limit: 24, lat, lng })
          .then((listed) => {
            if (!active) return;
            const rows = listed?.data || [];
            setNeeds(rows.filter((row) => row.owner?.id === data.userId));
          })
          .catch(() => {
            if (active) setNeeds([]);
          });
      })
      .catch((error) => {
        if (!active) return;
        setMissing(true);
        toast(apiMessage(error), 'error');
      });
    return () => {
      active = false;
    };
  }, [id, lat, lng, toast]);

  useLiveReload(() => {
    if (!id) return;
    orgsApi
      .detail(id, { lat, lng })
      .then(setOrg)
      .catch(() => {});
  }, 30000);

  async function openOffer() {
    try {
      const mine = await itemsApi.mine();
      setMyItems(mine.filter((row) => row.status === 'available' && row.type === 'public'));
      setOfferOpen(true);
    } catch (error) {
      toast(apiMessage(error), 'error');
    }
  }

  async function submitOffer() {
    setBusy(true);
    try {
      await requestsApi.create({ type: 'org_offer', itemId: Number(itemId), toUserId: org.userId });
      toast('Tawaran donasi terkirim.', 'success');
      setOfferOpen(false);
      navigate('/requests');
    } catch (error) {
      toast(apiMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function chat() {
    try {
      const conversation = await inboxApi.create({ otherUserId: org.userId });
      navigate(`/inbox/${conversation.id}`);
    } catch (error) {
      toast(apiMessage(error), 'error');
    }
  }

  async function claimProfile() {
    setBusy(true);
    try {
      const claimed = await orgsApi.claim({ googlePlaceId: org.googlePlaceId });
      setOrg((current) => ({ ...current, ...claimed }));
      toast('Klaim profil dikirim, tunggu verifikasi admin.', 'success');
    } catch (error) {
      toast(apiMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!visibleOrg) {
    if (missing) return <EmptyState title="Organisasi tidak ditemukan" />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-8 w-1/2" />
      </div>
    );
  }

  const gallery = org.galleryUrls?.length ? org.galleryUrls : org.photoUrl ? [org.photoUrl] : [];
  const canInboxOffer = org.offerChannel === 'inbox' && org.verified === 'approved' && org.userId;
  const mailBody = encodeURIComponent(
    `Halo ${org.name}, saya ${me?.username || ''}, berniat mengirim donasi. Apakah bersedia?`,
  );

  return (
    <div>
      <Link to="/organizations" className="font-label mb-4 inline-block text-sm text-on-surface-variant hover:text-primary">
        ← Kembali ke daftar organisasi
      </Link>

      <Card className="overflow-hidden p-0">
        <div className="h-64 w-full bg-surface-container-low md:h-80 relative">
            {org.photoUrl ? (
              <img src={org.photoUrl} alt={org.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-primary">
                <Buildings size={64} weight="duotone" />
              </div>
            )}
            {isUnsplash(org.photoUrl) && (
              <p className="absolute bottom-3 left-3 rounded-full bg-surface/90 px-3 py-1 text-[11px] text-on-surface-variant">
                Foto ilustrasi Unsplash
              </p>
            )}
        </div>
        <div className="p-6">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone="primary">{ORG_TYPE_LABELS[org.type]}</Badge>
            <Badge tone={org.verified === 'approved' ? 'success' : 'warning'}>
              {org.verified === 'approved' ? 'Terverifikasi' : org.verified}
            </Badge>
            {org.source === 'openstreetmap' && <Badge>Data OpenStreetMap</Badge>}
          </div>
          <h1 className="font-display text-3xl font-extrabold text-on-surface">{org.name}</h1>
          <p className="mt-3 text-on-surface-variant">{org.description}</p>
          <p className="mt-3 flex items-center gap-2 text-sm text-on-surface-variant">
            <MapPin size={16} className="shrink-0" />
            {org.addressLabel}
            {org.distanceKm != null && ` · ${formatDistance(org.distanceKm)}`}
          </p>
          {org.suggestedShipping?.length > 0 && (
            <p className="mt-1 flex items-center gap-2 text-sm text-on-surface-variant">
              <Truck size={16} className="shrink-0" />
              Opsi kirim: {org.suggestedShipping.map((row) => (row === 'pickup' ? 'ambil sendiri' : 'kurir')).join(', ')}
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {canInboxOffer && <Button onClick={openOffer}>Tawarkan donasi</Button>}
            {canInboxOffer && <Button variant="secondary" onClick={chat}>Chat organisasi</Button>}
            {org.offerChannel === 'email' && org.email && (
              <Button as="a" href={`mailto:${org.email}?subject=${encodeURIComponent(`Donasi untuk ${org.name}`)}&body=${mailBody}`}>
                Tawarkan via email
              </Button>
            )}
            {org.offerChannel === 'phone' && org.phone && (
              <Button as="a" href={`tel:${org.phone}`} variant="secondary">Hubungi {org.phone}</Button>
            )}
            {org.offerChannel === 'website' && org.website && (
              <Button as="a" href={org.website} target="_blank" rel="noreferrer" variant="secondary">Buka situs organisasi</Button>
            )}
            {org.offerChannel === 'none' && (
              <p className="text-sm text-on-surface-variant">Belum ada kanal tawaran untuk organisasi ini.</p>
            )}
            {org.userId && org.verified !== 'approved' && org.offerChannel === 'inbox' && (
              <p className="text-sm text-on-surface-variant">Organisasi ini belum terverifikasi, tawaran donasi belum bisa dikirim.</p>
            )}
            {!org.userId && me?.role === 'organization' && org.googlePlaceId && (
              <Button variant="secondary" onClick={claimProfile} loading={busy}>Klaim profil ini</Button>
            )}
          </div>
        </div>
      </Card>

      {gallery.length > 1 && (
        <section className="mt-stack-lg">
          <h2 className="font-headline mb-stack-md text-xl text-on-surface">Galeri</h2>
          <div className="grid grid-cols-2 gap-gutter md:grid-cols-3">
            {gallery.map((url) => (
              <img key={url} src={url} alt={org.name} loading="lazy" className="soft-shadow h-40 w-full rounded-2xl object-cover" />
            ))}
          </div>
        </section>
      )}

      {needs.length > 0 && (
        <section className="mt-stack-lg">
          <h2 className="font-headline mb-stack-md text-xl text-on-surface">Kebutuhan saat ini</h2>
          <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2">
            {needs.map((item, index) => (
              <ItemCard key={item.id} item={item} index={index} />
            ))}
          </div>
        </section>
      )}

      <Modal
        open={offerOpen}
        onClose={() => setOfferOpen(false)}
        title={`Tawarkan donasi ke ${org.name}`}
        description="Pilih barang yang ingin kamu donasikan."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOfferOpen(false)}>Batal</Button>
            <Button onClick={submitOffer} loading={busy} disabled={!itemId}>Kirim tawaran</Button>
          </>
        }
      >
        {myItems.length === 0 ? (
          <p className="text-sm text-on-surface-variant">
            Belum ada barang tersedia. <Link to="/items/new" className="text-primary underline">Unggah dulu</Link>.
          </p>
        ) : (
          <Field label="Barang">
            <Select value={itemId} onChange={(event) => setItemId(event.target.value)}>
              <option value="">Pilih barang</option>
              {myItems.map((row) => (
                <option key={row.id} value={row.id}>{row.title}</option>
              ))}
            </Select>
          </Field>
        )}
      </Modal>
    </div>
  );
}

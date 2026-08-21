import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { itemsApi, requestsApi, inboxApi, orgsApi, reviewsApi } from '../api';
import { apiMessage } from '../api/http';
import { Button } from '../components/ui/Button';
import { Card, Badge } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { Field, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Skeleton, EmptyState } from '../components/ui/Feedback';
import { ChatCircle, Hand, Info, MapPin, Package, Star } from '@phosphor-icons/react';
import { CATEGORY_LABELS, CONDITION_LABELS, STATUS_LABELS, TYPE_LABELS, formatDistance } from '../lib/labels';
import { useGeolocation } from '../hooks/useGeolocation';
import { useUi } from '../context/UiContext';

export default function ItemDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const me = useSelector((state) => state.auth.user);
  const { coords } = useGeolocation();
  const { toast } = useUi();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claimOpen, setClaimOpen] = useState(false);
  const [barterOpen, setBarterOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [myItems, setMyItems] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [targetItemId, setTargetItemId] = useState('');
  const [orgUserId, setOrgUserId] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [related, setRelated] = useState([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    itemsApi
      .detail(id, { lat: coords.latitude, lng: coords.longitude })
      .then((data) => active && setItem(data))
      .catch((error) => toast(apiMessage(error), 'error'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id, coords, toast]);

  useEffect(() => {
    if (!item?.id) return undefined;
    let active = true;
    itemsApi
      .list({
        category: item.category,
        limit: 8,
        lat: coords.latitude,
        lng: coords.longitude,
      })
      .then((data) => {
        if (!active) return;
        const rows = Array.isArray(data) ? data : data.data || [];
        setRelated(rows.filter((row) => row.id !== item.id).slice(0, 3));
      })
      .catch(() => {
        if (active) setRelated([]);
      });
    return () => {
      active = false;
    };
  }, [item?.id, item?.category, coords.latitude, coords.longitude]);

  const isOwner = me && item && me.id === item.owner?.id;

  async function openBarter() {
    try {
      const mine = await itemsApi.mine();
      setMyItems(mine.filter((row) => row.type === 'barter' && row.status === 'available'));
      setBarterOpen(true);
    } catch (error) {
      toast(apiMessage(error), 'error');
    }
  }

  async function openFulfill() {
    try {
      const mine = await itemsApi.mine();
      setMyItems(mine.filter((row) => row.type === 'public' && row.status === 'available'));
      setOfferOpen(true);
    } catch (error) {
      toast(apiMessage(error), 'error');
    }
  }

  async function openOffer() {
    try {
      const data = await orgsApi.list({ lat: coords.latitude, lng: coords.longitude, limit: 50 });
      const rows = Array.isArray(data) ? data : data.data || [];
      setOrgs(rows.filter((row) => row.userId && row.verified === 'approved'));
      setOfferOpen(true);
    } catch (error) {
      toast(apiMessage(error), 'error');
    }
  }

  async function cancelItem() {
    setBusy(true);
    try {
      await itemsApi.cancel(item.id);
      setCancelOpen(false);
      toast('Barang dibatalkan.', 'success');
      navigate('/profile');
    } catch (error) {
      toast(apiMessage(error, 'Barang yang sudah didonasikan tidak bisa dibatalkan.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function completeNeed() {
    setBusy(true);
    try {
      const updated = await itemsApi.complete(item.id);
      setItem(updated);
      setCompleteOpen(false);
      toast('Kebutuhan ditandai selesai.', 'success');
    } catch (error) {
      toast(apiMessage(error, 'Kebutuhan ini belum bisa ditandai selesai.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function submitClaim() {
    setBusy(true);
    try {
      await requestsApi.create({ type: 'claim', itemId: item.id, reason });
      toast('Klaim terkirim. Tunggu jawaban pemilik.', 'success');
      setClaimOpen(false);
      setReason('');
      navigate('/requests');
    } catch (error) {
      toast(apiMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function submitBarter() {
    setBusy(true);
    try {
      await requestsApi.create({ type: 'barter', itemId: Number(targetItemId), targetItemId: item.id });
      toast('Tawaran barter terkirim.', 'success');
      setBarterOpen(false);
      navigate('/requests');
    } catch (error) {
      toast(apiMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function submitFulfill() {
    setBusy(true);
    try {
      await requestsApi.create({ type: 'org_offer', itemId: Number(targetItemId), toUserId: item.owner.id });
      toast('Tawaran donasi terkirim ke organisasi.', 'success');
      setOfferOpen(false);
      navigate('/requests');
    } catch (error) {
      toast(apiMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function submitOffer() {
    setBusy(true);
    try {
      await requestsApi.create({ type: 'org_offer', itemId: item.id, toUserId: Number(orgUserId) });
      toast('Tawaran donasi terkirim ke organisasi.', 'success');
      setOfferOpen(false);
      navigate('/requests');
    } catch (error) {
      toast(apiMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function submitReport() {
    setBusy(true);
    try {
      await reviewsApi.report({ targetType: 'item', targetId: item.id, reason: reportReason });
      toast('Laporan dikirim ke admin.', 'success');
      setReportOpen(false);
      setReportReason('');
    } catch (error) {
      toast(apiMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function chatOwner() {
    try {
      const conversation = await inboxApi.create({ otherUserId: item.owner.id, itemId: item.id });
      navigate(`/inbox/${conversation.id}`);
    } catch (error) {
      toast(apiMessage(error), 'error');
    }
  }

  async function decideClaim(requestId, status) {
    try {
      await requestsApi.update(requestId, { status });
      const refreshed = await itemsApi.detail(id, { lat: coords.latitude, lng: coords.longitude });
      setItem(refreshed);
      toast(status === 'accepted' ? 'Klaim diterima.' : 'Klaim ditolak.', 'success');
    } catch (error) {
      toast(apiMessage(error), 'error');
    }
  }

  if (loading) {
    return (
      <div className="grid gap-gutter md:grid-cols-2">
        <Skeleton className="aspect-[4/3] w-full" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
    );
  }

  if (!item) return <EmptyState title="Barang tidak ditemukan" description="Mungkin sudah dihapus pemiliknya." />;

  return (
    <div>
      <Link to="/home" className="font-label mb-4 inline-block text-sm text-on-surface-variant hover:text-primary">
        ← Kembali ke beranda
      </Link>

      <div className="grid items-start gap-gutter lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <div>
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <Card className="overflow-hidden p-0">
              <div className="aspect-[4/3] w-full bg-surface-container-low">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-primary">
                    <Package size={64} weight="duotone" />
                  </div>
                )}
              </div>
            </Card>
            {item.type === 'barter' && item.wantedImageUrl && (
              <Card className="hidden overflow-hidden p-0 sm:block">
                <img src={item.wantedImageUrl} alt={item.wantedTitle || 'Dicari'} className="h-full w-full object-cover" />
              </Card>
            )}
          </div>

          <Card className="mt-4 p-6">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge tone="primary">{TYPE_LABELS[item.type]}</Badge>
              <Badge>{CATEGORY_LABELS[item.category]}</Badge>
              <Badge>Kondisi: {CONDITION_LABELS[item.condition]}</Badge>
              {item.status !== 'available' && (
                <Badge tone={item.status === 'completed' ? 'success' : 'warning'}>
                  {STATUS_LABELS[item.status] || item.status}
                </Badge>
              )}
            </div>
            <h1 className="font-display text-3xl font-extrabold leading-tight text-on-surface">{item.title}</h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-on-surface-variant">
              <MapPin size={16} />
              {item.addressLabel} {item.distanceKm != null && `· ${formatDistance(item.distanceKm)}`}
            </p>
            <h2 className="font-headline mt-6 text-lg text-on-surface">Deskripsi</h2>
            <p className="mt-2 whitespace-pre-line text-on-surface-variant">{item.description}</p>
            {item.type === 'barter' && item.wantedTitle && (
              <div className="mt-5 rounded-2xl bg-surface-container p-4">
                <p className="font-label text-sm text-primary">Dicari untuk barter</p>
                <p className="font-headline mt-1 text-on-surface">{item.wantedTitle}</p>
                {item.wantedDescription && (
                  <p className="mt-1 text-sm text-on-surface-variant">{item.wantedDescription}</p>
                )}
              </div>
            )}
            {item.pendingClaimCount > 0 && (
              <p className="mt-4 text-sm text-on-surface-variant">{item.pendingClaimCount} orang sedang mengajukan klaim</p>
            )}
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <Card className="bg-surface-container p-5">
            <p className="font-label text-xs uppercase tracking-wide text-on-surface-variant">Pemilik</p>
            <div className="mt-3 flex items-center gap-3">
              <Avatar src={item.owner?.photoUrl} name={item.owner?.username} size="xl" />
              <div>
                {item.owner?.id ? (
                  <Link to={`/users/${item.owner.id}`} className="font-headline text-on-surface hover:text-primary">
                    {item.owner.username}
                  </Link>
                ) : (
                  <p className="font-headline text-on-surface">{item.owner?.username}</p>
                )}
                <p className="flex items-center gap-1 text-sm text-primary">
                  <Star size={14} weight="fill" /> {(item.owner?.ratingAvg || 0).toFixed(1)}
                </p>
              </div>
            </div>
          </Card>

          <div className="flex flex-col gap-2">
            {!isOwner && item.status === 'available' && item.type === 'public' && (
              <Button className="w-full" onClick={() => setClaimOpen(true)}>
                <Hand size={18} /> Klaim barang
              </Button>
            )}
            {!isOwner && item.status === 'available' && item.type === 'barter' && (
              <>
                <Button className="w-full" onClick={openBarter}>Tawar barter</Button>
                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await requestsApi.create({ type: 'credit', itemId: item.id });
                      toast('Tawaran kredit terkirim.', 'success');
                      navigate('/requests');
                    } catch (error) {
                      toast(apiMessage(error), 'error');
                    } finally {
                      setBusy(false);
                    }
                  }}
                  loading={busy}
                >
                  Tawar dengan kredit
                </Button>
              </>
            )}
            {!isOwner && item.status === 'available' && item.type === 'organization' && (
              <Button className="w-full" onClick={openFulfill}>Saya bisa bantu</Button>
            )}
            {isOwner && item.status === 'available' && (
              <>
                {item.type === 'organization' && (
                  <Button className="w-full" variant="success" onClick={() => setCompleteOpen(true)}>Selesai</Button>
                )}
                {item.type !== 'organization' && (
                  <Button className="w-full" variant="secondary" onClick={openOffer}>Tawarkan ke organisasi</Button>
                )}
                <Button as={Link} to={`/items/${item.id}/edit`} className="w-full" variant="secondary">Ubah</Button>
                <Button className="w-full" variant="ghost" onClick={() => setCancelOpen(true)}>Batalkan</Button>
              </>
            )}
            {!isOwner && (
              <Button className="w-full" variant="secondary" onClick={chatOwner}>
                <ChatCircle size={18} /> Kirim pesan
              </Button>
            )}
            {!isOwner && (
              <Button className="w-full" variant="ghost" onClick={() => setReportOpen(true)}>Laporkan</Button>
            )}
          </div>

          <Card className="bg-error-container/40 p-4 text-sm text-on-error-container">
            <p className="flex gap-2">
              <Info size={18} className="mt-0.5 shrink-0" />
              Barang ini dibagikan, bukan dijual. Tetap sopan saat klaim dan janji temu.
            </p>
          </Card>

          {related.length > 0 && (
            <div>
              <h2 className="font-headline mb-3 text-sm text-on-surface">Mungkin kamu suka</h2>
              <div className="space-y-2">
                {related.map((row) => (
                  <Link key={row.id} to={`/items/${row.id}`} className="block">
                    <Card className="flex items-center gap-3 p-2 hover:border-primary">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-container">
                        {row.imageUrl ? (
                          <img src={row.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full items-center justify-center text-primary">
                            <Package size={22} weight="duotone" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <Badge tone="primary" className="text-[10px]">{TYPE_LABELS[row.type]}</Badge>
                        <p className="font-label mt-1 truncate text-sm text-on-surface">{row.title}</p>
                        {row.distanceKm != null && (
                          <p className="text-xs text-on-surface-variant">{formatDistance(row.distanceKm)}</p>
                        )}
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {isOwner && item.claims?.length > 0 && (
        <section className="mt-stack-lg">
          <h2 className="font-headline mb-stack-md text-xl text-on-surface">Permintaan klaim</h2>
          <div className="space-y-3">
            {item.claims.map((claim) => (
              <Card key={claim.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <Avatar src={claim.fromUser?.photoUrl} name={claim.fromUser?.username} size="md" />
                  <div>
                    <p className="font-label flex items-center gap-1 text-sm text-on-surface">
                      {claim.fromUser?.username} · <Star size={12} weight="fill" /> {(claim.fromUser?.ratingAvg || 0).toFixed(1)}
                    </p>
                    <p className="mt-1 text-sm text-on-surface-variant">{claim.reason}</p>
                  </div>
                </div>
                {claim.status === 'pending' ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="success" onClick={() => decideClaim(claim.id, 'accepted')}>Terima</Button>
                    <Button size="sm" variant="secondary" onClick={() => decideClaim(claim.id, 'rejected')}>Tolak</Button>
                  </div>
                ) : (
                  <Badge tone={claim.status === 'accepted' ? 'success' : 'danger'}>{claim.status}</Badge>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      <Modal
        open={claimOpen}
        onClose={() => setClaimOpen(false)}
        title="Klaim barang ini"
        description="Ceritakan kenapa kamu membutuhkannya."
        footer={
          <>
            <Button variant="secondary" onClick={() => setClaimOpen(false)}>Batal</Button>
            <Button onClick={submitClaim} loading={busy} disabled={!reason.trim()}>Kirim klaim</Button>
          </>
        }
      >
        <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="untuk adik yang baru masuk sekolah..." />
      </Modal>

      <Modal
        open={barterOpen}
        onClose={() => setBarterOpen(false)}
        title="Tawar barter"
        description="Pilih barang barter milikmu yang ditukarkan."
        footer={
          <>
            <Button variant="secondary" onClick={() => setBarterOpen(false)}>Batal</Button>
            <Button onClick={submitBarter} loading={busy} disabled={!targetItemId}>Kirim tawaran</Button>
          </>
        }
      >
        {myItems.length === 0 ? (
          <p className="text-sm text-on-surface-variant">
            Belum ada barang barter milikmu yang tersedia.{' '}
            <Link to="/items/new" className="text-primary underline">Unggah dulu</Link>.
          </p>
        ) : (
          <Field label="Barang punyaku">
            <Select value={targetItemId} onChange={(event) => setTargetItemId(event.target.value)}>
              <option value="">Pilih barang</option>
              {myItems.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.title} (kredit {row.creditValue})
                </option>
              ))}
            </Select>
          </Field>
        )}
      </Modal>

      <Modal
        open={offerOpen}
        onClose={() => { setOfferOpen(false); setTargetItemId(''); setOrgUserId(''); }}
        title={item.type === 'organization' && !isOwner ? 'Tawarkan donasi untuk kebutuhan ini' : 'Tawarkan ke organisasi'}
        description={item.type === 'organization' && !isOwner
          ? 'Pilih barang donasi milikmu yang ingin kamu kirim ke organisasi ini.'
          : 'Hanya organisasi terverifikasi yang bisa menerima donasi.'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOfferOpen(false)}>Batal</Button>
            <Button
              onClick={item.type === 'organization' && !isOwner ? submitFulfill : submitOffer}
              loading={busy}
              disabled={item.type === 'organization' && !isOwner ? !targetItemId : !orgUserId}
            >
              Kirim tawaran
            </Button>
          </>
        }
      >
        {item.type === 'organization' && !isOwner ? (
          myItems.length === 0 ? (
            <p className="text-sm text-on-surface-variant">
              Belum ada barang donasi milikmu.{' '}
              <Link to="/items/new" className="text-primary underline">Unggah dulu</Link>.
            </p>
          ) : (
            <Field label="Barang punyaku">
              <Select value={targetItemId} onChange={(event) => setTargetItemId(event.target.value)}>
                <option value="">Pilih barang</option>
                {myItems.map((row) => (
                  <option key={row.id} value={row.id}>{row.title}</option>
                ))}
              </Select>
            </Field>
          )
        ) : orgs.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Belum ada organisasi terverifikasi di dekatmu.</p>
        ) : (
          <Field label="Organisasi">
            <Select value={orgUserId} onChange={(event) => setOrgUserId(event.target.value)}>
              <option value="">Pilih organisasi</option>
              {orgs.map((row) => (
                <option key={row.id} value={row.userId}>
                  {row.name} · {row.addressLabel}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </Modal>

      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Laporkan barang"
        description="Jelaskan kenapa barang ini perlu ditinjau."
        footer={
          <>
            <Button variant="secondary" onClick={() => setReportOpen(false)}>Batal</Button>
            <Button variant="danger" onClick={submitReport} loading={busy} disabled={!reportReason.trim()}>
              Kirim laporan
            </Button>
          </>
        }
      >
        <Textarea value={reportReason} onChange={(event) => setReportReason(event.target.value)} placeholder="foto tidak sesuai deskripsi" />
      </Modal>

      <Modal
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        title="Tandai kebutuhan selesai?"
        description="Kebutuhan ini akan hilang dari beranda. Gunakan jika panti sudah mendapat barang yang dibutuhkan."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCompleteOpen(false)}>Belum</Button>
            <Button variant="success" onClick={completeNeed} loading={busy}>Ya, selesai</Button>
          </>
        }
      />

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Batalkan unggahan?"
        description="Barang yang sudah didonasikan atau sedang diproses tidak bisa dibatalkan. Jika masih tersedia, unggahan akan dihapus dari beranda."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>Tetap tampilkan</Button>
            <Button variant="danger" onClick={cancelItem} loading={busy}>Ya, batalkan</Button>
          </>
        }
      />
    </div>
  );
}

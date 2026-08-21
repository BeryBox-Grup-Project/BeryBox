import { Check, Package, User } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { requestsApi, reviewsApi } from '../api';
import { apiMessage } from '../api/http';
import { Button } from '../components/ui/Button';
import { Card, Badge } from '../components/ui/Card';
import { Field, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { EmptyState, ModeratorNotice, Skeleton, Stars } from '../components/ui/Feedback';
import { TRACKING_STEPS, TYPE_LABELS, formatMoney } from '../lib/labels';
import { isModeratorNotice, isUnread, markNotificationRead, markNotificationsRead } from '../store/notificationsSlice';
import { useLiveReload } from '../hooks/useLiveReload';
import { useUi } from '../context/UiContext';

function loadSnap(clientKey, isProduction) {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.snap) return Promise.resolve(true);
  if (!clientKey) return Promise.resolve(false);

  return new Promise((resolve) => {
    const existing = document.getElementById('midtrans-snap');
    if (existing) {
      existing.addEventListener('load', () => resolve(Boolean(window.snap)));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.id = 'midtrans-snap';
    script.src = isProduction
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js';
    script.setAttribute('data-client-key', clientKey);
    script.onload = () => resolve(Boolean(window.snap));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

const REQUEST_TYPE_LABELS = {
  claim: 'Klaim',
  org_offer: 'Donasi ke organisasi',
  barter: 'Barter',
  credit: 'Kredit',
};

const STATUS_TONE = {
  pending: 'warning',
  accepted: 'success',
  rejected: 'danger',
  completed: 'primary',
};

function Stepper({ shipment }) {
  if (!shipment) return null;
  const currentIndex = TRACKING_STEPS.findIndex((step) => step.key === shipment.trackingStatus);
  return (
    <div className="relative pl-8">
      {TRACKING_STEPS.map((step, index) => {
        const done = index <= currentIndex;
        return (
          <div key={step.key} className="relative mb-5 last:mb-0">
            {index < TRACKING_STEPS.length - 1 && (
              <span
                className={`absolute -left-[21px] top-6 h-full w-0.5 ${done ? 'bg-tertiary-container' : 'bg-outline-variant'}`}
              />
            )}
            <span
              className={`absolute -left-[33px] top-0 flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                done ? 'bg-tertiary-container text-on-tertiary' : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {done ? <Check size={12} weight="bold" /> : index + 1}
            </span>
            <p className={`font-label text-sm ${done ? 'text-on-surface' : 'text-on-surface-variant'}`}>{step.label}</p>
          </div>
        );
      })}
    </div>
  );
}

function RequestCard({ request, direction, meId, onRefresh }) {
  const { toast } = useUi();
  const [busy, setBusy] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const syncingPay = useRef(false);

  const shipment = request.shipment;
  const canDecide = direction === 'incoming' && request.status === 'pending';
  const canChooseShipping =
    request.status === 'accepted' &&
    shipment?.trackingStatus === 'awaiting_method' &&
    (request.type === 'org_offer' ? direction === 'incoming' : direction === 'outgoing');
  const payer = shipment?.payer || 'from_user';
  const iAmPayer = payer === 'from_user' ? meId === request.fromUserId : meId === request.toUserId;
  const canPay = shipment?.method === 'courier_agent' && shipment?.paymentStatus === 'unpaid' && iAmPayer;
  const canTrack = ['preparing', 'in_transit', 'ready_for_pickup'].includes(shipment?.trackingStatus);
  const canComplete = request.status === 'accepted' && shipment && shipment.trackingStatus !== 'awaiting_method';
  const canRedeem = request.type === 'barter' && request.status === 'rejected' && direction === 'outgoing';

  async function run(fn, message) {
    setBusy(true);
    try {
      await fn();
      if (message) toast(message, 'success');
      await onRefresh();
    } catch (error) {
      toast(apiMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    setBusy(true);
    try {
      const data = await requestsApi.pay(request.id);
      const ready = window.snap || await loadSnap(data.clientKey, data.isProduction);
      if (ready && data.token) {
        window.snap.pay(data.token, {
          onSuccess: () => syncPaid('Pembayaran ongkir berhasil.'),
          onPending: () => syncPaid('Menunggu konfirmasi pembayaran dari Midtrans.'),
          onError: () => {
            toast('Pembayaran gagal. Coba lagi.', 'error');
            onRefresh();
          },
          onClose: () => syncPaid(),
        });
        return;
      }
      if (data.simulated) {
        toast('Pembayaran ongkir disimulasikan. Midtrans belum dikonfigurasi.', 'success');
        await onRefresh();
        return;
      }
      if (data.redirect_url) {
        window.open(data.redirect_url, '_blank', 'noopener');
        return;
      }
      toast('Midtrans belum siap. Isi MIDTRANS_SERVER_KEY dan MIDTRANS_CLIENT_KEY di server, lalu restart.', 'error');
    } catch (error) {
      toast(apiMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function syncPaid(message) {
    if (syncingPay.current) return;
    syncingPay.current = true;
    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const updated = await requestsApi.confirmPay(request.id);
        if (updated.shipment?.paymentStatus === 'paid') {
          if (message) toast(message, 'success');
          await onRefresh();
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 800));
      }
      if (message) toast(message, 'success');
    } catch (error) {
      toast(apiMessage(error), 'error');
    } finally {
      syncingPay.current = false;
    }
    await onRefresh();
  }

  async function submitReview() {
    setBusy(true);
    try {
      await reviewsApi.create({ requestId: request.id, rating, comment });
      toast('Ulasan terkirim.', 'success');
      setReviewOpen(false);
      setComment('');
      await onRefresh();
    } catch (error) {
      toast(apiMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-stack-md">
      <div className="flex flex-col gap-stack-md md:flex-row">
        <div className="flex gap-4 md:w-1/3">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-surface-container-low">
            {request.item?.imageUrl ? (
              <img src={request.item.imageUrl} alt={request.item.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-primary">
                <Package size={32} weight="duotone" />
              </div>
            )}
          </div>
          <div>
            <Badge tone={STATUS_TONE[request.status]}>{request.status}</Badge>
            <h3 className="font-label mt-2 text-sm text-on-surface">
              {request.item ? (
                <Link to={`/items/${request.item.id}`} className="hover:text-primary">{request.item.title}</Link>
              ) : (
                'Barang'
              )}
            </h3>
            <p className="mt-1 text-xs text-on-surface-variant">
              {REQUEST_TYPE_LABELS[request.type]}
              {request.item?.type && ` · ${TYPE_LABELS[request.item.type]}`}
            </p>
            {request.fromUser && (
              <p className="mt-1 flex items-center gap-1 text-xs text-on-surface-variant">
                <User size={12} /> {request.fromUser.username}
              </p>
            )}
            {request.reason && <p className="mt-2 line-clamp-3 text-xs text-on-surface-variant">“{request.reason}”</p>}
          </div>
        </div>

        <div className="flex-1 border-t border-outline-variant pt-4 md:border-l md:border-t-0 md:pl-stack-md md:pt-0">
          <h4 className="font-label mb-4 text-sm text-on-surface">Status pengiriman</h4>
          {shipment ? (
            <>
              <Stepper shipment={shipment} />
              {shipment.grossAmount > 0 && (
                <p className="mt-2 text-xs text-on-surface-variant">
                  Ongkir {formatMoney(shipment.grossAmount)} · pembayaran {shipment.paymentStatus}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-on-surface-variant">Belum ada pengiriman untuk permintaan ini.</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {canDecide && (
              <>
                <Button size="sm" variant="success" loading={busy} onClick={() => run(() => requestsApi.update(request.id, { status: 'accepted' }), 'Permintaan diterima.')}>
                  Terima
                </Button>
                <Button size="sm" variant="secondary" loading={busy} onClick={() => run(() => requestsApi.update(request.id, { status: 'rejected' }), 'Permintaan ditolak.')}>
                  Tolak
                </Button>
              </>
            )}
            {canChooseShipping && (
              <>
                <Button size="sm" loading={busy} onClick={() => run(() => requestsApi.shipping(request.id, { method: 'pickup' }), 'Metode ambil sendiri dipilih.')}>
                  Ambil sendiri
                </Button>
                <Button size="sm" variant="secondary" loading={busy} onClick={() => run(() => requestsApi.shipping(request.id, { method: 'courier_agent' }), 'Metode kurir dipilih.')}>
                  Pakai kurir
                </Button>
              </>
            )}
            {canPay && (
              <Button size="sm" loading={busy} onClick={pay}>Bayar ongkir</Button>
            )}
            {canTrack && shipment.trackingStatus !== 'in_transit' && shipment.trackingStatus !== 'ready_for_pickup' && (
              <Button size="sm" variant="secondary" loading={busy} onClick={() => run(() => requestsApi.tracking(request.id, { trackingStatus: 'in_transit' }), 'Status diperbarui.')}>
                Tandai dikirim
              </Button>
            )}
            {canTrack && (
              <Button size="sm" variant="secondary" loading={busy} onClick={() => run(() => requestsApi.tracking(request.id, { trackingStatus: 'delivered' }), 'Barang diterima.')}>
                Tandai diterima
              </Button>
            )}
            {canComplete && (
              <Button size="sm" variant="ghost" loading={busy} onClick={() => run(() => requestsApi.update(request.id, { status: 'completed' }), 'Transaksi selesai.')}>
                Selesaikan
              </Button>
            )}
            {canRedeem && (
              <Button size="sm" loading={busy} onClick={() => run(() => requestsApi.redeem(request.id), 'Barang ditebus dengan kredit.')}>
                Tebus pakai kredit
              </Button>
            )}
            {request.status === 'completed' && (
              <Button size="sm" variant="secondary" onClick={() => setReviewOpen(true)}>Beri ulasan</Button>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title="Beri ulasan"
        description="Bantu komunitas menilai kepercayaan."
        footer={
          <>
            <Button variant="secondary" onClick={() => setReviewOpen(false)}>Batal</Button>
            <Button onClick={submitReview} loading={busy} disabled={!comment.trim()}>Kirim</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Stars value={rating} onChange={setRating} />
          <Field label="Komentar">
            <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="penyerahan cepat dan barang sesuai" />
          </Field>
        </div>
      </Modal>
    </Card>
  );
}

export default function ActivityPage() {
  const [tab, setTab] = useState('incoming');
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(true);
  const dispatch = useDispatch();
  const notifications = useSelector((state) => state.notifications.items);
  const me = useSelector((state) => state.auth.user);
  const { toast } = useUi();

  const load = useCallback(async () => {
    try {
      const [inc, out] = await Promise.all([requestsApi.incoming(), requestsApi.outgoing()]);
      setIncoming(Array.isArray(inc) ? inc : []);
      setOutgoing(Array.isArray(out) ? out : []);
    } catch (error) {
      toast(apiMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
    dispatch(markNotificationsRead('activity')).catch(() => {});
  }, [load, dispatch]);

  useLiveReload(() => {
    load();
    dispatch(markNotificationsRead('activity')).catch(() => {});
  }, 6000);

  const rows = tab === 'incoming' ? incoming : outgoing;

  return (
    <div>
      <div className="mb-stack-lg flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-on-surface">Aktivitas</h1>
          <p className="mt-2 text-on-surface-variant">Permintaan masuk, keluar, dan status pengiriman.</p>
        </div>
        <Button as={Link} to="/history" variant="secondary">Riwayat selesai</Button>
      </div>

      {notifications.length > 0 && (
        <Card className="mb-stack-lg p-4">
          <h2 className="font-headline mb-3 text-sm text-on-surface">Notifikasi terbaru</h2>
          <ul className="space-y-2">
            {notifications.slice(0, 5).map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 text-sm">
                {isModeratorNotice(row) ? (
                  <ModeratorNotice message={row.message} className="flex-1" />
                ) : (
                  <span className={isUnread(row) ? 'text-on-surface' : 'text-on-surface-variant'}>{row.message}</span>
                )}
                {isUnread(row) && (
                  <button
                    type="button"
                    className="font-label shrink-0 text-xs text-primary underline"
                    onClick={() => dispatch(markNotificationRead(row.id))}
                  >
                    Tandai dibaca
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mb-stack-md flex border-b border-outline-variant">
        {[
          { key: 'incoming', label: `Masuk (${incoming.length})` },
          { key: 'outgoing', label: `Keluar (${outgoing.length})` },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`font-label px-6 py-3 text-sm ${
              tab === item.key ? 'border-b-2 border-primary text-primary' : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-40 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={tab === 'incoming' ? 'Belum ada permintaan masuk' : 'Belum ada permintaan keluar'}
          description="Klaim barang atau tawarkan donasi untuk memulai."
          action={<Button as={Link} to="/home">Lihat barang</Button>}
        />
      ) : (
        <div className="space-y-stack-md">
          {rows.map((request) => (
            <RequestCard key={request.id} request={request} direction={tab} meId={me?.id} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  );
}

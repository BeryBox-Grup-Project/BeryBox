import { Package } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { requestsApi } from '../api';
import { apiMessage } from '../api/http';
import { Card, Badge } from '../components/ui/Card';
import { EmptyState, Skeleton } from '../components/ui/Feedback';
import { formatMoney } from '../lib/labels';
import { useUi } from '../context/UiContext';

const SECTIONS = [
  { key: 'donated', title: 'Donasi yang kamu berikan' },
  { key: 'received', title: 'Barang yang kamu terima' },
  { key: 'offered', title: 'Tawaran ke organisasi' },
  { key: 'receivedOffers', title: 'Donasi yang organisasi terima' },
  { key: 'barters', title: 'Barter selesai' },
];

const TYPE_LABELS = {
  claim: 'Klaim',
  org_offer: 'Donasi organisasi',
  barter: 'Barter',
  credit: 'Kredit',
};

function HistoryCard({ request }) {
  return (
    <Card className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 overflow-hidden rounded-2xl bg-surface-container-low">
          {request.item?.imageUrl ? (
            <img src={request.item.imageUrl} alt={request.item.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-primary">
              <Package size={28} weight="duotone" />
            </div>
          )}
        </div>
        <div>
          <p className="font-label text-sm text-on-surface">
            {request.item ? (
              <Link to={`/items/${request.item.id}`} className="hover:text-primary">{request.item.title}</Link>
            ) : (
              'Barang'
            )}
          </p>
          <p className="text-xs text-on-surface-variant">{TYPE_LABELS[request.type] || request.type}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {request.shipment?.grossAmount > 0 && (
          <span className="text-xs text-on-surface-variant">{formatMoney(request.shipment.grossAmount)}</span>
        )}
        <Badge tone="primary">selesai</Badge>
      </div>
    </Card>
  );
}

export default function HistoryPage() {
  const [history, setHistory] = useState({
    donated: [],
    received: [],
    offered: [],
    receivedOffers: [],
    barters: [],
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useUi();

  useEffect(() => {
    requestsApi
      .history()
      .then((data) => {
        if (Array.isArray(data)) {
          setHistory({ donated: [], received: data, offered: [], receivedOffers: [], barters: [] });
          return;
        }
        setHistory({
          donated: data?.donated || [],
          received: data?.received || [],
          offered: data?.offered || [],
          receivedOffers: data?.receivedOffers || [],
          barters: data?.barters || [],
        });
      })
      .catch((error) => toast(apiMessage(error), 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) return <Skeleton className="h-64 w-full" />;

  const total = SECTIONS.reduce((sum, section) => sum + (history[section.key]?.length || 0), 0);

  return (
    <div>
      <h1 className="font-display mb-stack-lg text-3xl font-extrabold text-on-surface">Riwayat transaksi</h1>
      {total === 0 ? (
        <EmptyState title="Belum ada transaksi selesai" description="Transaksi muncul setelah barang diterima." />
      ) : (
        <div className="space-y-stack-lg">
          {SECTIONS.map((section) => {
            const rows = history[section.key] || [];
            if (rows.length === 0) return null;
            return (
              <section key={section.key}>
                <h2 className="font-headline mb-stack-md text-lg text-on-surface">{section.title}</h2>
                <div className="space-y-3">
                  {rows.map((request) => (
                    <HistoryCard key={request.id} request={request} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

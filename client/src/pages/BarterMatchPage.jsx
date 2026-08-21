import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkle } from '@phosphor-icons/react';
import { aiApi, itemsApi } from '../api';
import { apiMessage } from '../api/http';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field, Input, Select } from '../components/ui/Input';
import { ItemCard } from '../components/Cards';
import { CardSkeleton, EmptyState } from '../components/ui/Feedback';
import { CATEGORY_LABELS, ITEM_CATEGORIES } from '../lib/labels';
import { useGeolocation } from '../hooks/useGeolocation';
import { useLiveReload } from '../hooks/useLiveReload';
import { useUi } from '../context/UiContext';

export default function BarterMatchPage() {
  const [form, setForm] = useState({ have: '', want: '', category: '' });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const { coords } = useGeolocation();
  const { toast } = useUi();

  useEffect(() => {
    let active = true;
    itemsApi
      .list({ type: 'barter', lat: coords.latitude, lng: coords.longitude, limit: 50, sort: 'nearby' })
      .then((data) => {
        if (active) setItems(data?.data || []);
      })
      .catch((error) => toast(apiMessage(error), 'error'))
      .finally(() => active && setListLoading(false));
    return () => {
      active = false;
    };
  }, [coords, toast]);

  useLiveReload(() => {
    itemsApi
      .list({ type: 'barter', lat: coords.latitude, lng: coords.longitude, limit: 50, sort: 'nearby' })
      .then((data) => setItems(data?.data || []))
      .catch(() => {});
  }, 12000);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const payload = { have: form.have, want: form.want };
      if (form.category) payload.category = form.category;
      const data = await aiApi.match(payload);
      setResult(data);
    } catch (error) {
      toast(apiMessage(error, 'AI service unavailable'), 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-stack-lg text-center md:text-left">
        <h1 className="font-display text-3xl font-extrabold text-primary">Barter</h1>
        <p className="mt-2 text-on-surface-variant">
          Pakai AI matcher di kartu pertama, lalu jelajahi barang barter di sekitarmu.
        </p>
      </div>

      <section>
        {listLoading ? (
          <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => <CardSkeleton key={index} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <Card className="flex h-full flex-col p-4 sm:col-span-2">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary">
                  <Sparkle size={20} weight="fill" />
                </span>
                <div>
                  <h2 className="font-headline text-base text-on-surface">AI matcher barter</h2>
                  <p className="text-xs text-on-surface-variant">Cocokkan barang punya dan yang dicari.</p>
                </div>
              </div>
              <form onSubmit={submit} className="flex flex-1 flex-col gap-3">
                <Field label="Aku punya">
                  <Input required value={form.have} onChange={(event) => setForm({ ...form, have: event.target.value })} placeholder="kamera analog Canon AE-1" />
                </Field>
                <Field label="Aku mau">
                  <Input required value={form.want} onChange={(event) => setForm({ ...form, want: event.target.value })} placeholder="tanaman hias monstera" />
                </Field>
                <Field label="Kategori (opsional)">
                  <Select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                    <option value="">Semua kategori</option>
                    {ITEM_CATEGORIES.map((row) => (
                      <option key={row} value={row}>{CATEGORY_LABELS[row]}</option>
                    ))}
                  </Select>
                </Field>
                <Button type="submit" className="mt-auto w-full" loading={loading}>Cari kecocokan</Button>
              </form>
              {result && (
                <div className="mt-4 border-t border-outline-variant pt-4">
                  <p className="text-sm text-on-surface">{result.reply}</p>
                  {result.suggestions?.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {result.suggestions.map((row) => (
                        <li key={`${row.kind}-${row.id}`}>
                          <Link
                            to={row.kind === 'organization' ? `/organizations/${row.id}` : `/items/${row.id}`}
                            className="font-label text-sm text-primary underline"
                          >
                            {row.title || row.name}
                            {row.wantedTitle && ` (mau: ${row.wantedTitle})`}
                            {row.distanceKm != null && ` · ${row.distanceKm} km`}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </Card>
            {items.length === 0 ? (
              <div className="sm:col-span-2 lg:col-span-2">
                <EmptyState title="Belum ada barang barter" action={<Button as={Link} to="/items/new">Unggah barang</Button>} />
              </div>
            ) : items.map((item, index) => (
              <ItemCard key={item.id} item={item} index={index + 1} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

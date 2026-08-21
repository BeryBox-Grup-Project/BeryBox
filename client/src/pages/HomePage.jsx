import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { itemsApi } from '../api';
import { apiMessage } from '../api/http';
import { ItemCard, BarterMatcherCard } from '../components/Cards';
import { Card, Chip } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { CardSkeleton, EmptyState } from '../components/ui/Feedback';
import { BarterMatchForm } from '../components/BarterMatchForm';
import { CATEGORY_LABELS, ITEM_CATEGORIES } from '../lib/labels';
import { useGeolocation } from '../hooks/useGeolocation';
import { useLiveReload } from '../hooks/useLiveReload';
import { useUi } from '../context/UiContext';

const TYPE_FILTERS = [
  { value: '', label: 'Semua' },
  { value: 'public', label: 'Gratis' },
  { value: 'barter', label: 'Barter' },
  { value: 'organization', label: 'Kebutuhan' },
];

export default function HomePage() {
  const me = useSelector((state) => state.auth.user);
  const [params, setParams] = useSearchParams();
  const { coords } = useGeolocation();
  const { toast } = useUi();
  const [result, setResult] = useState({ data: [], page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(params.get('q') || '');
  const [matchOpen, setMatchOpen] = useState(false);

  const type = params.get('type') || '';
  const category = params.get('category') || '';
  const page = Number(params.get('page') || 1);
  const q = params.get('q') || '';
  const sort = params.get('sort') || 'newest';

  const query = useMemo(
    () => ({
      q: q || undefined,
      type: type || undefined,
      category: category || undefined,
      page,
      limit: 24,
      lat: coords.latitude,
      lng: coords.longitude,
      sort,
    }),
    [q, type, category, page, coords, sort],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    itemsApi
      .list(query)
      .then((data) => {
        if (active) setResult(data);
      })
      .catch((error) => toast(apiMessage(error), 'error'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [query, toast]);

  useLiveReload(() => {
    itemsApi.list(query).then(setResult).catch(() => {});
  }, 12000);

  const setFilter = useCallback(
    (patch) => {
      const next = new URLSearchParams(params);
      Object.entries(patch).forEach(([key, value]) => {
        if (value) next.set(key, value);
        else next.delete(key);
      });
      if (!('page' in patch)) next.delete('page');
      setParams(next);
    },
    [params, setParams],
  );

  return (
    <div>
      <div className="mb-stack-lg text-center md:text-left">
        <h1 className="font-display max-w-2xl text-3xl font-extrabold leading-tight text-on-surface md:text-4xl">
          Temukan di sekitarmu.
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-on-surface-variant md:mx-0">
          Donasikan, klaim, atau barter barang layak pakai.
        </p>
      </div>

      {me?.role === 'organization' && me.organization?.verified !== 'approved' && (
        <Card className="mb-stack-md flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-headline text-on-surface">Verifikasi organisasi</p>
            <p className="text-sm text-on-surface-variant">
              {me.organization?.verified === 'pending'
                ? 'Pengajuan sudah masuk CMS. Admin yang menyetujui, baru akun ini bisa menerima donasi.'
                : 'Ajukan profil ke CMS supaya akun organisasi bisa menerima donasi.'}
            </p>
          </div>
          {me.organization?.verified === 'pending' ? (
            <Button as={Link} to={`/organizations/${me.organization.id}`} variant="secondary">
              Lihat pengajuan
            </Button>
          ) : (
            <Button as={Link} to="/organizations/new">Ajukan verifikasi</Button>
          )}
        </Card>
      )}

      <form
        className="mb-stack-md flex flex-col gap-3 sm:flex-row sm:items-center"
        onSubmit={(event) => {
          event.preventDefault();
          setFilter({ q: search });
        }}
      >
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari di sekitarmu..."
          className="flex-1"
        />
        <div className="flex gap-2">
          <Button type="submit" variant="secondary">Cari</Button>
          <Button as={Link} to="/items/new" className="hidden md:inline-flex">Unggah barang</Button>
        </div>
      </form>

      <div className="mb-4 flex flex-wrap gap-2 border-b border-outline-variant/50 pb-4">
        {TYPE_FILTERS.map((filter) => (
          <Chip key={filter.label} active={type === filter.value} onClick={() => setFilter({ type: filter.value })}>
            {filter.label}
          </Chip>
        ))}
      </div>

      <div className="mb-stack-lg flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-label mb-2 text-xs uppercase tracking-wide text-on-surface-variant">Urutkan</p>
          <div className="flex flex-wrap gap-2">
            <Chip active={sort === 'newest'} onClick={() => setFilter({ sort: 'newest' })}>Terbaru</Chip>
            <Chip active={sort === 'oldest'} onClick={() => setFilter({ sort: 'oldest' })}>Terlama</Chip>
            <Chip active={sort === 'nearby'} onClick={() => setFilter({ sort: 'nearby' })}>Terdekat</Chip>
          </div>
        </div>
        <div className="min-w-0 flex-1 lg:max-w-xl">
          <p className="font-label mb-2 text-xs uppercase tracking-wide text-on-surface-variant">Kategori</p>
          <div className="no-scrollbar -mx-margin-mobile flex gap-2 overflow-x-auto px-margin-mobile pb-1 md:mx-0 md:flex-wrap md:px-0">
            {ITEM_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilter({ category: category === cat ? '' : cat })}
                className={`font-label shrink-0 rounded-full px-4 py-1.5 text-xs transition-colors ${
                  category === cat ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface hover:text-primary'
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      ) : (result.data || []).length === 0 && type !== 'barter' ? (
        <EmptyState
          title="Belum ada barang di sini"
          description="Coba ubah filter, atau jadi yang pertama mengunggah barang di sekitarmu."
          action={<Button as={Link} to="/items/new">Unggah barang</Button>}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {type === 'barter' && page <= 1 && (
              <BarterMatcherCard onClick={() => setMatchOpen(true)} />
            )}
            {(result.data || []).map((item, index) => (
              <ItemCard key={item.id} item={item} index={index + (type === 'barter' && page <= 1 ? 1 : 0)} />
            ))}
          </div>
          {type === 'barter' && (result.data || []).length === 0 && (
            <div className="mt-stack-md">
              <EmptyState
                title="Belum ada barang barter"
                description="Pakai AI matcher di kartu pertama, atau unggah barang barter."
                action={<Button as={Link} to="/items/new">Unggah barang</Button>}
              />
            </div>
          )}

          {result.totalPages > 1 && (
            <div className="mt-stack-lg flex items-center justify-center gap-4">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setFilter({ page: String(page - 1) })}
              >
                Sebelumnya
              </Button>
              <span className="font-label text-sm text-on-surface-variant">
                Halaman {result.page} dari {result.totalPages}
              </span>
              <Button
                variant="secondary"
                disabled={page >= result.totalPages}
                onClick={() => setFilter({ page: String(page + 1) })}
              >
                Berikutnya
              </Button>
            </div>
          )}
        </>
      )}

      <Modal
        open={matchOpen}
        onClose={() => setMatchOpen(false)}
        title="AI matcher barter"
        description="Tulis barang yang kamu punya dan yang kamu cari."
        footer={
          <Button as={Link} to="/barter" variant="secondary" onClick={() => setMatchOpen(false)}>
            Buka halaman barter
          </Button>
        }
      >
        <BarterMatchForm />
      </Modal>
    </div>
  );
}

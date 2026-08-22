import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { orgsApi } from '../api';
import { apiMessage } from '../api/http';
import { OrganizationCard } from '../components/Cards';
import { Button } from '../components/ui/Button';
import { Chip } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { CardSkeleton, EmptyState } from '../components/ui/Feedback';
import { setupLeafletIcons } from '../lib/leafletSetup';
import { useGeolocation } from '../hooks/useGeolocation';
import { useLiveReload } from '../hooks/useLiveReload';
import { useUi } from '../context/UiContext';

setupLeafletIcons();

function Recenter({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
    const timer = window.setTimeout(() => map.invalidateSize(), 120);
    return () => window.clearTimeout(timer);
  }, [center, map]);
  return null;
}

function useDesktopSplit() {
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 1280px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1280px)');
    const onChange = () => setDesktop(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return desktop;
}

export default function OrganizationsPage() {
  const { coords } = useGeolocation();
  const { toast } = useUi();
  const desktopSplit = useDesktopSplit();
  const [result, setResult] = useState({ data: [], page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('nearby');
  const [selectedId, setSelectedId] = useState(null);

  const query = useMemo(
    () => ({ q: q || undefined, lat: coords.latitude, lng: coords.longitude, limit: 50, sort }),
    [q, coords.latitude, coords.longitude, sort],
  );

  useEffect(() => {
    let active = true;
    const showSkeleton = result.data.length === 0;
    if (showSkeleton) setLoading(true);
    orgsApi
      .list(query)
      .then((data) => {
        if (!active) return;
        setResult(Array.isArray(data) ? { data, page: 1, totalPages: 1 } : data);
      })
      .catch((error) => toast(apiMessage(error), 'error'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [query, toast]);

  useLiveReload(() => {
    orgsApi
      .list(query)
      .then((data) => setResult(Array.isArray(data) ? { data, page: 1, totalPages: 1 } : data))
      .catch(() => {});
  }, 30000);

  useEffect(() => {
    if (!selectedId) return undefined;
    document.getElementById(`org-card-${selectedId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return undefined;
  }, [selectedId]);

  const center = [coords.latitude, coords.longitude];
  const rows = result.data || [];
  const pins = rows.filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain xl:overflow-hidden xl:flex-row">
      <div className="relative h-[36vh] w-full shrink-0 overflow-hidden touch-pan-y xl:order-1 xl:h-auto xl:min-h-0 xl:flex-1 xl:w-3/5">
        <MapContainer
          center={center}
          zoom={13}
          className="h-full w-full"
          scrollWheelZoom={desktopSplit}
          dragging={desktopSplit}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Recenter center={center} />
          <Marker position={center}>
            <Popup>Lokasimu</Popup>
          </Marker>
          {pins.map((row) => (
            <Marker
              key={row.id}
              position={[row.latitude, row.longitude]}
              eventHandlers={{ click: () => setSelectedId(row.id) }}
            >
              <Popup>
                <strong>{row.name}</strong>
                <br />
                {row.addressLabel}
                <br />
                <Link to={`/organizations/${row.id}`} state={{ organization: row }} className="text-primary underline">Lihat detail</Link>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        {pins.length === 0 && (
          <p className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-full bg-surface/90 px-4 py-2 text-center text-xs text-on-surface-variant shadow-sm backdrop-blur-sm xl:text-left">
            Titik organisasi disembunyikan. Jarak tampil di kartu organisasi.
          </p>
        )}
      </div>

      <div className="flex w-full min-w-0 flex-col border-outline-variant bg-surface-bright xl:order-2 xl:min-h-0 xl:w-2/5 xl:overflow-hidden xl:border-l">
        <div className="shrink-0 border-b border-outline-variant p-6 pb-4">
          <h1 className="font-display text-2xl font-extrabold text-on-surface">Temukan Organisasi</h1>
          <p className="text-on-surface-variant">Terhubung dengan komunitas tepercaya di sekitarmu.</p>

          <form
            className="mt-4 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setQ(search);
            }}
          >
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari organisasi..." />
            <Button type="submit" variant="secondary">Cari</Button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip active={sort === 'nearby'} onClick={() => setSort('nearby')}>Terdekat</Chip>
            <Chip active={sort === 'newest'} onClick={() => setSort('newest')}>Terbaru</Chip>
            <Chip active={sort === 'oldest'} onClick={() => setSort('oldest')}>Terlama</Chip>
          </div>
        </div>

        <div className="p-6 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:overflow-x-hidden">
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => <CardSkeleton key={index} />)
          ) : rows.length === 0 ? (
            <EmptyState
              title="Belum ada organisasi terdekat"
              description="Coba cari nama organisasi, atau minta admin menambahkannya di CMS."
            />
          ) : (
            <div className="flex flex-col gap-6">
            {rows.map((row, index) => (
              <div
                key={row.id}
                id={`org-card-${row.id}`}
                className={selectedId === row.id ? 'rounded-3xl ring-2 ring-primary' : ''}
              >
                <OrganizationCard organization={row} index={index} compact />
              </div>
            ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { adminApi, apiMessage } from '../api';
import { Button } from '../components/ui/Button';
import { Card, Badge, Chip } from '../components/ui/Card';
import { EmptyState, Skeleton } from '../components/ui/Feedback';
import { Input } from '../components/ui/Input';
import { useUi } from '../context/UiContext';

const TARGET_LABELS = {
  item: 'Barang',
  user: 'Pengguna',
  organization: 'Organisasi',
};

function targetName(report) {
  if (report.target?.title) return report.target.title;
  if (report.target?.name) return report.target.name;
  if (report.target?.username) return report.target.username;
  return `${report.targetType} #${report.targetId}`;
}

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [status, setStatus] = useState('open');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const { toast } = useUi();

  const load = useCallback(async ({ silent = false } = {}) => {
    try {
      const params = {};
      if (status) params.status = status;
      if (q) params.q = q;
      const rows = await adminApi.reports(Object.keys(params).length ? params : undefined);
      setReports(Array.isArray(rows) ? rows : []);
    } catch (error) {
      if (!silent) toast(apiMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [status, q, toast]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    const refresh = () => load({ silent: true });
    const timer = window.setInterval(refresh, 6000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load]);

  async function run(id, fn, message) {
    setBusyId(id);
    try {
      const result = await fn();
      toast(typeof message === 'function' ? message(result) : message, 'success');
      await load();
    } catch (error) {
      toast(apiMessage(error), 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold text-on-surface">Laporan</h1>
      <p className="mt-2 text-on-surface-variant">
        Tindak yang dilaporkan: <strong>Aman</strong> (tutup tanpa hukuman) atau <strong>Peringatan</strong>.
        Hapus barang / blokir user hanya setelah ada pelapor kedua.
      </p>

      <div className="mt-6 flex flex-col gap-4 rounded-3xl border border-surface-variant bg-surface-container-lowest p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2">
          <Chip active={status === 'open'} onClick={() => setStatus('open')}>Terbuka</Chip>
          <Chip active={status === 'resolved'} onClick={() => setStatus('resolved')}>Selesai</Chip>
          <Chip active={status === ''} onClick={() => setStatus('')}>Semua</Chip>
        </div>
        <form
          className="flex min-w-0 flex-1 gap-2 md:max-w-md"
          onSubmit={(event) => {
            event.preventDefault();
            setLoading(true);
            setQ(search.trim());
          }}
        >
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari alasan, pelapor, atau target..."
          />
          <Button type="submit" variant="secondary">Cari</Button>
        </form>
      </div>

      {loading ? (
        <div className="mt-8"><Skeleton className="h-64 w-full" /></div>
      ) : reports.length === 0 ? (
        <div className="mt-8"><EmptyState title={q ? 'Tidak ada laporan yang cocok' : 'Tidak ada laporan'} /></div>
      ) : (
        <div className="mt-8 space-y-3">
          {reports.map((report) => {
            const subject = report.subjectUser;
            const canEscalate = Boolean(report.repeatOffense);
            const canRemoveItem = canEscalate
              && report.targetType === 'item'
              && report.target?.status
              && report.target.status !== 'cancelled';
            const canBan = canEscalate && subject && subject.status !== 'banned';
            const canWarn = subject && subject.status !== 'banned';

            return (
              <Card key={report.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={report.status === 'open' ? 'warning' : 'success'}>{report.status}</Badge>
                    <Badge>{TARGET_LABELS[report.targetType] || report.targetType}</Badge>
                    {canEscalate ? (
                      <Badge tone="danger">Laporan berulang ({report.distinctReporterCount} pelapor)</Badge>
                    ) : (
                      <Badge tone="neutral">Laporan pertama</Badge>
                    )}
                  </div>
                  <p className="mt-2 font-headline text-sm text-on-surface">{targetName(report)}</p>
                  {subject && (
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Yang dilaporkan: {subject.username}
                      {` · status ${subject.status}`}
                      {` · peringatan ${subject.warningCount ?? 0}`}
                    </p>
                  )}
                  <p className="mt-2 text-sm text-on-surface">{report.reason}</p>
                  {report.reporter && (
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Dilapor oleh {report.reporter.username}
                    </p>
                  )}
                  {!canEscalate && report.status === 'open' && (
                    <p className="mt-2 text-xs text-on-surface-variant">
                      Hapus barang atau blokir user bisa dipakai setelah orang lain juga melapor target yang sama.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {report.status === 'open' && (
                    <Button
                      size="sm"
                      variant="success"
                      loading={busyId === report.id}
                      onClick={() => run(report.id, () => adminApi.resolveReport(report.id), 'Ditandai aman, laporan ditutup.')}
                    >
                      Aman
                    </Button>
                  )}
                  {canWarn && (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={busyId === report.id}
                      onClick={() => run(
                        report.id,
                        async () => {
                          const warned = await adminApi.warn(subject.id);
                          if (report.status === 'open') await adminApi.resolveReport(report.id);
                          return warned;
                        },
                        (result) => (result?.status === 'banned'
                          ? 'Peringatan kedua: akun diblokir.'
                          : 'Peringatan dikirim.'),
                      )}
                    >
                      Peringatan
                    </Button>
                  )}
                  {canRemoveItem && (
                    <Button
                      size="sm"
                      variant="danger"
                      loading={busyId === report.id}
                      onClick={() => run(report.id, () => adminApi.removeItem(report.targetId), 'Barang dihapus dari listing.')}
                    >
                      Hapus barang
                    </Button>
                  )}
                  {canBan && (
                    <Button
                      size="sm"
                      variant="danger"
                      loading={busyId === report.id}
                      onClick={() => run(
                        report.id,
                        async () => {
                          const banned = await adminApi.ban(subject.id);
                          if (report.status === 'open') await adminApi.resolveReport(report.id);
                          return banned;
                        },
                        'Pengguna diblokir.',
                      )}
                    >
                      Blokir user
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

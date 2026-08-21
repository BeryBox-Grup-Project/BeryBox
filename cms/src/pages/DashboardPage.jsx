import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Flag, Package, Handshake, CheckCircle, UsersThree, Users } from '@phosphor-icons/react';
import { adminApi, apiMessage } from '../api';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Feedback';
import { useUi } from '../context/UiContext';

const CARDS = [
  { key: 'users', label: 'Pengguna', Icon: Users },
  { key: 'items', label: 'Barang', Icon: Package },
  { key: 'requests', label: 'Transaksi', Icon: Handshake },
  { key: 'completedRequests', label: 'Selesai', Icon: CheckCircle },
  { key: 'organizations', label: 'Organisasi', Icon: UsersThree },
  { key: 'openReports', label: 'Laporan terbuka', Icon: Flag },
];

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const { toast } = useUi();

  useEffect(() => {
    adminApi
      .stats()
      .then(setStats)
      .catch((error) => toast(apiMessage(error), 'error'));
  }, [toast]);

  if (!stats) return <Skeleton className="h-64 w-full" />;

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold text-on-surface">Dashboard</h1>
      <p className="mt-2 text-on-surface-variant">Ringkasan komunitas BeryBox.</p>
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
        {CARDS.map((card, index) => (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.35 }}
            whileHover={{ y: -3 }}
          >
            <Card className="p-5">
              <div className="flex items-start justify-between">
                <p className="font-label text-xs uppercase tracking-wide text-on-surface-variant">{card.label}</p>
                <card.Icon size={18} className="text-primary" />
              </div>
              <p className="font-display mt-3 text-3xl font-extrabold text-primary">{stats[card.key] ?? 0}</p>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

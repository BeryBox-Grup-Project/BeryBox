export const ITEM_TYPES = ['public', 'organization', 'barter'];
export const ITEM_CATEGORIES = ['clothes', 'books', 'electronics', 'furniture', 'toys', 'kitchen', 'other'];
export const ITEM_CONDITIONS = ['new', 'like_new', 'good', 'fair'];
export const ORG_TYPES = ['orphanage', 'volunteer', 'community', 'other'];

export const TYPE_LABELS = {
  public: 'Gratis',
  organization: 'Kebutuhan',
  barter: 'Barter',
};

export const CATEGORY_LABELS = {
  clothes: 'Pakaian',
  books: 'Buku',
  electronics: 'Elektronik',
  furniture: 'Furniture',
  toys: 'Mainan',
  kitchen: 'Dapur',
  other: 'Lainnya',
};

export const CONDITION_LABELS = {
  new: 'Baru',
  like_new: 'Seperti Baru',
  good: 'Bekas Baik',
  fair: 'Cukup',
};

export const STATUS_LABELS = {
  available: 'Tersedia',
  pending: 'Diproses',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

export const ORG_TYPE_LABELS = {
  orphanage: 'Panti Asuhan',
  volunteer: 'Relawan',
  community: 'Komunitas',
  other: 'Lainnya',
};

export const TRACKING_STEPS = [
  { key: 'awaiting_method', label: 'Pilih metode kirim' },
  { key: 'awaiting_payment', label: 'Menunggu pembayaran' },
  { key: 'ready_for_pickup', label: 'Siap diambil' },
  { key: 'preparing', label: 'Disiapkan' },
  { key: 'in_transit', label: 'Dalam perjalanan' },
  { key: 'delivered', label: 'Terkirim' },
];

export function formatDistance(km) {
  if (km == null || Number.isNaN(Number(km))) return '';
  return `${Number(km).toFixed(1)} km`;
}

export function formatMoney(amount) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount || 0);
}

export function isUnsplash(url) {
  return typeof url === 'string' && url.includes('images.unsplash.com');
}

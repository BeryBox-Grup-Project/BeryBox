'use strict';

const { Op, QueryTypes } = require('sequelize');

const SEED_MARK = '[BeryBox dummy]';

const PUBLIC_ITEMS = [
  {
    type: 'public',
    title: 'Meja belajar lipat',
    description: `${SEED_MARK} Meja lipat kayu, masih kokoh untuk les atau sekolah.`,
    condition: 'good',
    category: 'furniture',
    creditValue: 40,
    imageUrl: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=800&q=80',
  },
  {
    type: 'public',
    title: 'Paket baju anak sekolah',
    description: `${SEED_MARK} Kemeja dan celana seragam SD, bersih dan siap pakai.`,
    condition: 'like_new',
    category: 'clothes',
    creditValue: 25,
    imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
  },
  {
    type: 'public',
    title: 'Rak buku 4 susun',
    description: `${SEED_MARK} Rak kayu 4 susun, cocok untuk kamar atau ruang baca.`,
    condition: 'good',
    category: 'furniture',
    creditValue: 35,
    imageUrl: 'https://images.unsplash.com/photo-1594620302200-9a762244a156?auto=format&fit=crop&w=800&q=80',
  },
  {
    type: 'public',
    title: 'Buku cerita anak paket',
    description: `${SEED_MARK} Kumpulan buku cerita bergambar untuk usia SD.`,
    condition: 'good',
    category: 'books',
    creditValue: 15,
    imageUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80',
  },
  {
    type: 'public',
    title: 'Lampu belajar LED',
    description: `${SEED_MARK} Lampu meja LED, cahaya putih, masih berfungsi normal.`,
    condition: 'like_new',
    category: 'electronics',
    creditValue: 20,
    imageUrl: 'https://images.unsplash.com/photo-1507473883500-2b2d60d37b23?auto=format&fit=crop&w=800&q=80',
  },
  {
    type: 'public',
    title: 'Set panci stainless',
    description: `${SEED_MARK} Dua panci stainless bekas pakai rumah, tidak bocor.`,
    condition: 'good',
    category: 'kitchen',
    creditValue: 30,
    imageUrl: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80',
  },
  {
    type: 'public',
    title: 'Puzzle dan balok kayu',
    description: `${SEED_MARK} Mainan edukasi kayu, komplet, aman untuk anak.`,
    condition: 'good',
    category: 'toys',
    creditValue: 18,
    imageUrl: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=800&q=80',
  },
];

const BARTER_ITEMS = [
  {
    type: 'barter',
    title: 'Gitar akustik',
    description: `${SEED_MARK} Gitar akustik senar baja, ada goresan ringan di body.`,
    condition: 'good',
    category: 'other',
    creditValue: 0,
    imageUrl: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&w=800&q=80',
    wantedTitle: 'Keyboard musik',
    wantedDescription: 'Keyboard 61 tuts yang masih layak latihan.',
    wantedCategory: 'electronics',
  },
  {
    type: 'barter',
    title: 'Kamera analog',
    description: `${SEED_MARK} Body kamera analog, shutter masih jalan.`,
    condition: 'fair',
    category: 'electronics',
    creditValue: 0,
    imageUrl: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=800&q=80',
    wantedTitle: 'Lensa kit',
    wantedDescription: 'Lensa kit 18-55 atau setara untuk fotografi pemula.',
    wantedCategory: 'electronics',
  },
];

const ORG_NEEDS = [
  {
    type: 'organization',
    title: 'Kebutuhan seragam sekolah',
    description: `${SEED_MARK} Mencari seragam SD bekas layak untuk anak asuh.`,
    condition: 'good',
    category: 'clothes',
    creditValue: 0,
    imageUrl: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=800&q=80',
  },
  {
    type: 'organization',
    title: 'Meja dan kursi belajar',
    description: `${SEED_MARK} Butuh meja-kursi belajar untuk ruang les sore.`,
    condition: 'good',
    category: 'furniture',
    creditValue: 0,
    imageUrl: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=800&q=80',
  },
  {
    type: 'organization',
    title: 'Buku pelajaran dan alat tulis',
    description: `${SEED_MARK} Membutuhkan buku pelajaran SD-SMP dan alat tulis.`,
    condition: 'good',
    category: 'books',
    creditValue: 0,
    imageUrl: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=80',
  },
];

const ORG_PROFILES = [
  { name: 'Panti Asuhan Harapan', type: 'orphanage' },
  { name: 'Yayasan Peduli Anak', type: 'community' },
  { name: 'Komunitas Relawan Bandung', type: 'volunteer' },
  { name: 'Rumah Belajar Ceria', type: 'other' },
];

function withLocation(template, user, now) {
  return {
    ...template,
    ownerId: user.id,
    latitude: user.latitude,
    longitude: user.longitude,
    addressLabel: user.addressLabel,
    wantedTitle: template.wantedTitle || null,
    wantedDescription: template.wantedDescription || null,
    wantedImageUrl: template.wantedImageUrl || null,
    wantedCategory: template.wantedCategory || null,
    status: 'available',
    createdAt: now,
    updatedAt: now,
  };
}

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const users = await queryInterface.sequelize.query(
      `SELECT id, username, email, role, status, latitude, longitude, "addressLabel"
       FROM "Users"
       ORDER BY id`,
      { type: QueryTypes.SELECT },
    );

    if (!users.length) {
      throw new Error('No existing users found. Dummy catalog needs accounts already in the database.');
    }

    const existingOrgs = await queryInterface.sequelize.query(
      'SELECT "userId" FROM "Organizations" WHERE "userId" IS NOT NULL',
      { type: QueryTypes.SELECT },
    );
    const orgUserIds = new Set(existingOrgs.map((row) => row.userId));

    const existingDummyItems = await queryInterface.sequelize.query(
      'SELECT "ownerId", type FROM "Items" WHERE description LIKE :mark',
      { replacements: { mark: `%${SEED_MARK}%` }, type: QueryTypes.SELECT },
    );
    const dummyCounts = {};
    existingDummyItems.forEach((row) => {
      const key = `${row.ownerId}:${row.type}`;
      dummyCounts[key] = (dummyCounts[key] || 0) + 1;
    });

    const organizations = [];
    const items = [];

    users.forEach((user, index) => {
      if (user.role === 'organization' && !orgUserIds.has(user.id)) {
        const profile = ORG_PROFILES[index % ORG_PROFILES.length];
        organizations.push({
          userId: user.id,
          name: `${profile.name} ${user.username}`,
          type: profile.type,
          description: `${SEED_MARK} Organisasi dummy untuk akun ${user.username}. Menerima donasi barang layak pakai di sekitar ${user.addressLabel || 'Bandung'}.`,
          verified: 'approved',
          source: 'manual',
          googlePlaceId: null,
          photoUrl: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
          galleryUrls: null,
          website: null,
          phone: '022-555-0100',
          email: user.email,
          latitude: user.latitude,
          longitude: user.longitude,
          addressLabel: user.addressLabel,
          createdAt: now,
          updatedAt: now,
        });
      }

      if (user.role === 'admin' || user.status === 'banned') return;

      if (user.role === 'organization') {
        if ((dummyCounts[`${user.id}:organization`] || 0) > 0) return;
        items.push(withLocation(ORG_NEEDS[index % ORG_NEEDS.length], user, now));
        items.push(withLocation(ORG_NEEDS[(index + 1) % ORG_NEEDS.length], user, now));
        return;
      }

      if (user.role !== 'user') return;
      if ((dummyCounts[`${user.id}:public`] || 0) > 0) return;

      items.push(withLocation(PUBLIC_ITEMS[index % PUBLIC_ITEMS.length], user, now));
      if (index % 3 === 0) {
        items.push(withLocation(BARTER_ITEMS[index % BARTER_ITEMS.length], user, now));
      }
    });

    if (organizations.length) {
      await queryInterface.bulkInsert('Organizations', organizations);
    }
    if (items.length) {
      await queryInterface.bulkInsert('Items', items);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('Items', { description: { [Op.like]: `%${SEED_MARK}%` } });
    await queryInterface.bulkDelete('Organizations', { description: { [Op.like]: `%${SEED_MARK}%` } });
  },
};

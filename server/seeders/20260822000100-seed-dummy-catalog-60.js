'use strict';

const { Op, QueryTypes } = require('sequelize');

const SEED_MARK = '[BeryBox catalog]';
const TARGET_PRODUCTS = 60;
const TARGET_ORGS = 20;

const PRODUCT_TEMPLATES = [
  {
    type: 'public',
    title: 'Meja belajar',
    description: 'Meja kayu kokoh untuk les dan sekolah.',
    condition: 'good',
    category: 'furniture',
    creditValue: 40,
    imageUrl: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=800&q=80',
  },
  {
    type: 'public',
    title: 'Rak buku',
    description: 'Rak 4 susun, masih kuat menahan buku pelajaran.',
    condition: 'good',
    category: 'furniture',
    creditValue: 35,
    imageUrl: 'https://images.unsplash.com/photo-1594620302200-9a762244a156?auto=format&fit=crop&w=800&q=80',
  },
  {
    type: 'public',
    title: 'Paket seragam SD',
    description: 'Kemeja dan celana seragam, bersih dan siap pakai.',
    condition: 'like_new',
    category: 'clothes',
    creditValue: 25,
    imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
  },
  {
    type: 'public',
    title: 'Jaket parasut',
    description: 'Jaket ringan, cocok untuk sekolah pagi.',
    condition: 'good',
    category: 'clothes',
    creditValue: 20,
    imageUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=80',
  },
  {
    type: 'public',
    title: 'Buku cerita anak',
    description: 'Paket buku bergambar untuk usia SD.',
    condition: 'good',
    category: 'books',
    creditValue: 15,
    imageUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80',
  },
  {
    type: 'public',
    title: 'Ensiklopedia anak',
    description: 'Buku pengetahuan bergambar, halaman lengkap.',
    condition: 'like_new',
    category: 'books',
    creditValue: 22,
    imageUrl: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=80',
  },
  {
    type: 'public',
    title: 'Lampu belajar LED',
    description: 'Lampu meja LED, cahaya putih, masih normal.',
    condition: 'like_new',
    category: 'electronics',
    creditValue: 18,
    imageUrl: 'https://images.unsplash.com/photo-1507473883500-2b2d60d37b23?auto=format&fit=crop&w=800&q=80',
  },
  {
    type: 'public',
    title: 'Kipas meja',
    description: 'Kipas kecil USB, hemat listrik.',
    condition: 'good',
    category: 'electronics',
    creditValue: 16,
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80',
  },
  {
    type: 'public',
    title: 'Puzzle kayu',
    description: 'Mainan edukasi kayu, komplet.',
    condition: 'good',
    category: 'toys',
    creditValue: 14,
    imageUrl: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=800&q=80',
  },
  {
    type: 'public',
    title: 'Set panci stainless',
    description: 'Dua panci stainless, tidak bocor.',
    condition: 'good',
    category: 'kitchen',
    creditValue: 30,
    imageUrl: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80',
  },
];

const ORG_NAMES = [
  'Panti Asuhan Melati Putih',
  'Panti Asuhan Mawar Bandung',
  'Panti Asuhan Kenanga',
  'Panti Asuhan Dahlia Asih',
  'Panti Asuhan Anggrek',
  'Panti Asuhan Teratai',
  'Yayasan Harapan Anak',
  'Rumah Belajar Ceria',
  'Panti Asuhan Pelangi',
  'Panti Asuhan Bintang Kecil',
  'Komunitas Peduli Anak',
  'Panti Asuhan Seroja',
  'Panti Asuhan Cempaka',
  'Yayasan Kasih Ibu',
  'Panti Asuhan Lotus',
  'Panti Asuhan Jasmine',
  'Rumah Asuh Flamboyan',
  'Panti Asuhan Edelweis',
  'Yayasan Ceria Bandung',
  'Panti Asuhan Sakura',
];

const BANDUNG = [
  ['Coblong, Bandung', -6.8915, 107.6107],
  ['Cicendo, Bandung', -6.91, 107.6],
  ['Bandung Wetan, Bandung', -6.9039, 107.6186],
  ['Sukajadi, Bandung', -6.888, 107.597],
  ['Andir, Bandung', -6.917, 107.58],
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const users = await queryInterface.sequelize.query(
      `SELECT id, role, status, latitude, longitude, "addressLabel"
       FROM "Users"
       ORDER BY id`,
      { type: QueryTypes.SELECT },
    );
    if (!users.length) {
      throw new Error('No existing users found. Dummy catalog needs accounts already in the database.');
    }

    const owners = users.filter((user) => user.role === 'user' && user.status !== 'banned');
    if (!owners.length) {
      throw new Error('No active user accounts found to attach dummy products.');
    }

    const existingProducts = await queryInterface.sequelize.query(
      `SELECT COUNT(*)::int AS count FROM "Items" WHERE description LIKE :mark AND type = 'public'`,
      { replacements: { mark: `%${SEED_MARK}%` }, type: QueryTypes.SELECT },
    );
    const existingOrgs = await queryInterface.sequelize.query(
      `SELECT COUNT(*)::int AS count FROM "Organizations" WHERE description LIKE :mark`,
      { replacements: { mark: `%${SEED_MARK}%` }, type: QueryTypes.SELECT },
    );
    const takenOrgUsers = await queryInterface.sequelize.query(
      'SELECT "userId" FROM "Organizations" WHERE "userId" IS NOT NULL',
      { type: QueryTypes.SELECT },
    );
    const takenUserIds = new Set(takenOrgUsers.map((row) => row.userId));
    const orgCandidates = users
      .filter((user) => user.role !== 'admin' && user.status !== 'banned' && !takenUserIds.has(user.id))
      .sort((left, right) => Number(right.role === 'organization') - Number(left.role === 'organization'));
    const userIdColumn = await queryInterface.sequelize.query(
      `SELECT is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'Organizations' AND column_name = 'userId'`,
      { type: QueryTypes.SELECT },
    );
    const userIdNullable = userIdColumn[0]?.is_nullable === 'YES';

    const productCount = existingProducts[0]?.count || 0;
    const orgCount = existingOrgs[0]?.count || 0;
    const items = [];
    const organizations = [];

    for (let index = productCount; index < TARGET_PRODUCTS; index += 1) {
      const template = PRODUCT_TEMPLATES[index % PRODUCT_TEMPLATES.length];
      const owner = owners[index % owners.length];
      items.push({
        ownerId: owner.id,
        type: template.type,
        title: `${template.title} ${String(index + 1).padStart(2, '0')}`,
        description: `${SEED_MARK} ${template.description}`,
        condition: template.condition,
        category: template.category,
        creditValue: template.creditValue,
        latitude: owner.latitude,
        longitude: owner.longitude,
        addressLabel: owner.addressLabel,
        imageUrl: template.imageUrl,
        wantedTitle: null,
        wantedDescription: null,
        wantedImageUrl: null,
        wantedCategory: null,
        status: 'available',
        createdAt: now,
        updatedAt: now,
      });
    }

    for (let index = orgCount; index < TARGET_ORGS; index += 1) {
      const place = BANDUNG[index % BANDUNG.length];
      const owner = orgCandidates.shift() || null;
      if (!owner && !userIdNullable) continue;
      organizations.push({
        userId: owner ? owner.id : null,
        name: ORG_NAMES[index],
        type: index % 4 === 0 ? 'community' : 'orphanage',
        description: `${SEED_MARK} ${ORG_NAMES[index]} menerima donasi barang layak pakai di ${place[0]}.`,
        verified: 'approved',
        source: 'manual',
        googlePlaceId: null,
        photoUrl: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
        galleryUrls: null,
        website: null,
        phone: `022-555-${String(1000 + index).slice(-4)}`,
        email: `panti${String(index + 1).padStart(2, '0')}@berybox.local`,
        latitude: place[1] + (index * 0.002),
        longitude: place[2] + (index * 0.002),
        addressLabel: place[0],
        createdAt: now,
        updatedAt: now,
      });
    }

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

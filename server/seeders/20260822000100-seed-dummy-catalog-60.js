'use strict';

const { Op, QueryTypes } = require('sequelize');
const { hashPassword } = require('../helpers/bcrypt');

const SEED_MARK = '[BeryBox v3]';
const OLD_MARKS = ['[BeryBox dummy]', '[BeryBox catalog]', SEED_MARK];

const ORG_ACCOUNTS = [
  {
    username: 'panti_harapan',
    email: 'panti.harapan@berybox.local',
    name: 'Panti Asuhan Harapan',
    type: 'orphanage',
    addressLabel: 'Coblong, Bandung',
    latitude: -6.8915,
    longitude: 107.6107,
  },
  {
    username: 'panti_mawar',
    email: 'panti.mawar@berybox.local',
    name: 'Panti Asuhan Mawar',
    type: 'orphanage',
    addressLabel: 'Cicendo, Bandung',
    latitude: -6.91,
    longitude: 107.6,
  },
  {
    username: 'yayasan_ceria',
    email: 'yayasan.ceria@berybox.local',
    name: 'Yayasan Ceria Bandung',
    type: 'community',
    addressLabel: 'Bandung Wetan, Bandung',
    latitude: -6.9039,
    longitude: 107.6186,
  },
  {
    username: 'rumah_belajar',
    email: 'rumah.belajar@berybox.local',
    name: 'Rumah Belajar Ceria',
    type: 'other',
    addressLabel: 'Sukajadi, Bandung',
    latitude: -6.888,
    longitude: 107.597,
  },
  {
    username: 'relawan_anak',
    email: 'relawan.anak@berybox.local',
    name: 'Komunitas Relawan Anak',
    type: 'volunteer',
    addressLabel: 'Andir, Bandung',
    latitude: -6.917,
    longitude: 107.58,
  },
];

const EXTRA_ORGS = [
  'Panti Asuhan Melati Putih',
  'Panti Asuhan Kenanga',
  'Panti Asuhan Dahlia Asih',
  'Panti Asuhan Anggrek',
  'Panti Asuhan Teratai',
  'Yayasan Kasih Ibu',
  'Panti Asuhan Pelangi',
  'Panti Asuhan Bintang Kecil',
  'Panti Asuhan Seroja',
  'Panti Asuhan Cempaka',
];

const PUBLIC_TEMPLATES = [
  ['Meja belajar', 'furniture', 'Meja kayu kokoh untuk les dan sekolah.', 40, 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=800&q=80'],
  ['Rak buku', 'furniture', 'Rak 4 susun masih kuat menahan buku.', 35, 'https://images.unsplash.com/photo-1594620302200-9a762244a156?auto=format&fit=crop&w=800&q=80'],
  ['Paket seragam SD', 'clothes', 'Kemeja dan celana seragam, bersih siap pakai.', 25, 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80'],
  ['Jaket parasut', 'clothes', 'Jaket ringan untuk sekolah pagi.', 20, 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=80'],
  ['Buku cerita anak', 'books', 'Paket buku bergambar untuk usia SD.', 15, 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80'],
  ['Ensiklopedia anak', 'books', 'Buku pengetahuan bergambar, halaman lengkap.', 22, 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=80'],
  ['Lampu belajar LED', 'electronics', 'Lampu meja LED cahaya putih masih normal.', 18, 'https://images.unsplash.com/photo-1507473883500-2b2d60d37b23?auto=format&fit=crop&w=800&q=80'],
  ['Kipas meja', 'electronics', 'Kipas kecil USB hemat listrik.', 16, 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80'],
  ['Puzzle kayu', 'toys', 'Mainan edukasi kayu komplet.', 14, 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=800&q=80'],
  ['Set panci stainless', 'kitchen', 'Dua panci stainless tidak bocor.', 30, 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80'],
];

const BARTER_PAIRS = [
  ['Kamera analog', 'electronics', 'Body kamera analog shutter masih jalan.', 'Lensa kit', 'Lensa kit 18-55 untuk pemula.', 'electronics', 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=800&q=80'],
  ['Gitar akustik', 'other', 'Gitar akustik senar baja, goresan ringan.', 'Keyboard musik', 'Keyboard 61 tuts untuk latihan.', 'electronics', 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&w=800&q=80'],
  ['Sepeda lipat', 'other', 'Sepeda lipat masih kencang, rem berfungsi.', 'Meja drafting', 'Meja gambar atau drafting bekas kampus.', 'furniture', 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80'],
  ['Monitor 22 inci', 'electronics', 'Monitor 22 inci masih terang.', 'Keyboard USB', 'Keyboard USB standar untuk kerja.', 'electronics', 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80'],
  ['Jaket varsity', 'clothes', 'Jaket varsity ukuran L, masih bagus.', 'Sepatu hiking', 'Sepatu hiking size 42 layak pakai.', 'clothes', 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=80'],
  ['Novel fantasi paket', 'books', 'Set novel fantasi 4 buku.', 'Ensiklopedia dunia', 'Ensiklopedia bergambar untuk koleksi.', 'books', 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80'],
  ['Blender kaca', 'kitchen', 'Blender kaca, pisau masih tajam.', 'Wajan granit', 'Wajan granit 24 cm anti lengket.', 'kitchen', 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?auto=format&fit=crop&w=800&q=80'],
  ['Lego architecture', 'toys', 'Set Lego architecture hampir komplet.', 'Puzzle 1000 pcs', 'Puzzle pemandangan 1000 pcs.', 'toys', 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&w=800&q=80'],
];

const NEED_TEMPLATES = [
  ['Kebutuhan seragam sekolah', 'clothes', 'Mencari seragam SD bekas layak untuk anak asuh.', 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=800&q=80'],
  ['Meja dan kursi belajar', 'furniture', 'Butuh meja-kursi belajar untuk ruang les sore.', 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=800&q=80'],
  ['Buku pelajaran dan alat tulis', 'books', 'Membutuhkan buku pelajaran SD-SMP dan alat tulis.', 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=80'],
];

function nowStamp() {
  return new Date();
}

module.exports = {
  async up(queryInterface) {
    const now = nowStamp();
    await queryInterface.sequelize.query(
      `DELETE FROM "Items" WHERE ${OLD_MARKS.map((_, index) => `description LIKE :mark${index}`).join(' OR ')}`,
      { replacements: Object.fromEntries(OLD_MARKS.map((mark, index) => [`mark${index}`, `%${mark}%`])) },
    );
    await queryInterface.sequelize.query(
      `DELETE FROM "Organizations" WHERE ${OLD_MARKS.map((_, index) => `description LIKE :mark${index}`).join(' OR ')}`,
      { replacements: Object.fromEntries(OLD_MARKS.map((mark, index) => [`mark${index}`, `%${mark}%`])) },
    );

    const users = await queryInterface.sequelize.query(
      `SELECT id, role, status, latitude, longitude, "addressLabel", email
       FROM "Users"
       ORDER BY id`,
      { type: QueryTypes.SELECT },
    );
    if (!users.length) {
      throw new Error('No existing users found. Dummy catalog needs accounts already in the database.');
    }

    const password = await hashPassword('Panti123!');
    const orgUserIds = [];
    for (const account of ORG_ACCOUNTS) {
      const existing = users.find((user) => user.email === account.email);
      if (existing) {
        orgUserIds.push(existing.id);
        continue;
      }
      await queryInterface.bulkInsert('Users', [{
        username: account.username,
        email: account.email,
        password,
        role: 'organization',
        latitude: account.latitude,
        longitude: account.longitude,
        addressLabel: account.addressLabel,
        creditBalance: 0,
        ratingAvg: 0,
        status: 'active',
        warningCount: 0,
        photoUrl: null,
        createdAt: now,
        updatedAt: now,
      }]);
      const created = await queryInterface.sequelize.query(
        'SELECT id FROM "Users" WHERE email = :email',
        { replacements: { email: account.email }, type: QueryTypes.SELECT },
      );
      orgUserIds.push(created[0].id);
    }

    const taken = await queryInterface.sequelize.query(
      'SELECT "userId" FROM "Organizations" WHERE "userId" IS NOT NULL',
      { type: QueryTypes.SELECT },
    );
    const takenIds = new Set(taken.map((row) => row.userId));

    const organizations = [];
    ORG_ACCOUNTS.forEach((account, index) => {
      const userId = orgUserIds[index];
      if (takenIds.has(userId)) return;
      organizations.push({
        userId,
        name: account.name,
        type: account.type,
        description: `${SEED_MARK} ${account.name} menerima donasi barang layak pakai di ${account.addressLabel}.`,
        verified: 'approved',
        source: 'manual',
        googlePlaceId: null,
        photoUrl: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
        galleryUrls: null,
        website: null,
        phone: `022-555-${1100 + index}`,
        email: account.email,
        latitude: account.latitude,
        longitude: account.longitude,
        addressLabel: account.addressLabel,
        createdAt: now,
        updatedAt: now,
      });
      takenIds.add(userId);
    });

    const userIdColumn = await queryInterface.sequelize.query(
      `SELECT is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'Organizations' AND column_name = 'userId'`,
      { type: QueryTypes.SELECT },
    );
    const userIdNullable = userIdColumn[0]?.is_nullable === 'YES';
    const spareUsers = (await queryInterface.sequelize.query(
      `SELECT id, role, status FROM "Users" ORDER BY id`,
      { type: QueryTypes.SELECT },
    )).filter((user) => user.role !== 'admin' && user.status !== 'banned' && !takenIds.has(user.id)
      && !orgUserIds.includes(user.id));

    EXTRA_ORGS.forEach((name, index) => {
      const place = ORG_ACCOUNTS[index % ORG_ACCOUNTS.length];
      const spare = spareUsers.shift();
      const userId = userIdNullable ? null : (spare ? spare.id : null);
      if (!userIdNullable && !userId) return;
      organizations.push({
        userId,
        name,
        type: index % 3 === 0 ? 'community' : 'orphanage',
        description: `${SEED_MARK} ${name} menerima donasi barang layak pakai di ${place.addressLabel}.`,
        verified: 'approved',
        source: 'manual',
        googlePlaceId: null,
        photoUrl: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
        galleryUrls: null,
        website: null,
        phone: `022-555-${1200 + index}`,
        email: `panti.extra${index + 1}@berybox.local`,
        latitude: place.latitude + ((index + 1) * 0.003),
        longitude: place.longitude + ((index + 1) * 0.003),
        addressLabel: place.addressLabel,
        createdAt: now,
        updatedAt: now,
      });
    });
    if (organizations.length) {
      await queryInterface.bulkInsert('Organizations', organizations);
    }

    const owners = users.filter((user) => user.role === 'user' && user.status !== 'banned');
    if (!owners.length) {
      throw new Error('No active user accounts found to attach dummy products.');
    }

    const items = [];
    for (let index = 0; index < 50; index += 1) {
      const template = PUBLIC_TEMPLATES[index % PUBLIC_TEMPLATES.length];
      const owner = owners[index % owners.length];
      items.push({
        ownerId: owner.id,
        type: 'public',
        title: `${template[0]} ${String(index + 1).padStart(2, '0')}`,
        description: `${SEED_MARK} ${template[2]}`,
        condition: index % 4 === 0 ? 'like_new' : 'good',
        category: template[1],
        creditValue: template[3],
        latitude: owner.latitude,
        longitude: owner.longitude,
        addressLabel: owner.addressLabel,
        imageUrl: template[4],
        wantedTitle: null,
        wantedDescription: null,
        wantedImageUrl: null,
        wantedCategory: null,
        status: 'available',
        createdAt: now,
        updatedAt: now,
      });
    }

    for (let index = 0; index < 40; index += 1) {
      const pair = BARTER_PAIRS[index % BARTER_PAIRS.length];
      const owner = owners[(index + 3) % owners.length];
      items.push({
        ownerId: owner.id,
        type: 'barter',
        title: `${pair[0]} ${String(index + 1).padStart(2, '0')}`,
        description: `${SEED_MARK} ${pair[2]}`,
        condition: 'good',
        category: pair[1],
        creditValue: 0,
        latitude: owner.latitude,
        longitude: owner.longitude,
        addressLabel: owner.addressLabel,
        imageUrl: pair[6],
        wantedTitle: pair[3],
        wantedDescription: pair[4],
        wantedImageUrl: null,
        wantedCategory: pair[5],
        status: 'available',
        createdAt: now,
        updatedAt: now,
      });
    }

    for (let index = 0; index < 15; index += 1) {
      const need = NEED_TEMPLATES[index % NEED_TEMPLATES.length];
      const account = ORG_ACCOUNTS[index % ORG_ACCOUNTS.length];
      const ownerId = orgUserIds[index % orgUserIds.length];
      items.push({
        ownerId,
        type: 'organization',
        title: `${need[0]} ${String(index + 1).padStart(2, '0')}`,
        description: `${SEED_MARK} ${need[2]}`,
        condition: 'good',
        category: need[1],
        creditValue: 0,
        latitude: account.latitude,
        longitude: account.longitude,
        addressLabel: account.addressLabel,
        imageUrl: need[3],
        wantedTitle: null,
        wantedDescription: null,
        wantedImageUrl: null,
        wantedCategory: null,
        status: 'available',
        createdAt: now,
        updatedAt: now,
      });
    }

    await queryInterface.bulkInsert('Items', items);
  },

  async down(queryInterface) {
    const emails = ORG_ACCOUNTS.map((account) => account.email);
    const seededUsers = await queryInterface.sequelize.query(
      'SELECT id FROM "Users" WHERE email IN (:emails)',
      { replacements: { emails }, type: QueryTypes.SELECT },
    );
    const userIds = seededUsers.map((user) => user.id);
    await queryInterface.bulkDelete('Items', {
      [Op.or]: [
        { description: { [Op.like]: `%${SEED_MARK}%` } },
        ...(userIds.length ? [{ ownerId: { [Op.in]: userIds } }] : []),
      ],
    });
    await queryInterface.bulkDelete('Organizations', {
      [Op.or]: [
        { description: { [Op.like]: `%${SEED_MARK}%` } },
        ...(userIds.length ? [{ userId: { [Op.in]: userIds } }] : []),
      ],
    });
    if (emails.length) {
      await queryInterface.bulkDelete('Users', { email: { [Op.in]: emails } });
    }
  },
};

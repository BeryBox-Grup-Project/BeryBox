'use strict';

const { Op, QueryTypes } = require('sequelize');
const { hashPassword } = require('../helpers/bcrypt');

const SEEDED_EMAILS = [
  'admin@berybox.com',
  'alice@mail.com',
  'ana@mail.com',
  'bob@mail.com',
  'panti@mail.com',
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const users = [
      {
        username: 'admin',
        email: 'admin@berybox.com',
        password: await hashPassword('Admin123!'),
        role: 'admin',
        latitude: -6.9175,
        longitude: 107.6191,
        addressLabel: 'Bandung, Bandung',
        creditBalance: 0,
        ratingAvg: 0,
        status: 'active',
        warningCount: 0,
        photoUrl: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        username: 'alice',
        email: 'alice@mail.com',
        password: await hashPassword('Alice123!'),
        role: 'user',
        latitude: -6.8915,
        longitude: 107.6107,
        addressLabel: 'Coblong, Bandung',
        creditBalance: 100,
        ratingAvg: 0,
        status: 'active',
        warningCount: 0,
        photoUrl: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        username: 'ana',
        email: 'ana@mail.com',
        password: await hashPassword('Ana123!'),
        role: 'user',
        latitude: -6.895,
        longitude: 107.613,
        addressLabel: 'Coblong, Bandung',
        creditBalance: 40,
        ratingAvg: 0,
        status: 'active',
        warningCount: 0,
        photoUrl: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        username: 'bob',
        email: 'bob@mail.com',
        password: await hashPassword('Bob123!'),
        role: 'user',
        latitude: -6.9039,
        longitude: 107.6186,
        addressLabel: 'Bandung Wetan, Bandung',
        creditBalance: 0,
        ratingAvg: 0,
        status: 'active',
        warningCount: 0,
        photoUrl: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        username: 'panti',
        email: 'panti@mail.com',
        password: await hashPassword('Panti123!'),
        role: 'organization',
        latitude: -6.91,
        longitude: 107.6,
        addressLabel: 'Cicendo, Bandung',
        creditBalance: 0,
        ratingAvg: 0,
        status: 'active',
        warningCount: 0,
        photoUrl: null,
        createdAt: now,
        updatedAt: now,
      },
    ];

    await queryInterface.bulkInsert('Users', users);

    const seededUsers = await queryInterface.sequelize.query(
      'SELECT id, email FROM "Users" WHERE email IN (:emails)',
      { replacements: { emails: SEEDED_EMAILS }, type: QueryTypes.SELECT },
    );
    const userIds = Object.fromEntries(seededUsers.map((user) => [user.email, user.id]));

    await queryInterface.bulkInsert('Organizations', [{
      userId: userIds['panti@mail.com'],
      name: 'Panti Asuhan Melati',
      type: 'orphanage',
      description: 'Panti untuk anak sekolah dasar di Bandung.',
      verified: 'pending',
      source: 'manual',
      googlePlaceId: null,
      photoUrl: null,
      galleryUrls: null,
      website: null,
      phone: null,
      email: 'panti@mail.com',
      latitude: -6.91,
      longitude: 107.6,
      addressLabel: 'Cicendo, Bandung',
      createdAt: now,
      updatedAt: now,
    }]);

    await queryInterface.bulkInsert('Items', [{
      ownerId: userIds['alice@mail.com'],
      type: 'public',
      title: 'Meja belajar',
      description: 'Meja kayu masih kokoh untuk sekolah.',
      condition: 'good',
      category: 'furniture',
      creditValue: 50,
      latitude: -6.8915,
      longitude: 107.6107,
      addressLabel: 'Coblong, Bandung',
      imageUrl: 'https://ik.imagekit.io/demo/meja.jpg',
      status: 'available',
      createdAt: now,
      updatedAt: now,
    }]);
  },

  async down(queryInterface) {
    const seededUsers = await queryInterface.sequelize.query(
      'SELECT id, email FROM "Users" WHERE email IN (:emails)',
      { replacements: { emails: SEEDED_EMAILS }, type: QueryTypes.SELECT },
    );
    const userIds = seededUsers.map((user) => user.id);

    await queryInterface.bulkDelete('Items', { ownerId: { [Op.in]: userIds } });
    await queryInterface.bulkDelete('Organizations', { userId: { [Op.in]: userIds } });
    await queryInterface.bulkDelete('Users', { email: { [Op.in]: SEEDED_EMAILS } });
  },
};

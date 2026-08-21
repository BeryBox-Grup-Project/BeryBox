const { Op } = require('sequelize');
const db = require('../models');
const { signToken } = require('../helpers/jwt');

db.sequelize.options.logging = false;

async function cleanDb() {
  await db.Message.destroy({ where: {}, truncate: false });
  await db.Review.destroy({ where: {}, truncate: false });
  await db.Report.destroy({ where: {}, truncate: false });
  await db.Request.destroy({ where: {}, truncate: false });
  await db.Conversation.destroy({ where: {}, truncate: false });
  await db.Organization.destroy({ where: {}, truncate: false });
  await db.Item.destroy({ where: {}, truncate: false });
  await db.User.destroy({ where: {}, truncate: false });
}

let userSequence = 0;
async function createUser(overrides = {}) {
  userSequence += 1;
  return db.User.create({
    username: `user${userSequence}`,
    email: `user${userSequence}@test.local`,
    password: 'Password123!',
    role: 'user',
    latitude: -6.9,
    longitude: 107.6,
    addressLabel: 'Bandung',
    creditBalance: 0,
    ratingAvg: 0,
    ...overrides,
  });
}

async function createItem(ownerId, overrides = {}) {
  userSequence += 1;
  return db.Item.create({
    ownerId,
    type: 'public',
    title: `Item ${userSequence}`,
    description: 'Barang ini masih sangat layak untuk digunakan.',
    condition: 'good',
    category: 'other',
    creditValue: 0,
    latitude: -6.9,
    longitude: 107.6,
    addressLabel: 'Bandung',
    imageUrl: 'https://ik.imagekit.io/test/item.jpg',
    status: 'available',
    ...overrides,
  });
}

function tokenFor(user, options = {}) {
  return signToken({ id: user.id, email: user.email, role: user.role }, options);
}

function authorization(user) {
  return { Authorization: `Bearer ${tokenFor(user)}` };
}

module.exports = {
  db,
  Op,
  cleanDb,
  createUser,
  createItem,
  tokenFor,
  authorization,
};

jest.mock('../helpers/nominatim', () => ({ reverse: jest.fn() }));
jest.mock('../helpers/imagekit', () => ({
  getImageKit: jest.fn(),
  isImageKitUrl: jest.fn((url) => typeof url === 'string' && url.startsWith('https://ik.imagekit.io/test/')),
}));

const request = require('supertest');
const app = require('../app');
const nominatim = require('../helpers/nominatim');
const { db, cleanDb, createUser, createItem, authorization } = require('./utils');

describe('Items API', () => {
  let owner;
  let other;
  let third;

  beforeEach(async () => {
    await cleanDb();
    owner = await createUser();
    other = await createUser({ latitude: -6.901, longitude: 107.601 });
    third = await createUser({ latitude: -7.2, longitude: 107.9 });
    nominatim.reverse.mockReset().mockResolvedValue('Coblong, Bandung');
  });
  afterAll(() => db.sequelize.close());

  const itemBody = (overrides = {}) => ({
    type: 'public',
    title: 'Meja belajar',
    description: 'Meja kayu masih kokoh untuk sekolah.',
    condition: 'good',
    category: 'furniture',
    creditValue: 50,
    latitude: -6.9,
    longitude: 107.6,
    imageUrl: 'https://ik.imagekit.io/test/meja.jpg',
    ...overrides,
  });

  test('lists only available items with filters, counts and safe owner shape', async () => {
    const publicItem = await createItem(owner.id, { type: 'public', category: 'books' });
    await createItem(owner.id, { type: 'barter', category: 'furniture' });
    await createItem(owner.id, { status: 'cancelled' });
    await db.Request.create({ type: 'claim', fromUserId: other.id, toUserId: owner.id, itemId: publicItem.id, reason: 'Alasan claim ini cukup panjang untuk validasi.', status: 'pending' });
    await db.Request.create({ type: 'claim', fromUserId: third.id, toUserId: owner.id, itemId: publicItem.id, reason: 'Alasan claim lain yang sudah ditolak pemilik.', status: 'rejected' });

    const response = await request(app).get('/items').set(authorization(other));
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body.every((item) => item.status === 'available')).toBe(true);
    const found = response.body.find((item) => item.id === publicItem.id);
    expect(found.pendingClaimCount).toBe(1);
    expect(found).not.toHaveProperty('latitude');
    expect(found.owner).toEqual({ id: owner.id, username: owner.username, ratingAvg: owner.ratingAvg });
    expect(await request(app).get('/items?type=invalid').set(authorization(other))).toEqual(expect.objectContaining({ status: 400 }));
    expect((await request(app).get('/items?category=invalid').set(authorization(other))).status).toBe(400);
    const filtered = await request(app).get('/items?type=public&category=books').set(authorization(other));
    expect(filtered.body.map((item) => item.id)).toEqual([publicItem.id]);
  });

  test('sorts default by newest and nearby by distance', async () => {
    const old = await createItem(owner.id, { latitude: -7.0, longitude: 107.7 });
    const recent = await createItem(owner.id, { latitude: -6.901, longitude: 107.601 });
    await old.update({ createdAt: new Date('2020-01-01'), updatedAt: new Date('2020-01-01') }, { silent: true });
    await recent.update({ createdAt: new Date('2022-01-01'), updatedAt: new Date('2022-01-01') }, { silent: true });
    const normal = await request(app).get('/items').set(authorization(other));
    expect(normal.body[0].id).toBe(recent.id);
    const nearby = await request(app).get('/items?lat=-7&lng=107.7').set(authorization(other));
    expect(nearby.body[0].id).toBe(old.id);
    expect(nearby.body.every((item) => typeof item.distanceKm === 'number')).toBe(true);
    expect((await request(app).get('/items?lat=&lng=x').set(authorization(other))).status).toBe(400);
    const incomplete = await request(app).get('/items?lat=-6.9').set(authorization(other));
    expect(incomplete.body[0]).not.toHaveProperty('distanceKm');
  });

  test('mine includes every status and coordinates only current owner items', async () => {
    await createItem(owner.id, { status: 'available' });
    await createItem(owner.id, { status: 'pending' });
    await createItem(owner.id, { status: 'completed' });
    await createItem(owner.id, { status: 'cancelled' });
    await createItem(other.id);
    const response = await request(app).get('/items/mine').set(authorization(owner));
    expect(response.body).toHaveLength(4);
    expect(new Set(response.body.map((item) => item.status))).toEqual(new Set(['available', 'pending', 'completed', 'cancelled']));
    expect(response.body.every((item) => Object.hasOwn(item, 'latitude'))).toBe(true);
  });

  test('detail applies claims, shipping, and coordinate privacy rules', async () => {
    const item = await createItem(owner.id, { type: 'public' });
    await db.Request.create({ type: 'claim', fromUserId: other.id, toUserId: owner.id, itemId: item.id, reason: 'Claim pending yang terlihat hanya oleh pemilik.', status: 'pending' });
    await db.Request.create({ type: 'claim', fromUserId: third.id, toUserId: owner.id, itemId: item.id, reason: 'Claim accepted memberikan akses koordinat.', shippingMethod: 'pickup', status: 'accepted' });
    const ownerDetail = await request(app).get(`/items/${item.id}`).set(authorization(owner));
    expect(ownerDetail.body.claims).toHaveLength(2);
    expect(ownerDetail.body).toHaveProperty('latitude');
    expect(ownerDetail.body.suggestedShipping).toEqual([]);
    const unrelated = await request(app).get(`/items/${item.id}?lat=-6.9&lng=107.6`).set(authorization(other));
    expect(unrelated.body).not.toHaveProperty('claims');
    expect(unrelated.body).not.toHaveProperty('latitude');
    expect(unrelated.body.suggestedShipping).toEqual(['pickup', 'gosend']);
    const participant = await request(app).get(`/items/${item.id}`).set(authorization(third));
    expect(participant.body).toHaveProperty('latitude');
    expect((await request(app).get('/items/bad').set(authorization(other))).status).toBe(404);
    expect((await request(app).get('/items/999999').set(authorization(other))).status).toBe(404);
  });

  test('creates valid item with server ownership/status and geocoded address', async () => {
    const response = await request(app).post('/items').set(authorization(owner)).send(itemBody());
    expect(response.status).toBe(201);
    expect(response.body).toEqual(expect.objectContaining({ status: 'available', addressLabel: 'Coblong, Bandung' }));
    const stored = await db.Item.findByPk(response.body.id);
    expect(stored.ownerId).toBe(owner.id);
    expect(nominatim.reverse).toHaveBeenCalled();
  });

  test.each([
    [itemBody({ description: 'short' }), 'Item does not meet donation standards'],
    [itemBody({ description: 'Barang medicine ini tidak boleh didonasikan.' }), 'Item does not meet donation standards'],
    [itemBody({ condition: 'bad' }), 'Item does not meet donation standards'],
    [itemBody({ category: 'bad' }), 'Item does not meet donation standards'],
    [itemBody({ type: 'bad' }), 'Validation error'],
    [itemBody({ title: '' }), 'Validation error'],
    [itemBody({ creditValue: -1 }), 'Validation error'],
    [itemBody({ latitude: 'bad' }), 'Validation error'],
    [itemBody({ longitude: Infinity }), 'Validation error'],
    [itemBody({ imageUrl: 'https://example.com/a.jpg' }), 'Invalid image url'],
    [{ ...itemBody(), ownerId: 999 }, 'Validation error'],
  ])('rejects invalid item creation', async (body, message) => {
    const response = await request(app).post('/items').set(authorization(owner)).send(body);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message });
  });

  test('updates allowed fields, revalidates, and geocodes location', async () => {
    const item = await createItem(owner.id);
    const response = await request(app).patch(`/items/${item.id}`).set(authorization(owner)).send({
      title: 'Updated title',
      description: 'Deskripsi baru masih sangat layak digunakan.',
      condition: 'like_new',
      category: 'books',
      creditValue: 10,
      imageUrl: 'https://ik.imagekit.io/test/new.jpg',
      latitude: -6.91,
      longitude: 107.61,
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({ title: 'Updated title', addressLabel: 'Coblong, Bandung' }));
  });

  test.each([
    [{ ownerId: 3 }, 'Validation error'],
    [{ title: '' }, 'Validation error'],
    [{ creditValue: -1 }, 'Validation error'],
    [{ description: 'short' }, 'Item does not meet donation standards'],
    [{ condition: 'bad' }, 'Item does not meet donation standards'],
    [{ category: 'bad' }, 'Item does not meet donation standards'],
    [{ imageUrl: 'bad' }, 'Invalid image url'],
    [{ latitude: -6.9 }, 'Validation error'],
    [{ latitude: 'bad', longitude: 3 }, 'Validation error'],
  ])('rejects invalid item updates', async (patch, message) => {
    const item = await createItem(owner.id);
    const response = await request(app).patch(`/items/${item.id}`).set(authorization(owner)).send(patch);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message });
  });

  test('enforces owner, existence, and available status for patch/delete', async () => {
    const item = await createItem(owner.id);
    expect((await request(app).patch(`/items/${item.id}`).set(authorization(other)).send({ title: 'No' })).status).toBe(403);
    expect((await request(app).patch('/items/999999').set(authorization(owner)).send({ title: 'No' })).status).toBe(404);
    expect((await request(app).patch('/items/bad').set(authorization(owner)).send({ title: 'No' })).status).toBe(404);
    const unavailable = await createItem(owner.id, { status: 'pending' });
    expect((await request(app).patch(`/items/${unavailable.id}`).set(authorization(owner)).send({ title: 'No' })).status).toBe(403);
    expect((await request(app).delete(`/items/${item.id}`).set(authorization(other))).status).toBe(403);
    expect((await request(app).delete('/items/999999').set(authorization(owner))).status).toBe(404);
    const cancelled = await request(app).delete(`/items/${item.id}`).set(authorization(owner));
    expect(cancelled.body).toEqual({ message: 'Item cancelled' });
    expect((await db.Item.findByPk(item.id)).status).toBe('cancelled');
  });
});

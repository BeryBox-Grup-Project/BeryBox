jest.mock('../services/geminiService', () => ({ generateReply: jest.fn() }));
jest.mock('../services/groqService', () => ({ generateReply: jest.fn() }));

const request = require('supertest');
const app = require('../app');
const geminiService = require('../services/geminiService');
const groqService = require('../services/groqService');
const { db, cleanDb, createUser, createItem, authorization } = require('./utils');

describe('reviews, reports, and AI chat', () => {
  let alice;
  let bob;
  let outsider;

  beforeEach(async () => {
    jest.clearAllMocks();
    await cleanDb();
    alice = await createUser({ latitude: 0, longitude: 0 });
    bob = await createUser();
    outsider = await createUser();
  });

  afterAll(async () => db.sequelize.close());

  async function completedRequest(overrides = {}) {
    const item = await createItem(alice.id, { status: 'completed' });
    return db.Request.create({
      type: 'claim', fromUserId: bob.id, toUserId: alice.id, itemId: item.id,
      reason: 'Barang ini sangat saya perlukan.', shippingMethod: 'pickup', status: 'completed',
      ...overrides,
    });
  }

  test('participants review a completed request and rating average is recalculated', async () => {
    const exchange = await completedRequest();
    const first = await request(app).post('/reviews').set(authorization(bob))
      .send({ requestId: exchange.id, rating: 5, comment: 'Sangat membantu' });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ fromUserId: bob.id, toUserId: alice.id, rating: 5 });
    await request(app).post('/reviews').set(authorization(alice))
      .send({ requestId: exchange.id, rating: 3, comment: 'Proses berjalan baik' });
    expect(Number((await db.User.findByPk(alice.id)).ratingAvg)).toBe(5);
    expect(Number((await db.User.findByPk(bob.id)).ratingAvg)).toBe(3);
  });

  test.each([
    [{}, 400],
    [{ requestId: 1, rating: 0, comment: 'cukup baik' }, 400],
    [{ requestId: 1, rating: 6, comment: 'cukup baik' }, 400],
    [{ requestId: 1, rating: 2.5, comment: 'cukup baik' }, 400],
    [{ requestId: 1, rating: 5, comment: 'bad' }, 404],
    [{ requestId: 1, rating: 5, comment: 'cukup baik', extra: true }, 400],
  ])('validates review payload %#', async (body, status) => {
    expect((await request(app).post('/reviews').set(authorization(alice)).send(body)).status)
      .toBe(status);
  });

  test('rejects review for missing, pending, unrelated, and duplicate requests', async () => {
    expect((await request(app).post('/reviews').set(authorization(alice))
      .send({ requestId: 999999, rating: 5, comment: 'Sangat membantu' })).status).toBe(404);
    const completed = await completedRequest();
    expect((await request(app).post('/reviews').set(authorization(outsider))
      .send({ requestId: completed.id, rating: 5, comment: 'Sangat membantu' })).status).toBe(403);
    const pending = await completedRequest({ status: 'pending' });
    expect((await request(app).post('/reviews').set(authorization(alice))
      .send({ requestId: pending.id, rating: 5, comment: 'Sangat membantu' })).status).toBe(400);
    const accepted = await completedRequest({ status: 'accepted' });
    expect((await request(app).post('/reviews').set(authorization(alice))
      .send({ requestId: accepted.id, rating: 1, comment: 'Tidak sesuai harapan' })).status).toBe(400);
    const payload = { requestId: completed.id, rating: 5, comment: 'Sangat membantu' };
    expect((await request(app).post('/reviews').set(authorization(alice)).send(payload)).status)
      .toBe(201);
    expect((await request(app).post('/reviews').set(authorization(alice)).send(payload)).status)
      .toBe(400);
  });

  test.each(['item', 'user', 'organization'])('creates an open %s report', async (targetType) => {
    let targetId;
    if (targetType === 'item') targetId = (await createItem(bob.id)).id;
    if (targetType === 'user') targetId = bob.id;
    if (targetType === 'organization') {
      targetId = (await db.Organization.create({
        userId: bob.id, name: 'Komunitas Bandung', type: 'community',
        description: 'Komunitas sosial dengan deskripsi panjang.', verified: 'approved',
      })).id;
    }
    const response = await request(app).post('/reports').set(authorization(alice)).send({
      targetType, targetId, reason: 'Konten ini perlu segera ditinjau.',
    });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ reporterId: alice.id, targetType, targetId, status: 'open' });
  });

  test.each([
    [{}, 400],
    [{ targetType: 'request', targetId: 1, reason: 'Alasan laporan cukup panjang' }, 400],
    [{ targetType: 'user', targetId: 0, reason: 'Alasan laporan cukup panjang' }, 400],
    [{ targetType: 'user', targetId: 999999, reason: 'pendek' }, 404],
    [{ targetType: 'user', targetId: 1, reason: 'Alasan laporan cukup panjang', x: 1 }, 400],
  ])('validates report payload %#', async (body, status) => {
    expect((await request(app).post('/reports').set(authorization(alice)).send(body)).status)
      .toBe(status);
  });

  test('returns 404 when report target does not exist', async () => {
    expect((await request(app).post('/reports').set(authorization(alice)).send({
      targetType: 'item', targetId: 999999, reason: 'Konten ini perlu segera ditinjau.',
    })).status).toBe(404);
  });

  test('AI uses only approved/public available located candidates, sorted and capped', async () => {
    geminiService.generateReply.mockResolvedValue('Coba kandidat 999 yang terdekat berikut.');
    await db.Organization.create({
      userId: bob.id, name: 'Near Org', type: 'community',
      description: 'Organisasi sosial yang aktif membantu warga.', verified: 'approved',
      latitude: 0, longitude: 0.01, addressLabel: 'Dekat',
    });
    const pendingOwner = await createUser();
    await db.Organization.create({
      userId: pendingOwner.id, name: 'Hidden Org', type: 'other',
      description: 'Organisasi belum disetujui oleh administrator.', verified: 'pending',
      latitude: 0, longitude: 0.001,
    });
    for (let index = 1; index <= 6; index += 1) {
      await createItem(bob.id, { longitude: index * 0.02, title: `Public ${index}` });
    }
    await createItem(bob.id, { type: 'barter', longitude: 0.001, title: 'Hidden barter' });
    await createItem(bob.id, { status: 'completed', longitude: 0.001, title: 'Hidden done' });
    await createItem(bob.id, { latitude: null, longitude: null, title: 'No location' });

    const response = await request(app).post('/ai/chat').set(authorization(alice))
      .send({ message: '  apa yang dekat?  ' });
    expect(response.status).toBe(200);
    expect(response.body.reply).toBe('Coba kandidat 999 yang terdekat berikut.');
    expect(response.body.suggestions).toHaveLength(5);
    expect(response.body.suggestions[0]).toMatchObject({ kind: 'organization', name: 'Near Org' });
    expect(response.body.suggestions.every((entry) => !Object.hasOwn(entry, 'addressLabel'))).toBe(true);
    const call = geminiService.generateReply.mock.calls[0][0];
    expect(call.message).toBe('apa yang dekat?');
    expect(call.candidates).toHaveLength(5);
    expect(call.candidates[0]).toEqual(expect.objectContaining({ addressLabel: 'Dekat' }));
    expect(call.candidates.every((entry) => !Object.hasOwn(entry, 'latitude'))).toBe(true);
    expect(response.body.suggestions.some((entry) => entry.id === 999)).toBe(false);
    expect(groqService.generateReply).not.toHaveBeenCalled();
  });

  test.each([{}, [], { message: '' }, { message: 10 }, { message: 'ok', extra: true }])(
    'validates AI payload %#', async (body) => {
      expect((await request(app).post('/ai/chat').set(authorization(alice)).send(body)).status)
        .toBe(400);
      expect(geminiService.generateReply).not.toHaveBeenCalled();
      expect(groqService.generateReply).not.toHaveBeenCalled();
    },
  );

  test('AI returns empty suggestions without calling fallback after Gemini succeeds', async () => {
    geminiService.generateReply.mockResolvedValueOnce('Belum ada kandidat.');
    const empty = await request(app).post('/ai/chat').set(authorization(alice))
      .send({ message: 'Bantu saya' });
    expect(empty.status).toBe(200);
    expect(empty.body.suggestions).toEqual([]);
    expect(groqService.generateReply).not.toHaveBeenCalled();
  });

  test('falls back to Groq after Gemini fails and keeps suggestions DB-backed', async () => {
    const item = await createItem(bob.id, { latitude: 0, longitude: 0.01 });
    geminiService.generateReply.mockRejectedValueOnce(new Error('network'));
    groqService.generateReply.mockResolvedValueOnce('Gunakan item 999, bukan data lain.');
    const response = await request(app).post('/ai/chat').set(authorization(alice))
      .send({ message: 'Bantu saya' });
    expect(response.status).toBe(200);
    expect(response.body.reply).toBe('Gunakan item 999, bukan data lain.');
    expect(Array.isArray(response.body.suggestions)).toBe(true);
    expect(response.body.suggestions.some((entry) => entry.id === 999)).toBe(false);
    expect(geminiService.generateReply).toHaveBeenCalledTimes(1);
    expect(groqService.generateReply).toHaveBeenCalledTimes(1);
    expect(groqService.generateReply).toHaveBeenCalledWith(
      geminiService.generateReply.mock.calls[0][0],
    );
  });

  test('returns the stable 502 contract only when Gemini and Groq both fail', async () => {
    geminiService.generateReply.mockRejectedValueOnce(new Error('Gemini unavailable'));
    groqService.generateReply.mockRejectedValueOnce(new Error('Groq unavailable'));
    const response = await request(app).post('/ai/chat').set(authorization(alice))
      .send({ message: 'Bantu saya' });
    expect(response.status).toBe(200);
    expect(typeof response.body.reply).toBe('string');
    expect(response.body.reply.length).toBeGreaterThan(0);
    expect(geminiService.generateReply).toHaveBeenCalledTimes(1);
    expect(groqService.generateReply).toHaveBeenCalledTimes(1);
  });
});

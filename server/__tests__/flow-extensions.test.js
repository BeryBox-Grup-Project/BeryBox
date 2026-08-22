jest.mock('../helpers/nominatim', () => ({ reverse: jest.fn() }));
jest.mock('../socket', () => ({ emitNotification: jest.fn(), emitMessageEvents: jest.fn() }));
jest.mock('../services/aiService', () => ({ generateReply: jest.fn() }));

const request = require('supertest');
const app = require('../app');
const nominatim = require('../helpers/nominatim');
const aiService = require('../services/aiService');
const { db, cleanDb, createUser, createItem, authorization } = require('./utils');

describe('profile, notifications, shipping, admin extras', () => {
  let admin;
  let owner;
  let applicant;

  beforeEach(async () => {
    await cleanDb();
    nominatim.reverse.mockReset().mockResolvedValue('Coblong, Bandung');
    aiService.generateReply.mockReset().mockResolvedValue('ringkasan organisasi');
    admin = await createUser({ role: 'admin' });
    owner = await createUser();
    applicant = await createUser();
  });
  afterAll(() => db.sequelize.close());

  test('PATCH /me updates username, photo, and location', async () => {
    const updated = await request(app).patch('/me').set(authorization(owner)).send({
      username: 'ownerbaru',
      photoUrl: 'https://ik.imagekit.io/test/me.jpg',
      latitude: -6.91,
      longitude: 107.61,
    });
    expect(updated.status).toBe(200);
    expect(updated.body).toEqual(expect.objectContaining({
      username: 'ownerbaru', photoUrl: 'https://ik.imagekit.io/test/me.jpg',
    }));
    expect((await request(app).patch('/me').set(authorization(owner)).send({})).status).toBe(400);
    expect((await request(app).patch('/me').set(authorization(owner)).send({ latitude: -6.9 })).status).toBe(400);
  });

  test('notifications list, read one, and read-all by scope', async () => {
    const warning = await db.Notification.create({
      userId: owner.id, type: 'warning', message: 'You received a warning from BeryBox moderators',
    });
    await db.Notification.create({
      userId: owner.id, type: 'message', conversationId: 1, message: 'hello',
    });
    const list = await request(app).get('/notifications').set(authorization(owner));
    expect(list.body).toHaveLength(2);
    const read = await request(app).patch(`/notifications/${warning.id}/read`).set(authorization(owner));
    expect(read.body.readAt).toBeTruthy();
    expect((await request(app).patch(`/notifications/${warning.id}/read`).set(authorization(applicant))).status).toBe(403);
    expect((await request(app).patch('/notifications/bad/read').set(authorization(owner))).status).toBe(404);
    const inbox = await request(app).patch('/notifications/read-all').set(authorization(owner)).send({ scope: 'inbox' });
    expect(inbox.status).toBe(200);
    const activity = await request(app).patch('/notifications/read-all').set(authorization(owner)).send({ scope: 'activity' });
    expect(activity.status).toBe(200);
    expect((await request(app).patch('/notifications/read-all').set(authorization(owner)).send({ scope: 'all' })).status).toBe(400);
  });

  test('ownerId filter, organization complete, history, and pickup shipping', async () => {
    const need = await createItem(owner.id, { type: 'organization' });
    await createItem(applicant.id, { type: 'public' });
    const filtered = await request(app).get(`/items?ownerId=${owner.id}`).set(authorization(applicant));
    expect(filtered.body.data.every((row) => row.owner.id === owner.id)).toBe(true);
    expect((await request(app).get('/items?ownerId=0').set(authorization(applicant))).status).toBe(400);
    const completed = await request(app).post(`/items/${need.id}/complete`).set(authorization(owner));
    expect(completed.body.status).toBe('completed');
    expect((await request(app).post(`/items/${need.id}/complete`).set(authorization(owner))).status).toBe(403);

    const item = await createItem(owner.id);
    const claim = await request(app).post('/requests').set(authorization(applicant))
      .send({ type: 'claim', itemId: item.id, reason: 'Saya membutuhkan meja ini untuk belajar.' });
    await request(app).patch(`/requests/${claim.body.id}`).set(authorization(owner)).send({ status: 'accepted' });
    const shipped = await request(app).post(`/requests/${claim.body.id}/shipping`)
      .set(authorization(applicant)).send({ method: 'pickup' });
    expect(shipped.body.shipment.trackingStatus).toBe('ready_for_pickup');
    expect((await request(app).post(`/requests/${claim.body.id}/shipping`)
      .set(authorization(applicant)).send({ method: 'pickup' })).status).toBe(400);
    const tracked = await request(app).patch(`/requests/${claim.body.id}/tracking`)
      .set(authorization(owner)).send({ trackingStatus: 'delivered' });
    expect(tracked.status).toBe(200);
    const history = await request(app).get('/history').set(authorization(owner));
    expect(history.body.donated).toHaveLength(1);
  });

  test('credit request, admin stats/warn/ban/remove, match, claim, and photo 404', async () => {
    const item = await createItem(owner.id, { type: 'barter', creditValue: 20 });
    await applicant.update({ creditBalance: 50 });
    const credit = await request(app).post('/requests').set(authorization(applicant))
      .send({ type: 'credit', itemId: item.id });
    expect(credit.status).toBe(201);

    const stats = await request(app).get('/admin/stats').set(authorization(admin));
    expect(stats.body).toEqual(expect.objectContaining({ users: expect.any(Number), items: expect.any(Number) }));

    const warned = await request(app).post(`/admin/users/${applicant.id}/warn`).set(authorization(admin));
    expect(warned.body.status).toBe('warned');
    const banned = await request(app).post(`/admin/users/${applicant.id}/warn`).set(authorization(admin));
    expect(banned.body.status).toBe('banned');
    expect((await request(app).post(`/admin/users/${admin.id}/warn`).set(authorization(admin))).status).toBe(403);
    expect((await request(app).post('/admin/users/bad/ban').set(authorization(admin))).status).toBe(404);

    const target = await createItem(owner.id);
    await db.Report.create({ reporterId: admin.id, targetType: 'item', targetId: target.id, reason: 'Spam berulang dari pelapor satu.' });
    await db.Report.create({ reporterId: owner.id, targetType: 'item', targetId: target.id, reason: 'Spam berulang dari pelapor dua.' });
    const removed = await request(app).delete(`/admin/items/${target.id}`).set(authorization(admin));
    expect(removed.body.status).toBe('cancelled');

    const created = await request(app).post('/admin/organizations').set(authorization(admin)).send({
      name: 'Panti CMS', type: 'orphanage', description: 'Panti ditambahkan dari CMS untuk verifikasi.',
      latitude: -6.91, longitude: 107.6,
    });
    expect(created.status).toBe(201);
    const research = await request(app).post('/admin/ai/organization').set(authorization(admin))
      .send({ organizationId: created.body.id });
    expect(research.body.reply).toBe('ringkasan organisasi');

    const match = await request(app).post('/ai/match').set(authorization(owner))
      .send({ have: 'kamera analog', want: 'tanaman hias' });
    expect(match.status).toBe(200);

    const orgAccount = await createUser({ role: 'organization' });
    const placeOrg = await db.Organization.create({
      userId: null, name: 'OSM Panti', type: 'orphanage',
      description: 'Panti dari peta untuk diklaim akun organisasi.',
      verified: 'unverified', source: 'openstreetmap', googlePlaceId: 'osm:node:99',
      latitude: -6.9, longitude: 107.6,
    });
    const claimed = await request(app).post('/organizations/claim').set(authorization(orgAccount))
      .send({ googlePlaceId: 'osm:node:99' });
    expect(claimed.status).toBe(200);
    expect(claimed.body.userId).toBe(orgAccount.id);
    expect(placeOrg.id).toBe(claimed.body.id);
    expect((await request(app).get('/places/photo').set(authorization(owner))).status).toBe(404);
    expect((await request(app).post('/organizations/claim').set(authorization(orgAccount)).send({ googlePlaceId: 'x' })).status).toBe(400);
  });

  test('simulates courier payment in test when Midtrans is unset', async () => {
    const item = await createItem(owner.id);
    const claim = await request(app).post('/requests').set(authorization(applicant))
      .send({ type: 'claim', itemId: item.id, reason: 'Saya membutuhkan meja ini untuk belajar.' });
    await request(app).patch(`/requests/${claim.body.id}`).set(authorization(owner)).send({ status: 'accepted' });
    await request(app).post(`/requests/${claim.body.id}/shipping`)
      .set(authorization(applicant)).send({ method: 'courier_agent' });
    const paid = await request(app).post(`/requests/${claim.body.id}/pay`).set(authorization(applicant));
    expect(paid.body.simulated).toBe(true);
    const confirm = await request(app).post(`/requests/${claim.body.id}/pay/confirm`).set(authorization(applicant));
    expect(confirm.status).toBe(200);
    expect((await request(app).post('/midtrans/notification').send({})).status).toBe(400);
  });
});

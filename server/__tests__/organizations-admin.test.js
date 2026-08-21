jest.mock('../helpers/nominatim', () => ({ reverse: jest.fn() }));

const request = require('supertest');
const app = require('../app');
const nominatim = require('../helpers/nominatim');
const { db, cleanDb, createUser, createItem, authorization } = require('./utils');

describe('Organizations and admin API', () => {
  let admin;
  let normal;
  let orgUser;

  beforeEach(async () => {
    await cleanDb();
    admin = await createUser({ role: 'admin' });
    normal = await createUser();
    orgUser = await createUser({ role: 'organization' });
    nominatim.reverse.mockReset().mockResolvedValue('Cicendo, Bandung');
  });
  afterAll(() => db.sequelize.close());

  const body = (overrides = {}) => ({
    name: 'Panti Asuhan Melati',
    type: 'orphanage',
    description: 'Panti untuk anak sekolah dasar di Bandung.',
    latitude: -6.91,
    longitude: 107.6,
    ...overrides,
  });

  test('organization role creates pending profile, duplicate fails, normal role forbidden', async () => {
    expect((await request(app).post('/organizations').set(authorization(normal)).send(body())).body).toEqual({ message: 'Forbidden' });
    const created = await request(app).post('/organizations').set(authorization(orgUser)).send(body());
    expect(created.status).toBe(201);
    expect(created.body).toEqual(expect.objectContaining({ userId: orgUser.id, verified: 'pending', addressLabel: 'Cicendo, Bandung' }));
    expect((await request(app).post('/organizations').set(authorization(orgUser)).send(body())).body).toEqual({ message: 'Organization already exists' });
  });

  test.each([
    [body({ type: 'bad' })],
    [body({ description: 'short' })],
    [body({ name: '' })],
    [body({ latitude: 'x' })],
    [body({ longitude: Infinity })],
    [{ ...body(), verified: 'approved' }],
    [{ ...body(), userId: 99 }],
  ])('rejects invalid organization bodies', async (invalidBody) => {
    expect((await request(app).post('/organizations').set(authorization(orgUser)).send(invalidBody)).status).toBe(400);
  });

  test('uses geocode fallback', async () => {
    nominatim.reverse.mockResolvedValueOnce('Unknown location');
    const response = await request(app).post('/organizations').set(authorization(orgUser)).send(body());
    expect(response.body.addressLabel).toBe('Unknown location');
  });

  test('public listing only shows approved, sorts nearby, and strips coordinates', async () => {
    const users = await Promise.all([createUser({ role: 'organization' }), createUser({ role: 'organization' }), createUser({ role: 'organization' })]);
    const approvedNear = await db.Organization.create({ userId: users[0].id, ...body({ name: 'Near', verified: undefined }), verified: 'approved' });
    await db.Organization.create({ userId: users[1].id, ...body({ name: 'Far', latitude: -7.2, longitude: 107.9 }), verified: 'approved' });
    await db.Organization.create({ userId: users[2].id, ...body({ name: 'Hidden' }), verified: 'rejected' });
    const response = await request(app).get('/organizations?lat=-6.91&lng=107.6').set(authorization(normal));
    expect(response.body).toHaveLength(2);
    expect(response.body[0].id).toBe(approvedNear.id);
    expect(response.body.every((organization) => !Object.hasOwn(organization, 'latitude'))).toBe(true);
    expect((await request(app).get('/organizations?lat=&lng=x').set(authorization(normal))).status).toBe(400);
    const incomplete = await request(app).get('/organizations?lat=-6.9').set(authorization(normal));
    expect(incomplete.body[0]).not.toHaveProperty('distanceKm');
  });

  test('organization detail handles shipping, not found, and accepted coordinate privacy', async () => {
    const organization = await db.Organization.create({ userId: orgUser.id, ...body(), verified: 'approved' });
    const detail = await request(app).get(`/organizations/${organization.id}?lat=-6.9&lng=107.6`).set(authorization(normal));
    expect(detail.body.suggestedShipping).toEqual(['pickup', 'gosend']);
    expect(detail.body).not.toHaveProperty('latitude');
    const item = await createItem(normal.id, { type: 'organization' });
    await db.Request.create({ type: 'org_offer', fromUserId: normal.id, toUserId: orgUser.id, itemId: item.id, shippingMethod: 'pickup', status: 'accepted' });
    const allowed = await request(app).get(`/organizations/${organization.id}`).set(authorization(normal));
    expect(allowed.body).toHaveProperty('latitude');
    expect(allowed.body.suggestedShipping).toEqual([]);
    expect((await request(app).get('/organizations/bad').set(authorization(normal))).status).toBe(404);
    expect((await request(app).get('/organizations/999999').set(authorization(normal))).status).toBe(404);
  });

  test('admin organization moderation includes all statuses and enforces role', async () => {
    const orgs = [];
    for (const status of ['pending', 'approved', 'rejected']) {
      const account = await createUser({ role: 'organization' });
      orgs.push(await db.Organization.create({ userId: account.id, ...body({ name: status }), verified: status }));
    }
    expect((await request(app).get('/admin/organizations').set(authorization(normal))).body).toEqual({ message: 'Admin access required' });
    const list = await request(app).get('/admin/organizations').set(authorization(admin));
    expect(new Set(list.body.map((organization) => organization.verified))).toEqual(new Set(['pending', 'approved', 'rejected']));
    expect(list.body[0]).toHaveProperty('latitude');
    expect((await request(app).patch(`/admin/organizations/${orgs[0].id}`).set(authorization(admin)).send({ verified: 'approved' })).body.verified).toBe('approved');
    expect((await request(app).patch(`/admin/organizations/${orgs[1].id}`).set(authorization(admin)).send({ verified: 'rejected' })).body.verified).toBe('rejected');
    for (const verified of ['pending', 'random']) {
      expect((await request(app).patch(`/admin/organizations/${orgs[2].id}`).set(authorization(admin)).send({ verified })).status).toBe(400);
    }
    expect((await request(app).patch('/admin/organizations/999999').set(authorization(admin)).send({ verified: 'approved' })).status).toBe(404);
  });

  test('admin report moderation filters and resolves', async () => {
    const open = await db.Report.create({ reporterId: normal.id, targetType: 'user', targetId: orgUser.id, reason: 'Laporan open yang valid.', status: 'open' });
    await db.Report.create({ reporterId: orgUser.id, targetType: 'user', targetId: normal.id, reason: 'Laporan resolved yang valid.', status: 'resolved' });
    expect((await request(app).get('/admin/reports').set(authorization(normal))).status).toBe(403);
    expect((await request(app).get('/admin/reports').set(authorization(admin))).body).toHaveLength(2);
    expect((await request(app).get('/admin/reports?status=open').set(authorization(admin))).body.every((report) => report.status === 'open')).toBe(true);
    expect((await request(app).get('/admin/reports?status=resolved').set(authorization(admin))).body.every((report) => report.status === 'resolved')).toBe(true);
    expect((await request(app).get('/admin/reports?status=bad').set(authorization(admin))).status).toBe(400);
    expect((await request(app).patch(`/admin/reports/${open.id}`).set(authorization(admin)).send({ status: 'resolved' })).body.status).toBe('resolved');
    expect((await request(app).patch(`/admin/reports/${open.id}`).set(authorization(admin)).send({ status: 'open' })).status).toBe(400);
    expect((await request(app).patch('/admin/reports/999999').set(authorization(admin)).send({ status: 'resolved' })).status).toBe(404);
  });
});

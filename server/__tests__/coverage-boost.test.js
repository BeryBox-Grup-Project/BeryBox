jest.mock('../helpers/nominatim', () => ({ reverse: jest.fn() }));
jest.mock('../socket', () => ({ emitNotification: jest.fn(), emitMessageEvents: jest.fn() }));
jest.mock('../services/aiService', () => ({ generateReply: jest.fn() }));
jest.mock('../helpers/midtrans', () => ({
  isConfigured: jest.fn(),
  createSnapTransaction: jest.fn(),
  getTransactionStatus: jest.fn(),
  verifyNotificationSignature: jest.fn(),
  isPaidStatus: jest.fn(),
  clientKey: jest.fn(() => 'client-key'),
  isProduction: jest.fn(() => false),
}));

const request = require('supertest');
const app = require('../app');
const nominatim = require('../helpers/nominatim');
const aiService = require('../services/aiService');
const midtrans = require('../helpers/midtrans');
const { db, cleanDb, createUser, createItem, authorization } = require('./utils');

describe('remaining branch coverage', () => {
  let admin;
  let owner;
  let applicant;

  beforeEach(async () => {
    await cleanDb();
    nominatim.reverse.mockReset().mockResolvedValue('Coblong, Bandung');
    aiService.generateReply.mockReset().mockResolvedValue('ok');
    midtrans.isConfigured.mockReturnValue(false);
    midtrans.verifyNotificationSignature.mockReturnValue(false);
    midtrans.isPaidStatus.mockReturnValue(false);
    admin = await createUser({ role: 'admin' });
    owner = await createUser();
    applicant = await createUser();
  });
  afterAll(() => db.sequelize.close());

  test('unknown routes, profile validation, reviews list, and barter listing', async () => {
    expect((await request(app).get('/no-such-route').set(authorization(owner))).status).toBe(404);
    expect((await request(app).patch('/me').set(authorization(owner)).send({ username: '  ' })).status).toBe(400);
    expect((await request(app).patch('/me').set(authorization(owner)).send({ photoUrl: 1 })).status).toBe(400);
    expect((await request(app).patch('/me').set(authorization(owner)).send({ role: 'admin' })).status).toBe(400);
    expect((await request(app).get(`/users/${owner.id}/reviews`).set(authorization(applicant))).status).toBe(200);
    expect((await request(app).get('/users/bad/reviews').set(authorization(applicant))).status).toBe(404);

    const orgUser = await createUser({ role: 'organization' });
    const orgItem = await request(app).post('/items').set(authorization(orgUser)).send({
      type: 'organization',
      title: 'Kebutuhan panti',
      description: 'Kami membutuhkan meja belajar yang masih layak.',
      condition: 'good',
      category: 'furniture',
      creditValue: 0,
      latitude: -6.9,
      longitude: 107.6,
      imageUrl: 'https://ik.imagekit.io/test/need.jpg',
    });
    expect(orgItem.status).toBe(201);
    expect((await request(app).post('/items').set(authorization(owner)).send({
      type: 'organization',
      title: 'Tidak boleh',
      description: 'User biasa tidak boleh unggah kebutuhan organisasi.',
      condition: 'good',
      category: 'other',
      creditValue: 0,
      latitude: -6.9,
      longitude: 107.6,
      imageUrl: 'https://ik.imagekit.io/test/x.jpg',
    })).status).toBe(400);

    const barter = await request(app).post('/items').set(authorization(owner)).send({
      type: 'barter',
      title: 'Kamera analog',
      description: 'Kamera analog masih berfungsi dengan baik sekali.',
      condition: 'good',
      category: 'electronics',
      creditValue: 10,
      latitude: -6.9,
      longitude: 107.6,
      imageUrl: 'https://ik.imagekit.io/test/cam.jpg',
      wantedTitle: 'Lensa kit',
      wantedDescription: 'Lensa 50mm',
      wantedImageUrl: 'https://ik.imagekit.io/test/lens.jpg',
      wantedCategory: 'electronics',
    });
    expect(barter.status).toBe(201);
    expect((await request(app).post('/items').set(authorization(owner)).send({
      type: 'barter',
      title: 'Kamera rusak',
      description: 'Kamera analog masih berfungsi dengan baik sekali.',
      condition: 'good',
      category: 'electronics',
      creditValue: 10,
      latitude: -6.9,
      longitude: 107.6,
      imageUrl: 'https://ik.imagekit.io/test/cam.jpg',
    })).status).toBe(400);
  });

  test('credit accept, tracking transit, and Midtrans pay/notify', async () => {
    const item = await createItem(owner.id, { type: 'barter', creditValue: 20 });
    await applicant.update({ creditBalance: 5 });
    const poor = await db.Request.create({
      type: 'credit', fromUserId: applicant.id, toUserId: owner.id, itemId: item.id, status: 'pending',
    });
    expect((await request(app).patch(`/requests/${poor.id}`).set(authorization(owner)).send({ status: 'accepted' })).body)
      .toEqual({ message: 'Insufficient credit' });
    await applicant.update({ creditBalance: 50 });
    const richItem = await createItem(owner.id, { type: 'barter', creditValue: 10 });
    const credit = await request(app).post('/requests').set(authorization(applicant)).send({ type: 'credit', itemId: richItem.id });
    expect(credit.status).toBe(201);
    const accepted = await request(app).patch(`/requests/${credit.body.id}`).set(authorization(owner)).send({ status: 'accepted' });
    expect(accepted.status).toBe(200);

    const publicItem = await createItem(owner.id);
    const claim = await request(app).post('/requests').set(authorization(applicant))
      .send({ type: 'claim', itemId: publicItem.id, reason: 'Saya membutuhkan meja ini untuk belajar.' });
    await request(app).patch(`/requests/${claim.body.id}`).set(authorization(owner)).send({ status: 'accepted' });
    await request(app).post(`/requests/${claim.body.id}/shipping`)
      .set(authorization(applicant)).send({ method: 'courier_agent', payer: 'from_user' });
    const transit = await request(app).patch(`/requests/${claim.body.id}/tracking`)
      .set(authorization(owner)).send({ trackingStatus: 'in_transit' });
    expect(transit.status).toBe(400);
    await db.Shipment.update({ trackingStatus: 'preparing', paymentStatus: 'paid' }, { where: { requestId: claim.body.id } });
    const moved = await request(app).patch(`/requests/${claim.body.id}/tracking`)
      .set(authorization(owner)).send({ trackingStatus: 'in_transit' });
    expect(moved.status).toBe(200);

    const payItem = await createItem(owner.id);
    const payClaim = await request(app).post('/requests').set(authorization(applicant))
      .send({ type: 'claim', itemId: payItem.id, reason: 'Saya membutuhkan meja ini untuk belajar.' });
    await request(app).patch(`/requests/${payClaim.body.id}`).set(authorization(owner)).send({ status: 'accepted' });
    await request(app).post(`/requests/${payClaim.body.id}/shipping`)
      .set(authorization(applicant)).send({ method: 'courier_agent' });
    midtrans.isConfigured.mockReturnValue(true);
    midtrans.createSnapTransaction.mockResolvedValue({ token: 'snap', redirect_url: 'https://snap.test' });
    const snap = await request(app).post(`/requests/${payClaim.body.id}/pay`).set(authorization(applicant));
    expect(snap.body.token).toBe('snap');
    midtrans.getTransactionStatus.mockResolvedValue({ transaction_status: 'settlement' });
    midtrans.isPaidStatus.mockReturnValue(true);
    const confirmed = await request(app).post(`/requests/${payClaim.body.id}/pay/confirm`).set(authorization(applicant));
    expect(confirmed.status).toBe(200);
    midtrans.verifyNotificationSignature.mockReturnValue(true);
    const shipment = await db.Shipment.findOne({ where: { requestId: payClaim.body.id } });
    const notify = await request(app).post('/midtrans/notification').send({
      order_id: shipment.midtransOrderId,
      transaction_status: 'settlement',
    });
    expect(notify.body).toEqual({ message: 'OK' });
    expect((await request(app).post(`/requests/${payClaim.body.id}/pay`).set(authorization(owner))).status).toBe(403);
  });

  test('organizations claim/create extras and admin report subjects', async () => {
    const orgUser = await createUser({ role: 'organization' });
    expect((await request(app).get('/organizations?type=bad').set(authorization(owner))).status).toBe(400);
    expect((await request(app).get('/organizations?sort=bad').set(authorization(owner))).status).toBe(400);
    const listed = await request(app).get('/organizations?type=orphanage&sort=oldest&q=panti').set(authorization(owner));
    expect(listed.status).toBe(200);

    expect((await request(app).post('/organizations').set(authorization(orgUser)).send({
      name: 'Panti', type: 'orphanage', description: 'Panti untuk anak sekolah dasar di Bandung.',
      latitude: -6.91, longitude: 107.6, email: 1,
    })).status).toBe(400);
    expect((await request(app).post('/organizations').set(authorization(orgUser)).send({
      name: 'Panti', type: 'orphanage', description: 'Panti untuk anak sekolah dasar di Bandung.',
      latitude: -6.91, longitude: 107.6, galleryUrls: ['https://example.com/x.jpg'],
    })).status).toBe(400);

    await db.Organization.create({
      userId: orgUser.id, name: 'Rejected', type: 'orphanage',
      description: 'Profil ditolak supaya bisa dibuat ulang.', verified: 'rejected',
    });
    const recreated = await request(app).post('/organizations').set(authorization(orgUser)).send({
      name: 'Panti Baru', type: 'orphanage', description: 'Panti untuk anak sekolah dasar di Bandung.',
      latitude: -6.91, longitude: 107.6,
    });
    expect(recreated.status).toBe(200);

    const otherOrg = await createUser({ role: 'organization' });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        elements: [{
          id: 21, type: 'node', lat: -6.9, lon: 107.6,
          tags: { name: 'Panti Klaim', amenity: 'orphanage', phone: '0812', website: 'https://panti.test' },
        }],
      }),
    });
    const claimed = await request(app).post('/organizations/claim').set(authorization(otherOrg))
      .send({ googlePlaceId: 'osm:node:21' });
    expect(claimed.status).toBe(200);
    const thirdOrg = await createUser({ role: 'organization' });
    expect((await request(app).post('/organizations/claim').set(authorization(thirdOrg))
      .send({ googlePlaceId: 'osm:node:21' })).status).toBe(400);

    const osmOrg = await db.Organization.create({
      userId: null, name: 'OSM Detail', type: 'community',
      description: 'Organisasi peta tanpa kontak untuk diisi detail.',
      verified: 'unverified', source: 'openstreetmap', googlePlaceId: 'osm:node:22',
      latitude: -6.9, longitude: 107.6,
    });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        elements: [{
          id: 22, type: 'node', lat: -6.9, lon: 107.6,
          tags: { name: 'OSM Detail', phone: '0813', website: 'https://osm.test' },
        }],
      }),
    });
    const detail = await request(app).get(`/organizations/${osmOrg.id}`).set(authorization(owner));
    expect(detail.status).toBe(200);

    const targetItem = await createItem(owner.id);
    await db.Report.create({
      reporterId: applicant.id, targetType: 'item', targetId: targetItem.id,
      reason: 'Laporan barang yang valid untuk dicari.',
    });
    const orgTarget = await db.Organization.create({
      userId: null, name: 'Cari Org', type: 'community',
      description: 'Organisasi untuk tes pencarian laporan admin.',
      verified: 'approved',
    });
    await db.Report.create({
      reporterId: owner.id, targetType: 'organization', targetId: orgTarget.id,
      reason: 'Laporan organisasi yang valid untuk dicari.',
    });
    const searched = await request(app).get('/admin/reports?q=barang').set(authorization(admin));
    expect(searched.body.some((row) => row.targetType === 'item')).toBe(true);

    const banned = await request(app).post(`/admin/users/${applicant.id}/ban`).set(authorization(admin));
    expect(banned.body.status).toBe('banned');
    expect((await request(app).post(`/admin/users/${applicant.id}/warn`).set(authorization(admin))).status).toBe(400);
    expect((await request(app).delete(`/admin/items/${targetItem.id}`).set(authorization(admin))).status).toBe(400);
    await targetItem.update({ status: 'cancelled' });
    expect((await request(app).delete(`/admin/items/${targetItem.id}`).set(authorization(admin))).status).toBe(400);

    expect((await request(app).post('/admin/organizations').set(authorization(admin)).send({
      name: 'X', type: 'bad', description: 'Deskripsi organisasi cukup panjang.', latitude: -6.9, longitude: 107.6,
    })).status).toBe(400);
    expect((await request(app).post('/admin/organizations').set(authorization(admin)).send({
      name: 'X', type: 'orphanage', description: 'Deskripsi organisasi cukup panjang.',
      latitude: -6.9, longitude: 107.6, email: 1,
    })).status).toBe(400);
    expect((await request(app).post('/admin/organizations').set(authorization(admin)).send({
      name: 'X', type: 'orphanage', description: 'Deskripsi organisasi cukup panjang.',
      latitude: -6.9, longitude: 107.6, galleryUrls: 'nope',
    })).status).toBe(400);

    aiService.generateReply.mockRejectedValueOnce(new Error('down'));
    expect((await request(app).post('/admin/ai/organization').set(authorization(admin))
      .send({ organizationId: orgTarget.id })).status).toBe(502);
    expect((await request(app).post('/admin/ai/organization').set(authorization(admin))
      .send({ organizationId: 1, extra: true })).status).toBe(400);
    expect((await request(app).post('/admin/ai/organization').set(authorization(admin))
      .send({ organizationId: 999999 })).status).toBe(404);

    expect((await request(app).post('/ai/match').set(authorization(owner)).send({ have: 'a' })).status).toBe(400);
    expect((await request(app).post('/ai/match').set(authorization(owner)).send({
      have: 'kamera', want: 'lensa', extra: 1,
    })).status).toBe(400);
    const match = await request(app).post('/ai/match').set(authorization(owner)).send({
      have: 'kamera analog', want: 'lensa kit', category: 'electronics',
    });
    expect(match.status).toBe(200);

    const related = await db.Request.create({
      type: 'claim', fromUserId: owner.id, toUserId: admin.id, itemId: targetItem.id, status: 'completed',
    });
    expect((await request(app).post('/reports').set(authorization(owner)).send({
      targetType: 'user', targetId: admin.id, reason: 'Alasan laporan cukup panjang', requestId: related.id,
    })).status).toBe(201);
    expect((await request(app).post('/reports').set(authorization(owner)).send({
      targetType: 'user', targetId: admin.id, reason: 'Alasan laporan cukup panjang', requestId: 999999,
    })).status).toBe(404);
  });

  test('request validation, chat coordinates, org sync update, and pay errors', async () => {
    expect((await request(app).get('/items?sort=bad').set(authorization(owner))).status).toBe(400);
    expect((await request(app).get('/items?lat=abc&lng=1').set(authorization(owner))).status).toBe(400);
    expect((await request(app).get('/items?sort=oldest').set(authorization(owner))).status).toBe(200);
    const publicItem = await createItem(owner.id);
    expect((await request(app).post(`/items/${publicItem.id}/complete`).set(authorization(owner))).status).toBe(400);

    const orgUser = await createUser({ role: 'organization' });
    expect((await request(app).post('/items').set(authorization(orgUser)).send({
      type: 'public',
      title: 'Tidak boleh',
      description: 'Akun organisasi hanya unggah kebutuhan panti saja.',
      condition: 'good',
      category: 'other',
      creditValue: 0,
      latitude: -6.9,
      longitude: 107.6,
      imageUrl: 'https://ik.imagekit.io/test/x.jpg',
    })).status).toBe(400);

    expect((await request(app).post('/requests').set(authorization(applicant)).send({ type: 'claim' })).status).toBe(400);
    expect((await request(app).post('/requests').set(authorization(applicant)).send({
      type: 'claim', itemId: 1, reason: 'Alasan claim cukup panjang untuk cabang validasi.', extra: true,
    })).status).toBe(400);
    expect((await request(app).post('/requests').set(authorization(applicant)).send({
      type: 'org_offer', itemId: 1, toUserId: 1, extra: true,
    })).status).toBe(400);
    expect((await request(app).post('/requests').set(authorization(applicant)).send({
      type: 'barter', itemId: 1, targetItemId: 2, extra: true,
    })).status).toBe(400);
    expect((await request(app).post('/requests').set(authorization(applicant)).send({ type: 'org_offer' })).status).toBe(400);
    expect((await request(app).post('/requests').set(authorization(applicant)).send({
      type: 'org_offer', itemId: 0, toUserId: 1,
    })).status).toBe(400);
    expect((await request(app).post('/requests').set(authorization(applicant)).send({ type: 'barter' })).status).toBe(400);
    expect((await request(app).post('/requests').set(authorization(applicant)).send({ type: 'credit', extra: 1 })).status).toBe(400);
    expect((await request(app).post('/requests').set(authorization(applicant)).send({
      type: 'credit', itemId: publicItem.id,
    })).status).toBe(400);
    expect((await request(app).patch('/requests/1').set(authorization(owner)).send({ status: 'nope' })).status).toBe(400);
    expect((await request(app).post('/requests/1/shipping').set(authorization(applicant)).send({
      method: 'courier_agent', payer: 'other',
    })).status).toBe(400);
    expect((await request(app).post('/requests/999999/pay').set(authorization(applicant))).status).toBe(404);

    const claim = await request(app).post('/requests').set(authorization(applicant))
      .send({ type: 'claim', itemId: publicItem.id, reason: 'Saya membutuhkan meja ini untuk belajar.' });
    await request(app).patch(`/requests/${claim.body.id}`).set(authorization(owner)).send({ status: 'accepted' });
    expect((await request(app).post(`/requests/${claim.body.id}/shipping`)
      .set(authorization(applicant)).send({ method: 'walking' })).status).toBe(400);
    await request(app).post(`/requests/${claim.body.id}/shipping`)
      .set(authorization(applicant)).send({ method: 'courier_agent' });
    midtrans.isConfigured.mockReturnValue(true);
    midtrans.createSnapTransaction.mockRejectedValueOnce(new Error('down'));
    expect((await request(app).post(`/requests/${claim.body.id}/pay`).set(authorization(applicant))).status).toBe(502);
    midtrans.createSnapTransaction.mockResolvedValue({ token: 'snap', redirect_url: 'https://snap.test' });
    await request(app).post(`/requests/${claim.body.id}/pay`).set(authorization(applicant));
    midtrans.getTransactionStatus.mockRejectedValueOnce(new Error('down'));
    expect((await request(app).post(`/requests/${claim.body.id}/pay/confirm`).set(authorization(applicant))).status).toBe(502);
    await db.Shipment.update({ paymentStatus: 'paid' }, { where: { requestId: claim.body.id } });
    expect((await request(app).post(`/requests/${claim.body.id}/pay`).set(authorization(applicant))).status).toBe(400);
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    midtrans.isConfigured.mockReturnValue(false);
    const unpaidItem = await createItem(owner.id);
    const unpaidClaim = await request(app).post('/requests').set(authorization(applicant))
      .send({ type: 'claim', itemId: unpaidItem.id, reason: 'Saya membutuhkan meja ini untuk belajar.' });
    await request(app).patch(`/requests/${unpaidClaim.body.id}`).set(authorization(owner)).send({ status: 'accepted' });
    await request(app).post(`/requests/${unpaidClaim.body.id}/shipping`)
      .set(authorization(applicant)).send({ method: 'courier_agent' });
    expect((await request(app).post(`/requests/${unpaidClaim.body.id}/pay`).set(authorization(applicant))).status).toBe(502);
    process.env.NODE_ENV = env;
    midtrans.isConfigured.mockReturnValue(true);
    expect((await request(app).patch(`/requests/${claim.body.id}/tracking`).set(authorization(admin))
      .send({ trackingStatus: 'in_transit' })).status).toBe(403);

    expect((await request(app).post('/ai/chat').set(authorization(owner)).send({
      message: 'barang kamera', lat: -6.9,
    })).status).toBe(400);
    expect((await request(app).post('/ai/chat').set(authorization(owner)).send({
      message: 'barang kamera', lat: 'x', lng: 'y',
    })).status).toBe(400);
    const located = await request(app).post('/ai/chat').set(authorization(owner)).send({
      message: 'barang kamera', lat: -6.9, lng: 107.6,
    });
    expect(located.status).toBe(200);
    aiService.generateReply.mockRejectedValueOnce(new Error('down'));
    expect((await request(app).post('/ai/chat').set(authorization(owner)).send({ message: 'barang kamera' })).status)
      .toBe(502);

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        elements: [{
          id: 77, type: 'node', lat: -6.91, lon: 107.6,
          tags: { name: 'Panti Sync', amenity: 'orphanage', description: 'Deskripsi organisasi dari peta yang cukup panjang.' },
        }],
      }),
    });
    await request(app).get('/organizations?lat=-6.91&lng=107.6').set(authorization(owner));
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        elements: [{
          id: 77, type: 'node', lat: -6.92, lon: 107.61,
          tags: { name: 'Panti Synced', amenity: 'orphanage', description: 'Deskripsi organisasi dari peta yang cukup panjang.' },
        }],
      }),
    });
    const synced = await request(app).get('/organizations?lat=-6.91&lng=107.6').set(authorization(owner));
    expect(synced.body.data.some((row) => row.name === 'Panti Synced')).toBe(true);
    expect((await request(app).get('/admin/organizations?q=panti').set(authorization(admin))).status).toBe(200);
    expect((await request(app).post('/organizations/claim').set(authorization(orgUser)).send([])).status).toBe(400);
    expect((await request(app).get('/conversations/999999/messages').set(authorization(owner))).status).toBe(404);
    midtrans.verifyNotificationSignature.mockReturnValue(true);
    expect((await request(app).post('/midtrans/notification').send({
      order_id: 'missing', transaction_status: 'settlement',
    })).status).toBe(404);

    const acceptedBare = await db.Request.create({
      type: 'claim', fromUserId: applicant.id, toUserId: owner.id, itemId: publicItem.id,
      reason: 'Claim tanpa shipment tidak bisa diselesaikan.', status: 'accepted',
    });
    expect((await request(app).patch(`/requests/${acceptedBare.id}`).set(authorization(owner))
      .send({ status: 'completed' })).status).toBe(400);
    expect((await request(app).patch(`/requests/${acceptedBare.id}`).set(authorization(owner))
      .send({ status: 'rejected' })).status).toBe(400);

    const source = await createItem(applicant.id, { type: 'barter' });
    const wrong = await createItem(owner.id, { type: 'public' });
    const badBarter = await db.Request.create({
      type: 'barter', fromUserId: applicant.id, toUserId: owner.id,
      itemId: source.id, targetItemId: wrong.id, status: 'pending',
    });
    expect((await request(app).patch(`/requests/${badBarter.id}`).set(authorization(owner))
      .send({ status: 'accepted' })).status).toBe(400);
    expect((await request(app).get('/organizations?lat=&lng=107.6').set(authorization(owner))).status).toBe(400);

    const barterItem = await createItem(owner.id, { type: 'barter' });
    const offerOrg = await createUser({ role: 'organization' });
    await db.Organization.create({
      userId: offerOrg.id, name: 'Org Barter', type: 'community',
      description: 'Organisasi untuk menolak tawaran barang barter.', verified: 'approved',
    });
    expect((await request(app).post('/requests').set(authorization(owner)).send({
      type: 'org_offer', itemId: barterItem.id, toUserId: offerOrg.id,
    })).status).toBe(400);
    expect((await request(app).post('/requests/1/shipping').set(authorization(applicant)).send({
      method: 'pickup', extra: true,
    })).status).toBe(400);

    const far = await createUser({ latitude: 1, longitude: 1 });
    const farItem = await createItem(owner.id);
    const farClaim = await request(app).post('/requests').set(authorization(far))
      .send({ type: 'claim', itemId: farItem.id, reason: 'Saya membutuhkan meja ini untuk belajar.' });
    await request(app).patch(`/requests/${farClaim.body.id}`).set(authorization(owner)).send({ status: 'accepted' });
    expect((await request(app).post(`/requests/${farClaim.body.id}/shipping`).set(authorization(far))
      .send({ method: 'pickup' })).body).toEqual({ message: 'Invalid shipping method' });

    const equalSource = await createItem(applicant.id, { type: 'barter', creditValue: 10 });
    const equalTarget = await createItem(owner.id, { type: 'barter', creditValue: 10 });
    await applicant.update({ creditBalance: 50 });
    const equalBarter = await request(app).post('/requests').set(authorization(applicant))
      .send({ type: 'barter', itemId: equalSource.id, targetItemId: equalTarget.id });
    await request(app).patch(`/requests/${equalBarter.body.id}`).set(authorization(owner)).send({ status: 'accepted' });
    await request(app).post(`/requests/${equalBarter.body.id}/shipping`).set(authorization(applicant)).send({ method: 'pickup' });
    expect((await request(app).patch(`/requests/${equalBarter.body.id}`).set(authorization(owner))
      .send({ status: 'completed' })).status).toBe(200);

    midtrans.isConfigured.mockReturnValue(true);
    midtrans.verifyNotificationSignature.mockReturnValue(true);
    midtrans.isPaidStatus.mockReturnValue(false);
    const paidShip = await db.Shipment.findOne({ where: { method: 'courier_agent' } });
    if (paidShip?.midtransOrderId) {
      expect((await request(app).post('/midtrans/notification').send({
        order_id: paidShip.midtransOrderId, transaction_status: 'deny',
      })).body).toEqual({ message: 'OK' });
    }

    expect((await request(app).patch('/me').set(authorization(owner)).send({
      latitude: '1', longitude: '2',
    })).status).toBe(400);

    const previousEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    await request(app).get('/organizations?lat=-6.91&lng=107.6').set(authorization(owner));
    await request(app).get('/organizations?lat=-6.91&lng=107.6').set(authorization(owner));
    process.env.NODE_ENV = previousEnv;
  });
});

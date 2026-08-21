jest.mock('../socket', () => ({
  emitNotification: jest.fn(),
  emitMessageEvents: jest.fn(),
}));

const request = require('supertest');
const app = require('../app');
const socket = require('../socket');
const { db, cleanDb, createUser, createItem, authorization } = require('./utils');

describe('Requests state machine', () => {
  let owner;
  let applicant;
  let other;

  beforeEach(async () => {
    await cleanDb();
    owner = await createUser({ creditBalance: 100 });
    applicant = await createUser({ latitude: -6.901, longitude: 107.601, creditBalance: 100 });
    other = await createUser({ latitude: -6.902, longitude: 107.602, creditBalance: 0 });
    socket.emitNotification.mockReset();
  });
  afterAll(() => db.sequelize.close());

  test('creates claim, keeps item available, prevents self/duplicate and emits', async () => {
    const item = await createItem(owner.id);
    const created = await request(app).post('/requests').set(authorization(applicant)).send({ type: 'claim', itemId: item.id, reason: 'Saya membutuhkan barang ini untuk kegiatan belajar.' });
    expect(created.status).toBe(201);
    expect(created.body).toEqual(expect.objectContaining({ fromUserId: applicant.id, toUserId: owner.id, status: 'pending' }));
    expect((await db.Item.findByPk(item.id)).status).toBe('available');
    expect(socket.emitNotification).toHaveBeenCalledWith(owner.id, expect.objectContaining({ type: 'claim', requestId: created.body.id }));
    expect((await request(app).post('/requests').set(authorization(owner)).send({ type: 'claim', itemId: item.id, reason: 'Saya mencoba claim barang milik sendiri.' })).body).toEqual({ message: 'Cannot request your own item' });
    expect((await request(app).post('/requests').set(authorization(applicant)).send({ type: 'claim', itemId: item.id, reason: 'Saya membutuhkan barang ini untuk kegiatan belajar.' })).body).toEqual({ message: 'Claim already exists' });
  });

  test.each([
    [{ type: 'bad', itemId: 1 }, 400],
    [{ type: 'claim', itemId: 999999, reason: 'Alasan yang panjang untuk claim ini.' }, 404],
    [{ type: 'claim', itemId: 1, reason: 'short' }, 404],
    [{ type: 'claim', itemId: '1', reason: 'Alasan yang panjang untuk claim ini.' }, 400],
  ])('validates claim request body', async (body, status) => {
    const response = await request(app).post('/requests').set(authorization(applicant)).send(body);
    expect(response.status).toBe(status);
  });

  test('rejects claim for wrong type and unavailable item', async () => {
    const barter = await createItem(owner.id, { type: 'barter' });
    const unavailable = await createItem(owner.id, { status: 'pending' });
    for (const item of [barter, unavailable]) {
      const response = await request(app).post('/requests').set(authorization(applicant)).send({ type: 'claim', itemId: item.id, reason: 'Alasan claim cukup panjang untuk dilakukan.' });
      expect(response.status).toBe(400);
    }
  });

  test('accepts claim atomically, rejects competing claims, creates conversation and notifications', async () => {
    const item = await createItem(owner.id);
    const first = await db.Request.create({ type: 'claim', fromUserId: applicant.id, toUserId: owner.id, itemId: item.id, reason: 'Claim pertama cukup panjang untuk diterima.', status: 'pending' });
    const competing = await db.Request.create({ type: 'claim', fromUserId: other.id, toUserId: owner.id, itemId: item.id, reason: 'Claim kedua cukup panjang dan akan ditolak.', status: 'pending' });
    const invalid = await request(app).patch(`/requests/${first.id}`).set(authorization(owner)).send({ status: 'accepted', shippingMethod: 'jne' });
    expect(invalid.body).toEqual({ message: 'Validation error' });
    expect((await db.Request.findByPk(first.id)).status).toBe('pending');
    expect((await request(app).patch(`/requests/${first.id}`).set(authorization(other)).send({ status: 'accepted' })).status).toBe(403);
    const accepted = await request(app).patch(`/requests/${first.id}`).set(authorization(owner)).send({ status: 'accepted' });
    expect(accepted.body.status).toBe('accepted');
    expect((await db.Item.findByPk(item.id)).status).toBe('pending');
    expect((await db.Request.findByPk(competing.id)).status).toBe('rejected');
    expect(await db.Conversation.count()).toBe(1);
    expect(socket.emitNotification).toHaveBeenCalledWith(applicant.id, expect.objectContaining({ type: 'accepted' }));
    expect(socket.emitNotification).toHaveBeenCalledWith(other.id, expect.objectContaining({ type: 'rejected' }));
  });

  test('rejects and completes claim only through valid transitions by either participant', async () => {
    const rejectedItem = await createItem(owner.id);
    const rejectedRequest = await db.Request.create({ type: 'claim', fromUserId: applicant.id, toUserId: owner.id, itemId: rejectedItem.id, reason: 'Claim yang akan ditolak pemilik barang.', status: 'pending' });
    const rejected = await request(app).patch(`/requests/${rejectedRequest.id}`).set(authorization(owner)).send({ status: 'rejected' });
    expect(rejected.body.status).toBe('rejected');
    expect((await db.Item.findByPk(rejectedItem.id)).status).toBe('available');
    expect((await request(app).patch(`/requests/${rejectedRequest.id}`).set(authorization(owner)).send({ status: 'accepted' })).status).toBe(400);

    for (const completingUser of ['from', 'to']) {
      const item = await createItem(owner.id, { status: 'pending' });
      const acceptedRequest = await db.Request.create({ type: 'claim', fromUserId: applicant.id, toUserId: owner.id, itemId: item.id, reason: 'Claim accepted yang akan diselesaikan participant.', shippingMethod: 'pickup', status: 'accepted' });
      await db.Shipment.create({
        requestId: acceptedRequest.id,
        method: 'pickup',
        payer: 'from_user',
        paymentStatus: 'not_required',
        trackingStatus: 'ready_for_pickup',
        grossAmount: 0,
      });
      const actor = completingUser === 'from' ? applicant : owner;
      const completed = await request(app).patch(`/requests/${acceptedRequest.id}`).set(authorization(actor)).send({ status: 'completed' });
      expect(completed.body.status).toBe('completed');
      expect((await db.Item.findByPk(item.id)).status).toBe('completed');
    }
    const pending = await db.Request.create({ type: 'claim', fromUserId: applicant.id, toUserId: owner.id, itemId: rejectedItem.id, reason: 'Pending tidak boleh langsung menjadi completed.', status: 'pending' });
    expect((await request(app).patch(`/requests/${pending.id}`).set(authorization(applicant)).send({ status: 'completed' })).status).toBe(400);
    expect((await request(app).patch(`/requests/${pending.id}`).set(authorization(other)).send({ status: 'completed' })).status).toBe(403);
  });

  async function createOrganizationAccount(verified = 'approved') {
    const user = await createUser({ role: 'organization' });
    const organization = await db.Organization.create({ userId: user.id, name: `Org ${user.id}`, type: 'community', description: 'Organization description is sufficiently long.', verified, latitude: -6.9, longitude: 107.6, addressLabel: 'Bandung' });
    return { user, organization };
  }

  test('creates organization offers only for approved organizations and allowed items', async () => {
    const approved = await createOrganizationAccount();
    const pending = await createOrganizationAccount('pending');
    const rejected = await createOrganizationAccount('rejected');
    const publicItem = await createItem(owner.id, { type: 'public' });
    const orgItem = await createItem(owner.id, { type: 'organization' });
    for (const item of [publicItem, orgItem]) {
      const response = await request(app).post('/requests').set(authorization(owner)).send({ type: 'org_offer', itemId: item.id, toUserId: approved.user.id });
      expect(response.status).toBe(201);
    }
    expect((await request(app).post('/requests').set(authorization(owner)).send({ type: 'org_offer', itemId: publicItem.id, toUserId: pending.user.id })).status).toBe(201);
    expect((await request(app).post('/requests').set(authorization(owner)).send({ type: 'org_offer', itemId: publicItem.id, toUserId: rejected.user.id })).status).toBe(403);
    expect((await request(app).post('/requests').set(authorization(owner)).send({ type: 'org_offer', itemId: publicItem.id, toUserId: other.id })).status).toBe(400);
    expect((await request(app).post('/requests').set(authorization(other)).send({ type: 'org_offer', itemId: publicItem.id, toUserId: approved.user.id })).status).toBe(403);
    expect((await request(app).post('/requests').set(authorization(approved.user)).send({ type: 'org_offer', itemId: publicItem.id, toUserId: approved.user.id })).body).toEqual({ message: 'Cannot request your own item' });
    expect(socket.emitNotification).toHaveBeenCalledWith(approved.user.id, expect.objectContaining({ type: 'offer' }));
  });

  test('accepts, rejects and completes organization offers with verification recheck', async () => {
    const approved = await createOrganizationAccount();
    const acceptedItem = await createItem(owner.id, { type: 'organization' });
    const acceptedRequest = await db.Request.create({ type: 'org_offer', fromUserId: owner.id, toUserId: approved.user.id, itemId: acceptedItem.id, status: 'pending' });
    const accepted = await request(app).patch(`/requests/${acceptedRequest.id}`).set(authorization(approved.user)).send({ status: 'accepted' });
    expect(accepted.body.status).toBe('accepted');
    expect(await db.Conversation.count()).toBe(1);
    await db.Shipment.update({ method: 'pickup', trackingStatus: 'ready_for_pickup' }, { where: { requestId: acceptedRequest.id } });
    const completed = await request(app).patch(`/requests/${acceptedRequest.id}`).set(authorization(owner)).send({ status: 'completed' });
    expect(completed.body.status).toBe('completed');

    const rejectedItem = await createItem(owner.id);
    const rejectedRequest = await db.Request.create({ type: 'org_offer', fromUserId: owner.id, toUserId: approved.user.id, itemId: rejectedItem.id, status: 'pending' });
    expect((await request(app).patch(`/requests/${rejectedRequest.id}`).set(authorization(approved.user)).send({ status: 'rejected' })).body.status).toBe('rejected');
    await approved.organization.update({ verified: 'pending' });
    const blockedItem = await createItem(owner.id);
    const blockedRequest = await db.Request.create({ type: 'org_offer', fromUserId: owner.id, toUserId: approved.user.id, itemId: blockedItem.id, status: 'pending' });
    expect((await request(app).patch(`/requests/${blockedRequest.id}`).set(authorization(approved.user)).send({ status: 'accepted' })).body).toEqual({ message: 'Organization is not verified' });
  });

  test('creates barter without transferring credit and validates ownership/items', async () => {
    const source = await createItem(applicant.id, { type: 'barter', creditValue: 30 });
    const target = await createItem(owner.id, { type: 'barter', creditValue: 50 });
    const before = applicant.creditBalance;
    const response = await request(app).post('/requests').set(authorization(applicant)).send({ type: 'barter', itemId: source.id, targetItemId: target.id });
    expect(response.status).toBe(201);
    expect((await db.User.findByPk(applicant.id)).creditBalance).toBe(before);
    expect((await request(app).post('/requests').set(authorization(other)).send({ type: 'barter', itemId: source.id, targetItemId: target.id })).status).toBe(403);
    const wrongTarget = await createItem(owner.id, { type: 'public' });
    expect((await request(app).post('/requests').set(authorization(applicant)).send({ type: 'barter', itemId: source.id, targetItemId: wrongTarget.id })).status).toBe(400);
    expect((await request(app).post('/requests').set(authorization(applicant)).send({ type: 'barter', itemId: source.id, targetItemId: source.id })).status).toBe(400);
  });

  test('settles successful and equal barter atomically', async () => {
    for (const equal of [false, true]) {
      await applicant.reload();
      await owner.reload();
      await applicant.update({ creditBalance: 100 });
      await owner.update({ creditBalance: 10 });
      const source = await createItem(applicant.id, { type: 'barter', creditValue: equal ? 40 : 30 });
      const target = await createItem(owner.id, { type: 'barter', creditValue: equal ? 40 : 50 });
      const barter = await db.Request.create({ type: 'barter', fromUserId: applicant.id, toUserId: owner.id, itemId: source.id, targetItemId: target.id, status: 'pending' });
      const response = await request(app).patch(`/requests/${barter.id}`).set(authorization(owner)).send({ status: 'accepted' });
      expect(response.body.status).toBe('accepted');
      expect((await db.Item.findByPk(source.id)).status).toBe('pending');
      expect((await db.Item.findByPk(target.id)).status).toBe('pending');
      expect((await db.User.findByPk(applicant.id)).creditBalance).toBe(equal ? 100 : 80);
      expect(await db.Conversation.count({ where: { userAId: Math.min(owner.id, applicant.id), userBId: Math.max(owner.id, applicant.id) } })).toBe(1);
    }
  });

  test('rolls back insufficient barter and supports rejection', async () => {
    await applicant.update({ creditBalance: 5 });
    const source = await createItem(applicant.id, { type: 'barter', creditValue: 30 });
    const target = await createItem(owner.id, { type: 'barter', creditValue: 50 });
    const barter = await db.Request.create({ type: 'barter', fromUserId: applicant.id, toUserId: owner.id, itemId: source.id, targetItemId: target.id, status: 'pending' });
    const insufficient = await request(app).patch(`/requests/${barter.id}`).set(authorization(owner)).send({ status: 'accepted' });
    expect(insufficient.body).toEqual({ message: 'Insufficient credit' });
    expect((await db.Request.findByPk(barter.id)).status).toBe('pending');
    expect((await db.Item.findByPk(source.id)).status).toBe('available');
    const rejected = await request(app).patch(`/requests/${barter.id}`).set(authorization(owner)).send({ status: 'rejected' });
    expect(rejected.body.status).toBe('rejected');
  });

  test('redeems rejected barter with authorization, balance transfer and rollback', async () => {
    const source = await createItem(applicant.id, { type: 'barter', creditValue: 20 });
    const target = await createItem(owner.id, { type: 'barter', creditValue: 60 });
    const barter = await db.Request.create({ type: 'barter', fromUserId: applicant.id, toUserId: owner.id, itemId: source.id, targetItemId: target.id, status: 'rejected' });
    expect((await request(app).post(`/requests/${barter.id}/redeem-credit`).set(authorization(other))).status).toBe(403);
    await applicant.update({ creditBalance: 50 });
    expect((await request(app).post(`/requests/${barter.id}/redeem-credit`).set(authorization(applicant))).body).toEqual({ message: 'Insufficient credit' });
    expect((await db.Item.findByPk(target.id)).status).toBe('available');
    await applicant.update({ creditBalance: 100 });
    const beforeOwner = (await db.User.findByPk(owner.id)).creditBalance;
    const redeemed = await request(app).post(`/requests/${barter.id}/redeem-credit`).set(authorization(applicant));
    expect(redeemed.body.status).toBe('accepted');
    expect((await db.Item.findByPk(source.id)).status).toBe('available');
    expect((await db.Item.findByPk(target.id)).status).toBe('pending');
    expect((await db.User.findByPk(applicant.id)).creditBalance).toBe(40);
    expect((await db.User.findByPk(owner.id)).creditBalance).toBe(beforeOwner + 60);
    expect(await db.Conversation.count()).toBe(1);
    expect((await request(app).post(`/requests/${barter.id}/redeem-credit`).set(authorization(applicant))).status).toBe(400);
  });

  test('lists incoming/outgoing safely with coordinate privacy', async () => {
    const item = await createItem(owner.id);
    await db.Request.create({ type: 'claim', fromUserId: applicant.id, toUserId: owner.id, itemId: item.id, reason: 'Pending request coordinates stay private.', status: 'pending' });
    await db.Request.create({ type: 'claim', fromUserId: other.id, toUserId: owner.id, itemId: item.id, reason: 'Accepted participants can view coordinates.', shippingMethod: 'pickup', status: 'accepted' });
    const incoming = await request(app).get('/requests/incoming').set(authorization(owner));
    const outgoing = await request(app).get('/requests/outgoing').set(authorization(applicant));
    expect(incoming.body.every((entry) => entry.toUserId === owner.id)).toBe(true);
    expect(outgoing.body.every((entry) => entry.fromUserId === applicant.id)).toBe(true);
    expect(incoming.body.find((entry) => entry.status === 'pending').item).not.toHaveProperty('latitude');
    expect(incoming.body.find((entry) => entry.status === 'accepted').item).toHaveProperty('latitude');
    expect(JSON.stringify(incoming.body)).not.toContain('password');
  });
});

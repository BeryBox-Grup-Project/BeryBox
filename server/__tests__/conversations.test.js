jest.mock('../socket', () => ({
  emitMessageEvents: jest.fn(),
  emitNotification: jest.fn(),
}));

const request = require('supertest');
const app = require('../app');
const socket = require('../socket');
const { db, cleanDb, createUser, createItem, authorization } = require('./utils');

describe('conversations and REST messages', () => {
  let alice;
  let bob;
  let outsider;

  beforeEach(async () => {
    jest.clearAllMocks();
    await cleanDb();
    alice = await createUser();
    bob = await createUser();
    outsider = await createUser();
  });

  afterAll(async () => db.sequelize.close());

  test('creates a normalized conversation and returns the existing pair', async () => {
    const item = await createItem(alice.id);
    const first = await request(app).post('/conversations').set(authorization(bob))
      .send({ otherUserId: alice.id, itemId: item.id });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ userAId: alice.id, userBId: bob.id, itemId: item.id });

    const again = await request(app).post('/conversations').set(authorization(alice))
      .send({ otherUserId: bob.id });
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(first.body.id);
  });

  test.each([
    [{ otherUserId: 0 }, 400],
    [{ otherUserId: '2' }, 400],
    [{ otherUserId: 2, itemId: 0 }, 400],
    [{ otherUserId: 2, extra: true }, 400],
    [[], 400],
  ])('validates conversation payload %#', async (body, status) => {
    expect((await request(app).post('/conversations').set(authorization(alice)).send(body)).status)
      .toBe(status);
  });

  test('rejects self conversation and missing user or item', async () => {
    expect((await request(app).post('/conversations').set(authorization(alice))
      .send({ otherUserId: alice.id })).status).toBe(400);
    expect((await request(app).post('/conversations').set(authorization(alice))
      .send({ otherUserId: 999999 })).status).toBe(404);
    expect((await request(app).post('/conversations').set(authorization(alice))
      .send({ otherUserId: bob.id, itemId: 999999 })).status).toBe(404);
  });

  test('lists only own inbox with other user and latest message', async () => {
    const own = await db.Conversation.create({ userAId: alice.id, userBId: bob.id });
    await db.Conversation.create({ userAId: bob.id, userBId: outsider.id });
    expect((await request(app).get('/conversations').set(authorization(alice))).body[0])
      .toMatchObject({ id: own.id, otherUser: { id: bob.id }, lastMessage: null });

    await db.Message.create({ conversationId: own.id, senderId: bob.id, body: 'first' });
    await db.Message.create({ conversationId: own.id, senderId: alice.id, body: 'latest' });
    const response = await request(app).get('/conversations').set(authorization(bob));
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body.find((entry) => entry.id === own.id)).toMatchObject({
      otherUser: { id: alice.id, username: alice.username },
      lastMessage: { body: 'latest', senderId: alice.id },
    });
  });

  test('returns chronological history only to participants', async () => {
    const conversation = await db.Conversation.create({ userAId: alice.id, userBId: bob.id });
    await db.Message.create({ conversationId: conversation.id, senderId: bob.id, body: 'one' });
    await db.Message.create({ conversationId: conversation.id, senderId: alice.id, body: 'two' });
    const response = await request(app).get(`/conversations/${conversation.id}/messages`)
      .set(authorization(alice));
    expect(response.status).toBe(200);
    expect(response.body.map((message) => message.body)).toEqual(['one', 'two']);
    expect(response.body[0]).toEqual(expect.objectContaining({
      conversationId: conversation.id, senderId: bob.id,
    }));
    expect((await request(app).get(`/conversations/${conversation.id}/messages`)
      .set(authorization(outsider))).status).toBe(403);
    expect((await request(app).get('/conversations/nope/messages')
      .set(authorization(alice))).status).toBe(404);
    expect((await request(app).get('/conversations/999999/messages')
      .set(authorization(alice))).status).toBe(404);
  });

  test('creates a message as the authenticated sender and emits it', async () => {
    const conversation = await db.Conversation.create({ userAId: alice.id, userBId: bob.id });
    const response = await request(app).post(`/conversations/${conversation.id}/messages`)
      .set(authorization(alice)).send({ body: 'hello', senderId: bob.id });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ senderId: alice.id, body: 'hello' });
    expect(socket.emitMessageEvents).toHaveBeenCalledWith(expect.objectContaining({
      senderUsername: alice.username,
      message: expect.objectContaining({ senderId: alice.id }),
    }));
  });

  test.each([{}, { body: '' }, { body: 42 }, { body: 'x'.repeat(2001) }])(
    'validates message body %#', async (body) => {
      const conversation = await db.Conversation.create({ userAId: alice.id, userBId: bob.id });
      expect((await request(app).post(`/conversations/${conversation.id}/messages`)
        .set(authorization(alice)).send(body)).status).toBe(400);
    },
  );

  test('blocks a nonparticipant from posting messages', async () => {
    const conversation = await db.Conversation.create({ userAId: alice.id, userBId: bob.id });
    expect((await request(app).post(`/conversations/${conversation.id}/messages`)
      .set(authorization(outsider)).send({ body: 'intrusion' })).status).toBe(403);
  });
});

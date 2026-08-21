jest.mock('../socket', () => ({ emitMessageEvents: jest.fn(), emitNotification: jest.fn() }));

const request = require('supertest');
const app = require('../app');
const { db, cleanDb, createUser, authorization } = require('./utils');

describe('route rate limits', () => {
  jest.setTimeout(60000);
  beforeEach(cleanDb);
  afterAll(async () => db.sequelize.close());

  test('login permits 10 attempts per IP then returns 429', async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await request(app).post('/login')
        .send({ email: 'missing@test.local', password: 'Password123!' });

      expect(response.status).toBe(401);
    }

    const limited = await request(app).post('/login')
      .send({ email: 'missing@test.local', password: 'Password123!' });
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ message: 'Too many requests' });
  });

  test('message limit is keyed by authenticated user at 60 per minute', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const conversation = await db.Conversation.create({ userAId: alice.id, userBId: bob.id });
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const response = await request(app).post(`/conversations/${conversation.id}/messages`)
        .set(authorization(alice)).send({ body: `message ${attempt}` });
      expect(response.status).toBe(201);
    }
    const limited = await request(app).post(`/conversations/${conversation.id}/messages`)
      .set(authorization(alice)).send({ body: 'one too many' });
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ message: 'Too many requests' });

    const otherUser = await request(app).post(`/conversations/${conversation.id}/messages`)
      .set(authorization(bob)).send({ body: 'independent quota' });
    expect(otherUser.status).toBe(201);
  });
});

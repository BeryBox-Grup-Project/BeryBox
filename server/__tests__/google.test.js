jest.mock('../helpers/nominatim', () => ({ reverse: jest.fn() }));
jest.mock('../helpers/google', () => ({ verifyGoogleToken: jest.fn() }));

const request = require('supertest');
const app = require('../app');
const nominatim = require('../helpers/nominatim');
const { verifyGoogleToken } = require('../helpers/google');
const { db, cleanDb, createUser } = require('./utils');

describe('Google login', () => {
  beforeEach(async () => {
    await cleanDb();
    nominatim.reverse.mockReset().mockResolvedValue('Coblong, Bandung');
    verifyGoogleToken.mockReset();
  });
  afterAll(() => db.sequelize.close());

  test('creates a user from a new google account and logs existing users in', async () => {
    verifyGoogleToken.mockResolvedValue({ email: 'google@test.local', name: 'Google User' });
    const created = await request(app).post('/google-login').send({
      id_token: 'token', latitude: -6.9, longitude: 107.6,
    });
    expect(created.status).toBe(201);
    expect(created.body.user.email).toBe('google@test.local');

    const again = await request(app).post('/google-login').send({ id_token: 'token' });
    expect(again.status).toBe(201);
    expect(again.body.user.id).toBe(created.body.user.id);
  });

  test('requires coordinates for a new google user and blocks banned accounts', async () => {
    verifyGoogleToken.mockResolvedValue({ email: 'plain.user@test.local', name: 'New Google' });
    expect((await request(app).post('/google-login').send({ id_token: 'token' })).status).toBe(400);
    const banned = await createUser({ email: 'banned.google@test.local', status: 'banned' });
    verifyGoogleToken.mockResolvedValue({ email: banned.email, name: 'Banned' });
    expect((await request(app).post('/google-login').send({ id_token: 'token' })).body)
      .toEqual({ message: 'Account banned' });
  });
});

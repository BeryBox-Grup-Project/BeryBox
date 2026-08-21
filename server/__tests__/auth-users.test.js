jest.mock('../helpers/nominatim', () => ({ reverse: jest.fn() }));
jest.mock('../helpers/imagekit', () => ({
  getImageKit: () => ({
    getAuthenticationParameters: () => ({ token: 'test-token', expire: 1710000000, signature: 'test-signature' }),
  }),
  isImageKitUrl: jest.fn(),
}));

const request = require('supertest');
const app = require('../app');
const nominatim = require('../helpers/nominatim');
const { signToken } = require('../helpers/jwt');
const { db, cleanDb, createUser, authorization } = require('./utils');

describe('authentication and public user API', () => {
  beforeEach(async () => {
    await cleanDb();
    nominatim.reverse.mockReset().mockResolvedValue('Coblong, Bandung');
  });
  afterAll(() => db.sequelize.close());

  const registerBody = (overrides = {}) => ({
    username: 'alice',
    email: 'alice@test.local',
    password: 'Alice123!',
    latitude: -6.9,
    longitude: 107.6,
    ...overrides,
  });

  test.each([
    [{}, 'user'],
    [{ role: 'organization', username: 'org', email: 'org@test.local' }, 'organization'],
  ])('registers valid accounts without secrets', async (overrides, role) => {
    const response = await request(app).post('/register').send(registerBody(overrides));
    expect(response.status).toBe(201);
    expect(response.body).toEqual(expect.objectContaining({ role, addressLabel: 'Coblong, Bandung' }));
    expect(response.body).not.toHaveProperty('password');
    expect(response.body).not.toHaveProperty('access_token');
    const stored = await db.User.scope('withPassword').findOne({ where: { email: response.body.email } });
    expect(stored.password).not.toBe('Alice123!');
  });

  test.each([
    [{ role: 'admin' }, 'Validation error'],
    [{ password: 'short' }, 'Validation error'],
    [{ username: '' }, 'Validation error'],
    [{ email: null }, 'Validation error'],
    [{ latitude: 'x' }, 'Validation error'],
    [{ longitude: Infinity }, 'Validation error'],
  ])('rejects invalid registration', async (overrides, message) => {
    const response = await request(app).post('/register').send(registerBody(overrides));
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message });
  });

  test('handles duplicate email and username', async () => {
    await request(app).post('/register').send(registerBody());
    const duplicateEmail = await request(app).post('/register').send(registerBody({ username: 'other' }));
    const duplicateUsername = await request(app).post('/register').send(registerBody({ email: 'other@test.local' }));
    expect(duplicateEmail.body).toEqual({ message: 'Email already registered' });
    expect(duplicateUsername.body).toEqual({ message: 'Username already taken' });
  });

  test('uses Unknown location fallback supplied by Nominatim helper', async () => {
    nominatim.reverse.mockResolvedValueOnce('Unknown location');
    const response = await request(app).post('/register').send(registerBody());
    expect(response.body.addressLabel).toBe('Unknown location');
  });

  test('logs in and returns contracted token/user response', async () => {
    await request(app).post('/register').send(registerBody());
    const response = await request(app).post('/login').send({ email: 'alice@test.local', password: 'Alice123!' });
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('access_token');
    expect(response.body.user).not.toHaveProperty('password');
    const me = await request(app).get('/me').set('Authorization', `Bearer ${response.body.access_token}`);
    expect(me.status).toBe(200);
    expect(me.body).toEqual(expect.objectContaining({ email: 'alice@test.local', latitude: -6.9, longitude: 107.6 }));
  });

  test.each([
    [{ email: 'missing@test.local', password: 'Password123!' }],
    [{ email: 'alice@test.local', password: 'wrong' }],
    [{ email: '', password: 'Password123!' }],
    [{ email: 'alice@test.local', password: '' }],
    [{}],
  ])('rejects invalid login uniformly', async (body) => {
    await createUser({ username: 'alice', email: 'alice@test.local' });
    const response = await request(app).post('/login').send(body);
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Invalid email or password' });
  });

  test('rejects missing, malformed, expired and deleted-user tokens', async () => {
    const user = await createUser();
    expect((await request(app).get('/me')).body).toEqual({ message: 'Invalid token' });
    expect((await request(app).get('/me').set('Authorization', 'Token bad')).body).toEqual({ message: 'Invalid token' });
    expect((await request(app).get('/me').set('Authorization', 'Bearer malformed')).body).toEqual({ message: 'Invalid token' });
    const oldExpiry = process.env.JWT_EXPIRES_IN;
    process.env.JWT_EXPIRES_IN = '-1s';
    const expired = signToken({ id: user.id, email: user.email, role: user.role });
    process.env.JWT_EXPIRES_IN = oldExpiry;
    expect((await request(app).get('/me').set('Authorization', `Bearer ${expired}`)).status).toBe(401);
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    await user.destroy();
    expect((await request(app).get('/me').set('Authorization', `Bearer ${token}`)).status).toBe(401);
  });

  test('returns safe public user profile and not found cases', async () => {
    const viewer = await createUser();
    const target = await createUser({ ratingAvg: 4.5 });
    const response = await request(app).get(`/users/${target.id}`).set(authorization(viewer));
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: target.id, username: target.username, role: target.role, ratingAvg: 4.5, addressLabel: 'Bandung' });
    expect(JSON.stringify(response.body)).not.toContain('email');
    expect((await request(app).get('/users/bad').set(authorization(viewer))).status).toBe(404);
    expect((await request(app).get('/users/999999').set(authorization(viewer))).status).toBe(404);
  });

  test('returns mocked ImageKit authentication shape', async () => {
    const user = await createUser();
    const response = await request(app).get('/images/auth').set(authorization(user));
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ token: 'test-token', expire: 1710000000, signature: 'test-signature' });
    expect(response.body).not.toHaveProperty('privateKey');
  });
});

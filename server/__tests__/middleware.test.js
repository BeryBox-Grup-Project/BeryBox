const errorHandler = require('../middlewares/errorHandler');
const { adminAuthorization, organizationAuthorization } = require('../middlewares/authorization');

function responseMock() {
  return {
    headersSent: false,
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('authorization middleware', () => {
  test('admin and organization roles pass', () => {
    const next = jest.fn();
    adminAuthorization({ user: { role: 'admin' } }, {}, next);
    organizationAuthorization({ user: { role: 'organization' } }, {}, next);
    expect(next).toHaveBeenNthCalledWith(1);
    expect(next).toHaveBeenNthCalledWith(2);
  });

  test('wrong roles return contracted errors', () => {
    const nextAdmin = jest.fn();
    const nextOrg = jest.fn();
    adminAuthorization({ user: { role: 'user' } }, {}, nextAdmin);
    organizationAuthorization({ user: { role: 'user' } }, {}, nextOrg);
    expect(nextAdmin.mock.calls[0][0]).toEqual(expect.objectContaining({ status: 403, message: 'Admin access required' }));
    expect(nextOrg.mock.calls[0][0]).toEqual(expect.objectContaining({ status: 403, message: 'Forbidden' }));
  });
});

describe('centralized error handler', () => {
  test.each([
    [{ status: 403, message: 'Forbidden' }, 403, 'Forbidden'],
    [{ status: 404, message: 'Not found' }, 404, 'Not found'],
    [{ status: 400, message: '' }, 400, 'Internal server error'],
    [{ message: 'secret stack' }, 500, 'Internal server error'],
    [{ name: 'SequelizeValidationError', message: 'raw' }, 400, 'Validation error'],
    [{ name: 'SequelizeUniqueConstraintError', fields: { email: 'x' } }, 400, 'Email already registered'],
    [{ name: 'SequelizeUniqueConstraintError', fields: { username: 'x' } }, 400, 'Username already taken'],
    [{ name: 'SequelizeUniqueConstraintError', fields: { other: 'x' } }, 400, 'Validation error'],
  ])('maps errors to safe JSON', (error, status, message) => {
    const res = responseMock();
    errorHandler(error, {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith({ message });
  });

  test('maps malformed JSON syntax and delegates after headers sent', () => {
    const syntax = new SyntaxError('bad');
    syntax.type = 'entity.parse.failed';
    const res = responseMock();
    errorHandler(syntax, {}, res, jest.fn());
    expect(res.json).toHaveBeenCalledWith({ message: 'Validation error' });
    const next = jest.fn();
    errorHandler(new Error('late'), {}, { headersSent: true }, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('CORS origins', () => {
  const app = require('../app');
  const request = require('supertest');

  test('allows any origin including unknown hosts', async () => {
    const allowed = await request(app).options('/login').set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const other = await request(app).options('/login').set('Origin', 'http://evil.test')
      .set('Access-Control-Request-Method', 'POST');
    expect(other.headers['access-control-allow-origin']).toBe('http://evil.test');
  });

  test('keeps CORS headers on API errors', async () => {
    const response = await request(app)
      .post('/reports')
      .set('Origin', 'https://www.berybox.web.id')
      .send({});
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.headers['access-control-allow-origin']).toBe('https://www.berybox.web.id');
  });
});

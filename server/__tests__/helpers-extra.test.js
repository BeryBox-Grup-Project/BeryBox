const crypto = require('crypto');

jest.mock('google-auth-library', () => {
  const verifyIdToken = jest.fn();
  function OAuth2Client() {
    return { verifyIdToken };
  }
  OAuth2Client.verifyIdToken = verifyIdToken;
  return { OAuth2Client };
});

jest.mock('midtrans-client', () => {
  const Snap = jest.fn().mockImplementation(() => ({
    createTransaction: jest.fn().mockResolvedValue({ token: 'snap-token', redirect_url: 'https://snap.test' }),
  }));
  const CoreApi = jest.fn().mockImplementation(() => ({
    transaction: { status: jest.fn().mockResolvedValue({ transaction_status: 'settlement' }) },
  }));
  return { Snap, CoreApi };
});

const { OAuth2Client } = require('google-auth-library');
const midtransClient = require('midtrans-client');
const { raceWithTimeout } = require('../helpers/timeout');
const { sanitizeUsername, uniqueUsername } = require('../helpers/username');
const { parsePagination, searchTerm, paginateArray } = require('../helpers/pagination');
const { allowedOrigins, isAllowedOrigin, normalizeOrigin } = require('../helpers/origins');
const google = require('../helpers/google');
const midtrans = require('../helpers/midtrans');
const { shippingFee } = require('../helpers/shipping');

describe('timeout helper', () => {
  test('resolves before timeout and rejects after', async () => {
    await expect(raceWithTimeout(Promise.resolve('ok'), 50)).resolves.toBe('ok');
    await expect(raceWithTimeout(new Promise(() => {}), 10, 'slow')).rejects.toThrow('slow');
  });
});

describe('username helper', () => {
  test('sanitizes and increments until unique', async () => {
    expect(sanitizeUsername(null)).toBe('user');
    expect(sanitizeUsername('Ana Kurnia!')).toBe('anakurnia');
    expect(sanitizeUsername('!!!')).toBe('user');
    const taken = new Set(['user', 'user1']);
    await expect(uniqueUsername((name) => taken.has(name), '!!!')).resolves.toBe('user2');
  });
});

describe('pagination helper', () => {
  test('parses defaults, search, pages, and rejects invalid values', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 12 });
    expect(parsePagination({ page: '', limit: '' })).toEqual({ page: 1, limit: 12 });
    expect(searchTerm('  buku  ')).toBe('buku');
    expect(searchTerm(12)).toBe('');
    expect(paginateArray([1, 2, 3], 1, 2)).toEqual({
      data: [1, 2], page: 1, limit: 2, total: 3, totalPages: 2,
    });
    expect(paginateArray([], 1, 12).totalPages).toBe(0);
    expect(() => parsePagination({ page: 0 })).toThrow('Validation error');
    expect(() => parsePagination({ limit: 51 })).toThrow('Validation error');
  });
});

describe('origins helper', () => {
  test('normalizes, twins localhost, and allows empty origin', () => {
    expect(normalizeOrigin(' http://x.test/ ')).toBe('http://x.test');
    expect(normalizeOrigin('')).toBeNull();
    const previous = process.env.CLIENT_ORIGIN;
    process.env.CLIENT_ORIGIN = 'http://127.0.0.1:3000';
    expect(allowedOrigins()).toEqual(expect.arrayContaining(['http://localhost:3000']));
    process.env.CLIENT_ORIGIN = 'not-a-url';
    expect(allowedOrigins()).toEqual(expect.arrayContaining(['not-a-url']));
    process.env.CLIENT_ORIGIN = previous;
    expect(isAllowedOrigin(undefined)).toBe(true);
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
    expect(isAllowedOrigin('http://evil.test')).toBe(false);
    expect(allowedOrigins()).toEqual(expect.arrayContaining([
      'http://127.0.0.1:5173',
      'http://127.0.0.1:4174',
    ]));
  });
});

describe('google helper', () => {
  const verifyIdToken = OAuth2Client.verifyIdToken;

  beforeEach(() => verifyIdToken.mockReset());

  test('rejects missing token and empty payload email', async () => {
    await expect(google.verifyGoogleToken('')).rejects.toMatchObject({ status: 401, message: 'Invalid google token' });
    verifyIdToken.mockResolvedValue({ getPayload: () => ({}) });
    await expect(google.verifyGoogleToken('tok')).rejects.toMatchObject({ status: 401 });
  });

  test('returns payload and maps library errors to 401', async () => {
    verifyIdToken.mockResolvedValue({ getPayload: () => ({ email: 'a@mail.com', name: 'A' }) });
    await expect(google.verifyGoogleToken('good')).resolves.toEqual({ email: 'a@mail.com', name: 'A' });
    verifyIdToken.mockRejectedValue(new Error('network'));
    await expect(google.verifyGoogleToken('bad')).rejects.toMatchObject({ status: 401 });
  });
});

describe('midtrans helper', () => {
  const previous = { ...process.env };

  afterEach(() => {
    process.env.MIDTRANS_SERVER_KEY = previous.MIDTRANS_SERVER_KEY;
    process.env.MIDTRANS_CLIENT_KEY = previous.MIDTRANS_CLIENT_KEY;
    process.env.MIDTRANS_IS_PRODUCTION = previous.MIDTRANS_IS_PRODUCTION;
  });

  test('unconfigured helpers throw 502 and skip signature', async () => {
    delete process.env.MIDTRANS_SERVER_KEY;
    delete process.env.MIDTRANS_CLIENT_KEY;
    expect(midtrans.isConfigured()).toBe(false);
    expect(midtrans.clientKey()).toBeNull();
    expect(midtrans.isProduction()).toBe(false);
    expect(() => midtrans.createSnapClient()).toThrow('Payment service unavailable');
    await expect(midtrans.getTransactionStatus('oid')).rejects.toMatchObject({
      message: 'Payment service unavailable',
    });
    expect(midtrans.verifyNotificationSignature({
      order_id: '1', status_code: '200', gross_amount: '10', signature_key: 'x',
    })).toBe(false);
  });

  test('creates clients, signs notifications, and maps paid statuses', async () => {
    process.env.MIDTRANS_SERVER_KEY = 'server';
    process.env.MIDTRANS_CLIENT_KEY = 'client';
    process.env.MIDTRANS_IS_PRODUCTION = 'true';
    expect(midtrans.isConfigured()).toBe(true);
    expect(midtrans.clientKey()).toBe('client');
    expect(midtrans.isProduction()).toBe(true);
    await expect(midtrans.createSnapTransaction({
      orderId: 'oid', grossAmount: 1000, email: 'a@test.local', firstName: 'A',
    })).resolves.toEqual({ token: 'snap-token', redirect_url: 'https://snap.test' });
    await expect(midtrans.getTransactionStatus('oid')).resolves.toEqual({ transaction_status: 'settlement' });
    expect(midtransClient.Snap).toHaveBeenCalled();
    const signature = crypto.createHash('sha512').update('oid20010server').digest('hex');
    expect(midtrans.verifyNotificationSignature({
      order_id: 'oid', status_code: '200', gross_amount: '10', signature_key: signature,
    })).toBe(true);
    expect(midtrans.isPaidStatus('settlement')).toBe(true);
    expect(midtrans.isPaidStatus('deny')).toBe(false);
  });
});

describe('shipping fee', () => {
  test('pickup is free and courier uses base plus km', () => {
    expect(shippingFee('pickup', 12)).toBe(0);
    expect(shippingFee('unknown', 12)).toBe(0);
    expect(shippingFee('courier_agent', 2)).toBe(10000 + 3000);
    expect(shippingFee('courier_agent', Number.NaN)).toBe(10000);
  });
});

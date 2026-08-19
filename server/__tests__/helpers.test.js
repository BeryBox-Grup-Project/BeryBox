const { hashPassword, comparePassword } = require('../helpers/bcrypt');
const { signToken, verifyToken } = require('../helpers/jwt');
const { haversineKm, NEARBY_KM } = require('../helpers/haversine');
const { suggestShipping } = require('../helpers/shipping');
const { isItemEligible } = require('../helpers/eligibility');
const { settleCredit } = require('../helpers/credit');
const { normalizeConversationPair } = require('../helpers/conversationPair');
const { stripCoordinates } = require('../helpers/geoPrivacy');
const { isImageKitUrl, getImageKit } = require('../helpers/imagekit');

describe('pure helpers', () => {
  test('bcrypt hashes and compares passwords', async () => {
    const hash = await hashPassword('Password123!');
    expect(hash).not.toBe('Password123!');
    await expect(comparePassword('Password123!', hash)).resolves.toBe(true);
    await expect(comparePassword('wrong', hash)).resolves.toBe(false);
  });

  test('JWT signs and verifies the contracted payload', () => {
    const token = signToken({ id: 1, email: 'a@test.local', role: 'user' });
    expect(verifyToken(token)).toEqual(expect.objectContaining({ id: 1, email: 'a@test.local', role: 'user' }));
    expect(() => verifyToken('bad-token')).toThrow();
  });

  test('haversine returns numeric kilometers and shipping observes boundary', () => {
    const distance = haversineKm(-6.9, 107.6, -6.91, 107.61);
    expect(typeof distance).toBe('number');
    expect(Number(distance.toFixed(1))).toBeGreaterThan(0);
    expect(NEARBY_KM).toBe(10);
    expect(suggestShipping(9.9)).toEqual(['pickup', 'gosend']);
    expect(suggestShipping(10)).toEqual(['jne', 'jnt']);
    expect(Number.isFinite(haversineKm(0, 0, 0, 180))).toBe(true);
  });

  test.each([
    ['bad', 'books', 'Deskripsi barang ini cukup panjang'],
    ['good', 'bad', 'Deskripsi barang ini cukup panjang'],
    ['good', 'books', 'pendek'],
    ...['obat', 'medicine', 'senjata', 'weapon', 'expired', 'kadaluarsa', 'narkoba', 'underwear', 'pakaian dalam']
      .map((word) => ['good', 'other', `Deskripsi mengandung ${word} yang dilarang`]),
  ])('eligibility rejects invalid or banned content', (condition, category, description) => {
    expect(isItemEligible({ condition, category, description })).toEqual({
      eligible: false,
      message: 'Item does not meet donation standards',
    });
  });

  test('eligibility accepts valid content and handles non-string description', () => {
    expect(isItemEligible({ condition: 'good', category: 'books', description: 'Buku ini masih sangat layak untuk dibaca.' }).eligible).toBe(true);
    expect(isItemEligible({ condition: 'good', category: 'books', description: null }).eligible).toBe(false);
  });

  test('credit settlement handles both directions and equality', () => {
    expect(settleCredit(30, 50)).toEqual({ payer: 'A', receiver: 'B', amount: 20 });
    expect(settleCredit(80, 50)).toEqual({ payer: 'B', receiver: 'A', amount: 30 });
    expect(settleCredit(40, 40)).toEqual({ payer: null, receiver: null, amount: 0 });
  });

  test('conversation pair normalizes and rejects same user', () => {
    expect(normalizeConversationPair(2, 9)).toEqual({ userAId: 2, userBId: 9 });
    expect(normalizeConversationPair(9, 2)).toEqual({ userAId: 2, userBId: 9 });
    expect(() => normalizeConversationPair(2, 2)).toThrow('Cannot chat with yourself');
  });

  test('coordinate stripping preserves other fields for objects and instances', () => {
    expect(stripCoordinates({ id: 1, latitude: 1, longitude: 2, name: 'x' })).toEqual({ id: 1, name: 'x' });
    expect(stripCoordinates({ toJSON: () => ({ id: 2, latitude: 1, longitude: 2, title: 'y' }) })).toEqual({ id: 2, title: 'y' });
  });

  test('ImageKit URL validation and authentication instance', () => {
    expect(isImageKitUrl('https://ik.imagekit.io/test/a.jpg')).toBe(true);
    expect(isImageKitUrl('https://example.com/a.jpg')).toBe(false);
    expect(isImageKitUrl(null)).toBe(false);
    expect(isImageKitUrl(undefined)).toBe(false);
    const auth = getImageKit().getAuthenticationParameters('token', 1710000000);
    expect(auth).toEqual(expect.objectContaining({ token: 'token', expire: 1710000000 }));
  });
});

describe('Nominatim helper', () => {
  afterEach(() => jest.resetModules());

  test.each([
    [{ suburb: 'Coblong', city: 'Bandung' }, 'Coblong, Bandung'],
    [{ village: 'Desa', town: 'Kota' }, 'Desa, Kota'],
    [{ city_district: 'District', county: 'County' }, 'District, County'],
    [{}, 'Unknown location'],
  ])('parses address variants', async (address, expected) => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ address }) });
    const nominatim = require('../helpers/nominatim');
    await expect(nominatim.reverse(-6.9, 107.6)).resolves.toBe(expected);
    expect(global.fetch).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ headers: expect.objectContaining({ 'User-Agent': expect.any(String) }) }));
  });

  test('falls back for failed response and thrown network error', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: false });
    let nominatim = require('../helpers/nominatim');
    await expect(nominatim.reverse(1, 2)).resolves.toBe('Unknown location');
    jest.resetModules();
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    nominatim = require('../helpers/nominatim');
    await expect(nominatim.reverse(1, 2)).resolves.toBe('Unknown location');
  });
});

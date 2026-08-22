const places = require('../helpers/places');

function defaultFetch(url) {
  if (String(url).includes('overpass-api.de')) {
    return Promise.resolve({ ok: true, json: async () => ({ elements: [] }) });
  }
  return Promise.resolve({ ok: false, json: async () => ({}) });
}

describe('OpenStreetMap places helper', () => {
  afterEach(() => {
    global.fetch.mockReset();
    global.fetch.mockImplementation(defaultFetch);
  });

  test('maps OSM tags, photos, and skips incomplete elements', () => {
    expect(places.inferType({ amenity: 'orphanage' })).toBe('orphanage');
    expect(places.inferType({ office: 'ngo' })).toBe('volunteer');
    expect(places.inferType({ name: 'Komunitas' })).toBe('community');
    expect(places.ensureDescription('pendek')).toContain('OpenStreetMap');
    expect(places.parseOsmId('osm:node:12')).toEqual({ type: 'node', id: '12' });
    expect(places.parseOsmId('bad')).toBeNull();
    expect(places.mapOsmElement({ id: 1, type: 'node' })).toBeNull();
    const mapped = places.mapOsmElement({
      id: 9,
      type: 'node',
      lat: -6.9,
      lon: 107.6,
      tags: {
        name: 'Panti Asuhan Melati',
        amenity: 'orphanage',
        description: 'Panti untuk anak sekolah dasar di Bandung.',
        website: 'https://panti.test',
        email: 'panti@test.local',
        image: 'https://example.com/panti.jpg',
      },
    });
    expect(mapped).toEqual(expect.objectContaining({
      googlePlaceId: 'osm:node:9',
      type: 'orphanage',
      source: 'openstreetmap',
      photoUrl: 'https://example.com/panti.jpg',
    }));
    expect(places.photoUrl()).toBeNull();
    expect(places.parsePhotoReference()).toBeNull();
    expect(places.isConfigured()).toBe(true);
    expect(places.mapOsmElement({
      id: 4, type: 'way', center: { lat: -6.8, lon: 107.5 },
      tags: { name: 'Komunitas RW', 'addr:city': 'Bandung', wikimedia_commons: 'File:Panti.jpg' },
    }).addressLabel).toBe('Bandung');
    expect(places.inferType({ social_facility: 'orphanage' })).toBe('orphanage');
    expect(places.inferType({ name: 'relawan kota' })).toBe('volunteer');
    expect(places.mapOsmElement({
      id: 5, type: 'node', lat: -6.7, lon: 107.4,
      tags: { name: 'Foto File', image: 'Panti.jpg', 'addr:street': 'Jl Melati' },
    }).photoUrl).toContain('commons.wikimedia.org');
  });

  test('fetchNearby and fetchDetails handle empty, failed, and successful overpass', async () => {
    await expect(places.fetchNearby({ latitude: NaN, longitude: 1 })).resolves.toEqual([]);
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    await expect(places.fetchNearby({ latitude: -6.9, longitude: 107.6 })).resolves.toEqual([]);
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(places.fetchDetails('osm:node:1')).resolves.toBeNull();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        elements: [{
          id: 3, type: 'node', lat: -6.91, lon: 107.6,
          tags: { name: 'Relawan Kota', office: 'ngo' },
        }],
      }),
    });
    const nearby = await places.fetchNearby({ latitude: -6.9, longitude: 107.6 });
    expect(nearby[0].name).toBe('Relawan Kota');
    const details = await places.fetchDetails('osm:node:3');
    expect(details.googlePlaceId).toBe('osm:node:3');
    await expect(places.fetchDetails('not-osm')).resolves.toBeNull();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    await expect(places.fetchNearby({ latitude: -6.9, longitude: 107.6 })).resolves.toEqual([]);
  });

  test('covers remaining OSM mapping branches', async () => {
    process.env.NOMINATIM_USER_AGENT = 'BeryBox-Test/2.0';
    expect(places.ensureDescription('Deskripsi organisasi yang sudah cukup panjang.')).toBe(
      'Deskripsi organisasi yang sudah cukup panjang.',
    );
    expect(places.inferType({ name: 'Orphan care house' })).toBe('orphanage');
    expect(places.inferType({ name: 'Panti sosial' })).toBe('orphanage');
    expect(places.parseOsmId(null)).toBeNull();
    expect(places.mapOsmElement({ id: 1, tags: { name: 'X' } })).toBeNull();
    const other = places.mapOsmElement({
      id: 8, type: 'node', lat: -6.5, lon: 107.1,
      tags: {
        name: 'Komunitas Lain',
        description: 'Komunitas warga dengan deskripsi yang cukup panjang.',
        'addr:suburb': 'Cicendo',
        'addr:city': 'Bandung',
        wikimedia_commons: 'Category:Foo',
      },
    });
    expect(other.type).toBe('community');
    expect(other.addressLabel).toBe('Cicendo, Bandung');
    expect(other.photoUrl).toContain('unsplash');
    expect(places.mapOsmElement({
      id: 11, type: 'node', lat: -6.4, lon: 107.2,
      tags: { name: 'Tanpa Kota', 'addr:full': 'Jl Asia Afrika 1' },
    }).addressLabel).toBe('Jl Asia Afrika 1');
    expect(places.mapOsmElement({
      id: 12, type: 'node', lat: -6.3, lon: 107.3,
      tags: { name: 'Tanpa Alamat' },
    }).addressLabel).toBe('Unknown location');
    expect(places.mapOsmElement({
      id: 13, type: 'node', lat: -6.2, lon: 107.0,
      tags: { name: 'Foto Kategori', image: 'Category:Skip' },
    }).photoUrl).toContain('unsplash');
    process.env.NOMINATIM_USER_AGENT = 'BeryBox-Test/2.0';
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ elements: [] }) });
    await places.fetchNearby({ latitude: -6.9, longitude: 107.6 });
    expect(global.fetch.mock.calls.at(-1)[1].headers['User-Agent']).toBe('BeryBox-Test/2.0');
    delete process.env.NOMINATIM_USER_AGENT;
  });
});

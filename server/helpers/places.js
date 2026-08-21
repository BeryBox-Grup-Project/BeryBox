const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const DEFAULT_USER_AGENT = 'BeryBox/1.0 (contact@berybox.local)';
const REQUEST_TIMEOUT_MS = 15000;
const DEFAULT_RADIUS_M = 15000;

const UNSPLASH_BY_TYPE = {
  orphanage: [
    'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&w=800&q=80',
  ],
  volunteer: [
    'https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=800&q=80',
  ],
  community: [
    'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
  ],
  other: [
    'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80',
  ],
};

function userAgent() {
  return process.env.NOMINATIM_USER_AGENT || DEFAULT_USER_AGENT;
}

function isConfigured() {
  return true;
}

function ensureDescription(text) {
  const base = (text && String(text).trim()) || 'Organisasi terdekat dari OpenStreetMap.';
  if (base.length >= 20) return base;
  return `${base} Data dilengkapi dari OpenStreetMap.`;
}

function inferType(tags = {}) {
  const haystack = [
    tags.name,
    tags.amenity,
    tags.social_facility,
    tags.office,
    tags.description,
  ].filter(Boolean).join(' ').toLowerCase();

  if (
    tags.amenity === 'orphanage'
    || tags.social_facility === 'orphanage'
    || haystack.includes('orphan')
    || haystack.includes('panti')
  ) {
    return 'orphanage';
  }
  if (
    tags.office === 'ngo'
    || haystack.includes('volunteer')
    || haystack.includes('relawan')
  ) {
    return 'volunteer';
  }
  return 'community';
}

function hashString(value) {
  const text = String(value || '');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function wikimediaFileUrl(file) {
  if (!file || typeof file !== 'string') return null;
  let name = file.trim();
  if (!name || name.toLowerCase().startsWith('category:')) return null;
  if (/^file:/i.test(name)) name = name.slice(5);
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}`;
}

function taggedImageUrl(tags = {}) {
  const image = typeof tags.image === 'string' ? tags.image.trim() : '';
  if (!image) {
    return wikimediaFileUrl(tags.wikimedia_commons);
  }
  if (/^https?:\/\//i.test(image)) return image;
  return wikimediaFileUrl(image);
}

function unsplashGallery(type, osmId) {
  const pool = UNSPLASH_BY_TYPE[type] || UNSPLASH_BY_TYPE.community;
  const start = hashString(osmId) % pool.length;
  return [0, 1, 2].map((offset) => pool[(start + offset) % pool.length]);
}

function photosFor(type, osmId, tags = {}) {
  const tagged = taggedImageUrl(tags);
  const fallback = unsplashGallery(type, osmId);
  const galleryUrls = tagged
    ? [tagged, ...fallback.filter((url) => url !== tagged)].slice(0, 3)
    : fallback;
  return {
    photoUrl: galleryUrls[0],
    galleryUrls,
  };
}

function addressLabel(tags = {}) {
  const area = tags['addr:suburb'] || tags['addr:village'] || tags['addr:hamlet'] || tags['addr:neighbourhood'];
  const city = tags['addr:city'] || tags['addr:town'] || tags['addr:district'] || tags['addr:county'];
  const joined = [area, city].filter(Boolean).join(', ');
  if (joined) return joined;
  if (tags['addr:full']) return tags['addr:full'];
  if (tags['addr:street']) return tags['addr:street'];
  return 'Unknown location';
}

function elementCoordinates(element) {
  if (Number.isFinite(element?.lat) && Number.isFinite(element?.lon)) {
    return { latitude: element.lat, longitude: element.lon };
  }
  if (Number.isFinite(element?.center?.lat) && Number.isFinite(element?.center?.lon)) {
    return { latitude: element.center.lat, longitude: element.center.lon };
  }
  return { latitude: null, longitude: null };
}

function osmId(element) {
  if (!element?.type || element.id == null) return null;
  return `osm:${element.type}:${element.id}`;
}

function parseOsmId(googlePlaceId) {
  if (typeof googlePlaceId !== 'string') return null;
  const match = /^osm:(node|way|relation):(\d+)$/.exec(googlePlaceId.trim());
  if (!match) return null;
  return { type: match[1], id: match[2] };
}

function mapOsmElement(element) {
  const tags = element?.tags || {};
  const googlePlaceId = osmId(element);
  const name = typeof tags.name === 'string' ? tags.name.trim() : '';
  const { latitude, longitude } = elementCoordinates(element);
  if (!googlePlaceId || !name || latitude == null || longitude == null) return null;

  const type = inferType(tags);
  const photos = photosFor(type, googlePlaceId, tags);
  return {
    googlePlaceId,
    name,
    type,
    description: ensureDescription(tags.description || tags.note || `Lokasi di ${addressLabel(tags)}.`),
    latitude,
    longitude,
    addressLabel: addressLabel(tags),
    photoUrl: photos.photoUrl,
    galleryUrls: photos.galleryUrls,
    website: tags.website || tags['contact:website'] || null,
    phone: tags.phone || tags['contact:phone'] || null,
    email: tags.email || tags['contact:email'] || null,
    source: 'openstreetmap',
    verified: 'unverified',
  };
}

function nearbyQuery(latitude, longitude, radius) {
  const around = `(around:${radius},${latitude},${longitude})`;
  return `[out:json][timeout:20];
(
  nwr["amenity"="orphanage"]${around};
  nwr["amenity"="social_facility"]${around};
  nwr["office"="ngo"]${around};
);
out center tags;`;
}

function detailsQuery(type, id) {
  return `[out:json][timeout:15];
${type}(${id});
out center tags;`;
}

async function overpass(query) {
  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': userAgent(),
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchNearby({ latitude, longitude, radius = DEFAULT_RADIUS_M } = {}) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
  const data = await overpass(nearbyQuery(latitude, longitude, radius));
  if (!data?.elements) return [];
  return data.elements.map(mapOsmElement).filter(Boolean);
}

async function fetchDetails(googlePlaceId) {
  const parsed = parseOsmId(googlePlaceId);
  if (!parsed) return null;
  const data = await overpass(detailsQuery(parsed.type, parsed.id));
  const element = data?.elements?.[0];
  if (!element) return null;
  return mapOsmElement({ ...element, type: element.type || parsed.type, id: element.id || Number(parsed.id) });
}

function photoUrl() {
  return null;
}

function parsePhotoReference() {
  return null;
}

module.exports = {
  isConfigured,
  fetchNearby,
  fetchDetails,
  photoUrl,
  parsePhotoReference,
  mapOsmElement,
  ensureDescription,
  inferType,
  photosFor,
  parseOsmId,
  OVERPASS_URL,
};

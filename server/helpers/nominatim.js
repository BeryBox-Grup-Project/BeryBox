const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const DEFAULT_USER_AGENT = 'BeryBox/1.0 (contact@berybox.local)';
const REQUEST_TIMEOUT_MS = 5000;

function parseAddressLabel(address = {}) {
  const area = address.suburb || address.village || address.city_district;
  const city = address.city || address.town || address.county;

  return [area, city].filter(Boolean).join(', ') || 'Unknown location';
}

async function reverse(lat, lng) {
  try {
    const url = new URL(NOMINATIM_REVERSE_URL);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', lat);
    url.searchParams.set('lon', lng);

    const response = await fetch(url, {
      headers: {
        'User-Agent': process.env.NOMINATIM_USER_AGENT || DEFAULT_USER_AGENT,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) return 'Unknown location';

    const data = await response.json();
    return parseAddressLabel(data.address);
  } catch {
    return 'Unknown location';
  }
}

module.exports = { reverse };

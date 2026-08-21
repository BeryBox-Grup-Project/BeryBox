function normalizeOrigin(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  return value.trim().replace(/\/+$/, '');
}

function withLocalhostTwin(origin) {
  const origins = [origin];
  try {
    const url = new URL(origin);
    if (url.hostname === 'localhost') {
      url.hostname = '127.0.0.1';
      origins.push(url.origin);
    } else if (url.hostname === '127.0.0.1') {
      url.hostname = 'localhost';
      origins.push(url.origin);
    }
  } catch {
    // Ignore malformed env origins; CORS will simply omit them.
  }
  return origins;
}

const LOCAL_APP_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4174',
  'http://127.0.0.1:4174',
  'http://localhost:5174',
];

function allowedOrigins() {
  return [...new Set(
    [process.env.CLIENT_ORIGIN, process.env.CMS_ORIGIN, ...LOCAL_APP_ORIGINS]
      .map(normalizeOrigin)
      .filter(Boolean)
      .flatMap(withLocalhostTwin),
  )];
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  return allowedOrigins().includes(origin);
}

module.exports = { allowedOrigins, isAllowedOrigin, normalizeOrigin };

const DEFAULT_API_URL = 'https://bb.berybox.web.id';
const DEFAULT_CLIENT_URL = 'https://www.berybox.web.id';

function trimUrl(value) {
  return typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';
}

export const API_URL = trimUrl(import.meta.env.VITE_API_URL)
  || (import.meta.env.DEV ? '' : DEFAULT_API_URL);

export const CLIENT_URL = trimUrl(import.meta.env.VITE_CLIENT_URL)
  || (import.meta.env.DEV ? 'http://localhost:5173' : DEFAULT_CLIENT_URL);

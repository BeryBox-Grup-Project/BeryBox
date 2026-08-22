const DEFAULT_API_URL = 'https://bb.berybox.web.id';
const DEFAULT_CMS_URL = 'https://www.berybox.my.id';
const DEFAULT_CLIENT_URL = 'https://www.berybox.web.id';

function trimUrl(value) {
  return typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';
}

export const API_URL = trimUrl(import.meta.env.VITE_API_URL)
  || (import.meta.env.DEV ? 'http://localhost:3000' : DEFAULT_API_URL);

export const CMS_URL = trimUrl(import.meta.env.VITE_CMS_URL)
  || (import.meta.env.DEV ? 'http://127.0.0.1:4174' : DEFAULT_CMS_URL);

export const CLIENT_URL = trimUrl(import.meta.env.VITE_CLIENT_URL)
  || (import.meta.env.DEV ? 'http://localhost:5173' : DEFAULT_CLIENT_URL);

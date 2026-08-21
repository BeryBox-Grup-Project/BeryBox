import axios from 'axios';

const apiUrl = typeof import.meta.env.VITE_API_URL === 'string'
  ? import.meta.env.VITE_API_URL.trim().replace(/\/+$/, '')
  : '';

export const http = axios.create({
  baseURL: apiUrl,
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || 'Terjadi kesalahan';
    const status = error.response?.status;
    const banned = message === 'Account banned';
    if ((status === 401 || banned) && !String(error.config?.url || '').includes('/login')) {
      localStorage.removeItem('access_token');
      if (window.location.pathname !== '/login') window.location.assign('/login');
    }
    error.userMessage = status
      ? message
      : 'Tidak bisa terhubung ke API. Restart server di port 3000, lalu restart CMS (port 4174).';
    return Promise.reject(error);
  },
);

export function apiMessage(error, fallback = 'Terjadi kesalahan') {
  return error?.userMessage || error?.response?.data?.message || fallback;
}

export const authApi = {
  login: (body) => http.post('/login', body).then((r) => r.data),
  me: () => http.get('/me').then((r) => r.data),
};

export const adminApi = {
  stats: () => http.get('/admin/stats').then((r) => r.data),
  organizations: (params) => http.get('/admin/organizations', { params }).then((r) => r.data),
  createOrganization: (body) => http.post('/admin/organizations', body).then((r) => r.data),
  verifyOrg: (id, verified) => http.patch(`/admin/organizations/${id}`, { verified }).then((r) => r.data),
  reports: (params) => http.get('/admin/reports', { params }).then((r) => r.data),
  resolveReport: (id) => http.patch(`/admin/reports/${id}`, { status: 'resolved' }).then((r) => r.data),
  warn: (id) => http.post(`/admin/users/${id}/warn`).then((r) => r.data),
  ban: (id) => http.post(`/admin/users/${id}/ban`).then((r) => r.data),
  removeItem: (id) => http.delete(`/admin/items/${id}`).then((r) => r.data),
  research: (organizationId, message) => http.post('/admin/ai/organization', {
    organizationId,
    ...(message ? { message } : {}),
  }).then((r) => r.data),
};

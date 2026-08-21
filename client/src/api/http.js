import axios from 'axios';

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function isAuthAttempt(config) {
  const url = `${config?.baseURL || ''}${config?.url || ''}`;
  return /\/(login|register|google-login)(?:\?|$)/.test(url);
}

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || 'Terjadi kesalahan';
    const status = error.response?.status;
    const banned = message === 'Account banned';
    if ((status === 401 || banned) && !isAuthAttempt(error.config)) {
      localStorage.removeItem('access_token');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
        window.location.assign('/login');
      }
    }
    error.userMessage = status ? message : 'Tidak bisa terhubung ke server. Pastikan API berjalan di port 3000.';
    return Promise.reject(error);
  },
);

export function apiMessage(error, fallback = 'Terjadi kesalahan') {
  return error?.userMessage || error?.response?.data?.message || fallback;
}

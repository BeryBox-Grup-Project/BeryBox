import { http } from './http';

export const authApi = {
  register: (body) => http.post('/register', body).then((r) => r.data),
  login: (body) => http.post('/login', body).then((r) => r.data),
  googleLogin: (body) => http.post('/google-login', body).then((r) => r.data),
  me: () => http.get('/me').then((r) => r.data),
  updateMe: (body) => http.patch('/me', body).then((r) => r.data),
  user: (id) => http.get(`/users/${id}`).then((r) => r.data),
  userReviews: (id) => http.get(`/users/${id}/reviews`).then((r) => r.data),
  imageAuth: () => http.get('/images/auth').then((r) => r.data),
  imageUpload: (body) => http.post('/images/upload', body).then((r) => r.data),
};

export const itemsApi = {
  list: (params) => http.get('/items', { params }).then((r) => r.data),
  mine: () => http.get('/items/mine').then((r) => r.data),
  detail: (id, params) => http.get(`/items/${id}`, { params }).then((r) => r.data),
  create: (body) => http.post('/items', body).then((r) => r.data),
  update: (id, body) => http.patch(`/items/${id}`, body).then((r) => r.data),
  complete: (id) => http.post(`/items/${id}/complete`).then((r) => r.data),
  cancel: (id) => http.delete(`/items/${id}`).then((r) => r.data),
};

export const requestsApi = {
  create: (body) => http.post('/requests', body).then((r) => r.data),
  incoming: () => http.get('/requests/incoming').then((r) => r.data),
  outgoing: () => http.get('/requests/outgoing').then((r) => r.data),
  update: (id, body) => http.patch(`/requests/${id}`, body).then((r) => r.data),
  shipping: (id, body) => http.post(`/requests/${id}/shipping`, body).then((r) => r.data),
  pay: (id) => http.post(`/requests/${id}/pay`).then((r) => r.data),
  confirmPay: (id) => http.post(`/requests/${id}/pay/confirm`).then((r) => r.data),
  tracking: (id, body) => http.patch(`/requests/${id}/tracking`, body).then((r) => r.data),
  redeem: (id) => http.post(`/requests/${id}/redeem-credit`).then((r) => r.data),
  history: () => http.get('/history').then((r) => r.data),
};

export const orgsApi = {
  list: (params) => http.get('/organizations', { params }).then((r) => r.data),
  detail: (id, params) => http.get(`/organizations/${id}`, { params }).then((r) => r.data),
  create: (body) => http.post('/organizations', body).then((r) => r.data),
  claim: (body) => http.post('/organizations/claim', body).then((r) => r.data),
  photo: (ref) => http.get('/places/photo', { params: { ref }, responseType: 'blob' }).then((r) => r.data),
};

export const inboxApi = {
  list: () => http.get('/conversations').then((r) => r.data),
  create: (body) => http.post('/conversations', body).then((r) => r.data),
  messages: (id) => http.get(`/conversations/${id}/messages`).then((r) => r.data),
  send: (id, body) => http.post(`/conversations/${id}/messages`, { body }).then((r) => r.data),
};

export const notificationsApi = {
  list: () => http.get('/notifications').then((r) => r.data),
  read: (id) => http.patch(`/notifications/${id}/read`).then((r) => r.data),
  readAll: (scope) => http.patch('/notifications/read-all', { scope }).then((r) => r.data),
};

export const aiApi = {
  chat: (message, coords) => http.post('/ai/chat', {
    message,
    ...(Number.isFinite(coords?.latitude) && Number.isFinite(coords?.longitude)
      ? { lat: coords.latitude, lng: coords.longitude }
      : {}),
  }).then((r) => r.data),
  match: (body) => http.post('/ai/match', body).then((r) => r.data),
};

export const reviewsApi = {
  create: (body) => http.post('/reviews', body).then((r) => r.data),
  report: (body) => http.post('/reports', body).then((r) => r.data),
};

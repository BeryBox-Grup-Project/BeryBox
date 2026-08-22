import { createSlice } from '@reduxjs/toolkit';
import { notificationsApi } from '../api';

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: { items: [], loading: false },
  reducers: {
    setLoading(state, action) {
      state.loading = action.payload;
    },
    setItems(state, action) {
      state.loading = false;
      state.items = Array.isArray(action.payload) ? action.payload : [];
    },
    upsertNotification(state, action) {
      const next = action.payload;
      const index = state.items.findIndex((row) => row.id === next.id);
      if (index >= 0) state.items[index] = next;
      else state.items.unshift(next);
    },
    pushNotification(state, action) {
      const payload = action.payload;
      if (!payload) return;
      const exists = payload.id != null && state.items.some((row) => row.id === payload.id);
      if (!exists) state.items.unshift(payload);
    },
    clearNotifications(state) {
      state.items = [];
    },
  },
});

export const {
  setLoading,
  setItems,
  upsertNotification,
  pushNotification,
  clearNotifications,
} = notificationsSlice.actions;

export const fetchNotifications = () => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    const items = await notificationsApi.list();
    dispatch(setItems(items));
  } catch {
    dispatch(setLoading(false));
  }
};

export const markNotificationRead = (id) => async (dispatch) => {
  const row = await notificationsApi.read(id);
  dispatch(upsertNotification(row));
};

export const markNotificationsRead = (scope) => async (dispatch) => {
  const items = await notificationsApi.readAll(scope);
  dispatch(setItems(items));
};

export function isUnread(row) {
  return !row?.readAt;
}

export function isInboxNotification(row) {
  return row?.type === 'message' || Boolean(row?.conversationId);
}

export function isModeratorNotice(row) {
  if (row?.type === 'warning' || row?.type === 'banned') return true;
  const message = String(row?.message || '');
  return /warning from BeryBox moderators/i.test(message)
    || /account was banned/i.test(message);
}

export default notificationsSlice.reducer;

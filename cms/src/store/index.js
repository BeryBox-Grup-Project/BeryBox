import { createSlice } from '@reduxjs/toolkit';
import { authApi } from '../api';
import { configureStore } from '@reduxjs/toolkit';

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    token: localStorage.getItem('access_token'),
    status: 'idle',
  },
  reducers: {
    setStatus(state, action) {
      state.status = action.payload;
    },
    setSession(state, action) {
      state.token = action.payload.access_token;
      state.user = action.payload.user || state.user;
      state.status = 'ready';
      localStorage.setItem('access_token', action.payload.access_token);
    },
    setUser(state, action) {
      state.user = action.payload;
      if (action.payload) state.status = 'ready';
    },
    logout(state) {
      state.user = null;
      state.token = null;
      state.status = 'ready';
      localStorage.removeItem('access_token');
    },
  },
});

export const { setStatus, setSession, setUser, logout } = authSlice.actions;

export function applyAdminSession(data) {
  return (dispatch) => {
    if (data?.user?.role !== 'admin') {
      const error = new Error('Admin access required');
      error.code = 'NOT_ADMIN';
      throw error;
    }
    dispatch(setSession(data));
  };
}

export const bootstrap = () => async (dispatch, getState) => {
  if (!getState().auth.token) {
    dispatch(setStatus('ready'));
    return;
  }
  if (!getState().auth.user) dispatch(setStatus('loading'));
  try {
    const user = await authApi.me();
    if (user?.role !== 'admin') {
      dispatch(logout());
      return;
    }
    dispatch(setUser(user));
  } catch (error) {
    const status = error.response?.status;
    const message = error.response?.data?.message;
    if (status === 401 || message === 'Account banned') {
      dispatch(logout());
      return;
    }
    dispatch(setStatus(getState().auth.user ? 'ready' : 'error'));
  }
};

export const store = configureStore({
  reducer: { auth: authSlice.reducer },
});

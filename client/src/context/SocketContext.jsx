import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useDispatch, useSelector } from 'react-redux';
import { isModeratorNotice, pushNotification } from '../store/notificationsSlice';
import { useUi } from './UiContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const token = useSelector((state) => state.auth.token);
  const dispatch = useDispatch();
  const { toast } = useUi();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return undefined;
    }

    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('new_notification', (payload) => {
      dispatch(pushNotification(payload));
      if (isModeratorNotice(payload) && payload?.message) toast(payload.message, 'warning');
    });

    return () => {
      socket.off('new_notification');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, dispatch, toast]);

  const value = useMemo(() => ({
    connected,
    socket: socketRef,
    joinConversation(conversationId) {
      socketRef.current?.emit('join_conversation', { conversationId });
    },
    emitTyping(conversationId) {
      socketRef.current?.emit('typing', { conversationId });
    },
    emitStopTyping(conversationId) {
      socketRef.current?.emit('stop_typing', { conversationId });
    },
    onMessage(handler) {
      socketRef.current?.on('new_message', handler);
      return () => socketRef.current?.off('new_message', handler);
    },
    onTyping(handler) {
      socketRef.current?.on('user_typing', handler);
      return () => socketRef.current?.off('user_typing', handler);
    },
    onStopTyping(handler) {
      socketRef.current?.on('user_stop_typing', handler);
      return () => socketRef.current?.off('user_stop_typing', handler);
    },
  }), [connected]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import url from '@/constants/backurl';

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  emit: (event: string, data?: any) => void;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  emit: () => {},
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [authVersion, setAuthVersion] = useState<number>(0);

  // Listen for login/logout events on web to connect or disconnect socket dynamically
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleAuthChange = () => setAuthVersion((v) => v + 1);
      window.addEventListener('leteski:auth-change', handleAuthChange);
      return () => {
        window.removeEventListener('leteski:auth-change', handleAuthChange);
      };
    }
  }, []);

  useEffect(() => {
    // 🚀 Performance Optimization (TBT < 200ms):
    // On web, avoid creating an unnecessary WebSocket & polling connection for anonymous
    // visitors on the landing page. Sockets are only needed once a user is authenticated.
    if (Platform.OS === 'web') {
      const token =
        typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem('@skillswap/auth_token')
          : null;
      if (!token) {
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
          setIsConnected(false);
        }
        return;
      }
    }

    const socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket.IO Frontend] Connected:', socket.id);
      setIsConnected(true);

      AsyncStorage.getItem('@skillswap/auth_user').then((userStr) => {
        if (userStr) {
          try {
            const u = JSON.parse(userStr);
            const uid = u?.id || u?._id;
            if (uid) {
              socket.emit('join_room', String(uid));
              console.log('[Socket.IO Frontend] Joined room on connect:', uid);
            }
          } catch (e) {}
        }
      }).catch(() => {});
    });

    socket.on('disconnect', () => {
      console.log('[Socket.IO Frontend] Disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket.IO Frontend] Connection error:', err.message);
    });

    return () => {
      socket.disconnect();
    };
  }, [authVersion]);

  const emit = (event: string, data?: any) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data);
    }
  };

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected, emit }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}

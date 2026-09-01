import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

  useEffect(() => {
    const socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
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
  }, []);

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

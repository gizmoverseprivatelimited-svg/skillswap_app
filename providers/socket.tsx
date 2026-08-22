import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import url from '@/constants/backurl';
import { useCurrentUser } from '@/providers/current-user';

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
  const { currentUser } = useCurrentUser();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    const socket = io(url, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket.IO Frontend] Connected:', socket.id);
      setIsConnected(true);

      const uId = currentUser?.id || (currentUser as any)?._id;
      if (uId) {
        socket.emit('join_room', String(uId));
        if ((currentUser as any)?._id && String((currentUser as any)._id) !== String(uId)) {
          socket.emit('join_room', String((currentUser as any)._id));
        }
      }
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

  useEffect(() => {
    const socket = socketRef.current;
    const uId = currentUser?.id || (currentUser as any)?._id;
    if (socket && socket.connected && uId) {
      socket.emit('join_room', String(uId));
      if ((currentUser as any)?._id && String((currentUser as any)._id) !== String(uId)) {
        socket.emit('join_room', String((currentUser as any)._id));
      }
    }
  }, [currentUser?.id, (currentUser as any)?._id]);

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

import React from 'react';
import { HMSPrebuilt } from '@100mslive/react-native-room-kit';

export default function HMSView({ 
  roomCode, 
  userName, 
  onLeave,
  authToken,
  isTeacher
}: { 
  roomCode: string; 
  userName: string; 
  onLeave: () => void;
  authToken?: string;
  isTeacher?: boolean;
}) {
  return (
    <HMSPrebuilt
      roomCode={roomCode}
      options={{ userName, ...(authToken ? { authToken } : {}) }}
      onLeave={onLeave}
    />
  );
}

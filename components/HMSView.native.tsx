import React from 'react';
import { HMSPrebuilt } from '@100mslive/react-native-room-kit';

export default function HMSView({ roomCode, userName, onLeave }: { roomCode: string; userName: string; onLeave: () => void }) {
  return (
    <HMSPrebuilt
      roomCode={roomCode}
      options={{ userName }}
      onLeave={onLeave}
    />
  );
}

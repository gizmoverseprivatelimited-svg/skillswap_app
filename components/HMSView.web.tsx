import React from 'react';
import { View } from 'react-native';

export default function HMSView({ roomCode, userName, onLeave }: { roomCode: string; userName: string; onLeave: () => void }) {
  const webPrebuiltUrl = `https://gizmoverse-videoconf-1656.app.100ms.live/meeting/${roomCode}?name=${encodeURIComponent(userName)}`;
  
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <iframe
        src={webPrebuiltUrl}
        allow="camera; microphone; fullscreen; speaker; display-capture"
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </View>
  );
}

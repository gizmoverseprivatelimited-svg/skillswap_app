import React, { useEffect } from 'react';
import { View } from 'react-native';

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
  const tokenParam = authToken ? `&token=${encodeURIComponent(authToken)}` : '';
  const webPrebuiltUrl = `https://gizmoverse-videoconf-1656.app.100ms.live/meeting/${roomCode}?name=${encodeURIComponent(userName)}${tokenParam}`;
  
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 100ms iframe sends a postMessage when the user leaves the room
      if (typeof event.data === 'string' && event.data.toLowerCase().includes('leave')) {
        onLeave();
      } else if (event.data && typeof event.data === 'object') {
        const type = event.data.type || event.data.action || event.data.event || '';
        const typeLower = typeof type === 'string' ? type.toLowerCase() : '';
        if (typeLower.includes('leave') || typeLower.includes('room-left') || typeLower.includes('room_left')) {
          onLeave();
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onLeave]);

  return (
    <div style={{ flex: 1, width: '100%', height: '100%', backgroundColor: '#000' }}>
      <iframe
        src={webPrebuiltUrl}
        allow="camera; microphone; fullscreen; speaker; display-capture; autoplay; wake-lock; screen-wake-lock; compute-pressure"
        allowFullScreen
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      />
    </div>
  );
}

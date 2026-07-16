import React, { useEffect } from 'react';
import { View } from 'react-native';

export default function HMSView({ roomCode, userName, onLeave }: { roomCode: string; userName: string; onLeave: () => void }) {
  // Removed skip_preview=true so the browser can require a user click (fixing AutoplayBlocked)
  const webPrebuiltUrl = `https://gizmoverse-videoconf-1656.app.100ms.live/meeting/${roomCode}?name=${encodeURIComponent(userName)}`;
  
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
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: '#000', zIndex: 9999 }}>
      <iframe
        src={webPrebuiltUrl}
        allow="camera; microphone; fullscreen; speaker; display-capture; autoplay; wake-lock; compute-pressure"
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </div>
  );
}

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

export interface LiveVideoTrackProps {
  trackId?: string;
  mediaStream?: MediaStream | null;
  mirror?: boolean;
  scaleType?: 'fill' | 'fit';
  style?: ViewStyle;
}

export default function LiveVideoTrack({ mediaStream, mirror = false, scaleType = 'fill', style }: LiveVideoTrackProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch((err) => {
        console.warn('[LiveVideoTrack.web] Auto-play video error:', err);
      });
    }
  }, [mediaStream]);

  if (!mediaStream) {
    return <View style={[styles.container, style]} />;
  }

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: scaleType === 'fit' ? 'contain' : 'cover',
          transform: mirror ? 'scaleX(-1)' : 'none',
        }}
      />
    </div>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});

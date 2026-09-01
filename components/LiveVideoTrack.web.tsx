import React, { useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

export interface LiveVideoTrackProps {
  trackId?: string;
  mediaStream?: MediaStream | null;
  mirror?: boolean;
  scaleType?: 'fill' | 'fit';
  style?: ViewStyle;
}

function LiveVideoTrackComponent({ mediaStream, mirror = false, scaleType = 'fill', style }: LiveVideoTrackProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const attachStream = useCallback((videoEl: HTMLVideoElement | null) => {
    if (!videoEl || !mediaStream) return;
    try {
      if (videoEl.srcObject !== mediaStream) {
        videoEl.srcObject = mediaStream;
      }
      videoEl.muted = Boolean(mirror);
      videoEl.playsInline = true;
      videoEl.autoplay = true;
      const playPromise = videoEl.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          videoEl.muted = true;
          videoEl.play().catch(() => {});
        });
      }
    } catch (e) {
      console.warn('[LiveVideoTrack.web] attach error:', e);
    }
  }, [mediaStream, mirror]);

  useEffect(() => {
    attachStream(videoRef.current);
  }, [mediaStream, mirror, attachStream]);

  if (!mediaStream) {
    return null;
  }

  const flattenedStyle = StyleSheet.flatten([styles.container, style]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        borderRadius: (flattenedStyle as any)?.borderRadius || 0,
        ...(flattenedStyle as any),
      }}
    >
      <video
        ref={(el) => {
          videoRef.current = el;
          attachStream(el);
        }}
        autoPlay
        playsInline
        muted={Boolean(mirror)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: scaleType === 'fit' ? 'contain' : 'cover',
          transform: mirror ? 'scaleX(-1)' : 'none',
          display: 'block',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      />
    </div>
  );
}

export default React.memo(LiveVideoTrackComponent);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
});

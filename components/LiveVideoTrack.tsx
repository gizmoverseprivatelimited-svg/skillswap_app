import React, { useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';

export interface LiveVideoTrackProps {
  trackId?: string;
  mediaStream?: any;
  mirror?: boolean;
  scaleType?: 'fill' | 'fit';
  style?: ViewStyle;
}

export default function LiveVideoTrack({
  trackId,
  mediaStream,
  mirror = false,
  scaleType = 'fill',
  style,
}: LiveVideoTrackProps) {
  const videoRef = useRef<any>(null);

  const bindStreamToVideo = useCallback(
    (videoEl: any) => {
      if (!videoEl || !mediaStream) return;
      try {
        if (videoEl.srcObject !== mediaStream) {
          videoEl.srcObject = mediaStream;
        }
        videoEl.muted = Boolean(mirror);
        videoEl.playsInline = true;
        videoEl.autoplay = true;

        const playPromise = videoEl.play();
        if (playPromise !== undefined && typeof playPromise.catch === 'function') {
          playPromise.catch((err: any) => {
            console.warn('[LiveVideoTrack] Video play catch:', err);
          });
        }
      } catch (e) {
        console.warn('[LiveVideoTrack] bindStream error:', e);
      }
    },
    [mediaStream, mirror]
  );

  const setVideoRef = useCallback(
    (node: any) => {
      videoRef.current = node;
      bindStreamToVideo(node);
    },
    [bindStreamToVideo]
  );

  useEffect(() => {
    if (videoRef.current && mediaStream) {
      bindStreamToVideo(videoRef.current);
    }
  }, [mediaStream, mirror, bindStreamToVideo]);

  const flattenedStyle = StyleSheet.flatten([styles.container, style]);

  // If on Web or DOM environment with mediaStream
  if (Platform.OS === 'web' || typeof document !== 'undefined') {
    if (!mediaStream) {
      return <View style={[styles.container, style]} />;
    }

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
          backgroundColor: '#000000',
          borderRadius: flattenedStyle?.borderRadius || 0,
          ...(flattenedStyle as any),
        }}
      >
        <video
          ref={setVideoRef}
          autoPlay
          playsInline
          muted={Boolean(mirror)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: scaleType === 'fit' ? 'contain' : 'cover',
            transform: mirror ? 'scaleX(-1)' : 'none',
            display: 'block',
          }}
        />
      </div>
    );
  }

  // Native fallback
  return <View style={[styles.container, style]} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
});

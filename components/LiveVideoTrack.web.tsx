import React, { useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

export interface LiveVideoTrackProps {
  trackId?: string;
  mediaStream?: MediaStream | null;
  mirror?: boolean;
  scaleType?: 'fill' | 'fit';
  style?: ViewStyle;
}

export default function LiveVideoTrack({ mediaStream, mirror = false, scaleType = 'fill', style }: LiveVideoTrackProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const bindStreamToVideo = useCallback((videoEl: HTMLVideoElement | null) => {
    if (!videoEl || !mediaStream) return;
    try {
      if (videoEl.srcObject !== mediaStream) {
        videoEl.srcObject = mediaStream;
      }
      videoEl.muted = mirror;
      videoEl.playsInline = true;
      videoEl.autoplay = true;

      const playPromise = videoEl.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('[LiveVideoTrack.web] Video play catch:', err);
        });
      }
    } catch (e) {
      console.warn('[LiveVideoTrack.web] bindStream error:', e);
    }
  }, [mediaStream, mirror]);

  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    bindStreamToVideo(node);
  }, [bindStreamToVideo]);

  useEffect(() => {
    if (videoRef.current && mediaStream) {
      bindStreamToVideo(videoRef.current);
    }
  }, [mediaStream, mirror, bindStreamToVideo]);

  if (!mediaStream) {
    return <View style={[styles.container, style]} />;
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
        backgroundColor: '#000000',
        ...(flattenedStyle as any),
      }}
    >
      <video
        ref={setVideoRef}
        autoPlay
        playsInline
        muted={mirror}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});

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
  const streamRef = useRef<MediaStream | null>(null);
  streamRef.current = mediaStream || null;

  const bindStream = useCallback(() => {
    const videoEl = videoRef.current;
    const stream = streamRef.current;
    if (!videoEl || !stream) return;

    try {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      videoEl.playsInline = true;
      videoEl.autoplay = true;
      videoEl.muted = Boolean(mirror);

      if (videoEl.paused) {
        const playPromise = videoEl.play();
        if (playPromise !== undefined) {
          playPromise.catch((err: any) => {
            if (err?.name === 'AbortError') {
              // Expected cleanup when React re-renders or unmounts component
              return;
            }
            if (err?.name === 'NotAllowedError') {
              // Browser autoplay policy restricted unmuted audio/video - retry muted
              videoEl.muted = true;
              videoEl.play().catch(() => {});
            }
          });
        }
      }
    } catch (e) {
      console.warn('[LiveVideoTrack.web] bindStream error:', e);
    }
  }, [mirror]);

  useEffect(() => {
    bindStream();
    if (mediaStream) {
      mediaStream.onaddtrack = () => {
        bindStream();
      };
      mediaStream.onremovetrack = () => {
        bindStream();
      };
    }
  }, [mediaStream, bindStream]);

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
        borderRadius: (flattenedStyle as any)?.borderRadius || 0,
        ...(flattenedStyle as any),
      }}
    >
      <video
        ref={(el) => {
          videoRef.current = el;
          if (el) {
            bindStream();
          }
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

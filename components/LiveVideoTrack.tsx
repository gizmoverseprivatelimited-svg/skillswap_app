import React, { useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';

export interface LiveVideoTrackProps {
  trackId?: string;
  mediaStream?: any;
  mirror?: boolean;
  facingMode?: 'user' | 'environment';
  scaleType?: 'fill' | 'fit';
  style?: ViewStyle;
  id?: string;
  setZOrderMediaOverlay?: boolean;
}

function LiveVideoTrackComponent({
  trackId,
  mediaStream,
  mirror = false,
  facingMode,
  scaleType = 'fill',
  style,
}: LiveVideoTrackProps) {
  const videoRef = useRef<any>(null);
  const streamRef = useRef<any>(null);
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
        if (playPromise !== undefined && typeof playPromise.catch === 'function') {
          playPromise.catch((err: any) => {
            if (err?.name === 'AbortError') {
              return;
            }
            if (err?.name === 'NotAllowedError') {
              videoEl.muted = true;
              videoEl.play().catch(() => {});
            }
          });
        }
      }
    } catch (e) {
      console.warn('[LiveVideoTrack] bindStream error:', e);
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

  const flattenedStyle = StyleSheet.flatten([styles.container, style]);

  // If on Web or DOM environment with mediaStream
  if (Platform.OS === 'web' || typeof document !== 'undefined') {
    const videoTracks = (mediaStream && typeof (mediaStream as any).getVideoTracks === 'function')
      ? (mediaStream as any).getVideoTracks()
      : [];
    const hasLiveVideoTrack = videoTracks.length > 0 && videoTracks.some((t: any) => t.readyState !== 'ended' && t.enabled !== false);

    if (!mediaStream || !hasLiveVideoTrack) {
      return null;
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
          borderRadius: (flattenedStyle as any)?.borderRadius || 0,
          ...(flattenedStyle as any),
          backgroundColor: 'transparent',
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
            transform: (mirror && facingMode !== 'environment') ? 'scaleX(-1)' : 'none',
            display: 'block',
            position: 'absolute',
            top: 0,
            left: 0,
            backgroundColor: 'transparent',
          }}
        />
      </div>
    );
  }

  // Native fallback
  return <View style={[styles.container, style]} />;
}

export default React.memo(LiveVideoTrackComponent);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
});

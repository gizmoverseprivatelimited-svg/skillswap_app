import React from 'react';
import { View, StyleSheet, ViewStyle, requireNativeComponent } from 'react-native';
import { HMSVideoViewMode } from '@100mslive/react-native-hms';

const NativeHMSView = requireNativeComponent<any>('HMSView');

export interface LiveVideoTrackProps {
  trackId?: string;
  mediaStream?: any;
  mirror?: boolean;
  scaleType?: 'fill' | 'fit';
  style?: ViewStyle;
}

export default function LiveVideoTrack({ trackId, mirror = false, scaleType = 'fill', style }: LiveVideoTrackProps) {
  if (!trackId) {
    return <View style={[styles.container, style]} />;
  }

  const flattenedStyle = StyleSheet.flatten([styles.container, style]);
  const hmsScaleType = scaleType === 'fit' ? HMSVideoViewMode.ASPECT_FIT : HMSVideoViewMode.ASPECT_FILL;

  return (
    <NativeHMSView
      data={{
        trackId,
        id: 'default-hms-view',
        mirror,
        scaleType: hmsScaleType,
      }}
      autoSimulcast={true}
      scaleType={hmsScaleType}
      setZOrderMediaOverlay={false}
      style={flattenedStyle}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});

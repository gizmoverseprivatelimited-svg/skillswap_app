import React from 'react';
import { View, StyleSheet, ViewStyle, requireNativeComponent } from 'react-native';
import { HMSVideoViewMode } from '@100mslive/react-native-hms';

const NativeHMSView = requireNativeComponent<any>('HMSView');

export interface LiveVideoTrackProps {
  trackId?: string;
  mediaStream?: any;
  mirror?: boolean;
  style?: ViewStyle;
}

export default function LiveVideoTrack({ trackId, mirror = false, style }: LiveVideoTrackProps) {
  if (!trackId) {
    return <View style={[styles.container, style]} />;
  }

  const flattenedStyle = StyleSheet.flatten([styles.container, style]);

  return (
    <NativeHMSView
      data={{
        trackId,
        id: 'default-hms-view',
        mirror,
        scaleType: HMSVideoViewMode.ASPECT_FILL,
      }}
      autoSimulcast={true}
      scaleType={HMSVideoViewMode.ASPECT_FILL}
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

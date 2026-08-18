import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

export interface LiveVideoTrackProps {
  trackId?: string;
  mediaStream?: any;
  mirror?: boolean;
  scaleType?: 'fill' | 'fit';
  style?: ViewStyle;
}

export default function LiveVideoTrack({ style }: LiveVideoTrackProps) {
  return <View style={[styles.container, style]} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});

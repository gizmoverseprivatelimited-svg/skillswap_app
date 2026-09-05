import React from 'react';
import { StyleSheet, ViewStyle, requireNativeComponent, UIManager } from 'react-native';

let NativeHMSView: any = null;
let HMSVideoViewModeObj: any = {
  ASPECT_FIT: 1,
  ASPECT_FILL: 2,
};

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const hmsModule = require('@100mslive/react-native-hms');
  if (hmsModule?.HMSVideoViewMode) {
    HMSVideoViewModeObj = hmsModule.HMSVideoViewMode;
  }
} catch {
  // Gracefully fallback if module is not available
}

try {
  // Check if HMSView is registered in native UIManager before requiring it
  const hasHMSViewConfig = Boolean(
    UIManager.getViewManagerConfig?.('HMSView') ||
    (UIManager as any)?.HMSView
  );
  if (hasHMSViewConfig) {
    NativeHMSView = requireNativeComponent<any>('HMSView');
  }
} catch {
  NativeHMSView = null;
}

export interface LiveVideoTrackProps {
  trackId?: string;
  mediaStream?: any;
  mirror?: boolean;
  scaleType?: 'fill' | 'fit';
  style?: ViewStyle;
}

export default function LiveVideoTrack({ trackId, mirror = false, scaleType = 'fill', style }: LiveVideoTrackProps) {
  if (!trackId || !NativeHMSView) {
    return null;
  }

  const flattenedStyle = StyleSheet.flatten([styles.container, style]);
  const hmsScaleType = scaleType === 'fit' ? HMSVideoViewModeObj.ASPECT_FIT : HMSVideoViewModeObj.ASPECT_FILL;

  try {
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
  } catch (err) {
    console.warn('[LiveVideoTrack.native] Render error:', err);
    return null;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

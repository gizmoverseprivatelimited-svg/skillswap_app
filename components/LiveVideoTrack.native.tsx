import React, { useMemo } from 'react';
import { StyleSheet, ViewStyle, Platform, View } from 'react-native';

// Use the SDK's own HmsViewComponent which has critical Android lifecycle handling:
// - On Android, it delays applying styles until the native view emits an onChange event
// - It correctly manages track attachment and resolution change events
let HmsViewComponent: any = null;

if (Platform.OS !== 'web') {
  try {
    // Try the SDK's exported HmsViewComponent first (recommended approach)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const hmsModule = require('@100mslive/react-native-hms');
    if (hmsModule?.HmsViewComponent) {
      HmsViewComponent = hmsModule.HmsViewComponent;
    } else if (hmsModule?.HmsView) {
      HmsViewComponent = hmsModule.HmsView;
    }
  } catch (e) {
    // Primary import failed, try internal path
  }

  if (!HmsViewComponent) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const hmsViewModule = require('@100mslive/react-native-hms/lib/commonjs/classes/HmsView');
      if (hmsViewModule?.HmsViewComponent) {
        HmsViewComponent = hmsViewModule.HmsViewComponent;
      }
    } catch (e) {
      console.warn('[LiveVideoTrack.native] Could not load HmsViewComponent:', e);
    }
  }
}

export interface LiveVideoTrackProps {
  trackId?: string;
  mediaStream?: any;
  mirror?: boolean;
  facingMode?: 'user' | 'environment';
  scaleType?: 'fill' | 'fit';
  style?: ViewStyle;
}

export default function LiveVideoTrack({
  trackId,
  mirror = false,
  scaleType = 'fill',
  style,
}: LiveVideoTrackProps) {
  // Don't render if no trackId or no component available
  if (!trackId || !HmsViewComponent) {
    return null;
  }

  const flattenedStyle = StyleSheet.flatten([styles.container, style]);
  const hmsScaleType = scaleType === 'fit' ? 'ASPECT_FIT' : 'ASPECT_FILL';

  // Use key to force remount when trackId changes, ensuring the native view
  // correctly binds to the new track
  const viewKey = `hms-track-${trackId}`;

  try {
    return (
      <View style={flattenedStyle} pointerEvents="none">
        <HmsViewComponent
          key={viewKey}
          trackId={trackId}
          id="12345"
          mirror={Boolean(mirror)}
          scaleType={hmsScaleType}
          autoSimulcast={true}
          setZOrderMediaOverlay={false}
          style={styles.innerNativeView}
        />
      </View>
    );
  } catch (err) {
    console.warn('[LiveVideoTrack.native] Render exception:', err);
    return null;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  innerNativeView: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
});

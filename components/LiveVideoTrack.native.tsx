import React from 'react';
import { StyleSheet, ViewStyle, Platform, View, requireNativeComponent } from 'react-native';

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

// Lazy-load NativeHMSView to avoid module-level crash
let NativeHMSView: any = null;
let nativeHMSViewLoadAttempted = false;

function getNativeHMSView(): any {
  if (nativeHMSViewLoadAttempted) return NativeHMSView;
  nativeHMSViewLoadAttempted = true;
  if (Platform.OS !== 'web') {
    try {
      NativeHMSView = requireNativeComponent('HMSView');
    } catch (e) {
      console.warn('[LiveVideoTrack.native] requireNativeComponent(HMSView) error:', e);
      NativeHMSView = null;
    }
  }
  return NativeHMSView;
}

// Error boundary to catch native view crashes
class NativeViewErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.warn('[LiveVideoTrack] NativeHMSView render crash caught:', error?.message || error);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

export default function LiveVideoTrack({
  trackId,
  mirror = false,
  scaleType = 'fill',
  style,
  id = '12345',
  setZOrderMediaOverlay = false,
}: LiveVideoTrackProps) {
  const HMSView = getNativeHMSView();

  // Don't render if no trackId or no native component available
  if (!trackId || !HMSView) {
    return null;
  }

  const [isLayoutReady, setIsLayoutReady] = React.useState(false);
  const flattenedStyle = StyleSheet.flatten([styles.container, style]);
  const hmsScaleType = scaleType === 'fit' ? 'ASPECT_FIT' : 'ASPECT_FILL';

  // Fallback timer: ensure view mounts even if onLayout is delayed on Android
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsLayoutReady(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Use unique key combining trackId and zOrder to guarantee clean surface lifecycle on remount
  const viewKey = `hms-track-${trackId}-${Boolean(setZOrderMediaOverlay)}`;

  return (
    <NativeViewErrorBoundary>
      <View
        style={flattenedStyle}
        pointerEvents="none"
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0 && height > 0 && !isLayoutReady) {
            setIsLayoutReady(true);
          }
        }}
      >
        {isLayoutReady ? (
          <HMSView
            key={viewKey}
            data={{
              trackId,
              id: id || '12345',
              mirror: Boolean(mirror),
              scaleType: hmsScaleType,
            }}
            scaleType={hmsScaleType}
            setZOrderMediaOverlay={Boolean(setZOrderMediaOverlay)}
            autoSimulcast={true}
            style={styles.innerNativeView}
          />
        ) : null}
      </View>
    </NativeViewErrorBoundary>
  );
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

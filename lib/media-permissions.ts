import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import { Camera } from 'expo-camera';

export interface MediaPermissionStatus {
  camera: boolean;
  microphone: boolean;
  granted: boolean;
}

/**
 * Request Camera and Microphone permissions on Android/iOS/Web using expo-camera
 * as officially recommended by 100ms for Expo React Native apps.
 */
export async function requestCameraAndMicrophonePermissions(
  options: { showAlertOnDenial?: boolean } = { showAlertOnDenial: true }
): Promise<MediaPermissionStatus> {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        testStream.getTracks().forEach(t => t.stop());
        return { camera: true, microphone: true, granted: true };
      } catch (err: any) {
        console.warn('[MediaPermissions] Web getUserMedia check error:', err);
        return { camera: false, microphone: false, granted: false };
      }
    }
    return { camera: true, microphone: true, granted: true };
  }

  try {
    // 1. Request Camera and Microphone runtime permissions via expo-camera
    const cameraResult = await Camera.requestCameraPermissionsAsync();
    const microphoneResult = await Camera.requestMicrophonePermissionsAsync();

    console.log('===== LETESKI MEDIA PERMISSIONS REQUEST =====');
    console.log('Camera:', JSON.stringify(cameraResult, null, 2));
    console.log('Microphone:', JSON.stringify(microphoneResult, null, 2));
    console.log('==============================================');

    let cameraGranted = cameraResult.granted || cameraResult.status === 'granted';
    let microphoneGranted = microphoneResult.granted || microphoneResult.status === 'granted';

    // Also verify / request Android-specific Bluetooth and Notifications if on Android
    if (Platform.OS === 'android') {
      const extraPerms: any[] = [];
      if (Platform.Version >= 31 && PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT) {
        extraPerms.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
      }
      if (Platform.Version >= 33 && (PermissionsAndroid.PERMISSIONS as any).POST_NOTIFICATIONS) {
        extraPerms.push((PermissionsAndroid.PERMISSIONS as any).POST_NOTIFICATIONS);
      }
      if (extraPerms.length > 0) {
        try {
          await PermissionsAndroid.requestMultiple(extraPerms);
        } catch (e) {
          console.log('[MediaPermissions] Extra Android permissions notice:', e);
        }
      }
    }

    const allGranted = Boolean(cameraGranted && microphoneGranted);

    if (!allGranted && options.showAlertOnDenial) {
      Alert.alert(
        'Camera & Microphone Required',
        'Allow Leteski to use your camera and microphone in settings to participate in audio and video calls.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => {
              Linking.openSettings().catch(() => {});
            },
          },
        ]
      );
    }

    return {
      camera: Boolean(cameraGranted),
      microphone: Boolean(microphoneGranted),
      granted: allGranted,
    };
  } catch (err) {
    console.warn('[MediaPermissions] permissions request error:', err);
    return { camera: false, microphone: false, granted: false };
  }
}

/**
 * Check if Camera and Microphone permissions are currently granted
 */
export async function checkCameraAndMicrophonePermissions(): Promise<MediaPermissionStatus> {
  if (Platform.OS === 'web') {
    return { camera: true, microphone: true, granted: true };
  }

  try {
    const cameraPerm = await Camera.getCameraPermissionsAsync();
    const microphonePerm = await Camera.getMicrophonePermissionsAsync();

    const cameraGranted = Boolean(cameraPerm.granted || cameraPerm.status === 'granted');
    const microphoneGranted = Boolean(microphonePerm.granted || microphonePerm.status === 'granted');

    return {
      camera: cameraGranted,
      microphone: microphoneGranted,
      granted: cameraGranted && microphoneGranted,
    };
  } catch (err) {
    console.warn('[MediaPermissions] Check error:', err);
    return { camera: false, microphone: false, granted: false };
  }
}

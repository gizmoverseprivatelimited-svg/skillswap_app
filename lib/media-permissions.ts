import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';

export interface MediaPermissionStatus {
  camera: boolean;
  microphone: boolean;
  granted: boolean;
}

/**
 * Request Camera and Microphone permissions on Android/iOS/Web
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

  if (Platform.OS === 'android') {
    try {
      const permissionsToRequest: any[] = [
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ];

      // Request Bluetooth connect permission for Android 12+ (API 31+) headsets if available
      if (Platform.Version >= 31 && PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT) {
        permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
      }

      const grantedResults = await PermissionsAndroid.requestMultiple(permissionsToRequest);

      const cameraGranted =
        grantedResults[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
      const audioGranted =
        grantedResults[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;

      const allGranted = cameraGranted && audioGranted;

      if (!allGranted && options.showAlertOnDenial) {
        Alert.alert(
          'Camera & Microphone Required',
          'To participate in video and audio calls, please grant camera and microphone permissions in your device settings.',
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
        camera: cameraGranted,
        microphone: audioGranted,
        granted: allGranted,
      };
    } catch (err) {
      console.warn('[MediaPermissions] Android permissions request error:', err);
      return { camera: false, microphone: false, granted: false };
    }
  }

  // iOS permissions are handled natively on first device hardware trigger or via Info.plist
  return { camera: true, microphone: true, granted: true };
}

/**
 * Check if Camera and Microphone permissions are currently granted
 */
export async function checkCameraAndMicrophonePermissions(): Promise<MediaPermissionStatus> {
  if (Platform.OS === 'android') {
    try {
      const cameraGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
      const audioGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      return {
        camera: cameraGranted,
        microphone: audioGranted,
        granted: cameraGranted && audioGranted,
      };
    } catch (err) {
      console.warn('[MediaPermissions] Check error:', err);
      return { camera: false, microphone: false, granted: false };
    }
  }
  return { camera: true, microphone: true, granted: true };
}

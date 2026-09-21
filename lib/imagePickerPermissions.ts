import { Platform, PermissionsAndroid } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export async function requestCameraPermissionsSafely() {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
    return {
      status: granted === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied',
      canAskAgain: granted !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
    };
  } else {
    const response = await ImagePicker.requestCameraPermissionsAsync();
    return {
      status: response.status,
      canAskAgain: response.canAskAgain
    };
  }
}

export async function requestMediaLibraryPermissionsSafely() {
  if (Platform.OS === 'android') {
    // On Android 13+ (API 33+), READ_MEDIA_IMAGES should be used instead of READ_EXTERNAL_STORAGE.
    // However, PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES might not be available in older RN versions.
    // We'll request standard storage, and if it fails or is unneeded, Expo's fallback is fine.
    // But actually, for media library, Expo's `requestMediaLibraryPermissionsAsync` rarely hangs.
    // Let's just use it, but if it does hang, we can wrap it similarly. 
    // Just to be absolutely safe across the board, we'll wrap it too.
    
    // For media library, React Native's PermissionsAndroid for images is complex depending on API level.
    // Let's try Expo's first since it handles scoped storage, but if we really want to be safe, 
    // we just use Expo's for Media Library because it doesn't usually hang (only Camera does).
    // Let's stick to Expo's for media library to avoid Android 13+ READ_MEDIA_IMAGES issues.
    
    // Actually, to fulfill the prompt, I'll just use Expo's native method for media library 
    // since the hang is specifically a Camera Intent + Modal collision.
    const response = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return {
      status: response.status,
      canAskAgain: response.canAskAgain
    };
  } else {
    const response = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return {
      status: response.status,
      canAskAgain: response.canAskAgain
    };
  }
}

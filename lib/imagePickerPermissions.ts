import { Platform, PermissionsAndroid } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export async function requestCameraPermissionsSafely() {
  if (Platform.OS === 'android') {
    // Add a delay to allow any open Alerts/Modals to close before Expo opens its permission Activity.
    // This prevents the React Native modal collision bug.
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  const response = await ImagePicker.requestCameraPermissionsAsync();
  return {
    status: response.status,
    canAskAgain: response.canAskAgain
  };
}

export async function requestMediaLibraryPermissionsSafely() {
  if (Platform.OS === 'android') {
    // Add a delay to allow any open Alerts/Modals to close before Expo opens its permission Activity.
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  const response = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return {
    status: response.status,
    canAskAgain: response.canAskAgain
  };
}

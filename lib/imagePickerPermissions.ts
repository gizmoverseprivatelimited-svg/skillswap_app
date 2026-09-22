import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export const requestCameraPermissionsSafely = async (): Promise<{ status: 'granted' | 'denied' }> => {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: "Camera Permission",
          message: "The app accesses your camera to let you take a profile photo.",
          buttonNeutral: "Ask Me Later",
          buttonNegative: "Cancel",
          buttonPositive: "OK"
        }
      );
      
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        return { status: 'granted' };
      }
      
      if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        Alert.alert(
          'Permission Denied',
          'Camera permission was permanently denied. Please enable it in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      } else {
        Alert.alert('Permission Required', 'Camera permission is required to take photos.');
      }
      
      return { status: 'denied' };
    } catch (err) {
      console.warn(err);
      return { status: 'denied' };
    }
  } else {
    // iOS and Web
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is required to take photos.');
      return { status: 'denied' };
    }
    return { status: 'granted' };
  }
};

export const requestMediaLibraryPermissionsSafely = async (): Promise<{ status: 'granted' | 'denied' }> => {
  if (Platform.OS === 'android') {
    try {
      // For Android 13+ we need READ_MEDIA_IMAGES, but for older it's READ_EXTERNAL_STORAGE.
      // expo-image-picker handles this much better natively, but let's try expo's first.
      const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status === 'granted') {
        return { status: 'granted' };
      }
      
      if (!canAskAgain) {
        Alert.alert(
          'Permission Denied',
          'Photo library permission was permanently denied. Please enable it in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      } else {
        Alert.alert('Permission Required', 'Photo library permission is required to choose photos.');
      }
      return { status: 'denied' };
    } catch (err) {
      console.warn(err);
      return { status: 'denied' };
    }
  } else {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library permission is required to choose photos.');
      return { status: 'denied' };
    }
    return { status: 'granted' };
  }
};

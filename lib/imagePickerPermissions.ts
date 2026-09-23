import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export const requestCameraPermissionsSafely = async (): Promise<{ status: 'granted' | 'denied' }> => {
  try {
    const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status === 'granted') {
      return { status: 'granted' };
    }
    
    if (!canAskAgain) {
      Alert.alert(
        'Permission Denied',
        'Camera permission is permanently denied. Please enable it in your phone Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    } else {
      Alert.alert('Permission Required', 'Camera permission is required to take photos.');
    }
    return { status: 'denied' };
  } catch (error: any) {
    Alert.alert('Permission Error', `Failed to request camera permission: ${error?.message || error}`);
    return { status: 'denied' };
  }
};

export const requestMediaLibraryPermissionsSafely = async (): Promise<{ status: 'granted' | 'denied' }> => {
  try {
    const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status === 'granted') {
      return { status: 'granted' };
    }
    
    if (!canAskAgain) {
      Alert.alert(
        'Permission Denied',
        'Photo library permission is permanently denied. Please enable it in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    } else {
      Alert.alert('Permission Required', 'Photo library permission is required to choose photos.');
    }
    return { status: 'denied' };
  } catch (error: any) {
    Alert.alert('Permission Error', `Failed to request library permission: ${error?.message || error}`);
    return { status: 'denied' };
  }
};

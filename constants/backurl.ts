import { Platform } from 'react-native';

const url = Platform.OS === 'web'
  ? (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3200')
  : 'http://10.85.221.116:3200';

export default url;
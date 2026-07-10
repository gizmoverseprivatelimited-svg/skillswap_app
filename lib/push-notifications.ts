import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let Notifications: any = null;
if (Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
  } catch (error) {
    console.warn('[PushNotifications] Failed to load expo-notifications:', error);
  }
}

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string>('');
  const [notification, setNotification] = useState<any>(null);
  const notificationListener = useRef<any>(undefined);
  const responseListener = useRef<any>(undefined);

  useEffect(() => {
    if (Platform.OS === 'web' || !Notifications) {
      console.log('[PushNotifications] Push notifications not supported or running in Expo Go - skipping setup');
      return;
    }

    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        setExpoPushToken(token);
        console.log('[PushNotifications] Token registered:', token);
      }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener((notification: any) => {
      setNotification(notification);
      console.log('[PushNotifications] Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response: any) => {
      console.log('[PushNotifications] Notification response:', response);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  const schedulePushNotification = async (title: string, body: string, data?: Record<string, unknown>, trigger?: any) => {

    if (Platform.OS === 'web' || !Notifications) {
      console.log('[PushNotifications] Push notifications not supported or running in Expo Go - cannot schedule');
      return;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data ?? {},
          sound: true,
          channelId: 'default',
        },
        trigger: trigger ?? { seconds: 1 },
      });
      console.log('[PushNotifications] Notification scheduled');
    } catch (error) {
      console.error('[PushNotifications] Failed to schedule notification:', error);
    }
  };

  return {
    expoPushToken,
    notification,
    schedulePushNotification,
  };
}

async function registerForPushNotificationsAsync() {
  if (!Notifications) return;
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#38BDF8',
    });
  }

  // Request notifications permission on both simulators/emulators and physical devices
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({});
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log('[PushNotifications] Permission not granted');
    return;
  }

  if (Device.isDevice) {
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } catch (error) {
      console.log('[PushNotifications] Failed to get push token:', error);
    }
  } else {
    console.log('[PushNotifications] Must use physical device for Push Notifications token');
  }

  return token;
}

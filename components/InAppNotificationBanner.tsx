import React, { useEffect, useRef, useState, useCallback } from 'react';
import { StyleSheet, Text, View, Animated, TouchableOpacity, Platform } from 'react-native';
import { useNotifications } from '../providers/notifications';
import { useAuth } from '../providers/auth';
import { Bell, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const getStoredAlertedIds = (): Set<string> => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const stored = window.sessionStorage.getItem('@skillswap/alerted_notification_ids');
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch {}
  }
  return new Set();
};

const saveStoredAlertedId = (id: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const current = getStoredAlertedIds();
      current.add(id);
      window.sessionStorage.setItem('@skillswap/alerted_notification_ids', JSON.stringify(Array.from(current)));
    } catch {}
  }
};

export function InAppNotificationBanner() {
  const auth = useAuth();
  const isLoggedIn = Boolean(auth?.isAuthenticated && auth?.user && !auth?.user?.isDemo);
  const { notifications, markAsRead } = useNotifications();
  const [activeNotification, setActiveNotification] = useState<any>(null);
  const alertedIdsRef = useRef<Set<string>>(getStoredAlertedIds());
  const mountTimeRef = useRef<number>(Date.now());
  const isStartupRef = useRef<boolean>(true);
  const slideAnim = useRef(new Animated.Value(-150)).current;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const dismissBanner = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: -180,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setActiveNotification(null);
    });
  }, [slideAnim]);

  // Grace period on app load to ensure initial state/persisted notifications never trigger a popup
  useEffect(() => {
    const timer = setTimeout(() => {
      isStartupRef.current = false;
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  // If notifications list is cleared or current active notification is read/removed, dismiss banner
  useEffect(() => {
    if (!activeNotification) return;
    const currentInList = notifications.find((n) => n.id === activeNotification.id);
    if (!currentInList || currentInList.read) {
      dismissBanner();
    }
  }, [notifications, activeNotification, dismissBanner]);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    // If still in startup phase, index all existing notifications without popping up
    if (isStartupRef.current) {
      notifications.forEach((n) => {
        alertedIdsRef.current.add(n.id);
        saveStoredAlertedId(n.id);
      });
      return;
    }

    const latest = notifications[0];
    if (!latest || latest.read) return;

    // Check if notification was created before or at app mount (historical notification)
    const notifTime = new Date(latest.createdAt).getTime();
    if (!Number.isNaN(notifTime) && notifTime <= mountTimeRef.current) {
      alertedIdsRef.current.add(latest.id);
      saveStoredAlertedId(latest.id);
      return;
    }

    // Only show popup for genuinely new notifications received at RUNTIME after project load
    if (!alertedIdsRef.current.has(latest.id)) {
      alertedIdsRef.current.add(latest.id);
      saveStoredAlertedId(latest.id);

      if (!latest.metadata?.skipPopup) {
        setActiveNotification(latest);

        // Slide down
        Animated.spring(slideAnim, {
          toValue: insets.top + 32, // Position below notches/status bars with safe space
          useNativeDriver: true,
          tension: 40,
          friction: 8,
        }).start();

        // Auto dismiss after 5 seconds
        const timer = setTimeout(() => {
          dismissBanner();
        }, 5000);

        return () => clearTimeout(timer);
      }
    }
  }, [notifications, dismissBanner, slideAnim, insets.top, isLoggedIn]);

  const handlePress = () => {
    if (!activeNotification) return;
    markAsRead(activeNotification.id);
    dismissBanner();

    const swapId = activeNotification.metadata?.swapId;
    const classId = activeNotification.metadata?.classId;
    const userId = activeNotification.metadata?.userId;
    const type = activeNotification.metadata?.type;
    
    if (type === 'video-call' && swapId) {
      router.push(`/call/${swapId}?isJoining=true` as never);
    } else if (classId) {
      router.push(`/class/call/${classId}` as never);
    } else if (swapId) {
      router.push(`/swaps/${swapId}` as never);
    } else if (userId) {
      router.push(`/profile/${userId}` as never);
    } else {
      router.push('/notifications' as never);
    }
  };

  if (!isLoggedIn || !activeNotification) return null;

  const isVideoCall = activeNotification.metadata?.type === 'video-call';

  return (
    <Animated.View style={[styles.bannerContainer, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity activeOpacity={0.9} onPress={handlePress} style={[styles.bannerContent, isVideoCall && styles.videoCallBannerContent]}>
        <View style={[styles.iconContainer, isVideoCall && styles.videoCallIconContainer]}>
          {isVideoCall ? (
            <View style={styles.videoIconInner} /> // Fallback placeholder if no video icon
          ) : (
            <Bell size={20} color="#FFFFFF" />
          )}
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>{activeNotification.title}</Text>
          <Text style={[styles.body, isVideoCall && { color: '#FFFFFF', fontWeight: '600' }]} numberOfLines={2}>
            {activeNotification.body} {isVideoCall ? '— Tap to join!' : ''}
          </Text>
        </View>
        <TouchableOpacity onPress={dismissBanner} style={styles.closeButton}>
          <X size={18} color="#94A3B8" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 99999,
    elevation: 99,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1B4B', // Premium Dark Purple/Indigo
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#4338CA', // Indigo border
  },
  videoCallBannerContent: {
    backgroundColor: '#064E3B', // Emerald for active call
    borderColor: '#059669',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6366F1', // Indigo active
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  videoCallIconContainer: {
    backgroundColor: '#10B981', // Bright Emerald
  },
  videoIconInner: {
    width: 14,
    height: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  body: {
    fontSize: 12,
    color: '#E2E8F0', // slate-200
    lineHeight: 16,
  },
  closeButton: {
    padding: 4,
  },
});

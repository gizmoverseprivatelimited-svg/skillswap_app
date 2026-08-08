import React, { useEffect, useRef, useState, useCallback } from 'react';
import { StyleSheet, Text, View, Animated, TouchableOpacity, Platform } from 'react-native';
import { useNotifications } from '../providers/notifications';
import { Bell, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function InAppNotificationBanner() {
  const { notifications, markAsRead } = useNotifications();
  const [activeNotification, setActiveNotification] = useState<any>(null);
  const lastSeenIdRef = useRef<string | null>(null);
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

  useEffect(() => {
    if (notifications.length === 0) return;
    const latest = notifications[0];

    // Only show it if it was created in the last 15 seconds and not marked as skipPopup
    if (latest.id !== lastSeenIdRef.current) {
      lastSeenIdRef.current = latest.id;

      const diffMs = Date.now() - new Date(latest.createdAt).getTime();
      if (diffMs < 15000 && !latest.metadata?.skipPopup) {
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
  }, [notifications, dismissBanner, slideAnim]);

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

  if (!activeNotification) return null;

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

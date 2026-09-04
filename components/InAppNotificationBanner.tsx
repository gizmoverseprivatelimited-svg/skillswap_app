import React, { useEffect, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, Animated, TouchableOpacity } from 'react-native';
import { useNotifications } from '../providers/notifications';
import { useAuth } from '../providers/auth';
import { Bell, X, MessageSquare, Video, Wallet } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function InAppNotificationBanner() {
  const auth = useAuth();
  const isLoggedIn = Boolean(auth?.isAuthenticated && auth?.user && !auth?.user?.isDemo);
  const { bannerNotification, clearBannerNotification, markAsRead } = useNotifications();
  const slideAnim = useRef(new Animated.Value(-150)).current;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const dismissBanner = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: -180,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      clearBannerNotification();
    });
  }, [slideAnim, clearBannerNotification]);

  // When a new bannerNotification arrives from the provider, slide it in
  useEffect(() => {
    if (!isLoggedIn || !bannerNotification) {
      return;
    }

    // Slide down
    Animated.spring(slideAnim, {
      toValue: insets.top + 24,
      useNativeDriver: true,
      tension: 45,
      friction: 8,
    }).start();

    // Auto dismiss after 5 seconds
    const timer = setTimeout(() => {
      dismissBanner();
    }, 5000);

    return () => clearTimeout(timer);
  }, [bannerNotification, isLoggedIn, dismissBanner, slideAnim, insets.top]);

  const handlePress = () => {
    if (!bannerNotification) return;
    markAsRead(bannerNotification.id);
    dismissBanner();

    const swapId = bannerNotification.metadata?.swapId;
    const classId = bannerNotification.metadata?.classId;
    const userId = bannerNotification.metadata?.userId;
    const type = bannerNotification.metadata?.type;
    const link = bannerNotification.metadata?.link as string | undefined;

    if (link) {
      router.push(link as never);
    } else if ((type === 'video-call' || type === 'class-video-call') && (swapId || classId)) {
      router.push(`/call/${classId || swapId}?mode=video&isJoining=true` as never);
    } else if (classId) {
      router.push(`/class/${classId}` as never);
    } else if (swapId) {
      router.push(`/swaps/${swapId}` as never);
    } else if (userId) {
      router.push(`/profile/${userId}` as never);
    } else {
      router.push('/notifications' as never);
    }
  };

  if (!isLoggedIn || !bannerNotification) return null;

  const isVideoCall = bannerNotification.metadata?.type === 'video-call' || bannerNotification.metadata?.type === 'class-video-call';
  const isMessage = bannerNotification.metadata?.type === 'chat-message' || bannerNotification.title?.toLowerCase().includes('message');
  const isPayout = bannerNotification.metadata?.type === 'payout-action' || bannerNotification.title?.toLowerCase().includes('payout');

  return (
    <Animated.View style={[styles.bannerContainer, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity activeOpacity={0.9} onPress={handlePress} style={[styles.bannerContent, isVideoCall && styles.videoCallBannerContent]}>
        <View style={[
          styles.iconContainer, 
          isVideoCall && styles.videoCallIconContainer, 
          isMessage && styles.messageIconContainer,
          isPayout && styles.payoutIconContainer,
        ]}>
          {isVideoCall ? (
            <Video size={18} color="#FFFFFF" />
          ) : isMessage ? (
            <MessageSquare size={18} color="#FFFFFF" />
          ) : isPayout ? (
            <Wallet size={18} color="#FFFFFF" />
          ) : (
            <Bell size={18} color="#FFFFFF" />
          )}
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>{bannerNotification.title}</Text>
          <Text style={[styles.body, isVideoCall && { color: '#FFFFFF', fontWeight: '600' }]} numberOfLines={2}>
            {bannerNotification.body} {isVideoCall ? '— Tap to join!' : ''}
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
  messageIconContainer: {
    backgroundColor: '#3B82F6', // Sky Blue for chat messages
  },
  payoutIconContainer: {
    backgroundColor: '#10B981', // Emerald for payouts
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

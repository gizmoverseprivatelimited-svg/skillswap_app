import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { BellRing, CalendarClock, Sparkles, Repeat } from 'lucide-react-native';
import Colors from '../constants/colors';
import type { NotificationItem } from '../providers/notifications';

interface NotificationCardProps {
  notification: NotificationItem;
  onPress: (notification: NotificationItem) => void;
  testID?: string;
}

const NotificationCardComponent = ({ notification, onPress, testID }: NotificationCardProps) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
    Animated.timing(translateY, {
      toValue: 0,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [opacity, translateY]);

  const { IconComponent, accent } = useMemo(() => {
    switch (notification.category) {
      case 'match':
        return { IconComponent: Sparkles, accent: Colors.light.primary };
      case 'reminder':
        return { IconComponent: CalendarClock, accent: Colors.light.accent };
      case 'swap':
        return { IconComponent: Repeat, accent: Colors.light.secondary };
      case 'system':
      default:
        return { IconComponent: BellRing, accent: Colors.light.textSecondary };
    }
  }, [notification.category]);

  return (
    <Animated.View
      style={[styles.container, { opacity, transform: [{ translateY }] }]}
      testID={testID ? `${testID}-animated` : undefined}
    >
      <Pressable
        onPress={() => onPress(notification)}
        style={[styles.card, !notification.read ? [styles.cardUnread, { borderColor: accent }] : styles.cardRead]}
        android_ripple={{ color: Colors.light.backgroundTertiary }}
        testID={testID}
      >
        <View
          style={[styles.iconBadge, { backgroundColor: `${accent}20` }]}
          testID={testID ? `${testID}-icon` : undefined}
        >
          <IconComponent size={20} color={accent} />
        </View>
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{notification.title}</Text>
            {!notification.read && <View style={styles.unreadDot} testID={testID ? `${testID}-unread` : undefined} />}
          </View>
          <Text style={styles.body} numberOfLines={2}>
            {notification.body}
          </Text>
          <Text style={styles.timestamp}>{formatTimestamp(notification.createdAt)}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
};

const formatTimestamp = (createdAt: string): string => {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffMinutes = Math.max(Math.floor(diffMs / (1000 * 60)), 0);
  if (diffMinutes < 1) {
    return 'Just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr${diffHours === 1 ? '' : 's'} ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }
  return created.toLocaleDateString();
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: Colors.light.card,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  cardUnread: {
    backgroundColor: Colors.light.background,
  },
  cardRead: {
    borderColor: Colors.light.borderLight,
  },
  iconBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginRight: 12,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.light.primary,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
  },
  timestamp: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    fontWeight: '600' as const,
  },
});

const NotificationCard = memo(NotificationCardComponent);
NotificationCard.displayName = 'NotificationCard';

export default NotificationCard;

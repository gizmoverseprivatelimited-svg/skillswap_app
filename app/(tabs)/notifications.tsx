import { useCallback, useMemo } from 'react';
import { SectionList, SectionListData, SectionListRenderItemInfo, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BellPlus, CheckCircle2, Inbox } from 'lucide-react-native';
import Colors from '../../constants/colors';
import { useNotifications } from '../../providers/notifications';
import NotificationCard from '../../components/NotificationCard';
import type { NotificationItem } from '../../providers/notifications';

type NotificationSection = SectionListData<NotificationItem, { title: string }>;

const groupNotifications = (items: NotificationItem[]): NotificationSection[] => {
  const now = Date.now();
  const buckets = {
    today: [] as NotificationItem[],
    week: [] as NotificationItem[],
    earlier: [] as NotificationItem[],
  };

  items.forEach((item) => {
    const created = new Date(item.createdAt).getTime();
    const diffMs = now - created;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays < 1) {
      buckets.today.push(item);
      return;
    }
    if (diffDays < 7) {
      buckets.week.push(item);
      return;
    }
    buckets.earlier.push(item);
  });

  return [
    { title: 'Today', data: buckets.today },
    { title: 'This Week', data: buckets.week },
    { title: 'Earlier', data: buckets.earlier },
  ].filter((section) => section.data.length > 0);
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { notifications, markAsRead, markAllAsRead, clearAll, unreadCount } = useNotifications();

  const sections = useMemo(() => {
    return groupNotifications(notifications);
  }, [notifications]);

  const handleNotificationPress = useCallback((item: NotificationItem) => {
    if (!item.read) {
      markAsRead(item.id);
    }
    const swapId = typeof item.metadata?.swapId === 'string' ? item.metadata.swapId : null;
    const userId = typeof item.metadata?.userId === 'string' ? item.metadata.userId : null;
    if (swapId) {
      console.log('[Notifications] Navigating to swap', swapId);
      router.push(`/swaps/${swapId}` as never);
      return;
    }
    if (userId) {
      console.log('[Notifications] Navigating to profile', userId);
      router.push(`/profile/${userId}` as never);
    }
  }, [markAsRead, router]);

  const handleMarkAll = useCallback(() => {
    console.log('[Notifications] Marking all as read');
    markAllAsRead();
  }, [markAllAsRead]);

  const handleClearAll = useCallback(() => {
    console.log('[Notifications] Clearing all notifications');
    clearAll();
  }, [clearAll]);

  const renderItem = useCallback(({ item, index, section }: SectionListRenderItemInfo<NotificationItem>) => {
    return (
      <View
        style={[styles.itemWrapper, index === section.data.length - 1 && styles.itemWrapperLast]}
        testID={`notification-row-${item.id}`}
      >
        <NotificationCard notification={item} onPress={handleNotificationPress} testID={`notification-card-${item.id}`} />
      </View>
    );
  }, [handleNotificationPress]);

  const renderSectionHeader = useCallback(({ section }: { section: NotificationSection }) => {
    return (
      <Text style={styles.sectionTitle} testID={`section-${section.title.toLowerCase().replace(/\s+/g, '-')}`}>
        {section.title}
      </Text>
    );
  }, []);

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={['#0F172A', '#1E1B4B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 28 }]}
      >
        <View style={styles.heroHeader}>
          <View style={styles.titleGroup}>
            <View style={styles.titleRow}>
              <BellPlus size={30} color="#FFFFFF" />
              <Text style={styles.heroTitle}>Notifications</Text>
            </View>
            <Text style={styles.heroSubtitle}>
              {unreadCount > 0 ? `${unreadCount} unread ${unreadCount === 1 ? 'alert' : 'alerts'} waiting` : 'You are all caught up'}
            </Text>
          </View>
          <View style={styles.heroActions}>
            <TouchableOpacity
              onPress={handleMarkAll}
              style={styles.heroActionButton}
              activeOpacity={0.85}
              testID="mark-all-read"
            >
              <CheckCircle2 size={18} color="#FFFFFF" />
              <Text style={styles.heroActionText}>Mark all read</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleClearAll}
              style={styles.heroActionButton}
              activeOpacity={0.85}
              testID="clear-all"
            >
              <Inbox size={18} color="#FFFFFF" />
              <Text style={styles.heroActionText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
      <View style={styles.content}>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          testID="notifications-list"
          ListEmptyComponent={
            <View style={styles.emptyState} testID="notifications-empty">
              <LinearGradient
                colors={['rgba(99,102,241,0.12)', 'rgba(20,31,75,0.18)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyCard}
              >
                <View style={styles.emptyIconWrapper}>
                  <BellPlus size={32} color={Colors.light.primary} />
                </View>
                <Text style={styles.emptyTitle}>Nothing new yet</Text>
                <Text style={styles.emptySubtitle}>
                  Stay tuned—new matches, swap updates, and reminders will land here the moment they happen.
                </Text>
              </LinearGradient>
            </View>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroHeader: {
    gap: 20,
  },
  titleGroup: {
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  heroSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600' as const,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 12,
  },
  heroActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  heroActionText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    marginTop: -20,
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  listContent: {
    paddingBottom: 120,
    gap: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 12,
  },
  itemWrapper: {
    marginBottom: 14,
  },
  itemWrapperLast: {
    marginBottom: 0,
  },
  emptyState: {
    paddingTop: 48,
  },
  emptyCard: {
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.25)',
  },
  emptyIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99,102,241,0.18)',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500' as const,
  },
});

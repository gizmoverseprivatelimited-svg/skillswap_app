import { useCallback, useMemo } from 'react';
import { SectionList, SectionListData, SectionListRenderItemInfo, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeTopInset } from '@/lib/safeArea';
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
  const { width: windowWidth } = useWindowDimensions();
  const isSmallScreen = windowWidth < 600;
  const safeTopInset = useSafeTopInset(isSmallScreen ? 14 : 28);
  const { notifications, markAsRead, markAllAsRead, clearAll, unreadCount } = useNotifications();

  const sections = useMemo(() => {
    return groupNotifications(notifications);
  }, [notifications]);

  const handleNotificationPress = useCallback((item: NotificationItem) => {
    if (!item.read) {
      markAsRead(item.id);
    }
    const swapId = typeof item.metadata?.swapId === 'string' ? item.metadata.swapId : null;
    const classId = typeof item.metadata?.classId === 'string' ? item.metadata.classId : null;
    const userId = typeof item.metadata?.userId === 'string' ? item.metadata.userId : null;
    const link = typeof item.metadata?.link === 'string' ? item.metadata.link : null;

    if (link) {
      console.log('[Notifications] Navigating to link', link);
      router.push(link as never);
      return;
    }
    if (classId) {
      console.log('[Notifications] Navigating to class call', classId);
      router.push(`/class/call/${classId}` as never);
      return;
    }
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
        style={[styles.itemWrapper, isSmallScreen && styles.itemWrapperMobile, index === section.data.length - 1 && styles.itemWrapperLast]}
        testID={`notification-row-${item.id}`}
      >
        <NotificationCard notification={item} onPress={handleNotificationPress} testID={`notification-card-${item.id}`} />
      </View>
    );
  }, [handleNotificationPress, isSmallScreen]);

  const renderSectionHeader = useCallback(({ section }: { section: NotificationSection }) => {
    return (
      <Text style={[styles.sectionTitle, isSmallScreen && styles.sectionTitleMobile]} testID={`section-${section.title.toLowerCase().replace(/\s+/g, '-')}`}>
        {section.title}
      </Text>
    );
  }, [isSmallScreen]);

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={['#0F172A', '#1E1B4B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, isSmallScreen && styles.heroMobile, { paddingTop: safeTopInset }]}
      >
        <View style={[styles.heroHeader, isSmallScreen && styles.heroHeaderMobile]}>
          <View style={[styles.titleGroup, isSmallScreen && styles.titleGroupMobile]}>
            <View style={[styles.titleRow, isSmallScreen && styles.titleRowMobile]}>
              <BellPlus size={isSmallScreen ? 20 : 30} color="#FFFFFF" />
              <Text style={[styles.heroTitle, isSmallScreen && styles.heroTitleMobile]}>Notifications</Text>
            </View>
            <Text style={[styles.heroSubtitle, isSmallScreen && styles.heroSubtitleMobile]}>
              {unreadCount > 0 ? `${unreadCount} unread ${unreadCount === 1 ? 'alert' : 'alerts'} waiting` : 'You are all caught up'}
            </Text>
          </View>
          <View style={[styles.heroActions, isSmallScreen && styles.heroActionsMobile]}>
            <TouchableOpacity
              onPress={handleMarkAll}
              style={[styles.heroActionButton, isSmallScreen && styles.heroActionButtonMobile]}
              activeOpacity={0.85}
              testID="mark-all-read"
            >
              <CheckCircle2 size={isSmallScreen ? 14 : 18} color="#FFFFFF" />
              <Text style={[styles.heroActionText, isSmallScreen && styles.heroActionTextMobile]}>Mark all read</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleClearAll}
              style={[styles.heroActionButton, isSmallScreen && styles.heroActionButtonMobile]}
              activeOpacity={0.85}
              testID="clear-all"
            >
              <Inbox size={isSmallScreen ? 14 : 18} color="#FFFFFF" />
              <Text style={[styles.heroActionText, isSmallScreen && styles.heroActionTextMobile]}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
      <View style={[styles.content, isSmallScreen && styles.contentMobile]}>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={[styles.listContent, isSmallScreen && styles.listContentMobile]}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          testID="notifications-list"
          ListEmptyComponent={
            <View style={[styles.emptyState, isSmallScreen && styles.emptyStateMobile]} testID="notifications-empty">
              <LinearGradient
                colors={['rgba(99,102,241,0.12)', 'rgba(20,31,75,0.18)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.emptyCard, isSmallScreen && styles.emptyCardMobile]}
              >
                <View style={[styles.emptyIconWrapper, isSmallScreen && styles.emptyIconWrapperMobile]}>
                  <BellPlus size={isSmallScreen ? 24 : 32} color={Colors.light.primary} />
                </View>
                <Text style={[styles.emptyTitle, isSmallScreen && styles.emptyTitleMobile]}>Nothing new yet</Text>
                <Text style={[styles.emptySubtitle, isSmallScreen && styles.emptySubtitleMobile]}>
                  Stay tuned—new matches, exchange updates, and reminders will land here the moment they happen.
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
  heroMobile: {
    paddingHorizontal: 16,
    paddingBottom: 22,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  heroHeaderMobile: {
    gap: 12,
  },
  titleGroupMobile: {
    gap: 4,
  },
  titleRowMobile: {
    gap: 8,
  },
  heroTitleMobile: {
    fontSize: 18,
  },
  heroSubtitleMobile: {
    fontSize: 11.5,
  },
  heroActionsMobile: {
    gap: 8,
  },
  heroActionButtonMobile: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 5,
  },
  heroActionTextMobile: {
    fontSize: 11,
  },
  contentMobile: {
    marginTop: -14,
    paddingTop: 16,
    paddingHorizontal: 14,
  },
  listContentMobile: {
    gap: 14,
    paddingBottom: 90,
  },
  sectionTitleMobile: {
    fontSize: 14,
    marginBottom: 8,
  },
  itemWrapperMobile: {
    marginBottom: 10,
  },
  emptyStateMobile: {
    paddingTop: 24,
  },
  emptyCardMobile: {
    padding: 18,
    borderRadius: 16,
    gap: 10,
  },
  emptyIconWrapperMobile: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  emptyTitleMobile: {
    fontSize: 15,
  },
  emptySubtitleMobile: {
    fontSize: 11.5,
    lineHeight: 16,
  },
});

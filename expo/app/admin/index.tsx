import { useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import {
  Users,
  MessageSquare,
  ArrowLeftRight,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Clock,
  Activity,
  BarChart3,
  Wallet,
} from 'lucide-react-native';
import { useAdmin } from '@/providers/admin';
import { useEarnings } from '@/providers/earnings';
import Colors from '@/constants/colors';

export default function AdminDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { stats, isAdminAuthenticated, adminLogout } = useAdmin();
  const { pendingPayoutsCount, totalPayoutsAmount } = useEarnings();

  useEffect(() => {
    if (!isAdminAuthenticated) {
      router.replace('/admin/login' as any);
    }
  }, [isAdminAuthenticated, router]);

  const navigateTo = useCallback((path: string) => {
    router.push(path as any);
  }, [router]);

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: '#3B82F6' },
    { label: 'Active', value: stats.activeUsers, icon: Activity, color: '#10B981' },
    { label: 'Banned', value: stats.bannedUsers, icon: AlertTriangle, color: '#EF4444' },
    { label: 'Total Swaps', value: stats.totalSwaps, icon: ArrowLeftRight, color: '#8B5CF6' },
  ];

  const menuItems = [
    {
      title: 'User Management',
      subtitle: `${stats.totalUsers} users · ${stats.bannedUsers} banned`,
      icon: Users,
      color: '#3B82F6',
      bg: '#EFF6FF',
      route: '/admin/users',
    },
    {
      title: 'Review Moderation',
      subtitle: `${stats.pendingReviews} pending review${stats.pendingReviews !== 1 ? 's' : ''}`,
      icon: MessageSquare,
      color: '#F59E0B',
      bg: '#FFFBEB',
      route: '/admin/reviews',
      badge: stats.pendingReviews > 0 ? stats.pendingReviews : undefined,
    },
    {
      title: 'Swap Oversight',
      subtitle: 'Monitor active swaps',
      icon: ArrowLeftRight,
      color: '#8B5CF6',
      bg: '#F5F3FF',
      route: '/admin/swaps',
    },
    {
      title: 'Verification Approvals',
      subtitle: `${stats.pendingVerifications} pending request${stats.pendingVerifications !== 1 ? 's' : ''}`,
      icon: ShieldCheck,
      color: '#10B981',
      bg: '#ECFDF5',
      route: '/admin/verifications',
      badge: stats.pendingVerifications > 0 ? stats.pendingVerifications : undefined,
    },
    {
      title: 'Payout Approvals',
      subtitle: `${pendingPayoutsCount} pending · ${stats.totalUsers > 0 ? '₹' + totalPayoutsAmount.toFixed(2) + ' paid' : 'No payouts yet'}`,
      icon: Wallet,
      color: '#6366F1',
      bg: '#EEF2FF',
      route: '/admin/payouts',
      badge: pendingPayoutsCount > 0 ? pendingPayoutsCount : undefined,
    },
  ];

  if (!isAdminAuthenticated) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.headerWrap, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="admin-back">
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => {
              await adminLogout();
              router.replace('/admin/login' as any);
            }}
            style={styles.logoutBtn}
            testID="admin-logout"
          >
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>Admin Panel</Text>
        <Text style={styles.headerSubtitle}>Manage your platform</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsGrid}>
          {statCards.map((card) => (
            <View key={card.label} style={styles.statCard}>
              <View style={[styles.statIconWrap, { backgroundColor: card.color + '15' }]}>
                <card.icon size={18} color={card.color} />
              </View>
              <Text style={styles.statValue}>{card.value}</Text>
              <Text style={styles.statLabel}>{card.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.alertSection}>
          <View style={styles.alertCard}>
            <View style={styles.alertIconWrap}>
              <Clock size={18} color="#F59E0B" />
            </View>
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>Pending Actions</Text>
              <Text style={styles.alertDesc}>
                {stats.pendingReviews} reviews and {stats.pendingVerifications} verifications need attention
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Management</Text>
        <View style={styles.menuList}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.title}
              style={styles.menuItem}
              onPress={() => navigateTo(item.route)}
              activeOpacity={0.7}
              testID={`admin-menu-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <View style={[styles.menuIconWrap, { backgroundColor: item.bg }]}>
                <item.icon size={22} color={item.color} />
              </View>
              <View style={styles.menuTextWrap}>
                <View style={styles.menuTitleRow}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  {item.badge ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <ChevronRight size={18} color={Colors.light.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Insights</Text>
          <View style={styles.insightRow}>
            <View style={styles.insightCard}>
              <BarChart3 size={20} color="#8B5CF6" />
              <Text style={styles.insightValue}>{stats.totalSwaps}</Text>
              <Text style={styles.insightLabel}>Swaps Completed</Text>
            </View>
            <View style={styles.insightCard}>
              <TrendingUp size={20} color="#10B981" />
              <Text style={styles.insightValue}>
                {stats.totalUsers > 0 ? (stats.totalSwaps / stats.totalUsers).toFixed(1) : '0'}
              </Text>
              <Text style={styles.insightLabel}>Avg Swaps/User</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  headerWrap: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#0F172A',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: {
    paddingVertical: 6,
    paddingRight: 12,
  },
  backText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '500' as const,
  },
  logoutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#1E293B',
    borderRadius: 10,
  },
  logoutText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  scroll: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: '47%' as any,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500' as const,
  },
  alertSection: {
    marginBottom: 24,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  alertIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#92400E',
  },
  alertDesc: {
    fontSize: 12,
    color: '#A16207',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#0F172A',
    marginBottom: 12,
  },
  menuList: {
    gap: 10,
    marginBottom: 28,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  menuIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuTextWrap: {
    flex: 1,
  },
  menuTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#0F172A',
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  badge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700' as const,
  },
  quickActions: {
    marginTop: 4,
  },
  insightRow: {
    flexDirection: 'row',
    gap: 12,
  },
  insightCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  insightValue: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#0F172A',
    marginTop: 8,
  },
  insightLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500' as const,
  },
});

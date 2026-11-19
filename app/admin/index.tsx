import { useCallback, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeTopInset } from '@/lib/safeArea';
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
  LogOut,
  Wallet,
  ShieldX,
  Award,
  Coins,
} from 'lucide-react-native';
import { useAdmin } from '../../providers/admin';
import { useEarnings } from '@/providers/earnings';
import { useSafety } from '@/providers/safety';
import Colors from '@/constants/colors';
import { useAlert } from '@/providers/alert';

export default function AdminDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isSmallScreen = windowWidth < 600;
  const safeTop = useSafeTopInset(isSmallScreen ? 8 : 14);
  const styles = useMemo(() => createStyles(isSmallScreen), [isSmallScreen]);
  const { stats, transactions, isLoading, isAdminAuthenticated, adminLogout } = useAdmin();
  const { pendingPayoutsCount } = useEarnings();
  const { pendingReportsCount } = useSafety();
  const { showAlert } = useAlert();

  // Redirect to login if not authenticated as admin
  useEffect(() => {
    if (!isAdminAuthenticated) {
      router.replace('/admin/login' as any);
    }
  }, [isAdminAuthenticated, router]);

  const navigateTo = useCallback((path: string) => {
    router.push(path as any);
  }, [router]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/home' as any);
    }
  }, [router]);

  const handleLogout = useCallback(() => {
    showAlert('Confirm Logout', 'Are you sure you want to log out of the Admin Panel?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await adminLogout();
          router.replace('/admin/login' as any);
        },
      },
    ]);
  }, [adminLogout, router, showAlert]);

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: '#3B82F6' },
    { label: 'Active', value: stats.activeUsers, icon: Activity, color: '#10B981' },
    { label: 'Banned', value: stats.bannedUsers, icon: AlertTriangle, color: '#EF4444' },
    { label: 'Total Exchanges', value: stats.totalSwaps, icon: ArrowLeftRight, color: '#8B5CF6' },
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
      title: 'Exchange Oversight',
      subtitle: 'Monitor active exchanges',
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
      title: 'Certification Approvals',
      subtitle: `${stats.pendingCertifications} pending skill certificate${stats.pendingCertifications !== 1 ? 's' : ''}`,
      icon: Award,
      color: '#0EA5E9',
      bg: '#E0F2FE',
      route: '/admin/certifications',
      badge: stats.pendingCertifications > 0 ? stats.pendingCertifications : undefined,
    },
    {
      title: 'Payout Approvals',
      subtitle: `${pendingPayoutsCount} pending request${pendingPayoutsCount !== 1 ? 's' : ''}`,
      icon: Wallet,
      color: '#6366F1',
      bg: '#EEF2FF',
      route: '/admin/payouts',
      badge: pendingPayoutsCount > 0 ? pendingPayoutsCount : undefined,
    },
    {
      title: 'User Transactions',
      subtitle: `${transactions?.length || 0} credit & payment movements`,
      icon: Coins,
      color: '#10B981',
      bg: '#ECFDF5',
      route: '/admin/transactions',
    },
    {
      title: 'Class Management',
      subtitle: 'Monitor and cancel group classes',
      icon: Users,
      color: '#F97316',
      bg: '#FFF7ED',
      route: '/admin/classes',
    },
    {
      title: 'User Reports',
      subtitle: `${pendingReportsCount} pending report${pendingReportsCount !== 1 ? 's' : ''}`,
      icon: ShieldX,
      color: '#EF4444',
      bg: '#FEF2F2',
      route: '/admin/reports',
      badge: pendingReportsCount > 0 ? pendingReportsCount : undefined,
    },
  ];

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.headerWrap, { paddingTop: safeTop }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} testID="admin-back">
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} testID="admin-logout">
            <LogOut size={16} color="#EF4444" />
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
                {stats.pendingReviews} reviews, {stats.pendingVerifications} verifications, and {pendingReportsCount} user reports need attention
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

const createStyles = (isSmallScreen: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  headerWrap: {
    paddingHorizontal: isSmallScreen ? 14 : 20,
    paddingBottom: isSmallScreen ? 14 : 20,
    backgroundColor: '#0F172A',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: isSmallScreen ? 10 : 16,
  },
  backBtn: {
    paddingVertical: isSmallScreen ? 4 : 6,
    paddingRight: 12,
  },
  backText: {
    color: '#94A3B8',
    fontSize: isSmallScreen ? 13 : 15,
    fontWeight: '500' as const,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: isSmallScreen ? 10 : 12,
    paddingVertical: isSmallScreen ? 4 : 6,
    borderRadius: 8,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: isSmallScreen ? 12 : 13,
    fontWeight: '600' as const,
  },
  headerTitle: {
    fontSize: isSmallScreen ? 20 : 28,
    fontWeight: '800' as const,
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: isSmallScreen ? 12 : 14,
    color: '#64748B',
    marginTop: isSmallScreen ? 2 : 4,
  },
  scroll: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: isSmallScreen ? 18 : 24,
    borderTopRightRadius: isSmallScreen ? 18 : 24,
  },
  scrollContent: {
    padding: isSmallScreen ? 12 : 20,
    paddingBottom: isSmallScreen ? 24 : 40,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: isSmallScreen ? 8 : 12,
    marginBottom: isSmallScreen ? 14 : 20,
  },
  statCard: {
    width: '47%' as any,
    backgroundColor: '#FFFFFF',
    borderRadius: isSmallScreen ? 12 : 16,
    padding: isSmallScreen ? 10 : 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconWrap: {
    width: isSmallScreen ? 30 : 36,
    height: isSmallScreen ? 30 : 36,
    borderRadius: isSmallScreen ? 8 : 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: isSmallScreen ? 8 : 12,
  },
  statValue: {
    fontSize: isSmallScreen ? 17 : 24,
    fontWeight: '700' as const,
    color: '#0F172A',
  },
  statLabel: {
    fontSize: isSmallScreen ? 10.5 : 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500' as const,
  },
  alertSection: {
    marginBottom: isSmallScreen ? 16 : 24,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: isSmallScreen ? 12 : 14,
    padding: isSmallScreen ? 12 : 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  alertIconWrap: {
    width: isSmallScreen ? 34 : 40,
    height: isSmallScreen ? 34 : 40,
    borderRadius: isSmallScreen ? 10 : 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: isSmallScreen ? 10 : 14,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: isSmallScreen ? 13 : 14,
    fontWeight: '700' as const,
    color: '#92400E',
  },
  alertDesc: {
    fontSize: isSmallScreen ? 11 : 12,
    color: '#A16207',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '700' as const,
    color: '#0F172A',
    marginBottom: isSmallScreen ? 8 : 12,
  },
  menuList: {
    gap: isSmallScreen ? 8 : 10,
    marginBottom: isSmallScreen ? 20 : 28,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: isSmallScreen ? 12 : 16,
    padding: isSmallScreen ? 12 : 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  menuIconWrap: {
    width: isSmallScreen ? 40 : 48,
    height: isSmallScreen ? 40 : 48,
    borderRadius: isSmallScreen ? 11 : 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: isSmallScreen ? 10 : 14,
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
    fontSize: isSmallScreen ? 13.5 : 15,
    fontWeight: '700' as const,
    color: '#0F172A',
  },
  menuSubtitle: {
    fontSize: isSmallScreen ? 11 : 12,
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
    fontSize: isSmallScreen ? 10 : 11,
    fontWeight: '700' as const,
  },
  quickActions: {
    marginTop: 4,
  },
  insightRow: {
    flexDirection: 'row',
    gap: isSmallScreen ? 8 : 12,
  },
  insightCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: isSmallScreen ? 12 : 16,
    padding: isSmallScreen ? 10 : 16,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  insightValue: {
    fontSize: isSmallScreen ? 16 : 22,
    fontWeight: '700' as const,
    color: '#0F172A',
    marginTop: isSmallScreen ? 4 : 8,
  },
  insightLabel: {
    fontSize: isSmallScreen ? 10 : 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500' as const,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
  },
});

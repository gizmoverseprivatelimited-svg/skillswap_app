import { View, Text, StyleSheet, SectionList, TouchableOpacity, RefreshControl, ScrollView, useWindowDimensions } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeTopInset } from '@/lib/safeArea';
import { ArrowLeft, Coins, Plus, Minus, Wallet, CreditCard, Sparkles, Gift, ShieldAlert } from 'lucide-react-native';
import { useMemo, useState, useCallback, useEffect } from 'react';
import Colors from '@/constants/colors';
import { formatPrice } from '@/constants/locale';
import { useCurrentUser } from '@/providers/current-user';
import { useEarnings } from '@/providers/earnings';

type HistoryFilter = 'all' | 'top_up' | 'earning' | 'payout';

type HistoryItem = {
  id: string;
  category: 'top_up' | 'earning' | 'payout' | 'bonus';
  title: string;
  subtitle: string;
  points: number;
  amount?: number;
  date: string;
  iconType: 'top_up' | 'earning' | 'payout' | 'subscription' | 'bonus' | 'adjustment';
};

const sourceLabels: Record<string, string> = {
  top_up: 'Credit Top-up',
  purchase: 'Credit Top-up',
  class_taught: 'Teaching Earnings',
  swap_completed: 'Session Fee',
  learner_bonus: 'Completion Bonus',
  monthly_subscription: 'Subscription Bonus',
  bonus: 'Bonus Credits',
  referral: 'Referral Reward',
  admin_adjustment: 'Admin Adjustment',
  refund: 'Enrollment Refund',
  payout: 'Payout',
};

const methodLabels: Record<string, string> = {
  store_credit: 'Store Credit',
  bank_transfer: 'Bank Transfer',
  upi: 'UPI Transfer',
  paypal: 'PayPal',
};

export default function EarningsHistoryScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const isSmallScreen = windowWidth < 600;
  const safeTop = useSafeTopInset(isSmallScreen ? 8 : 14);
  const { currentUser } = useCurrentUser();
  const { getUserTransactions, getUserPayouts, refreshUserEarnings } = useEarnings();
  const [activeFilter, setActiveFilter] = useState<HistoryFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    if (!currentUser?.id) return;
    setRefreshing(true);
    try {
      await refreshUserEarnings(currentUser.id);
    } catch (err) {
      console.error('[EarningsHistory] Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [currentUser?.id, refreshUserEarnings]);

  useEffect(() => {
    if (currentUser?.id) {
      refreshUserEarnings(currentUser.id);
    }
  }, [currentUser?.id, refreshUserEarnings]);

  const transactions = useMemo(
    () => (currentUser?.id ? getUserTransactions(currentUser.id) : []),
    [getUserTransactions, currentUser?.id],
  );
  const payouts = useMemo(
    () => (currentUser?.id ? getUserPayouts(currentUser.id) : []),
    [getUserPayouts, currentUser?.id],
  );

  const sections = useMemo(() => {
    const all: HistoryItem[] = [
      ...transactions
        .filter((t: any) => t.source !== 'payout')
        .map((t: any) => {
        const isTopUp = t.source === 'top_up' || t.source === 'purchase' || (t.source === 'bonus' && (t.description?.toLowerCase().includes('purchased') || t.description?.toLowerCase().includes('top-up')));
        const isSubscription = t.source === 'monthly_subscription';
        
        let category: HistoryItem['category'] = 'earning';
        let iconType: HistoryItem['iconType'] = 'earning';

        if (isTopUp) {
          category = 'top_up';
          iconType = 'top_up';
        } else if (isSubscription) {
          category = 'bonus';
          iconType = 'subscription';
        } else if (t.source === 'bonus' || t.source === 'referral' || t.source === 'learner_bonus') {
          category = 'bonus';
          iconType = 'bonus';
        } else if (t.source === 'refund' || t.description?.toLowerCase().includes('refund')) {
          category = 'top_up';
          iconType = 'top_up';
        } else if (t.source === 'admin_adjustment') {
          category = 'earning';
          iconType = 'adjustment';
        }

        const title = isTopUp 
          ? 'Credit Top-up' 
          : (sourceLabels[t.source] ?? (t.type === 'earned' ? 'Earned Credits' : 'Redeemed Credits'));

        return {
          id: t.id || t._id || Math.random().toString(),
          category,
          title,
          subtitle: t.description || 'Credit transaction',
          points: t.type === 'redeemed' ? -Math.abs(t.amount) : Math.abs(t.amount),
          date: t.timestamp || t.createdAt || new Date().toISOString(),
          iconType,
        };
      }),
      ...payouts
        .filter((p) => p.status !== 'rejected' && p.status !== 'cancelled')
        .map((p: any) => ({
          id: p.id || p._id || Math.random().toString(),
          category: 'payout' as const,
          title: `${methodLabels[p.method] ?? p.method} Payout`,
          subtitle: p.status === 'completed' ? 'Completed' : p.status === 'pending' ? 'Pending review' : p.status,
          points: -Math.abs(p.points || p.credits || 0),
          amount: p.amountCurrency ?? p.amount,
          date: p.createdAt || new Date().toISOString(),
          iconType: 'payout' as const,
        })),
    ];

    // Filter by active category tab
    const filtered = all.filter((item) => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'top_up') return item.category === 'top_up';
      if (activeFilter === 'earning') return item.category === 'earning' || item.category === 'bonus';
      if (activeFilter === 'payout') return item.category === 'payout';
      return true;
    });

    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const today: HistoryItem[] = [];
    const week: HistoryItem[] = [];
    const earlier: HistoryItem[] = [];
    const now = Date.now();
    filtered.forEach((item) => {
      const diff = now - new Date(item.date).getTime();
      if (diff < 24 * 60 * 60 * 1000) today.push(item);
      else if (diff < 7 * 24 * 60 * 60 * 1000) week.push(item);
      else earlier.push(item);
    });

    const result: { title: string; data: HistoryItem[] }[] = [];
    if (today.length) result.push({ title: 'Today', data: today });
    if (week.length) result.push({ title: 'This Week', data: week });
    if (earlier.length) result.push({ title: 'Earlier', data: earlier });
    return result;
  }, [transactions, payouts, activeFilter]);

  const renderIcon = (item: HistoryItem) => {
    if (item.iconType === 'top_up') {
      return (
        <View style={[s.itemIcon, { backgroundColor: '#EEF2FF' }]}>
          <CreditCard size={18} color="#6366F1" />
        </View>
      );
    }
    if (item.iconType === 'subscription') {
      return (
        <View style={[s.itemIcon, { backgroundColor: '#F5F3FF' }]}>
          <Gift size={18} color="#8B5CF6" />
        </View>
      );
    }
    if (item.iconType === 'payout') {
      return (
        <View style={[s.itemIcon, { backgroundColor: '#FEF3C7' }]}>
          <Wallet size={18} color="#F59E0B" />
        </View>
      );
    }
    if (item.iconType === 'adjustment') {
      return (
        <View style={[s.itemIcon, { backgroundColor: '#F1F5F9' }]}>
          <ShieldAlert size={18} color="#64748B" />
        </View>
      );
    }
    if (item.points > 0) {
      return (
        <View style={[s.itemIcon, { backgroundColor: '#ECFDF5' }]}>
          <Plus size={18} color="#10B981" />
        </View>
      );
    }
    return (
      <View style={[s.itemIcon, { backgroundColor: '#FEE2E2' }]}>
        <Minus size={18} color="#EF4444" />
      </View>
    );
  };

  return (
    <View style={s.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, isSmallScreen && s.headerMobile, { paddingTop: safeTop }]}>
        <TouchableOpacity onPress={() => router.back()} style={[s.backBtn, isSmallScreen && s.backBtnMobile]}>
          <ArrowLeft size={isSmallScreen ? 18 : 22} color={Colors.light.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, isSmallScreen && s.headerTitleMobile]}>Credits History</Text>
        <View style={{ width: isSmallScreen ? 34 : 44 }} />
      </View>

      {/* Filter Tabs */}
      <View style={s.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.filterScroll, isSmallScreen && s.filterScrollMobile]}>
          <TouchableOpacity
            style={[s.filterChip, isSmallScreen && s.filterChipMobile, activeFilter === 'all' && s.filterChipActive]}
            onPress={() => setActiveFilter('all')}
          >
            <Text style={[s.filterChipText, isSmallScreen && s.filterChipTextMobile, activeFilter === 'all' && s.filterChipTextActive]}>All Activity</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.filterChip, isSmallScreen && s.filterChipMobile, activeFilter === 'top_up' && s.filterChipActive]}
            onPress={() => setActiveFilter('top_up')}
          >
            <Text style={[s.filterChipText, isSmallScreen && s.filterChipTextMobile, activeFilter === 'top_up' && s.filterChipTextActive]}>💳 Top-ups</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.filterChip, isSmallScreen && s.filterChipMobile, activeFilter === 'earning' && s.filterChipActive]}
            onPress={() => setActiveFilter('earning')}
          >
            <Text style={[s.filterChipText, isSmallScreen && s.filterChipTextMobile, activeFilter === 'earning' && s.filterChipTextActive]}>✨ Earnings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.filterChip, isSmallScreen && s.filterChipMobile, activeFilter === 'payout' && s.filterChipActive]}
            onPress={() => setActiveFilter('payout')}
          >
            <Text style={[s.filterChipText, isSmallScreen && s.filterChipTextMobile, activeFilter === 'payout' && s.filterChipTextActive]}>💰 Payouts</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6366F1']} />
        }
        renderSectionHeader={({ section: { title } }) => (
          <Text style={[s.sectionHeader, isSmallScreen && s.sectionHeaderMobile]}>{title}</Text>
        )}
        renderItem={({ item }) => (
          <View style={[s.itemCard, isSmallScreen && s.itemCardMobile]}>
            {renderIcon(item)}
            <View style={{ flex: 1 }}>
              <View style={s.itemTitleRow}>
                <Text style={[s.itemTitle, isSmallScreen && s.itemTitleMobile]}>{item.title}</Text>
                {item.category === 'top_up' && (
                  <View style={s.topUpBadge}>
                    <Text style={s.topUpBadgeText}>Top-up</Text>
                  </View>
                )}
              </View>
              <Text style={[s.itemSubtitle, isSmallScreen && s.itemSubtitleMobile]}>{item.subtitle}</Text>
              <Text style={[s.itemDate, isSmallScreen && s.itemDateMobile]}>
                {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <View style={s.itemRight}>
              <Text style={[s.itemPoints, isSmallScreen && s.itemPointsMobile, { color: item.points > 0 ? '#10B981' : '#EF4444' }]}>
                {item.points > 0 ? '+' : ''}{item.points} credits
              </Text>
              {item.amount !== undefined && (
                <Text style={[s.itemAmount, isSmallScreen && s.itemAmountMobile]}>{formatPrice(item.amount)}</Text>
              )}
            </View>
          </View>
        )}
        contentContainerStyle={{ paddingHorizontal: isSmallScreen ? 12 : 20, paddingBottom: 40 }}
        ItemSeparatorComponent={() => <View style={{ height: isSmallScreen ? 8 : 10 }} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={[s.emptyWrap, isSmallScreen && { paddingVertical: 40 }]}>
            <Coins size={isSmallScreen ? 32 : 40} color={Colors.light.textTertiary} />
            <Text style={[s.emptyTitle, isSmallScreen && { fontSize: 15 }]}>
              {activeFilter === 'top_up'
                ? 'No Top-ups Yet'
                : activeFilter === 'payout'
                ? 'No Payouts Yet'
                : 'No History Yet'}
            </Text>
            <Text style={[s.emptyDesc, isSmallScreen && { fontSize: 12, paddingHorizontal: 20 }]}>
              {activeFilter === 'top_up'
                ? 'Top up credits in the Store to request sessions and enroll in classes.'
                : 'Complete swaps, teach classes, or top up in the Store to see activity here!'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.backgroundSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.light.card, borderBottomWidth: 1, borderBottomColor: Colors.light.borderLight },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.light.backgroundTertiary, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.light.text },
  filterContainer: { backgroundColor: Colors.light.card, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.light.borderLight },
  filterScroll: { paddingHorizontal: 16, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.light.backgroundSecondary, borderWidth: 1, borderColor: Colors.light.borderLight },
  filterChipActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  filterChipText: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.textSecondary },
  filterChipTextActive: { color: '#FFFFFF', fontWeight: '700' as const },
  sectionHeader: { fontSize: 14, fontWeight: '700' as const, color: Colors.light.textSecondary, marginTop: 16, marginBottom: 10, paddingHorizontal: 4 },
  itemCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.light.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.light.borderLight },
  itemIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  itemTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.light.text },
  topUpBadge: { backgroundColor: '#EEF2FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  topUpBadgeText: { fontSize: 10, fontWeight: '700' as const, color: '#6366F1' },
  itemSubtitle: { fontSize: 12, color: Colors.light.textSecondary, marginBottom: 3 },
  itemDate: { fontSize: 11, color: Colors.light.textTertiary },
  itemRight: { alignItems: 'flex-end' },
  itemPoints: { fontSize: 15, fontWeight: '800' as const, marginBottom: 2 },
  itemAmount: { fontSize: 12, color: Colors.light.textSecondary, fontWeight: '600' as const },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.light.text },
  emptyDesc: { fontSize: 14, color: Colors.light.textSecondary, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },
  headerMobile: { paddingHorizontal: 12, paddingVertical: 10 },
  backBtnMobile: { width: 34, height: 34, borderRadius: 17 },
  headerTitleMobile: { fontSize: 16 },
  filterScrollMobile: { paddingHorizontal: 12, gap: 6 },
  filterChipMobile: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 },
  filterChipTextMobile: { fontSize: 11.5 },
  sectionHeaderMobile: { fontSize: 12.5, marginTop: 12, marginBottom: 6 },
  itemCardMobile: { padding: 10, borderRadius: 10, gap: 8 },
  itemTitleMobile: { fontSize: 13 },
  itemSubtitleMobile: { fontSize: 11, marginBottom: 2 },
  itemDateMobile: { fontSize: 10 },
  itemPointsMobile: { fontSize: 13, marginBottom: 1 },
  itemAmountMobile: { fontSize: 11 },
});

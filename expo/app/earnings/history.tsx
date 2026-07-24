import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SectionList } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Coins, Plus, Minus, Wallet, TrendingUp } from 'lucide-react-native';
import { useMemo } from 'react';
import Colors from '@/constants/colors';
import { formatPrice } from '@/constants/locale';
import { useCurrentUser } from '@/providers/current-user';
import { useEarnings } from '@/providers/earnings';
import type { PointTransaction, PayoutRequest } from '@/types';

type HistoryItem = {
  id: string;
  type: 'earning' | 'payout';
  title: string;
  subtitle: string;
  points: number;
  amount?: number;
  date: string;
  icon: 'plus' | 'minus' | 'wallet';
};

const sourceLabels: Record<string, string> = {
  swap_completed: 'Swap Completed',
  class_taught: 'Class Taught',
  monthly_subscription: 'Subscription Bonus',
  bonus: 'Bonus Points',
  referral: 'Referral Reward',
  admin_adjustment: 'Admin Adjustment',
};

const methodLabels: Record<string, string> = {
  store_credit: 'Store Credit',
  bank_transfer: 'Bank Transfer',
  upi: 'UPI Transfer',
  paypal: 'PayPal',
};

export default function EarningsHistoryScreen() {
  const router = useRouter();
  const { currentUser } = useCurrentUser();
  const { getUserTransactions, getUserPayouts } = useEarnings();

  const transactions = useMemo(() => getUserTransactions(currentUser.id), [getUserTransactions, currentUser.id]);
  const payouts = useMemo(() => getUserPayouts(currentUser.id), [getUserPayouts, currentUser.id]);

  const sections = useMemo(() => {
    const all: HistoryItem[] = [
      ...transactions.map((t: PointTransaction) => ({
        id: t.id,
        type: 'earning' as const,
        title: sourceLabels[t.source] ?? t.source,
        subtitle: t.description,
        points: t.amount,
        date: t.createdAt,
        icon: 'plus' as const,
      })),
      ...payouts
        .filter((p) => p.status !== 'rejected' && p.status !== 'cancelled')
        .map((p: PayoutRequest) => ({
          id: p.id,
          type: 'payout' as const,
          title: `${methodLabels[p.method] ?? p.method} Payout`,
          subtitle: p.status === 'completed' ? 'Completed' : p.status === 'pending' ? 'Pending review' : p.status,
          points: -p.points,
          amount: p.amountCurrency,
          date: p.createdAt,
          icon: p.method === 'store_credit' ? ('wallet' as const) : ('minus' as const),
        })),
    ];
    all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const today: HistoryItem[] = [];
    const week: HistoryItem[] = [];
    const earlier: HistoryItem[] = [];
    const now = Date.now();
    all.forEach((item) => {
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
  }, [transactions, payouts]);

  return (
    <View style={s.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Points History</Text>
        <View style={{ width: 44 }} />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={s.sectionHeader}>{title}</Text>
        )}
        renderItem={({ item }) => (
          <View style={s.itemCard}>
            <View style={[s.itemIcon, { backgroundColor: item.points > 0 ? '#ECFDF5' : item.icon === 'wallet' ? '#FEF3C7' : '#FEE2E2' }]}>
              {item.points > 0 ? (
                <Plus size={18} color="#10B981" />
              ) : item.icon === 'wallet' ? (
                <Wallet size={18} color="#F59E0B" />
              ) : (
                <Minus size={18} color="#EF4444" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.itemTitle}>{item.title}</Text>
              <Text style={s.itemSubtitle} numberOfLines={1}>{item.subtitle}</Text>
              <Text style={s.itemDate}>
                {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </View>
            <View style={s.itemRight}>
              <Text style={[s.itemPoints, { color: item.points > 0 ? '#10B981' : '#EF4444' }]}>
                {item.points > 0 ? '+' : ''}{item.points} pts
              </Text>
              {item.amount !== undefined && (
                <Text style={s.itemAmount}>{formatPrice(item.amount)}</Text>
              )}
            </View>
          </View>
        )}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Coins size={40} color={Colors.light.textTertiary} />
            <Text style={s.emptyTitle}>No History Yet</Text>
            <Text style={s.emptyDesc}>Complete swaps and teach classes to start earning points!</Text>
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
  sectionHeader: { fontSize: 14, fontWeight: '700' as const, color: Colors.light.textSecondary, marginTop: 16, marginBottom: 10, paddingHorizontal: 4 },
  itemCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.light.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.light.borderLight },
  itemIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.light.text, marginBottom: 2 },
  itemSubtitle: { fontSize: 12, color: Colors.light.textSecondary, marginBottom: 2 },
  itemDate: { fontSize: 11, color: Colors.light.textTertiary },
  itemRight: { alignItems: 'flex-end' },
  itemPoints: { fontSize: 15, fontWeight: '800' as const, marginBottom: 2 },
  itemAmount: { fontSize: 12, color: Colors.light.textSecondary, fontWeight: '600' as const },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.light.text },
  emptyDesc: { fontSize: 14, color: Colors.light.textSecondary, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },
});

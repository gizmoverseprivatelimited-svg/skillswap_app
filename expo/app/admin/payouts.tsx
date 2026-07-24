import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Wallet,
  Check,
  X,
  Clock,
  TrendingUp,
  Coins,
  ExternalLink,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import Colors from '@/constants/colors';
import { formatPrice } from '@/constants/locale';
import { useAdmin } from '@/providers/admin';
import { useEarnings } from '@/providers/earnings';
import type { PayoutRequest, PayoutStatus } from '@/types';

const statusColors: Record<PayoutStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: '#FFFBEB', text: '#92400E', label: 'Pending' },
  approved: { bg: '#DBEAFE', text: '#1E40AF', label: 'Approved' },
  processing: { bg: '#E0E7FF', text: '#3730A3', label: 'Processing' },
  completed: { bg: '#ECFDF5', text: '#065F46', label: 'Completed' },
  rejected: { bg: '#FEE2E2', text: '#991B1B', label: 'Rejected' },
  cancelled: { bg: '#F1F5F9', text: '#475569', label: 'Cancelled' },
};

const methodLabels: Record<string, string> = {
  store_credit: 'Store Credit',
  bank_transfer: 'Bank Transfer',
  upi: 'UPI Transfer',
  paypal: 'PayPal',
};

type Filter = 'all' | 'pending' | 'completed';

export default function AdminPayoutsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAdminAuthenticated } = useAdmin();
  const { payouts, approvePayout, rejectPayout, markPayoutCompleted, pendingPayoutsCount, totalPayoutsAmount } = useEarnings();
  const [filter, setFilter] = useState<Filter>('pending');
  const [selectedPayout, setSelectedPayout] = useState<PayoutRequest | null>(null);

  const filteredPayouts = useMemo(() => {
    if (filter === 'all') return payouts;
    return payouts.filter((p) => p.status === filter);
  }, [payouts, filter]);

  const handleApprove = (payout: PayoutRequest) => {
    Alert.alert('Approve Payout?', `Approve ${payout.points} points (${formatPrice(payout.amountCurrency)}) for ${payout.userName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: () => {
          approvePayout({ payoutId: payout.id, reviewedBy: 'admin' });
          setSelectedPayout(null);
        },
      },
    ]);
  };

  const handleReject = (payout: PayoutRequest) => {
    Alert.alert(
      'Reject Payout?',
      `Reject this payout request from ${payout.userName}? Points will be returned to their balance.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => {
            rejectPayout({ payoutId: payout.id, reviewedBy: 'admin', rejectionReason: 'Rejected by admin' });
            setSelectedPayout(null);
          },
        },
      ],
    );
  };

  const handleComplete = (payout: PayoutRequest) => {
    const ref = `TXN-${Date.now()}`;
    markPayoutCompleted(payout.id, ref);
    Alert.alert('Payout Completed', `Reference: ${ref}`);
    setSelectedPayout(null);
  };

  if (!isAdminAuthenticated) {
    return <View style={s.container} />;
  }

  return (
    <View style={s.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Payout Approvals</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Clock size={18} color="#F59E0B" />
          <Text style={s.statValue}>{pendingPayoutsCount}</Text>
          <Text style={s.statLabel}>Pending</Text>
        </View>
        <View style={s.statCard}>
          <Check size={18} color="#10B981" />
          <Text style={s.statValue}>{payouts.filter((p) => p.status === 'completed').length}</Text>
          <Text style={s.statLabel}>Completed</Text>
        </View>
        <View style={s.statCard}>
          <Coins size={18} color="#6366F1" />
          <Text style={s.statValue}>{formatPrice(totalPayoutsAmount)}</Text>
          <Text style={s.statLabel}>Total Paid</Text>
        </View>
      </View>

      <View style={s.filterRow}>
        {(['pending', 'completed', 'all'] as Filter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[s.filterTab, filter === f && s.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.filterText, filter === f && s.filterTextActive]}>
              {f === 'pending' ? 'Pending' : f === 'completed' ? 'Completed' : 'All'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {filteredPayouts.length === 0 ? (
          <View style={s.emptyWrap}>
            <Wallet size={40} color="#64748B" />
            <Text style={s.emptyTitle}>No Payouts</Text>
            <Text style={s.emptyDesc}>No {filter !== 'all' ? filter : ''} payout requests to display.</Text>
          </View>
        ) : (
          <View style={s.payoutList}>
            {filteredPayouts.map((payout) => {
              const sc = statusColors[payout.status];
              return (
                <View key={payout.id} style={s.payoutCard}>
                  <Image source={{ uri: payout.userAvatar }} style={s.avatar} />
                  <View style={{ flex: 1 }}>
                    <View style={s.payoutHeader}>
                      <Text style={s.payoutUser}>{payout.userName}</Text>
                      <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                        <Text style={[s.statusText, { color: sc.text }]}>{sc.label}</Text>
                      </View>
                    </View>
                    <Text style={s.payoutMethod}>{methodLabels[payout.method]}</Text>
                    <Text style={s.payoutAmount}>
                      {payout.points} pts → {formatPrice(payout.amountCurrency)}
                    </Text>
                    <Text style={s.payoutDate}>
                      {new Date(payout.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                  {payout.status === 'pending' && (
                    <View style={s.actionRow}>
                      <TouchableOpacity style={s.approveBtn} onPress={() => handleApprove(payout)}>
                        <Check size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                      <TouchableOpacity style={s.rejectBtn} onPress={() => handleReject(payout)}>
                        <X size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  )}
                  {payout.status === 'approved' && (
                    <TouchableOpacity style={s.completeBtn} onPress={() => handleComplete(payout)}>
                      <Text style={s.completeBtnText}>Mark Paid</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' as const, color: '#FFFFFF' },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#1E293B', borderRadius: 14, padding: 12, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 18, fontWeight: '800' as const, color: '#FFFFFF' },
  statLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '500' as const },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 16 },
  filterTab: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#1E293B', alignItems: 'center' },
  filterTabActive: { backgroundColor: '#6366F1' },
  filterText: { fontSize: 13, fontWeight: '600' as const, color: '#94A3B8' },
  filterTextActive: { color: '#FFFFFF' },
  scroll: { flex: 1, backgroundColor: '#F8FAFC', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700' as const, color: '#0F172A' },
  emptyDesc: { fontSize: 14, color: '#64748B', textAlign: 'center' },
  payoutList: { padding: 20, gap: 12 },
  payoutCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  payoutHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  payoutUser: { fontSize: 15, fontWeight: '700' as const, color: '#0F172A', flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' as const },
  payoutMethod: { fontSize: 13, color: '#64748B', marginBottom: 2 },
  payoutAmount: { fontSize: 15, fontWeight: '700' as const, color: '#0F172A', marginBottom: 2 },
  payoutDate: { fontSize: 11, color: '#94A3B8' },
  actionRow: { flexDirection: 'row', gap: 8 },
  approveBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  completeBtn: { backgroundColor: '#6366F1', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  completeBtnText: { fontSize: 13, fontWeight: '700' as const, color: '#FFFFFF' },
});

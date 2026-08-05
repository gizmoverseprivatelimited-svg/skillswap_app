import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Wallet,
  Check,
  X,
  Clock,
  Coins,
  CreditCard,
  Building2,
  Send,
  AlertCircle,
  User as UserIcon,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import Colors from '@/constants/colors';
import { formatPrice } from '@/constants/locale';
import { useAdmin } from '@/providers/admin';
import { useEarnings } from '@/providers/earnings';
import { useAlert } from '@/providers/alert';
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
  const { showAlert } = useAlert();
  const [filter, setFilter] = useState<Filter>('pending');
  const [payoutToApprove, setPayoutToApprove] = useState<PayoutRequest | null>(null);
  const [isApproving, setIsApproving] = useState<boolean>(false);

  const filteredPayouts = useMemo(() => {
    const list = filter === 'all' ? payouts : payouts.filter((p) => p.status === filter);
    const map = new Map<string, PayoutRequest>();
    list.forEach((p) => {
      const key = p.id || (p as any)._id;
      if (key && !map.has(key)) {
        map.set(key, p);
      }
    });
    return Array.from(map.values());
  }, [payouts, filter]);

  const handleConfirmApprove = async () => {
    if (!payoutToApprove) return;
    try {
      setIsApproving(true);
      await approvePayout({ payoutId: payoutToApprove.id || (payoutToApprove as any)._id, reviewedBy: 'admin' });
      setPayoutToApprove(null);
    } catch (err) {
      console.error('[AdminPayouts] Approval failed:', err);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = (payout: PayoutRequest) => {
    const methodName = methodLabels[payout.method] || payout.method;
    showAlert(
      'Reject Payout Request',
      `Reject payout of ${payout.credits || payout.points} credits (${methodName}) for ${payout.userName}? Credits will be restored to their balance.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject Request',
          style: 'destructive',
          onPress: async () => {
            await rejectPayout({ payoutId: payout.id || (payout as any)._id, reviewedBy: 'admin', rejectionReason: 'Rejected by admin' });
          },
        },
      ]
    );
  };

  const handleComplete = (payout: PayoutRequest) => {
    const ref = `TXN-${Date.now()}`;
    showAlert(
      'Mark Payout Completed',
      `Confirm manual transfer completion for ${payout.userName} (${methodLabels[payout.method]})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Completed',
          onPress: async () => {
            await markPayoutCompleted({ payoutId: payout.id || (payout as any)._id, reviewedBy: 'admin', transactionRef: ref });
            showAlert('Payout Completed', `Transaction Reference: ${ref}`);
          },
        },
      ]
    );
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
            {filteredPayouts.map((payout, idx) => {
              if (!payout) return null;
              const statusKey = (payout.status || 'pending') as PayoutStatus;
              const sc = statusColors[statusKey] || { bg: '#F1F5F9', text: '#475569', label: 'Pending' };
              const keyVal = payout.id || (payout as any)._id || `payout-${idx}`;
              const formattedDate = payout.createdAt && !isNaN(new Date(payout.createdAt).getTime())
                ? new Date(payout.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : 'Recently';
              const displayAmount = payout.amountCurrency ?? payout.amount ?? 0;

              return (
                <View key={keyVal} style={s.payoutCard}>
                  <Image source={{ uri: payout.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150' }} style={s.avatar} />
                  <View style={{ flex: 1 }}>
                    <View style={s.payoutHeader}>
                      <Text style={s.payoutUser}>{payout.userName || 'User'}</Text>
                      <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                        <Text style={[s.statusText, { color: sc.text }]}>{sc.label}</Text>
                      </View>
                    </View>
                    <Text style={s.payoutMethod}>{methodLabels[payout.method || ''] || payout.method || 'Payout'}</Text>
                    <Text style={s.payoutAmount}>
                      {payout.credits || payout.points || 0} credits → {formatPrice(displayAmount)}
                    </Text>
                    <Text style={s.payoutDate}>{formattedDate}</Text>
                  </View>
                  {payout.status === 'pending' && (
                    <View style={s.actionRow}>
                      <TouchableOpacity style={s.approveBtn} onPress={() => setPayoutToApprove(payout)}>
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

      {/* 🌟 APPROVAL CONFIRMATION MODAL */}
      <Modal
        visible={!!payoutToApprove}
        transparent
        animationType="fade"
        onRequestClose={() => setPayoutToApprove(null)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <View style={s.modalIconWrap}>
                <Check size={20} color="#10B981" />
              </View>

              <Text style={s.modalTitle}>Approve Payout Request</Text>
            </View>

            {payoutToApprove && (
              <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                {/* User Header Card */}
                <View style={s.modalUserCard}>
                  <Image
                    source={{ uri: payoutToApprove.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150' }}
                    style={s.modalAvatar}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={s.modalUserName}>{payoutToApprove.userName}</Text>
                    <Text style={s.modalUserSub}>Requested Payout</Text>
                  </View>
                  <View style={s.methodBadge}>
                    <Text style={s.methodBadgeText}>{methodLabels[payoutToApprove.method] || payoutToApprove.method}</Text>
                  </View>
                </View>

                {/* Amount Display */}
                <View style={s.modalAmountCard}>
                  <Text style={s.modalAmountLabel}>Payout Amount</Text>
                  <Text style={s.modalAmountValue}>{formatPrice(payoutToApprove.amountCurrency ?? payoutToApprove.amount)}</Text>
                  <Text style={s.modalAmountSub}>{payoutToApprove.credits || payoutToApprove.points} credits to be redeemed</Text>
                </View>

                {/* Payment Details Section */}
                <Text style={s.detailsHeading}>Payment Details</Text>
                <View style={s.detailsCard}>
                  <View style={s.detailRow}>
                    <Text style={s.detailLabel}>Payout Method</Text>
                    <Text style={s.detailValue}>{methodLabels[payoutToApprove.method] || payoutToApprove.method}</Text>
                  </View>

                  {payoutToApprove.method === 'upi' && (
                    <View style={s.detailRow}>
                      <Text style={s.detailLabel}>UPI ID</Text>
                      <Text style={[s.detailValue, { color: '#6366F1', fontWeight: '700' }]}>
                        {payoutToApprove.payoutDetails?.upiId || 'Not provided'}
                      </Text>
                    </View>
                  )}

                  {payoutToApprove.method === 'bank_transfer' && (
                    <>
                      <View style={s.detailRow}>
                        <Text style={s.detailLabel}>Account Holder</Text>
                        <Text style={s.detailValue}>
                          {payoutToApprove.payoutDetails?.accountName || payoutToApprove.userName}
                        </Text>
                      </View>
                      <View style={s.detailRow}>
                        <Text style={s.detailLabel}>Account Number</Text>
                        <Text style={[s.detailValue, { fontWeight: '700' }]}>
                          {payoutToApprove.payoutDetails?.accountNumber || 'Not provided'}
                        </Text>
                      </View>
                      <View style={s.detailRow}>
                        <Text style={s.detailLabel}>IFSC Code</Text>
                        <Text style={[s.detailValue, { fontWeight: '700' }]}>
                          {payoutToApprove.payoutDetails?.ifscCode || 'Not provided'}
                        </Text>
                      </View>
                    </>
                  )}

                  {payoutToApprove.method === 'paypal' && (
                    <View style={s.detailRow}>
                      <Text style={s.detailLabel}>PayPal Email</Text>
                      <Text style={[s.detailValue, { color: '#6366F1', fontWeight: '700' }]}>
                        {payoutToApprove.payoutDetails?.paypalEmail || 'Not provided'}
                      </Text>
                    </View>
                  )}

                  {payoutToApprove.method === 'store_credit' && (
                    <View style={s.detailRow}>
                      <Text style={s.detailLabel}>Store Account</Text>
                      <Text style={s.detailValue}>Instant Credit Added to Account</Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}

            {/* Modal Actions */}
            <View style={s.modalActionRow}>
              <TouchableOpacity
                style={s.modalCancelBtn}
                onPress={() => setPayoutToApprove(null)}
                disabled={isApproving}
              >
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.modalConfirmBtn}
                onPress={handleConfirmApprove}
                disabled={isApproving}
              >
                <Text style={s.modalConfirmText}>{isApproving ? 'Approving...' : 'Confirm Approval'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { width: 440, maxWidth: '100%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 5 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  modalIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '800' as const, color: '#0F172A', flex: 1 },
  modalUserCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 14, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  modalAvatar: { width: 42, height: 42, borderRadius: 21 },
  modalUserName: { fontSize: 15, fontWeight: '700' as const, color: '#0F172A' },
  modalUserSub: { fontSize: 12, color: '#64748B' },
  methodBadge: { backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  methodBadgeText: { fontSize: 11, fontWeight: '700' as const, color: '#4F46E5' },
  modalAmountCard: { backgroundColor: '#EEF2FF', padding: 14, borderRadius: 14, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#C7D2FE' },
  modalAmountLabel: { fontSize: 12, color: '#4F46E5', fontWeight: '600' as const, marginBottom: 2 },
  modalAmountValue: { fontSize: 24, fontWeight: '800' as const, color: '#312E81' },
  modalAmountSub: { fontSize: 12, color: '#6366F1', fontWeight: '500' as const, marginTop: 2 },
  detailsHeading: { fontSize: 13, fontWeight: '700' as const, color: '#0F172A', marginBottom: 8 },
  detailsCard: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12, gap: 10, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: 13, color: '#64748B', fontWeight: '500' as const },
  detailValue: { fontSize: 13, color: '#0F172A', fontWeight: '600' as const },
  modalActionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center' },
  modalCancelText: { fontSize: 14, fontWeight: '700' as const, color: '#475569' },
  modalConfirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#10B981', alignItems: 'center' },
  modalConfirmText: { fontSize: 14, fontWeight: '700' as const, color: '#FFFFFF' },
});

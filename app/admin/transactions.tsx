import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Image,
  Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  Coins,
  IndianRupee,
  Calendar,
  Filter,
  RefreshCw,
  Sparkles,
  User as UserIcon,
  CreditCard,
  CheckCircle2,
  Clock,
  Zap,
  TrendingUp,
  TrendingDown,
  Layers,
  HelpCircle,
  X,
} from 'lucide-react-native';
import { useAdmin, type AdminTransaction } from '../../providers/admin';
import Colors from '@/constants/colors';
import { resolveImageUrl } from '@/lib/resolveImageUrl';

const SOURCE_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  swap_completed: { label: 'Skill Swap', bg: '#EFF6FF', color: '#2563EB' },
  class_taught: { label: 'Class Taught', bg: '#ECFDF5', color: '#059669' },
  class_enrollment: { label: 'Class Enrolled', bg: '#FEF3C7', color: '#D97706' },
  monthly_subscription: { label: 'Subscription', bg: '#F5F3FF', color: '#7C3AED' },
  top_up: { label: 'Store Top-up', bg: '#E0F2FE', color: '#0284C7' },
  purchase: { label: 'Pack Purchase', bg: '#E0E7FF', color: '#4338CA' },
  payout: { label: 'Creator Payout', bg: '#FFF1F2', color: '#E11D48' },
  bonus: { label: 'Reward Bonus', bg: '#FDF2F8', color: '#DB2777' },
  referral: { label: 'Referral', bg: '#F0FDF4', color: '#16A34A' },
  admin_adjustment: { label: 'Admin Adjustment', bg: '#F8FAFC', color: '#475569' },
  learner_bonus: { label: 'Learner Bonus', bg: '#FDF4FF', color: '#C026D3' },
};

export default function AdminTransactionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { transactions, transactionStats, fetchTransactions, isAdminAuthenticated } = useAdmin();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'earned' | 'redeemed' | 'money'>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!isAdminAuthenticated) {
      router.replace('/admin/login' as any);
    }
  }, [isAdminAuthenticated, router]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchTransactions();
    setIsRefreshing(false);
  }, [fetchTransactions]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/admin' as any);
    }
  }, [router]);

  const sourceOptions = useMemo(() => {
    return [
      { key: 'all', label: 'All Sources' },
      { key: 'swap_completed', label: 'Skill Swaps' },
      { key: 'class_taught', label: 'Classes Taught' },
      { key: 'top_up', label: 'Store Top-ups' },
      { key: 'monthly_subscription', label: 'Subscriptions' },
      { key: 'payout', label: 'Payouts' },
      { key: 'bonus', label: 'Bonuses & Rewards' },
    ];
  }, []);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Filter by type
      if (selectedType === 'earned' && tx.type !== 'earned') return false;
      if (selectedType === 'redeemed' && tx.type !== 'redeemed') return false;
      if (selectedType === 'money' && !tx.isMoneyPayment) return false;

      // Filter by source
      if (selectedSource !== 'all') {
        if (selectedSource === 'bonus') {
          if (tx.source !== 'bonus' && tx.source !== 'referral' && tx.source !== 'learner_bonus') return false;
        } else if (tx.source !== selectedSource) {
          return false;
        }
      }

      // Filter by search query
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = tx.userName?.toLowerCase().includes(q);
        const matchEmail = tx.userEmail?.toLowerCase().includes(q);
        const matchUsername = tx.userUsername?.toLowerCase().includes(q);
        const matchDesc = tx.description?.toLowerCase().includes(q);
        const matchId = tx.id?.toLowerCase().includes(q) || tx.paymentOrderId?.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchUsername && !matchDesc && !matchId) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, selectedType, selectedSource, searchQuery]);

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.headerWrap, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7} testID="admin-transactions-back">
            <ArrowLeft size={20} color="#FFFFFF" />
            <Text style={styles.backText}>Dashboard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleRefresh}
            style={styles.refreshBtn}
            disabled={isRefreshing}
            activeOpacity={0.7}
            testID="admin-transactions-refresh"
          >
            <RefreshCw size={16} color="#FFFFFF" style={isRefreshing ? styles.spinning : undefined} />
            <Text style={styles.refreshBtnText}>{isRefreshing ? 'Syncing...' : 'Refresh'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>User Transactions</Text>
        <Text style={styles.headerSubtitle}>
          Real-time ledger of all user credit movements, earnings, redemptions & purchases
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.light.primary} />}
      >
        {/* KPI Cards Grid */}
        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, { borderColor: '#BBF7D0' }]}>
            <View style={[styles.kpiIconWrap, { backgroundColor: '#DCFCE7' }]}>
              <ArrowUpRight size={18} color="#16A34A" />
            </View>
            <Text style={styles.kpiValue}>+{transactionStats.totalCreditsEarned.toLocaleString()}</Text>
            <Text style={styles.kpiLabel}>Credits Earned (+)</Text>
          </View>

          <View style={[styles.kpiCard, { borderColor: '#FED7AA' }]}>
            <View style={[styles.kpiIconWrap, { backgroundColor: '#FFEDD5' }]}>
              <ArrowDownLeft size={18} color="#EA580C" />
            </View>
            <Text style={styles.kpiValue}>-{transactionStats.totalCreditsRedeemed.toLocaleString()}</Text>
            <Text style={styles.kpiLabel}>Credits Spent (-)</Text>
          </View>

          <View style={[styles.kpiCard, { borderColor: '#C7D2FE' }]}>
            <View style={[styles.kpiIconWrap, { backgroundColor: '#E0E7FF' }]}>
              <IndianRupee size={18} color="#4F46E5" />
            </View>
            <Text style={styles.kpiValue}>₹{transactionStats.totalMoneyVolume.toLocaleString('en-IN')}</Text>
            <Text style={styles.kpiLabel}>Cash Volume (PAID)</Text>
          </View>

          <View style={[styles.kpiCard, { borderColor: '#E2E8F0' }]}>
            <View style={[styles.kpiIconWrap, { backgroundColor: '#F1F5F9' }]}>
              <Layers size={18} color="#475569" />
            </View>
            <Text style={styles.kpiValue}>{transactionStats.totalTransactions.toLocaleString()}</Text>
            <Text style={styles.kpiLabel}>Total Records</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchWrap}>
          <Search size={18} color="#94A3B8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by user name, @username, description..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            testID="search-transactions-input"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
              <X size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Tabs: Type */}
        <View style={styles.filterSection}>
          <Text style={styles.filterSectionLabel}>TRANSACTION TYPE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabsRow}>
            <TouchableOpacity
              style={[styles.filterTab, selectedType === 'all' && styles.filterTabActive]}
              onPress={() => setSelectedType('all')}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterTabText, selectedType === 'all' && styles.filterTabTextActive]}>
                All Types ({transactions.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterTab, selectedType === 'earned' && styles.filterTabActiveEarned]}
              onPress={() => setSelectedType('earned')}
              activeOpacity={0.8}
            >
              <ArrowUpRight size={14} color={selectedType === 'earned' ? '#FFFFFF' : '#16A34A'} />
              <Text style={[styles.filterTabText, selectedType === 'earned' && styles.filterTabTextActive]}>
                Earned / Added (+)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterTab, selectedType === 'redeemed' && styles.filterTabActiveRedeemed]}
              onPress={() => setSelectedType('redeemed')}
              activeOpacity={0.8}
            >
              <ArrowDownLeft size={14} color={selectedType === 'redeemed' ? '#FFFFFF' : '#DC2626'} />
              <Text style={[styles.filterTabText, selectedType === 'redeemed' && styles.filterTabTextActive]}>
                Redeemed / Spent (-)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterTab, selectedType === 'money' && styles.filterTabActiveMoney]}
              onPress={() => setSelectedType('money')}
              activeOpacity={0.8}
            >
              <IndianRupee size={14} color={selectedType === 'money' ? '#FFFFFF' : '#4F46E5'} />
              <Text style={[styles.filterTabText, selectedType === 'money' && styles.filterTabTextActive]}>
                Cash Purchases (₹)
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Filter Chips: Source */}
        <View style={styles.filterSection}>
          <Text style={styles.filterSectionLabel}>SOURCE & CATEGORY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabsRow}>
            {sourceOptions.map((opt) => {
              const isActive = selectedSource === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.sourceChip, isActive && styles.sourceChipActive]}
                  onPress={() => setSelectedSource(opt.key)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.sourceChipText, isActive && styles.sourceChipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Results Counter */}
        <View style={styles.resultsBar}>
          <Text style={styles.resultsText}>
            Showing <Text style={{ fontWeight: '700', color: '#0F172A' }}>{filteredTransactions.length}</Text> transaction
            {filteredTransactions.length !== 1 ? 's' : ''}
          </Text>
          {(selectedType !== 'all' || selectedSource !== 'all' || searchQuery.length > 0) && (
            <TouchableOpacity
              onPress={() => {
                setSelectedType('all');
                setSelectedSource('all');
                setSearchQuery('');
              }}
              style={styles.resetFiltersBtn}
            >
              <Text style={styles.resetFiltersText}>Reset Filters</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Transaction Cards List */}
        {filteredTransactions.length === 0 ? (
          <View style={styles.emptyCard}>
            <HelpCircle size={44} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Transactions Found</Text>
            <Text style={styles.emptySubtitle}>
              No transactions match your current search or filter criteria.
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => {
                setSelectedType('all');
                setSelectedSource('all');
                setSearchQuery('');
              }}
            >
              <Text style={styles.emptyActionText}>Clear All Filters</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredTransactions.map((tx) => {
            const isEarned = tx.type === 'earned';
            const isMoney = tx.isMoneyPayment;
            const sourceMeta = SOURCE_LABELS[tx.source] || { label: tx.source, bg: '#F1F5F9', color: '#475569' };
            const avatarUri = resolveImageUrl(tx.userAvatar, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150');

            return (
              <View key={tx.id} style={styles.txCard}>
                {/* Top Row: User details and Amount/Quantity Badge */}
                <View style={styles.txCardHeader}>
                  <View style={styles.userInfoRow}>
                    <Image source={{ uri: avatarUri }} style={styles.userAvatar} />
                    <View style={{ flex: 1 }}>
                      <View style={styles.userNameRow}>
                        <Text style={styles.userName} numberOfLines={1}>
                          {tx.userName}
                        </Text>
                        {tx.userTier && tx.userTier !== 'free' && (
                          <View style={styles.tierBadge}>
                            <Text style={styles.tierBadgeText}>{tx.userTier.toUpperCase()}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.userSubText} numberOfLines={1}>
                        {tx.userUsername || tx.userEmail || `User ID: ${tx.userId.slice(-6)}`} · Balance: {tx.userCredits} cr
                      </Text>
                    </View>
                  </View>

                  {/* Quantity / Amount Badge */}
                  <View
                    style={[
                      styles.amountBadge,
                      isMoney
                        ? styles.amountBadgeMoney
                        : isEarned
                        ? styles.amountBadgeEarned
                        : styles.amountBadgeRedeemed,
                    ]}
                  >
                    {isMoney ? (
                      <IndianRupee size={16} color="#4338CA" />
                    ) : isEarned ? (
                      <ArrowUpRight size={16} color="#15803D" />
                    ) : (
                      <ArrowDownLeft size={16} color="#B91C1C" />
                    )}
                    <Text
                      style={[
                        styles.amountBadgeText,
                        isMoney
                          ? styles.amountTextMoney
                          : isEarned
                          ? styles.amountTextEarned
                          : styles.amountTextRedeemed,
                      ]}
                    >
                      {isMoney
                        ? `₹${tx.amount.toLocaleString('en-IN')}`
                        : `${isEarned ? '+' : '-'}${Math.abs(tx.amount)} cr`}
                    </Text>
                  </View>
                </View>

                {/* Middle: Description */}
                <View style={styles.txBody}>
                  <Text style={styles.txDescription}>{tx.description}</Text>
                </View>

                {/* Footer: Source badge, Transaction ID & Timestamp */}
                <View style={styles.txFooter}>
                  <View style={[styles.sourceBadge, { backgroundColor: sourceMeta.bg }]}>
                    <Text style={[styles.sourceBadgeText, { color: sourceMeta.color }]}>{sourceMeta.label}</Text>
                  </View>

                  {isMoney && tx.paymentStatus && (
                    <View
                      style={[
                        styles.statusBadge,
                        tx.paymentStatus === 'PAID'
                          ? { backgroundColor: '#DCFCE7' }
                          : { backgroundColor: '#FEF3C7' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          tx.paymentStatus === 'PAID' ? { color: '#16A34A' } : { color: '#D97706' },
                        ]}
                      >
                        {tx.paymentStatus}
                      </Text>
                    </View>
                  )}

                  <View style={styles.timestampWrap}>
                    <Clock size={12} color="#94A3B8" />
                    <Text style={styles.timestampText}>{formatDateTime(tx.createdAt || tx.timestamp)}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerWrap: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 999,
  },
  backText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#3B82F6',
    borderRadius: 999,
  },
  refreshBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  spinning: {
    transform: [{ rotate: '45deg' }],
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  kpiIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  kpiLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  clearSearchBtn: {
    padding: 4,
  },
  filterSection: {
    marginBottom: 12,
  },
  filterSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingLeft: 2,
  },
  filterTabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterTabActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  filterTabActiveEarned: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  filterTabActiveRedeemed: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  filterTabActiveMoney: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  sourceChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sourceChipActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  sourceChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  sourceChipTextActive: {
    color: '#FFFFFF',
  },
  resultsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
    paddingHorizontal: 2,
  },
  resultsText: {
    fontSize: 13,
    color: '#64748B',
  },
  resetFiltersBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  resetFiltersText: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '600',
  },
  txCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  txCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  tierBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tierBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
  },
  userSubText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  amountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  amountBadgeEarned: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  amountBadgeRedeemed: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  amountBadgeMoney: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  amountBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  amountTextEarned: {
    color: '#15803D',
  },
  amountTextRedeemed: {
    color: '#B91C1C',
  },
  amountTextMoney: {
    color: '#4338CA',
  },
  txBody: {
    marginVertical: 4,
  },
  txDescription: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    fontWeight: '500',
  },
  txFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexWrap: 'wrap',
    gap: 8,
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sourceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  timestampWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  timestampText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  emptyActionBtn: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0F172A',
    borderRadius: 8,
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});

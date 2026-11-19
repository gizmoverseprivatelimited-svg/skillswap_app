import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeTopInset } from '@/lib/safeArea';
import {
  ArrowLeft,
  Coins,
  TrendingUp,
  Gift,
  History,
  Wallet,
  Sparkles,
  CheckCircle2,
  Clock,
  Trophy,
  Info,
} from 'lucide-react-native';
import { useMemo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { formatPrice } from '@/constants/locale';
import { useCurrentUser } from '@/providers/current-user';
import { useEarnings, EARNING_RULES } from '@/providers/earnings';

export default function EarningsDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isSmallScreen = windowWidth < 600;
  const { currentUser } = useCurrentUser();
  const { getSummary, creditsToRupees, getUserPayouts } = useEarnings();

  const summary = useMemo(
    () => (currentUser?.id ? getSummary(currentUser.id) : {
      userId: '',
      totalEarnedPoints: 0,
      availablePoints: 0,
      currentMonthPoints: 0,
      currentMonthClasses: 0,
      totalPayouts: 0,
      completedPayouts: 0,
      pendingPayouts: 0,
    }),
    [getSummary, currentUser?.id],
  );

  const userPayouts = useMemo(
    () => (currentUser?.id ? getUserPayouts(currentUser.id) : []),
    [getUserPayouts, currentUser?.id],
  );
  const recentPayouts = userPayouts.slice(0, 3);

  const currencyValue = creditsToRupees ? creditsToRupees(summary.availablePoints) : summary.availablePoints;

  return (
    <View style={s.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <LinearGradientHeader onBack={() => router.back()} isSmallScreen={isSmallScreen} />

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={[s.heroCard, isSmallScreen && s.heroCardMobile]}>
          <View style={s.heroTop}>
            <View style={[s.heroIconWrap, isSmallScreen && s.heroIconWrapMobile]}>
              <Coins size={isSmallScreen ? 20 : 26} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.heroLabel, isSmallScreen && s.heroLabelMobile]}>Available Credits</Text>
              <Text style={[s.heroPoints, isSmallScreen && s.heroPointsMobile]}>{summary.availablePoints.toLocaleString()}</Text>
              <Text style={[s.heroValue, isSmallScreen && s.heroValueMobile]}>≈ {formatPrice(currencyValue)}</Text>
            </View>
          </View>
          <View style={s.heroActions}>
            <TouchableOpacity
              style={[s.redeemBtn, isSmallScreen && s.redeemBtnMobile]}
              onPress={() => router.push('/payout' as any)}
              activeOpacity={0.85}
            >
              <Wallet size={isSmallScreen ? 15 : 18} color="#FFFFFF" />
              <Text style={[s.redeemBtnText, isSmallScreen && s.redeemBtnTextMobile]}>Redeem</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.historyBtn, isSmallScreen && s.historyBtnMobile]}
              onPress={() => router.push('/earnings/history' as any)}
              activeOpacity={0.85}
            >
              <History size={isSmallScreen ? 15 : 18} color={Colors.light.primary} />
              <Text style={[s.historyBtnText, isSmallScreen && s.historyBtnTextMobile]}>History</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[s.statsRow, isSmallScreen && s.statsRowMobile]}>
          <StatTile
            icon={<TrendingUp size={isSmallScreen ? 14 : 18} color="#10B981" />}
            iconBg="#ECFDF5"
            value={summary.currentMonthPoints.toString()}
            label="This Month"
            isSmallScreen={isSmallScreen}
          />
          <StatTile
            icon={<Sparkles size={isSmallScreen ? 14 : 18} color="#8B5CF6" />}
            iconBg="#F5F3FF"
            value={summary.currentMonthClasses.toString()}
            label="Classes Taught"
            isSmallScreen={isSmallScreen}
          />
          <StatTile
            icon={<Trophy size={isSmallScreen ? 14 : 18} color="#F59E0B" />}
            iconBg="#FFFBEB"
            value={summary.totalEarnedPoints.toLocaleString()}
            label="Total Earned"
            isSmallScreen={isSmallScreen}
          />
        </View>

        <View style={[s.section, isSmallScreen && s.sectionMobile]}>
          <Text style={[s.sectionTitle, isSmallScreen && s.sectionTitleMobile]}>How You Earn</Text>
          <View style={s.rulesList}>
            {EARNING_RULES.map((rule, i) => (
              <View key={i} style={[s.ruleCard, isSmallScreen && s.ruleCardMobile]}>
                <View style={[s.ruleIcon, isSmallScreen && s.ruleIconMobile, { backgroundColor: rule.source === 'monthly_subscription' ? '#F5F3FF' : rule.source === 'bonus' ? '#FFFBEB' : '#ECFDF5' }]}>
                  {rule.source === 'monthly_subscription' ? (
                    <Gift size={isSmallScreen ? 14 : 18} color="#8B5CF6" />
                  ) : rule.source === 'bonus' ? (
                    <Sparkles size={isSmallScreen ? 14 : 18} color="#F59E0B" />
                  ) : (
                    <CheckCircle2 size={isSmallScreen ? 14 : 18} color="#10B981" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.ruleLabel, isSmallScreen && s.ruleLabelMobile]}>{rule.label}</Text>
                  <Text style={[s.ruleDesc, isSmallScreen && s.ruleDescMobile]}>{rule.description}</Text>
                </View>
                <View style={s.rulePointsWrap}>
                  <Text style={[s.rulePoints, isSmallScreen && s.rulePointsMobile]}>+{rule.points}</Text>
                  <Text style={[s.rulePointsUnit, isSmallScreen && s.rulePointsUnitMobile]}>cr</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={[s.section, isSmallScreen && s.sectionMobile]}>
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, isSmallScreen && s.sectionTitleMobile]}>Recent Payouts</Text>
            {userPayouts.length > 3 && (
              <TouchableOpacity onPress={() => router.push('/earnings/history' as any)}>
                <Text style={s.seeAllText}>See all</Text>
              </TouchableOpacity>
            )}
          </View>
          {recentPayouts.length === 0 ? (
            <View style={s.emptyCard}>
              <Info size={16} color={Colors.light.textTertiary} />
              <Text style={[s.emptyText, isSmallScreen && s.emptyTextMobile]}>No payouts yet. Redeem your points to get started!</Text>
            </View>
          ) : (
            <View style={s.payoutList}>
              {recentPayouts.map((payout, index) => {
                const statusBg = payout.status === 'completed' ? '#ECFDF5' : payout.status === 'pending' ? '#FFFBEB' : '#FEE2E2';
                const statusColor = payout.status === 'completed' ? '#10B981' : payout.status === 'pending' ? '#D97706' : '#EF4444';
                const statusLabel = payout.status === 'completed' ? 'Completed' : payout.status === 'pending' ? 'Pending' : payout.status === 'rejected' ? 'Rejected' : payout.status;

                return (
                  <View key={payout.id || (payout as any)._id || index} style={[s.payoutCard, isSmallScreen && s.payoutCardMobile]}>
                    <View style={[s.payoutIcon, isSmallScreen && s.payoutIconMobile, { backgroundColor: statusBg }]}>
                      {payout.status === 'completed' ? (
                        <CheckCircle2 size={isSmallScreen ? 14 : 18} color="#10B981" />
                      ) : payout.status === 'pending' ? (
                        <Clock size={isSmallScreen ? 14 : 18} color="#F59E0B" />
                      ) : (
                        <Info size={isSmallScreen ? 14 : 18} color="#EF4444" />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <Text style={[s.payoutMethod, isSmallScreen && s.payoutMethodMobile]}>{payoutMethodLabel(payout.method)}</Text>
                        <View style={[s.statusBadge, { backgroundColor: statusBg }]}>
                          <Text style={[s.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
                        </View>
                      </View>
                      <Text style={[s.payoutDate, isSmallScreen && s.payoutDateMobile]}>
                        {new Date(payout.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                    <View style={s.payoutRight}>
                      <Text style={[s.payoutPoints, isSmallScreen && s.payoutPointsMobile]}>{payout.points} pts</Text>
                      <Text style={[s.payoutAmount, isSmallScreen && s.payoutAmountMobile]}>{formatPrice(payout.amount)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={[s.infoBanner, isSmallScreen && s.infoBannerMobile]}>
          <Info size={14} color={Colors.light.textSecondary} />
          <Text style={[s.infoText, isSmallScreen && s.infoTextMobile]}>
            Points are awarded when swaps are marked complete. Monthly subscription bonuses are credited on the 1st of each month.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function payoutMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    store_credit: 'Store Credit',
    bank_transfer: 'Bank Transfer',
    upi: 'UPI Transfer',
    paypal: 'PayPal',
  };
  return labels[method] ?? method;
}

function StatTile({ icon, iconBg, value, label, isSmallScreen }: { icon: React.ReactNode; iconBg: string; value: string; label: string; isSmallScreen: boolean }) {
  return (
    <View style={[s.statTile, isSmallScreen && s.statTileMobile]}>
      <View style={[s.statIcon, isSmallScreen && s.statIconMobile, { backgroundColor: iconBg }]}>{icon}</View>
      <Text style={[s.statValue, isSmallScreen && s.statValueMobile]}>{value}</Text>
      <Text style={[s.statLabel, isSmallScreen && s.statLabelMobile]}>{label}</Text>
    </View>
  );
}

function LinearGradientHeader({ onBack, isSmallScreen }: { onBack: () => void; isSmallScreen: boolean }) {
  const safeTop = useSafeTopInset(isSmallScreen ? 10 : 16);
  return (
    <LinearGradient
      colors={['#6366F1', '#4F46E5']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ paddingTop: safeTop, paddingHorizontal: isSmallScreen ? 14 : 20, paddingBottom: isSmallScreen ? 14 : 20, borderBottomLeftRadius: isSmallScreen ? 16 : 24, borderBottomRightRadius: isSmallScreen ? 16 : 24 }}
    >
      <View style={s.headerRow}>
        <TouchableOpacity onPress={onBack} style={[s.backBtn, isSmallScreen && s.backBtnMobile]}>
          <ArrowLeft size={isSmallScreen ? 18 : 22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={[s.headerTitle, isSmallScreen && s.headerTitleMobile]}>Earnings</Text>
        <View style={{ width: isSmallScreen ? 34 : 44 }} />
      </View>
      <Text style={[s.headerSubtitle, isSmallScreen && s.headerSubtitleMobile]}>Track your teaching rewards</Text>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.backgroundSecondary },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800' as const, color: '#FFFFFF' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '500' as const },
  scroll: { flex: 1 },
  heroCard: { margin: 20, backgroundColor: '#0F172A', borderRadius: 24, padding: 24, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  heroIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(99,102,241,0.3)', alignItems: 'center', justifyContent: 'center' },
  heroLabel: { fontSize: 13, color: '#94A3B8', fontWeight: '500' as const, marginBottom: 4 },
  heroPoints: { fontSize: 36, fontWeight: '800' as const, color: '#FFFFFF', marginBottom: 2 },
  heroValue: { fontSize: 14, color: '#6366F1', fontWeight: '600' as const },
  heroActions: { flexDirection: 'row', gap: 12 },
  redeemBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.light.primary, paddingVertical: 14, borderRadius: 14 },
  redeemBtnText: { fontSize: 15, fontWeight: '700' as const, color: '#FFFFFF' },
  historyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1E293B', paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: '#334155' },
  historyBtnText: { fontSize: 15, fontWeight: '700' as const, color: Colors.light.primary },
  statsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginBottom: 24 },
  statTile: { flex: 1, backgroundColor: Colors.light.card, borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.light.borderLight, shadowColor: Colors.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  statIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontSize: 20, fontWeight: '800' as const, color: Colors.light.text, marginBottom: 2 },
  statLabel: { fontSize: 11, color: Colors.light.textSecondary, fontWeight: '500' as const, textAlign: 'center' },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.light.text, marginBottom: 14 },
  seeAllText: { fontSize: 14, fontWeight: '600' as const, color: Colors.light.primary },
  rulesList: { gap: 10 },
  ruleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.light.card, borderRadius: 16, padding: 14, gap: 12, borderWidth: 1, borderColor: Colors.light.borderLight },
  ruleIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ruleLabel: { fontSize: 15, fontWeight: '700' as const, color: Colors.light.text, marginBottom: 2 },
  ruleDesc: { fontSize: 12, color: Colors.light.textSecondary, lineHeight: 17 },
  rulePointsWrap: { alignItems: 'flex-end' },
  rulePoints: { fontSize: 18, fontWeight: '800' as const, color: Colors.light.primary },
  rulePointsUnit: { fontSize: 11, color: Colors.light.textSecondary, fontWeight: '600' as const },
  payoutList: { gap: 10 },
  payoutCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.light.card, borderRadius: 14, padding: 14, gap: 12, borderWidth: 1, borderColor: Colors.light.borderLight },
  payoutIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  payoutMethod: { fontSize: 14, fontWeight: '700' as const, color: Colors.light.text, marginBottom: 2 },
  payoutDate: { fontSize: 12, color: Colors.light.textSecondary },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' as const, textTransform: 'uppercase' },
  payoutRight: { alignItems: 'flex-end' },
  payoutPoints: { fontSize: 14, fontWeight: '700' as const, color: Colors.light.text, marginBottom: 2 },
  payoutAmount: { fontSize: 13, color: Colors.light.primary, fontWeight: '600' as const },
  emptyCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.light.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.light.borderLight },
  emptyText: { fontSize: 13, color: Colors.light.textSecondary, flex: 1 },
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: 20, backgroundColor: Colors.light.backgroundTertiary, borderRadius: 12, padding: 14 },
  infoText: { fontSize: 12, color: Colors.light.textSecondary, flex: 1, lineHeight: 18 },
  heroCardMobile: { margin: 12, padding: 14, borderRadius: 16 },
  heroIconWrapMobile: { width: 42, height: 42, borderRadius: 21 },
  heroLabelMobile: { fontSize: 11, marginBottom: 2 },
  heroPointsMobile: { fontSize: 24, marginBottom: 2 },
  heroValueMobile: { fontSize: 12 },
  redeemBtnMobile: { paddingVertical: 10, borderRadius: 10 },
  redeemBtnTextMobile: { fontSize: 13 },
  historyBtnMobile: { paddingVertical: 10, borderRadius: 10 },
  historyBtnTextMobile: { fontSize: 13 },
  statsRowMobile: { gap: 8, paddingHorizontal: 12, marginBottom: 16 },
  statTileMobile: { padding: 8, borderRadius: 12 },
  statIconMobile: { width: 28, height: 28, borderRadius: 8, marginBottom: 4 },
  statValueMobile: { fontSize: 15, marginBottom: 2 },
  statLabelMobile: { fontSize: 9.5 },
  sectionMobile: { paddingHorizontal: 12, marginBottom: 16 },
  sectionTitleMobile: { fontSize: 14, marginBottom: 8 },
  ruleCardMobile: { padding: 10, borderRadius: 12, gap: 8 },
  ruleIconMobile: { width: 32, height: 32, borderRadius: 8 },
  ruleLabelMobile: { fontSize: 12.5, marginBottom: 2 },
  ruleDescMobile: { fontSize: 10.5, lineHeight: 14 },
  rulePointsMobile: { fontSize: 14 },
  rulePointsUnitMobile: { fontSize: 9.5 },
  payoutCardMobile: { padding: 10, borderRadius: 10, gap: 8 },
  payoutIconMobile: { width: 32, height: 32, borderRadius: 8 },
  payoutMethodMobile: { fontSize: 12 },
  payoutDateMobile: { fontSize: 10.5 },
  payoutPointsMobile: { fontSize: 12 },
  payoutAmountMobile: { fontSize: 11.5 },
  emptyTextMobile: { fontSize: 11.5 },
  infoBannerMobile: { marginHorizontal: 12, padding: 10, borderRadius: 10 },
  infoTextMobile: { fontSize: 11, lineHeight: 15 },
  backBtnMobile: { width: 34, height: 34, borderRadius: 17 },
  headerTitleMobile: { fontSize: 16 },
  headerSubtitleMobile: { fontSize: 11 },
});

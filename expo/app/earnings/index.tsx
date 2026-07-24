import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import Colors from '@/constants/colors';
import { formatPrice } from '@/constants/locale';
import { useCurrentUser } from '@/providers/current-user';
import { useEarnings } from '@/providers/earnings';

export default function EarningsDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentUser } = useCurrentUser();
  const { getSummary, earningRules, pointsToCurrency, getUserPayouts } =
    useEarnings();

  const summary = useMemo(
    () => getSummary(currentUser.id),
    [getSummary, currentUser.id],
  );
  const userPayouts = useMemo(
    () => getUserPayouts(currentUser.id),
    [getUserPayouts, currentUser.id],
  );
  const recentPayouts = userPayouts.slice(0, 3);

  const currencyValue = pointsToCurrency(summary.availablePoints);

  return (
    <View style={s.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <LinearGradientHeader insets={insets} onBack={() => router.back()} />

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={s.heroCard}>
          <View style={s.heroTop}>
            <View style={s.heroIconWrap}>
              <Coins size={26} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.heroLabel}>Available Points</Text>
              <Text style={s.heroPoints}>{summary.availablePoints.toLocaleString()}</Text>
              <Text style={s.heroValue}>≈ {formatPrice(currencyValue)}</Text>
            </View>
          </View>
          <View style={s.heroActions}>
            <TouchableOpacity
              style={s.redeemBtn}
              onPress={() => router.push('/payout' as any)}
              activeOpacity={0.85}
            >
              <Wallet size={18} color="#FFFFFF" />
              <Text style={s.redeemBtnText}>Redeem</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.historyBtn}
              onPress={() => router.push('/earnings/history' as any)}
              activeOpacity={0.85}
            >
              <History size={18} color={Colors.light.primary} />
              <Text style={s.historyBtnText}>History</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.statsRow}>
          <StatTile
            icon={<TrendingUp size={18} color="#10B981" />}
            iconBg="#ECFDF5"
            value={summary.currentMonthPoints.toString()}
            label="This Month"
          />
          <StatTile
            icon={<Sparkles size={18} color="#8B5CF6" />}
            iconBg="#F5F3FF"
            value={summary.currentMonthClasses.toString()}
            label="Classes Taught"
          />
          <StatTile
            icon={<Trophy size={18} color="#F59E0B" />}
            iconBg="#FFFBEB"
            value={summary.totalPointsEarned.toLocaleString()}
            label="Total Earned"
          />
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>How You Earn</Text>
          <View style={s.rulesList}>
            {earningRules.map((rule, i) => (
              <View key={i} style={s.ruleCard}>
                <View style={[s.ruleIcon, { backgroundColor: rule.source === 'monthly_subscription' ? '#F5F3FF' : rule.source === 'bonus' ? '#FFFBEB' : '#ECFDF5' }]}>
                  {rule.source === 'monthly_subscription' ? (
                    <Gift size={18} color="#8B5CF6" />
                  ) : rule.source === 'bonus' ? (
                    <Sparkles size={18} color="#F59E0B" />
                  ) : (
                    <CheckCircle2 size={18} color="#10B981" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.ruleLabel}>{rule.label}</Text>
                  <Text style={s.ruleDesc}>{rule.description}</Text>
                </View>
                <View style={s.rulePointsWrap}>
                  <Text style={s.rulePoints}>+{rule.points}</Text>
                  <Text style={s.rulePointsUnit}>pts</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Recent Payouts</Text>
            {userPayouts.length > 3 && (
              <TouchableOpacity onPress={() => router.push('/earnings/history' as any)}>
                <Text style={s.seeAllText}>See all</Text>
              </TouchableOpacity>
            )}
          </View>
          {recentPayouts.length === 0 ? (
            <View style={s.emptyCard}>
              <Info size={20} color={Colors.light.textTertiary} />
              <Text style={s.emptyText}>No payouts yet. Redeem your points to get started!</Text>
            </View>
          ) : (
            <View style={s.payoutList}>
              {recentPayouts.map((payout) => (
                <View key={payout.id} style={s.payoutCard}>
                  <View style={[s.payoutIcon, { backgroundColor: payout.status === 'completed' ? '#ECFDF5' : payout.status === 'pending' ? '#FFFBEB' : '#FEE2E2' }]}>
                    {payout.status === 'completed' ? (
                      <CheckCircle2 size={18} color="#10B981" />
                    ) : payout.status === 'pending' ? (
                      <Clock size={18} color="#F59E0B" />
                    ) : (
                      <Info size={18} color="#EF4444" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.payoutMethod}>{payoutMethodLabel(payout.method)}</Text>
                    <Text style={s.payoutDate}>
                      {new Date(payout.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                  <View style={s.payoutRight}>
                    <Text style={s.payoutPoints}>{payout.points} pts</Text>
                    <Text style={s.payoutAmount}>{formatPrice(payout.amountCurrency)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={s.infoBanner}>
          <Info size={16} color={Colors.light.textSecondary} />
          <Text style={s.infoText}>
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

function StatTile({ icon, iconBg, value, label }: { icon: React.ReactNode; iconBg: string; value: string; label: string }) {
  return (
    <View style={s.statTile}>
      <View style={[s.statIcon, { backgroundColor: iconBg }]}>{icon}</View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function LinearGradientHeader({ insets, onBack }: { insets: { top: number }; onBack: () => void }) {
  return (
    <LinearGradient
      colors={['#6366F1', '#4F46E5']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}
    >
      <View style={s.headerRow}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Earnings</Text>
        <View style={{ width: 44 }} />
      </View>
      <Text style={s.headerSubtitle}>Track your teaching rewards</Text>
    </LinearGradient>
  );
}

import { LinearGradient } from 'expo-linear-gradient';

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
  payoutRight: { alignItems: 'flex-end' },
  payoutPoints: { fontSize: 14, fontWeight: '700' as const, color: Colors.light.text, marginBottom: 2 },
  payoutAmount: { fontSize: 13, color: Colors.light.primary, fontWeight: '600' as const },
  emptyCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.light.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.light.borderLight },
  emptyText: { fontSize: 13, color: Colors.light.textSecondary, flex: 1 },
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: 20, backgroundColor: Colors.light.backgroundTertiary, borderRadius: 12, padding: 14 },
  infoText: { fontSize: 12, color: Colors.light.textSecondary, flex: 1, lineHeight: 18 },
});

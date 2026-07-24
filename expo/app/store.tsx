import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { Coins, Crown, Zap, Check } from 'lucide-react-native';
import { useState } from 'react';
import Colors from '@/constants/colors';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/providers/auth';
import { formatPrice } from '@/constants/locale';

const creditPackages = [
  { id: 'starter' as const, credits: 25, price: 99, popular: false },
  { id: 'popular' as const, credits: 60, price: 199, popular: true },
  { id: 'best_value' as const, credits: 150, price: 449, popular: false },
  { id: 'mega' as const, credits: 400, price: 999, popular: false },
];

const premiumTiers = [
  { id: 'basic' as const, name: 'Basic', monthlyPrice: 199, yearlyPrice: 1999, monthlyCredits: 30, features: ['Priority matching', 'Ad-free experience', 'Basic analytics'], color: '#6366F1' },
  { id: 'premium' as const, name: 'Premium', monthlyPrice: 399, yearlyPrice: 3999, monthlyCredits: 80, features: ['All Basic features', 'Unlimited swaps', 'Advanced matching', 'Video calls'], color: '#8B5CF6', popular: true },
  { id: 'elite' as const, name: 'Elite', monthlyPrice: 999, yearlyPrice: 9999, monthlyCredits: 200, features: ['All Premium features', 'Concierge support', 'Exclusive events', 'Expert badge'], color: '#F59E0B' },
];

export default function StoreScreen() {
  const [selectedTab, setSelectedTab] = useState<'credits' | 'premium'>('credits');
  const [selectedDuration, setSelectedDuration] = useState<'monthly' | 'yearly'>('monthly');
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const purchaseCreditsMutation = trpc.credits.purchaseCredits.useMutation({
    onSuccess: (data) => { Alert.alert('Success!', `${data.creditsAdded} credits added!`); utils.credits.getBalance.invalidate(); },
    onError: (error) => { Alert.alert('Error', error.message); },
  });

  const purchasePremiumMutation = trpc.credits.purchasePremium.useMutation({
    onSuccess: (data) => { Alert.alert('Success!', `Welcome to ${data.tier}! ${data.creditsAdded} bonus credits added!`); utils.credits.getBalance.invalidate(); },
    onError: (error) => { Alert.alert('Error', error.message); },
  });

  const handlePurchaseCredits = (packageId: typeof creditPackages[number]['id']) => {
    const pkg = creditPackages.find((p) => p.id === packageId);
    if (!pkg) return;
    Alert.alert('Purchase Credits', `Buy ${pkg.credits} credits for ${formatPrice(pkg.price)}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Buy', onPress: () => purchaseCreditsMutation.mutate({ packageId }) },
    ]);
  };

  const handlePurchasePremium = (tier: typeof premiumTiers[number]['id']) => {
    const tierInfo = premiumTiers.find((t) => t.id === tier);
    if (!tierInfo) return;
    const price = selectedDuration === 'monthly' ? tierInfo.monthlyPrice : tierInfo.yearlyPrice;
    Alert.alert(`Upgrade to ${tierInfo.name}`, `Subscribe for ${formatPrice(price)}/${selectedDuration}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Subscribe', onPress: () => purchasePremiumMutation.mutate({ tier, duration: selectedDuration }) },
    ]);
  };

  return (
    <View style={s.container}>
      <Stack.Screen options={{ title: 'Store', headerStyle: { backgroundColor: Colors.light.background }, headerTitleStyle: { fontSize: 18, fontWeight: '700', color: Colors.light.text } }} />
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        <View style={s.balanceCard}>
          <View style={s.balanceIcon}><Coins size={24} color="#F59E0B" /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: Colors.light.textSecondary, marginBottom: 2 }}>Your Balance</Text>
            <Text style={{ fontSize: 24, fontWeight: '700' as const, color: Colors.light.text }}>{user?.credits || 0} Credits</Text>
          </View>
        </View>
      </View>
      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab, selectedTab === 'credits' && s.tabActive]} onPress={() => setSelectedTab('credits')}>
          <Coins size={20} color={selectedTab === 'credits' ? Colors.light.primary : Colors.light.textSecondary} />
          <Text style={[s.tabText, selectedTab === 'credits' && s.tabTextActive]}>Buy Credits</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, selectedTab === 'premium' && s.tabActive]} onPress={() => setSelectedTab('premium')}>
          <Crown size={20} color={selectedTab === 'premium' ? Colors.light.primary : Colors.light.textSecondary} />
          <Text style={[s.tabText, selectedTab === 'premium' && s.tabTextActive]}>Premium</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {selectedTab === 'credits' ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Credit Packages</Text>
            <Text style={s.sectionDesc}>Use credits to request skill swaps and unlock premium features</Text>
            <View style={s.packagesGrid}>
              {creditPackages.map((pkg) => (
                <View key={pkg.id} style={s.packageCard}>
                  {pkg.popular && <View style={s.popularBadge}><Zap size={12} color="#FFF" fill="#FFF" /><Text style={{ fontSize: 10, fontWeight: '700' as const, color: '#FFF', letterSpacing: 0.5 }}>POPULAR</Text></View>}
                  <View style={s.packageIcon}><Coins size={32} color={Colors.light.primary} /></View>
                  <Text style={{ fontSize: 28, fontWeight: '700' as const, color: Colors.light.text }}>{pkg.credits}</Text>
                  <Text style={{ fontSize: 13, color: Colors.light.textSecondary, marginBottom: 12 }}>Credits</Text>
                  <View style={{ width: '100%', height: 1, backgroundColor: Colors.light.borderLight, marginVertical: 12 }} />
                  <Text style={{ fontSize: 20, fontWeight: '700' as const, color: Colors.light.primary, marginBottom: 12 }}>{formatPrice(pkg.price)}</Text>
                  <TouchableOpacity style={[s.buyBtn, purchaseCreditsMutation.isPending && { opacity: 0.6 }]} onPress={() => handlePurchaseCredits(pkg.id)} disabled={purchaseCreditsMutation.isPending}>
                    <Text style={{ fontSize: 14, fontWeight: '700' as const, color: '#FFF' }}>{purchaseCreditsMutation.isPending ? 'Processing...' : 'Buy Now'}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Premium Membership</Text>
            <Text style={s.sectionDesc}>Unlock unlimited swaps, priority matching, and exclusive features</Text>
            <View style={s.durationSelector}>
              <TouchableOpacity style={[s.durationOpt, selectedDuration === 'monthly' && s.durationOptActive]} onPress={() => setSelectedDuration('monthly')}>
                <Text style={[s.durationText, selectedDuration === 'monthly' && s.durationTextActive]}>Monthly</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.durationOpt, selectedDuration === 'yearly' && s.durationOptActive]} onPress={() => setSelectedDuration('yearly')}>
                <Text style={[s.durationText, selectedDuration === 'yearly' && s.durationTextActive]}>Yearly</Text>
                <View style={s.saveBadge}><Text style={{ fontSize: 11, fontWeight: '700' as const, color: '#FFF' }}>Save 17%</Text></View>
              </TouchableOpacity>
            </View>
            <View style={{ gap: 16, marginBottom: 20 }}>
              {premiumTiers.map((tier) => (
                <View key={tier.id} style={[s.tierCard, tier.popular && { borderWidth: 2, borderColor: Colors.light.primary }]}>
                  {tier.popular && <View style={s.tierPopularBadge}><Crown size={14} color="#FFF" fill="#FFF" /><Text style={{ fontSize: 12, fontWeight: '700' as const, color: '#FFF', letterSpacing: 0.5 }}>MOST POPULAR</Text></View>}
                  <View style={[s.tierIcon, { backgroundColor: tier.color }]}><Crown size={28} color="#FFF" /></View>
                  <Text style={{ fontSize: 24, fontWeight: '700' as const, color: Colors.light.text, marginBottom: 8 }}>{tier.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 }}>
                    <Text style={{ fontSize: 36, fontWeight: '700' as const, color: Colors.light.text }}>{formatPrice(selectedDuration === 'monthly' ? tier.monthlyPrice : tier.yearlyPrice)}</Text>
                    <Text style={{ fontSize: 16, color: Colors.light.textSecondary, marginLeft: 4 }}>/{selectedDuration === 'monthly' ? 'mo' : 'yr'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F9FAFB', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginBottom: 20, alignSelf: 'flex-start' }}>
                    <Coins size={16} color={tier.color} /><Text style={{ fontSize: 14, fontWeight: '600' as const, color: Colors.light.text }}>{tier.monthlyCredits} credits/month</Text>
                  </View>
                  <View style={{ gap: 12, marginBottom: 24 }}>
                    {tier.features.map((feature, i) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Check size={18} color={tier.color} strokeWidth={2.5} /><Text style={{ fontSize: 15, color: Colors.light.text, flex: 1 }}>{feature}</Text>
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity style={[{ paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: tier.color }, purchasePremiumMutation.isPending && { opacity: 0.6 }]} onPress={() => handlePurchasePremium(tier.id)} disabled={purchasePremiumMutation.isPending}>
                    <Text style={{ fontSize: 16, fontWeight: '700' as const, color: '#FFF' }}>{purchasePremiumMutation.isPending ? 'Processing...' : 'Subscribe'}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}
        <View style={{ padding: 20, alignItems: 'center' }}>
          <Text style={{ fontSize: 13, color: Colors.light.textSecondary, textAlign: 'center', fontStyle: 'italic' }}>This is a demo payment system. No actual charges will be made.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  balanceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 16, shadowColor: Colors.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  balanceIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  tabs: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: Colors.light.borderLight },
  tabActive: { backgroundColor: Colors.light.primaryLight, borderColor: Colors.light.primary },
  tabText: { fontSize: 15, fontWeight: '600' as const, color: Colors.light.textSecondary },
  tabTextActive: { color: Colors.light.primary },
  section: { paddingHorizontal: 20, paddingTop: 24 },
  sectionTitle: { fontSize: 22, fontWeight: '700' as const, color: Colors.light.text, marginBottom: 8 },
  sectionDesc: { fontSize: 15, color: Colors.light.textSecondary, marginBottom: 20, lineHeight: 22 },
  packagesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  packageCard: { width: '48%', backgroundColor: '#FFF', borderRadius: 16, padding: 16, alignItems: 'center', shadowColor: Colors.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2, position: 'relative' },
  popularBadge: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.light.accent, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  packageIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.light.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  buyBtn: { width: '100%', backgroundColor: Colors.light.primary, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  durationSelector: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  durationOpt: { flex: 1, backgroundColor: '#FFF', borderWidth: 2, borderColor: Colors.light.borderLight, borderRadius: 12, paddingVertical: 14, alignItems: 'center', position: 'relative' },
  durationOptActive: { borderColor: Colors.light.primary, backgroundColor: Colors.light.primaryLight },
  durationText: { fontSize: 15, fontWeight: '600' as const, color: Colors.light.textSecondary },
  durationTextActive: { color: Colors.light.primary },
  saveBadge: { position: 'absolute', top: -8, right: 12, backgroundColor: Colors.light.accent, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tierCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, shadowColor: Colors.light.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4, position: 'relative' },
  tierPopularBadge: { position: 'absolute', top: -12, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.light.primary, paddingVertical: 6, borderRadius: 8 },
  tierIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
});

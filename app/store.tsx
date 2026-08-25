import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Coins, Crown, Zap, Check, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import Colors from '@/constants/colors';
import { formatPrice } from '@/constants/locale';
import { useAlert } from '@/providers/alert';
import url from '@/constants/backurl';
import { useCurrentUser } from '@/providers/current-user';
import { useSocket } from '@/providers/socket';
import * as WebBrowser from 'expo-web-browser';
import { CREDIT_PACKAGES } from '@/lib/payments';

const creditPackages = CREDIT_PACKAGES;

const premiumTiers = [
  {
    id: 'basic' as const,
    name: 'Basic',
    monthlyPrice: 199,
    yearlyPrice: 1999,
    monthlyCredits: 30,
    features: ['Priority matching', 'Ad-free experience', 'Basic analytics'],
    color: '#6366F1',
  },
  {
    id: 'premium' as const,
    name: 'Premium',
    monthlyPrice: 399,
    yearlyPrice: 3999,
    monthlyCredits: 80,
    features: ['All Basic features', 'Unlimited swaps', 'Advanced matching', 'Video calls'],
    color: '#8B5CF6',
    popular: true,
  },
  {
    id: 'elite' as const,
    name: 'Elite',
    monthlyPrice: 999,
    yearlyPrice: 9999,
    monthlyCredits: 200,
    features: ['All Premium features', 'Concierge support', 'Exclusive events', 'Expert badge'],
    color: '#F59E0B',
  },
];

export default function StoreScreen() {
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState<'credits' | 'premium'>('credits');
  const [selectedDuration, setSelectedDuration] = useState<'monthly' | 'yearly'>('monthly');
  const { currentUser, loadUser, earnCredits } = useCurrentUser();
  const { socket } = useSocket();
  const { showAlert } = useAlert();
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [checkoutItem, setCheckoutItem] = useState<{
    type: 'credits' | 'premium';
    id: string;
    name: string;
    price: number;
    duration?: 'monthly' | 'yearly';
  } | null>(null);

  const pollingTimerRef = useRef<any>(null);
  const popupRef = useRef<any>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, []);

  // Listen to socket events for realtime balance updates
  useEffect(() => {
    if (!socket) return;
    const handleRealtimeUpdate = (data?: any) => {
      console.log('[Store] Realtime update from socket:', data);
      loadUser(true);
    };
    socket.on('payment_success', handleRealtimeUpdate);
    socket.on('credits_updated', handleRealtimeUpdate);
    socket.on('user_updated', handleRealtimeUpdate);
    return () => {
      socket.off('payment_success', handleRealtimeUpdate);
      socket.off('credits_updated', handleRealtimeUpdate);
      socket.off('user_updated', handleRealtimeUpdate);
    };
  }, [socket, loadUser]);

  const startPaymentMonitoring = useCallback(
    (initialCredits: number, expectedAdded: number, popupWindow?: any, isPremium = false) => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
      popupRef.current = popupWindow;
      const uId = currentUser?.id;
      if (!uId) return;

      let elapsedSeconds = 0;
      const maxSeconds = 150;

      const checkBalance = async () => {
        try {
          const res = await fetch(`${url}/users/${uId}`);
          if (res.ok) {
            const freshUser = await res.json();
            const freshCredits = freshUser?.credits ?? 0;
            const updated = isPremium
              ? freshUser?.premiumTier && freshUser.premiumTier !== 'free'
              : freshCredits > initialCredits;

            if (updated) {
              if (pollingTimerRef.current) {
                clearInterval(pollingTimerRef.current);
                pollingTimerRef.current = null;
              }
              if (popupRef.current && !popupRef.current.closed) {
                try {
                  popupRef.current.close();
                } catch (e) {}
              }
              if (earnCredits && freshCredits > initialCredits) {
                earnCredits(freshCredits - initialCredits);
              }
              await loadUser(true);
              return true;
            }
          }
        } catch (e) {
          console.warn('[Store] Polling balance check error:', e);
        }
        return false;
      };

      pollingTimerRef.current = setInterval(async () => {
        elapsedSeconds += 2;
        if (elapsedSeconds >= maxSeconds) {
          if (pollingTimerRef.current) {
            clearInterval(pollingTimerRef.current);
            pollingTimerRef.current = null;
          }
          return;
        }
        await checkBalance();
      }, 2000);

      // Check on window focus
      const onWindowFocus = () => {
        void checkBalance();
      };
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.addEventListener('focus', onWindowFocus, { once: false });
      }
    },
    [currentUser?.id, earnCredits, loadUser, showAlert],
  );

  const executePurchaseCredits = async (packageId: typeof creditPackages[number]['id'], mode: 'trial' | 'gateway') => {
    if (mode === 'trial') {
      try {
        setIsProcessing(true);
        const response = await fetch(`${url}/users/credits/purchase`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser?.id, packageId }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Purchase failed');

        const added = data.creditsAdded || 0;
        if (earnCredits && added > 0) {
          earnCredits(added);
        }
        showAlert('Success!', `${added} credits added to your account!`);
        await loadUser(true);
      } catch (error: any) {
        showAlert('Error', error.message);
      } finally {
        setIsProcessing(false);
      }
    } else {
      try {
        setIsProcessing(true);
        const origin = Platform.OS === 'web' && typeof window !== 'undefined' ? (window as any).location.origin : '';
        const response = await fetch(`${url}/payments/create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser?.id,
            purchaseType: 'credits',
            packageId,
            origin,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Purchase failed');

        const originParam = origin ? `&origin=${encodeURIComponent(origin)}` : '';
        const sessionParam = data.paymentSessionId ? `&paymentSessionId=${encodeURIComponent(data.paymentSessionId)}` : '';
        const checkoutUrl = `${url}/payments/checkout?orderId=${data.orderId}${sessionParam}&amount=${data.amount}&userId=${currentUser?.id}&purchaseType=credits&packageId=${packageId}${originParam}`;

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const width = 560;
          const height = 740;
          const left = Math.max(0, Math.round((window.innerWidth - width) / 2 + (window.screenX || 0)));
          const top = Math.max(0, Math.round((window.innerHeight - height) / 2 + (window.screenY || 0)));
          const popup = window.open(
            checkoutUrl,
            'cashfree_payment_window',
            `width=${width},height=${height},top=${top},left=${left},status=no,resizable=yes,scrollbars=yes`,
          );

          if (!popup || popup.closed || typeof popup.closed === 'undefined') {
            window.open(checkoutUrl, '_blank');
          }

          const pkg = creditPackages.find((p) => p.id === packageId);
          startPaymentMonitoring(
            currentUser?.credits || 0,
            (pkg?.credits || 0) + (pkg?.bonusCredits || 0),
            popup,
          );
        } else {
          await WebBrowser.openBrowserAsync(checkoutUrl);
          await loadUser(true);
        }
      } catch (error: any) {
        showAlert('Error', error.message);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handlePurchaseCredits = (packageId: typeof creditPackages[number]['id']) => {
    if (!currentUser || currentUser?.id === '1' || (currentUser as any)?.isDemo) {
      showAlert(
        'Login Required 🔒',
        'Please log in or create an account to purchase credits.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/login' as any) },
        ]
      );
      return;
    }
    const pkg = creditPackages.find((p) => p.id === packageId);
    if (!pkg) return;
    setCheckoutItem({
      type: 'credits',
      id: packageId,
      name: `${pkg.credits + pkg.bonusCredits} Credits Package`,
      price: pkg.priceRupees,
    });
    setCheckoutModalVisible(true);
  };

  const executePurchasePremium = async (tier: typeof premiumTiers[number]['id'], duration: 'monthly' | 'yearly', mode: 'trial' | 'gateway') => {
    if (mode === 'trial') {
      try {
        setIsProcessing(true);
        const response = await fetch(`${url}/users/premium/purchase`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser?.id, tier, duration }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Purchase failed');

        const added = data.creditsAdded || 0;
        if (earnCredits && added > 0) {
          earnCredits(added);
        }
        showAlert('Success!', `Welcome to ${data.tier} tier! ${added} bonus credits added!`);
        await loadUser(true);
      } catch (error: any) {
        showAlert('Error', error.message);
      } finally {
        setIsProcessing(false);
      }
    } else {
      try {
        setIsProcessing(true);
        const origin = Platform.OS === 'web' && typeof window !== 'undefined' ? (window as any).location.origin : '';
        const response = await fetch(`${url}/payments/create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser?.id,
            purchaseType: 'premium',
            tier,
            duration,
            origin,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Purchase failed');

        const originParam = origin ? `&origin=${encodeURIComponent(origin)}` : '';
        const sessionParam = data.paymentSessionId ? `&paymentSessionId=${encodeURIComponent(data.paymentSessionId)}` : '';
        const checkoutUrl = `${url}/payments/checkout?orderId=${data.orderId}${sessionParam}&amount=${data.amount}&userId=${currentUser?.id}&purchaseType=premium&tier=${tier}&duration=${duration}${originParam}`;

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const width = 560;
          const height = 740;
          const left = Math.max(0, Math.round((window.innerWidth - width) / 2 + (window.screenX || 0)));
          const top = Math.max(0, Math.round((window.innerHeight - height) / 2 + (window.screenY || 0)));
          const popup = window.open(
            checkoutUrl,
            'cashfree_payment_window',
            `width=${width},height=${height},top=${top},left=${left},status=no,resizable=yes,scrollbars=yes`,
          );

          if (!popup || popup.closed || typeof popup.closed === 'undefined') {
            window.open(checkoutUrl, '_blank');
          }

          startPaymentMonitoring(currentUser?.credits || 0, 0, popup, true);
        } else {
          await WebBrowser.openBrowserAsync(checkoutUrl);
          await loadUser(true);
          showAlert('Payment Successful! 🎉', 'Your membership status has been updated!');
        }
      } catch (error: any) {
        showAlert('Error', error.message);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handlePurchasePremium = (tier: typeof premiumTiers[number]['id']) => {
    if (!currentUser || currentUser?.id === '1' || (currentUser as any)?.isDemo) {
      showAlert(
        'Login Required 🔒',
        'Please log in or create an account to purchase a premium subscription.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/login' as any) },
        ]
      );
      return;
    }
    const tierInfo = premiumTiers.find((t) => t.id === tier);
    if (!tierInfo) return;
    const price = selectedDuration === 'monthly' ? tierInfo.monthlyPrice : tierInfo.yearlyPrice;
    setCheckoutItem({
      type: 'premium',
      id: tier,
      name: `${tierInfo.name} Subscription`,
      price,
      duration: selectedDuration,
    });
    setCheckoutModalVisible(true);
  };



  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Store',
          headerStyle: {
            backgroundColor: Colors.light.background,
          },
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: '700',
            color: Colors.light.text,
          },
        }}
      />

      <View style={styles.header}>
        <View style={styles.balanceCard}>
          <View style={styles.balanceIcon}>
            <Coins size={24} color="#F59E0B" />
          </View>
          <View style={styles.balanceInfo}>
            <Text style={styles.balanceLabel}>Your Balance</Text>
            <Text style={styles.balanceAmount}>{currentUser?.credits || 0} Credits</Text>
          </View>
        </View>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'credits' && styles.tabActive]}
          onPress={() => setSelectedTab('credits')}
        >
          <Coins size={20} color={selectedTab === 'credits' ? Colors.light.primary : Colors.light.textSecondary} />
          <Text style={[styles.tabText, selectedTab === 'credits' && styles.tabTextActive]}>Buy Credits</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'premium' && styles.tabActive]}
          onPress={() => setSelectedTab('premium')}
        >
          <Crown size={20} color={selectedTab === 'premium' ? Colors.light.primary : Colors.light.textSecondary} />
          <Text style={[styles.tabText, selectedTab === 'premium' && styles.tabTextActive]}>Premium</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {selectedTab === 'credits' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Credit Packages</Text>
            <Text style={styles.sectionDescription}>
              1 credit = ₹1 face value. Use credits to request sessions, unlock features, and tip teachers.
            </Text>
            <View style={styles.packagesGrid}>
              {creditPackages.map((pkg) => {
                const totalCredits = pkg.credits + pkg.bonusCredits;
                return (
                  <View key={pkg.id} style={styles.packageCard}>
                    {pkg.popular && (
                      <View style={styles.popularBadge}>
                        <Zap size={12} color="#FFFFFF" fill="#FFFFFF" />
                        <Text style={styles.popularText}>POPULAR</Text>
                      </View>
                    )}
                    <View style={styles.packageIcon}>
                      <Coins size={32} color={Colors.light.primary} />
                    </View>
                    <Text style={styles.packageCredits}>{totalCredits}</Text>
                    <Text style={styles.packageLabel}>Credits</Text>
                    {pkg.bonusCredits > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <Sparkles size={12} color="#F59E0B" />
                        <Text style={{ fontSize: 11, fontWeight: '600', color: '#F59E0B' }}>+{pkg.bonusCredits} bonus</Text>
                      </View>
                    )}
                    <View style={styles.packageDivider} />
                    <Text style={styles.packagePrice}>{formatPrice(pkg.priceRupees)}</Text>
                    <TouchableOpacity
                      style={[
                        styles.packageButton,
                        isProcessing && styles.packageButtonDisabled,
                      ]}
                      onPress={() => handlePurchaseCredits(pkg.id as any)}
                      disabled={isProcessing}
                    >
                      <Text style={styles.packageButtonText}>
                        {isProcessing ? 'Processing...' : 'Buy Now'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Premium Membership</Text>
            <Text style={styles.sectionDescription}>
              Unlock unlimited swaps, priority matching, and exclusive features
            </Text>

            <View style={styles.durationSelector}>
              <TouchableOpacity
                style={[
                  styles.durationOption,
                  selectedDuration === 'monthly' && styles.durationOptionActive,
                ]}
                onPress={() => setSelectedDuration('monthly')}
              >
                <Text
                  style={[
                    styles.durationText,
                    selectedDuration === 'monthly' && styles.durationTextActive,
                  ]}
                >
                  Monthly
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.durationOption,
                  selectedDuration === 'yearly' && styles.durationOptionActive,
                ]}
                onPress={() => setSelectedDuration('yearly')}
              >
                <Text
                  style={[
                    styles.durationText,
                    selectedDuration === 'yearly' && styles.durationTextActive,
                  ]}
                >
                  Yearly
                </Text>
                <View style={styles.saveBadge}>
                  <Text style={styles.saveText}>Save 17%</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.tiersContainer}>
              {premiumTiers.map((tier) => (
                <View
                  key={tier.id}
                  style={[
                    styles.tierCard,
                    tier.popular && styles.tierCardPopular,
                  ]}
                >
                  {tier.popular && (
                    <View style={styles.tierPopularBadge}>
                      <Crown size={14} color="#FFFFFF" fill="#FFFFFF" />
                      <Text style={styles.tierPopularText}>MOST POPULAR</Text>
                    </View>
                  )}
                  <View style={[styles.tierIcon, { backgroundColor: tier.color }]}>
                    <Crown size={28} color="#FFFFFF" />
                  </View>
                  <Text style={styles.tierName}>{tier.name}</Text>
                  <View style={styles.tierPriceContainer}>
                    <Text style={styles.tierPrice}>
                      {formatPrice(selectedDuration === 'monthly' ? tier.monthlyPrice : tier.yearlyPrice)}
                    </Text>
                    <Text style={styles.tierPricePeriod}>/{selectedDuration === 'monthly' ? 'mo' : 'yr'}</Text>
                  </View>
                  <View style={styles.tierCreditsInfo}>
                    <Coins size={16} color={tier.color} />
                    <Text style={styles.tierCreditsText}>{tier.monthlyCredits} credits/month</Text>
                  </View>
                  <View style={styles.tierFeatures}>
                    {tier.features.map((feature, index) => (
                      <View key={index} style={styles.tierFeature}>
                        <Check size={18} color={tier.color} strokeWidth={2.5} />
                        <Text style={styles.tierFeatureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.tierButton,
                      { backgroundColor: tier.color },
                      isProcessing && styles.tierButtonDisabled,
                    ]}
                    onPress={() => handlePurchasePremium(tier.id)}
                    disabled={isProcessing}
                  >
                    <Text style={styles.tierButtonText}>
                      {isProcessing ? 'Processing...' : 'Subscribe'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Custom Checkout Modal Overlay */}
      {checkoutModalVisible && checkoutItem && (
        <View style={styles.overlayContainer}>
          <TouchableOpacity
            style={styles.overlayBackdrop}
            activeOpacity={1}
            onPress={() => setCheckoutModalVisible(false)}
          />
          <View style={styles.modalContentCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Checkout Options</Text>
              <TouchableOpacity onPress={() => setCheckoutModalVisible(false)} style={styles.modalCloseButton}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalItemDetails}>
              <View style={[styles.modalItemIconWrap, { backgroundColor: checkoutItem.type === 'premium' ? Colors.light.primaryLight : '#FEF3C7' }]}>
                {checkoutItem.type === 'premium' ? (
                  <Crown size={28} color={Colors.light.primary} />
                ) : (
                  <Coins size={28} color="#F59E0B" />
                )}
              </View>
              <Text style={styles.modalItemName}>{checkoutItem.name}</Text>
              <Text style={styles.modalItemPrice}>
                {formatPrice(checkoutItem.price)}
                {checkoutItem.type === 'premium' && `/${checkoutItem.duration === 'monthly' ? 'mo' : 'yr'}`}
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.modalActionButtonPrimary]}
                onPress={() => {
                  setCheckoutModalVisible(false);
                  if (checkoutItem.type === 'credits') {
                    executePurchaseCredits(checkoutItem.id as any, 'gateway');
                  } else {
                    executePurchasePremium(checkoutItem.id as any, checkoutItem.duration!, 'gateway');
                  }
                }}
              >
                <Text style={styles.modalActionButtonText}>Continue to Payment Gateway</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalActionButton, styles.modalActionButtonSecondary]}
                onPress={() => {
                  setCheckoutModalVisible(false);
                  if (checkoutItem.type === 'credits') {
                    executePurchaseCredits(checkoutItem.id as any, 'trial');
                  } else {
                    executePurchasePremium(checkoutItem.id as any, checkoutItem.duration!, 'trial');
                  }
                }}
              >
                <Text style={[styles.modalActionButtonText, styles.modalActionButtonTextSecondary]}>
                  Trial Payment (Free)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  balanceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  balanceInfo: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  tabActive: {
    backgroundColor: Colors.light.primaryLight,
    borderColor: Colors.light.primary,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  tabTextActive: {
    color: Colors.light.primary,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    marginBottom: 20,
    lineHeight: 22,
  },
  packagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  packageCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    paddingTop: 20,
    alignItems: 'center',
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    elevation: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  popularText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  packageIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  packageCredits: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  packageLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 12,
  },
  packageDivider: {
    width: '100%',
    height: 1,
    backgroundColor: Colors.light.borderLight,
    marginVertical: 12,
  },
  packagePrice: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.light.primary,
    marginBottom: 12,
  },
  packageButton: {
    width: '100%',
    backgroundColor: Colors.light.primary,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  packageButtonDisabled: {
    opacity: 0.6,
  },
  packageButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  durationSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  durationOption: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: Colors.light.borderLight,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    position: 'relative',
  },
  durationOptionActive: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.primaryLight,
  },
  durationText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  durationTextActive: {
    color: Colors.light.primary,
  },
  saveBadge: {
    position: 'absolute',
    top: -8,
    right: 12,
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  saveText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  tiersContainer: {
    gap: 16,
    marginBottom: 20,
  },
  tierCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    position: 'relative',
  },
  tierCardPopular: {
    borderWidth: 2,
    borderColor: Colors.light.primary,
  },
  tierPopularBadge: {
    position: 'absolute',
    top: -12,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.light.primary,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  tierPopularText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  tierIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  tierName: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  tierPriceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  tierPrice: {
    fontSize: 36,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  tierPricePeriod: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginLeft: 4,
  },
  tierCreditsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  tierCreditsText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  tierFeatures: {
    gap: 12,
    marginBottom: 24,
  },
  tierFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tierFeatureText: {
    fontSize: 15,
    color: Colors.light.text,
    flex: 1,
  },
  tierButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  tierButtonDisabled: {
    opacity: 0.6,
  },
  tierButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  overlayBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  modalContentCard: {
    width: '90%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#0F172A',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#64748B',
  },
  modalItemDetails: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalItemIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalItemName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#0F172A',
    marginBottom: 4,
  },
  modalItemPrice: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.light.primary,
  },
  modalActions: {
    gap: 12,
  },
  modalActionButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionButtonPrimary: {
    backgroundColor: Colors.light.primary,
  },
  modalActionButtonSecondary: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalActionButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  modalActionButtonTextSecondary: {
    color: '#0F172A',
  },
});

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, useWindowDimensions } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeTopInset } from '@/lib/safeArea';
import { ArrowLeft, Coins, Wallet, Building2, Smartphone, Globe, Check } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import Colors from '@/constants/colors';
import { formatPrice } from '@/constants/locale';
import { useCurrentUser } from '@/providers/current-user';
import { useEarnings } from '@/providers/earnings';
import { useAlert } from '@/providers/alert';
import type { PayoutMethod } from '@/types';
import { getPayoutRate, MIN_PAYOUT_CREDITS } from '@/lib/payments';

type Method = PayoutMethod;

const METHODS: { id: Method; label: string; icon: typeof Wallet; rate: string; desc: string; notes: string }[] = [
  { id: 'store_credit', label: 'Store Credit', icon: Wallet, rate: '₹1.00/credit', desc: 'Convert to in-app credits instantly', notes: 'Instant, no fee' },
  { id: 'upi', label: 'UPI Transfer', icon: Smartphone, rate: '₹0.80/credit', desc: 'Direct transfer to UPI ID', notes: '3-5 business days' },
  { id: 'bank_transfer', label: 'Bank Transfer', icon: Building2, rate: '₹0.80/credit', desc: 'NEFT/IMPS to bank account', notes: '3-5 business days' },
  { id: 'paypal', label: 'PayPal', icon: Globe, rate: '₹0.75/credit', desc: 'International PayPal transfer', notes: 'International fee' },
];

export default function PayoutScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const isSmallScreen = windowWidth < 600;
  const safeTop = useSafeTopInset(isSmallScreen ? 8 : 14);
  const { currentUser } = useCurrentUser();
  const { getSummary, creditsToRupees, requestPayout, minPayoutCredits } = useEarnings();
  const { showAlert } = useAlert();

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

  const [selectedMethod, setSelectedMethod] = useState<Method>('store_credit');
  const [pointsInput, setPointsInput] = useState<string>('');
  const [upiId, setUpiId] = useState<string>('');
  const [accountName, setAccountName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [ifscCode, setIfscCode] = useState<string>('');
  const [paypalEmail, setPaypalEmail] = useState<string>('');

  const requestedPoints = parseInt(pointsInput || '0', 10);
  const minCredits = minPayoutCredits || MIN_PAYOUT_CREDITS;
  const isValid =
    requestedPoints >= minCredits &&
    requestedPoints <= summary.availablePoints &&
    (selectedMethod === 'store_credit' ||
      (selectedMethod === 'upi' && upiId.trim().length > 4) ||
      (selectedMethod === 'bank_transfer' &&
        accountName.trim() &&
        accountNumber.trim().length > 5 &&
        ifscCode.trim().length > 4) ||
      (selectedMethod === 'paypal' && paypalEmail.includes('@')));

  const handleSubmit = async () => {
    if (!isValid) {
      showAlert('Invalid Request', 'Please check your inputs and try again.');
      return;
    }
    if (!currentUser) return;

    await requestPayout({
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatarUrl,
      points: requestedPoints,
      method: selectedMethod,
      payoutDetails:
        selectedMethod === 'upi'
          ? { upiId }
          : selectedMethod === 'bank_transfer'
          ? { accountName, accountNumber, ifscCode }
          : selectedMethod === 'paypal'
          ? { paypalEmail }
          : undefined,
    });
    showAlert(
      'Request Submitted!',
      `Your payout of ${requestedPoints} credits (≈ ${formatPrice(creditsToRupees(requestedPoints, selectedMethod))}) is pending review.`,
      [{ text: 'OK', onPress: () => router.replace('/earnings' as any) }]
    );
  };

  return (
    <View style={s.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, isSmallScreen && s.headerMobile, { paddingTop: safeTop }]}>
        <TouchableOpacity onPress={() => router.back()} style={[s.backBtn, isSmallScreen && s.backBtnMobile]}>
          <ArrowLeft size={isSmallScreen ? 18 : 22} color={Colors.light.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, isSmallScreen && s.headerTitleMobile]}>Redeem Credits</Text>
        <View style={{ width: isSmallScreen ? 34 : 44 }} />
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={[s.balanceCard, isSmallScreen && s.balanceCardMobile]}>
          <Coins size={isSmallScreen ? 20 : 24} color="#6366F1" />
          <View style={{ flex: 1 }}>
            <Text style={[s.balanceLabel, isSmallScreen && s.balanceLabelMobile]}>Available Balance</Text>
            <Text style={[s.balanceValue, isSmallScreen && s.balanceValueMobile]}>{summary.availablePoints.toLocaleString()} credits</Text>
            <Text style={[s.balanceCurrency, isSmallScreen && s.balanceCurrencyMobile]}>≈ {formatPrice(creditsToRupees(summary.availablePoints, selectedMethod))}</Text>
          </View>
        </View>

        <Text style={[s.label, isSmallScreen && s.labelMobile]}>Select Payout Method</Text>
        <View style={[s.methodsList, isSmallScreen && s.methodsListMobile]}>
          {METHODS.map((m) => {
            const active = selectedMethod === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[s.methodCard, isSmallScreen && s.methodCardMobile, active && s.methodCardActive]}
                onPress={() => setSelectedMethod(m.id)}
                activeOpacity={0.7}
              >
                <View style={[s.methodIcon, isSmallScreen && s.methodIconMobile, { backgroundColor: active ? Colors.light.primaryLight : Colors.light.backgroundTertiary }]}>
                  <m.icon size={isSmallScreen ? 16 : 20} color={active ? Colors.light.primary : Colors.light.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={[s.methodLabel, isSmallScreen && s.methodLabelMobile, active && s.methodLabelActive]}>{m.label}</Text>
                    <View style={{ backgroundColor: active ? Colors.light.primary : '#E2E8F0', paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 5 }}>
                      <Text style={{ fontSize: isSmallScreen ? 9.5 : 11, fontWeight: '700', color: active ? '#FFFFFF' : '#475569' }}>{m.rate}</Text>
                    </View>
                  </View>
                  <Text style={[s.methodDesc, isSmallScreen && s.methodDescMobile]}>{m.desc} • <Text style={{ fontWeight: '600' }}>{m.notes}</Text></Text>
                </View>
                {active && <Check size={isSmallScreen ? 16 : 20} color={Colors.light.primary} />}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[s.label, isSmallScreen && s.labelMobile]}>Credits to Redeem (Min. {minCredits} credits)</Text>
        <View style={[s.inputWrap, isSmallScreen && s.inputWrapMobile]}>
          <Coins size={isSmallScreen ? 15 : 18} color={Colors.light.textSecondary} />
          <TextInput
            style={[s.input, isSmallScreen && s.inputMobile]}
            value={pointsInput}
            onChangeText={setPointsInput}
            placeholder="Enter credit amount"
            placeholderTextColor={Colors.light.textTertiary}
            keyboardType="numeric"
          />
          <TouchableOpacity onPress={() => setPointsInput(String(summary.availablePoints))}>
            <Text style={[s.maxBtn, isSmallScreen && s.maxBtnMobile]}>MAX</Text>
          </TouchableOpacity>
        </View>
        {requestedPoints > 0 && (
          <View style={[s.previewCard, isSmallScreen && s.previewCardMobile]}>
            <Text style={[s.previewLabel, isSmallScreen && s.previewLabelMobile]}>You'll receive</Text>
            <Text style={[s.previewValue, isSmallScreen && s.previewValueMobile]}>{formatPrice(creditsToRupees(requestedPoints, selectedMethod))}</Text>
          </View>
        )}

        {selectedMethod === 'upi' && (
          <>
            <Text style={[s.label, isSmallScreen && s.labelMobile]}>UPI ID</Text>
            <View style={[s.inputWrap, isSmallScreen && s.inputWrapMobile]}>
              <TextInput style={[s.input, isSmallScreen && s.inputMobile]} value={upiId} onChangeText={setUpiId} placeholder="yourname@upi" placeholderTextColor={Colors.light.textTertiary} autoCapitalize="none" />
            </View>
          </>
        )}

        {selectedMethod === 'bank_transfer' && (
          <>
            <Text style={[s.label, isSmallScreen && s.labelMobile]}>Account Holder Name</Text>
            <View style={[s.inputWrap, isSmallScreen && s.inputWrapMobile]}>
              <TextInput style={[s.input, isSmallScreen && s.inputMobile]} value={accountName} onChangeText={setAccountName} placeholder="Full name" placeholderTextColor={Colors.light.textTertiary} />
            </View>
            <Text style={[s.label, isSmallScreen && s.labelMobile]}>Account Number</Text>
            <View style={[s.inputWrap, isSmallScreen && s.inputWrapMobile]}>
              <TextInput style={[s.input, isSmallScreen && s.inputMobile]} value={accountNumber} onChangeText={setAccountNumber} placeholder="Bank account number" placeholderTextColor={Colors.light.textTertiary} keyboardType="numeric" />
            </View>
            <Text style={[s.label, isSmallScreen && s.labelMobile]}>IFSC Code</Text>
            <View style={[s.inputWrap, isSmallScreen && s.inputWrapMobile]}>
              <TextInput style={[s.input, isSmallScreen && s.inputMobile]} value={ifscCode} onChangeText={setIfscCode} placeholder="e.g. HDFC0001234" placeholderTextColor={Colors.light.textTertiary} autoCapitalize="characters" />
            </View>
          </>
        )}

        {selectedMethod === 'paypal' && (
          <>
            <Text style={[s.label, isSmallScreen && s.labelMobile]}>PayPal Email</Text>
            <View style={[s.inputWrap, isSmallScreen && s.inputWrapMobile]}>
              <TextInput style={[s.input, isSmallScreen && s.inputMobile]} value={paypalEmail} onChangeText={setPaypalEmail} placeholder="you@email.com" placeholderTextColor={Colors.light.textTertiary} autoCapitalize="none" keyboardType="email-address" />
            </View>
          </>
        )}

        <TouchableOpacity
          style={[s.submitBtn, isSmallScreen && s.submitBtnMobile, !isValid && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={!isValid}
          activeOpacity={0.85}
        >
          <Text style={[s.submitBtnText, isSmallScreen && s.submitBtnTextMobile]}>Submit Payout Request</Text>
        </TouchableOpacity>

        <View style={[s.noteCard, isSmallScreen && s.noteCardMobile]}>
          <Text style={{ fontSize: isSmallScreen ? 12.5 : 14, fontWeight: '700', color: Colors.light.text, marginBottom: 6 }}>Payout Rates & Rules</Text>
          <View style={{ gap: isSmallScreen ? 4 : 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[s.noteText, isSmallScreen && s.noteTextMobile]}>• Store Credit:</Text>
              <Text style={{ fontSize: isSmallScreen ? 10.5 : 12, fontWeight: '700', color: '#10B981' }}>₹1.00/credit (Instant, no fee)</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[s.noteText, isSmallScreen && s.noteTextMobile]}>• UPI Transfer:</Text>
              <Text style={{ fontSize: isSmallScreen ? 10.5 : 12, fontWeight: '700', color: Colors.light.text }}>₹0.80/credit (3-5 business days)</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[s.noteText, isSmallScreen && s.noteTextMobile]}>• Bank Transfer:</Text>
              <Text style={{ fontSize: isSmallScreen ? 10.5 : 12, fontWeight: '700', color: Colors.light.text }}>₹0.80/credit (3-5 business days)</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[s.noteText, isSmallScreen && s.noteTextMobile]}>• PayPal:</Text>
              <Text style={{ fontSize: isSmallScreen ? 10.5 : 12, fontWeight: '700', color: Colors.light.text }}>₹0.75/credit (International fee)</Text>
            </View>
            <View style={{ height: 1, backgroundColor: Colors.light.borderLight, marginVertical: 4 }} />
            <Text style={{ fontSize: isSmallScreen ? 10.5 : 12, color: Colors.light.textSecondary, fontWeight: '600' }}>
              • Minimum payout requirement: {minCredits} credits (₹{creditsToRupees(minCredits, selectedMethod).toFixed(2)} value)
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.backgroundSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.light.card, borderBottomWidth: 1, borderBottomColor: Colors.light.borderLight },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.light.backgroundTertiary, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.light.text },
  scroll: { flex: 1 },
  balanceCard: { flexDirection: 'row', alignItems: 'center', gap: 14, margin: 20, backgroundColor: '#0F172A', borderRadius: 18, padding: 18 },
  balanceLabel: { fontSize: 12, color: '#94A3B8', fontWeight: '500' as const, marginBottom: 4 },
  balanceValue: { fontSize: 24, fontWeight: '800' as const, color: '#FFFFFF', marginBottom: 2 },
  balanceCurrency: { fontSize: 13, color: '#6366F1', fontWeight: '600' as const },
  label: { fontSize: 14, fontWeight: '700' as const, color: Colors.light.text, marginBottom: 10, marginTop: 8, paddingHorizontal: 20 },
  methodsList: { paddingHorizontal: 20, gap: 10, marginBottom: 12 },
  methodCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.light.card, borderRadius: 14, padding: 14, borderWidth: 2, borderColor: Colors.light.borderLight },
  methodCardActive: { borderColor: Colors.light.primary, backgroundColor: Colors.light.primaryLight + '10' },
  methodIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  methodLabel: { fontSize: 15, fontWeight: '700' as const, color: Colors.light.text, marginBottom: 2 },
  methodLabelActive: { color: Colors.light.primary },
  methodDesc: { fontSize: 12, color: Colors.light.textSecondary },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, backgroundColor: Colors.light.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.light.borderLight, marginBottom: 10 },
  input: { flex: 1, fontSize: 15, color: Colors.light.text, fontWeight: '500' as const },
  maxBtn: { fontSize: 13, fontWeight: '700' as const, color: Colors.light.primary, letterSpacing: 0.5 },
  previewCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, backgroundColor: Colors.light.primaryLight + '15', borderRadius: 12, padding: 14, marginBottom: 16 },
  previewLabel: { fontSize: 14, color: Colors.light.textSecondary, fontWeight: '600' as const },
  previewValue: { fontSize: 20, fontWeight: '800' as const, color: Colors.light.primary },
  submitBtn: { marginHorizontal: 20, marginTop: 12, backgroundColor: Colors.light.primary, paddingVertical: 16, borderRadius: 16, alignItems: 'center', shadowColor: Colors.light.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  submitBtnText: { fontSize: 16, fontWeight: '700' as const, color: '#FFFFFF' },
  noteCard: { marginHorizontal: 20, marginTop: 16, backgroundColor: Colors.light.backgroundTertiary, borderRadius: 12, padding: 14 },
  noteText: { fontSize: 12, color: Colors.light.textSecondary, lineHeight: 20 },
  headerMobile: { paddingHorizontal: 12, paddingVertical: 10 },
  backBtnMobile: { width: 34, height: 34, borderRadius: 17 },
  headerTitleMobile: { fontSize: 16 },
  balanceCardMobile: { margin: 12, padding: 12, borderRadius: 14, gap: 10 },
  balanceLabelMobile: { fontSize: 11, marginBottom: 2 },
  balanceValueMobile: { fontSize: 18, marginBottom: 1 },
  balanceCurrencyMobile: { fontSize: 11.5 },
  labelMobile: { fontSize: 12.5, marginBottom: 6, marginTop: 4, paddingHorizontal: 12 },
  methodsListMobile: { paddingHorizontal: 12, gap: 8, marginBottom: 8 },
  methodCardMobile: { padding: 10, borderRadius: 10, gap: 8 },
  methodIconMobile: { width: 34, height: 34, borderRadius: 10 },
  methodLabelMobile: { fontSize: 13, marginBottom: 1 },
  methodDescMobile: { fontSize: 10.5 },
  inputWrapMobile: { marginHorizontal: 12, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, marginBottom: 8 },
  inputMobile: { fontSize: 13 },
  maxBtnMobile: { fontSize: 11.5 },
  previewCardMobile: { marginHorizontal: 12, padding: 10, borderRadius: 10, marginBottom: 12 },
  previewLabelMobile: { fontSize: 12 },
  previewValueMobile: { fontSize: 16 },
  submitBtnMobile: { marginHorizontal: 12, marginTop: 8, paddingVertical: 12, borderRadius: 12 },
  submitBtnTextMobile: { fontSize: 13.5 },
  noteCardMobile: { marginHorizontal: 12, marginTop: 12, padding: 10, borderRadius: 10 },
  noteTextMobile: { fontSize: 10.5, lineHeight: 16 },
});

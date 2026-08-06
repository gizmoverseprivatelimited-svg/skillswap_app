import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, TextInput, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { ShieldCheck, Mail, Smartphone, Linkedin, Globe, ChevronRight, Award, ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import Colors from '@/constants/colors';
import { VerificationCard } from '@/components/VerificationCard';
import { TrustScoreBadge } from '@/components/TrustScoreBadge';
import { SkillBadge } from '@/components/SkillBadge';

export default function VerificationScreen() {
  const [activeForm, setActiveForm] = useState<string | null>(null);
  const [phone, setPhone] = useState<string>('');
  const [linkedIn, setLinkedIn] = useState<string>('');
  const [portfolio, setPortfolio] = useState<string>('');

  const verificationsQuery = trpc.verification.getVerifications.useQuery();
  const verifyEmailMutation = trpc.verification.verifyEmail.useMutation();
  const submitIdentityMutation = trpc.verification.submitIdentity.useMutation();
  const verifyPhoneMutation = trpc.verification.verifyPhone.useMutation();
  const verifyLinkedInMutation = trpc.verification.verifyLinkedIn.useMutation();
  const verifyPortfolioMutation = trpc.verification.verifyPortfolio.useMutation();

  const verifications = verificationsQuery.data;

  const handleVerifyEmail = async () => {
    try {
      await verifyEmailMutation.mutateAsync();
      await verificationsQuery.refetch();
      Alert.alert('Success', 'Email verified successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to verify email');
      console.error('[Verification] Email error:', error);
    }
  };

  const handleSubmitIdentity = async () => {
    try {
      await submitIdentityMutation.mutateAsync({ documentType: 'passport', frontImageUrl: 'https://via.placeholder.com/800x600', backImageUrl: 'https://via.placeholder.com/800x600' });
      setActiveForm(null);
      await verificationsQuery.refetch();
      Alert.alert('Submitted', 'Your identity document has been submitted for review.');
    } catch (error) {
      Alert.alert('Error', 'Failed to submit identity verification');
      console.error('[Verification] Identity error:', error);
    }
  };

  const handleVerifyPhone = async () => {
    if (!phone || phone.length < 10) { Alert.alert('Invalid', 'Please enter a valid phone number'); return; }
    try {
      await verifyPhoneMutation.mutateAsync({ phoneNumber: phone });
      setActiveForm(null);
      await verificationsQuery.refetch();
      Alert.alert('Success', 'Phone number verified!');
    } catch (error) {
      Alert.alert('Error', 'Failed to verify phone number');
      console.error('[Verification] Phone error:', error);
    }
  };

  const handleVerifyLinkedIn = async () => {
    if (!linkedIn || !linkedIn.includes('linkedin.com')) { Alert.alert('Invalid', 'Please enter a valid LinkedIn URL'); return; }
    try {
      await verifyLinkedInMutation.mutateAsync({ linkedInUrl: linkedIn });
      setActiveForm(null);
      await verificationsQuery.refetch();
      Alert.alert('Success', 'LinkedIn profile verified!');
    } catch (error) {
      Alert.alert('Error', 'Failed to verify LinkedIn profile');
      console.error('[Verification] LinkedIn error:', error);
    }
  };

  const handleVerifyPortfolio = async () => {
    if (!portfolio || !portfolio.startsWith('http')) { Alert.alert('Invalid', 'Please enter a valid portfolio URL'); return; }
    try {
      await verifyPortfolioMutation.mutateAsync({ portfolioUrl: portfolio });
      setActiveForm(null);
      await verificationsQuery.refetch();
      Alert.alert('Success', 'Portfolio verified!');
    } catch (error) {
      Alert.alert('Error', 'Failed to verify portfolio');
      console.error('[Verification] Portfolio error:', error);
    }
  };

  if (verificationsQuery.isLoading) {
    return (
      <View style={s.container}>
        <Stack.Screen options={{ headerShown: true, title: 'Verification', headerStyle: { backgroundColor: Colors.light.card }, headerTintColor: Colors.light.text }} />
        <View style={s.loadingContainer}><ActivityIndicator size="large" color={Colors.light.primary} /></View>
      </View>
    );
  }

  const formHeaderOpts = (title: string) => ({
    headerShown: true, title, headerStyle: { backgroundColor: Colors.light.card }, headerTintColor: Colors.light.text,
    headerLeft: () => <TouchableOpacity onPress={() => setActiveForm(null)} style={{ marginLeft: 8 }}><ArrowLeft size={24} color={Colors.light.text} /></TouchableOpacity>,
  });

  if (activeForm === 'identity') {
    return (
      <View style={s.container}>
        <Stack.Screen options={formHeaderOpts('Identity Verification')} />
        <ScrollView style={s.formContainer}>
          <Text style={s.formTitle}>Submit Identity Document</Text>
          <Text style={s.formDesc}>For demo purposes, this will auto-verify. In production, this would upload a government ID for manual review.</Text>
          <TouchableOpacity style={s.submitBtn} onPress={handleSubmitIdentity} disabled={submitIdentityMutation.isPending}>
            {submitIdentityMutation.isPending ? <ActivityIndicator color="#FFF" /> : <Text style={s.submitBtnText}>Submit Document</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (activeForm === 'phone') {
    return (
      <View style={s.container}>
        <Stack.Screen options={formHeaderOpts('Phone Verification')} />
        <ScrollView style={s.formContainer}>
          <Text style={s.formTitle}>Verify Phone Number</Text>
          <Text style={s.formDesc}>Enter your phone number to verify your account.</Text>
          <TextInput style={s.input} placeholder="+91 98765 43210" placeholderTextColor={Colors.light.textSecondary} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <TouchableOpacity style={s.submitBtn} onPress={handleVerifyPhone} disabled={verifyPhoneMutation.isPending}>
            {verifyPhoneMutation.isPending ? <ActivityIndicator color="#FFF" /> : <Text style={s.submitBtnText}>Verify Phone</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (activeForm === 'linkedin') {
    return (
      <View style={s.container}>
        <Stack.Screen options={formHeaderOpts('LinkedIn Verification')} />
        <ScrollView style={s.formContainer}>
          <Text style={s.formTitle}>Connect LinkedIn</Text>
          <Text style={s.formDesc}>Enter your LinkedIn profile URL to verify your professional background.</Text>
          <TextInput style={s.input} placeholder="https://linkedin.com/in/yourprofile" placeholderTextColor={Colors.light.textSecondary} value={linkedIn} onChangeText={setLinkedIn} keyboardType="url" autoCapitalize="none" />
          <TouchableOpacity style={s.submitBtn} onPress={handleVerifyLinkedIn} disabled={verifyLinkedInMutation.isPending}>
            {verifyLinkedInMutation.isPending ? <ActivityIndicator color="#FFF" /> : <Text style={s.submitBtnText}>Connect LinkedIn</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (activeForm === 'portfolio') {
    return (
      <View style={s.container}>
        <Stack.Screen options={formHeaderOpts('Portfolio Verification')} />
        <ScrollView style={s.formContainer}>
          <Text style={s.formTitle}>Add Portfolio</Text>
          <Text style={s.formDesc}>Add your portfolio website to showcase your work.</Text>
          <TextInput style={s.input} placeholder="https://yourportfolio.com" placeholderTextColor={Colors.light.textSecondary} value={portfolio} onChangeText={setPortfolio} keyboardType="url" autoCapitalize="none" />
          <TouchableOpacity style={s.submitBtn} onPress={handleVerifyPortfolio} disabled={verifyPortfolioMutation.isPending}>
            {verifyPortfolioMutation.isPending ? <ActivityIndicator color="#FFF" /> : <Text style={s.submitBtnText}>Add Portfolio</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Stack.Screen options={{ headerShown: true, title: 'Verification', headerStyle: { backgroundColor: Colors.light.card }, headerTintColor: Colors.light.text }} />
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <TrustScoreBadge score={verifications?.trustScore ?? 0} size="large" showLabel={true} />
          <Text style={s.headerTitle}>Build Your Trust Score</Text>
          <Text style={s.headerSubtitle}>Verify your identity to increase credibility and unlock more opportunities</Text>
        </View>
        <View style={s.section}>
          <View style={{ marginBottom: 16 }}>
            <Text style={s.sectionTitle}>Verifications</Text>
            <Text style={{ fontSize: 14, color: Colors.light.textSecondary }}>
              {[verifications?.identity, verifications?.email, verifications?.phone, verifications?.linkedIn, verifications?.portfolio].filter((v) => v?.status === 'verified').length}/5 Completed
            </Text>
          </View>
          <View style={{ gap: 12 }}>
            <VerificationCard title="Identity Verification" description="Verify your identity with a government-issued ID" status={verifications?.identity.status ?? 'none'} icon={<ShieldCheck size={24} color="#6366F1" />} onPress={() => { if (verifications?.identity.status === 'none') setActiveForm('identity'); }} trustPoints={30} />
            <VerificationCard title="Email Verification" description="Confirm your email address" status={verifications?.email.status ?? 'none'} icon={<Mail size={24} color="#10B981" />} onPress={handleVerifyEmail} trustPoints={10} />
            <VerificationCard title="Phone Number" description="Add and verify your phone number" status={verifications?.phone.status ?? 'none'} icon={<Smartphone size={24} color="#F59E0B" />} onPress={() => setActiveForm('phone')} trustPoints={10} />
            <VerificationCard title="LinkedIn Profile" description="Connect your professional LinkedIn account" status={verifications?.linkedIn.status ?? 'none'} icon={<Linkedin size={24} color="#0A66C2" />} onPress={() => setActiveForm('linkedin')} trustPoints={20} />
            <VerificationCard title="Portfolio Website" description="Showcase your work with a portfolio link" status={verifications?.portfolio.status ?? 'none'} icon={<Globe size={24} color="#8B5CF6" />} onPress={() => setActiveForm('portfolio')} trustPoints={15} />
          </View>
        </View>
        {verifications && verifications.skillBadges.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Skill Badges</Text>
            <View style={{ gap: 12 }}>{verifications.skillBadges.map((badge) => <SkillBadge key={badge.id} badge={badge} size="medium" />)}</View>
          </View>
        )}
        <TouchableOpacity style={s.infoCard} onPress={() => Alert.alert('About Trust Score', 'Your Trust Score helps other users know they can rely on you. Complete verifications to increase your score.')}>
          <View style={s.infoIcon}><Award size={24} color={Colors.light.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700' as const, color: Colors.light.text, marginBottom: 4 }}>Why verify your account?</Text>
            <Text style={{ fontSize: 13, color: Colors.light.textSecondary, lineHeight: 18 }}>Verified users get more swap requests and build stronger connections</Text>
          </View>
          <ChevronRight size={20} color={Colors.light.textSecondary} />
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.backgroundSecondary },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20, backgroundColor: Colors.light.card, borderBottomWidth: 1, borderBottomColor: Colors.light.borderLight },
  headerTitle: { fontSize: 24, fontWeight: '800' as const, color: Colors.light.text, marginTop: 16, marginBottom: 8 },
  headerSubtitle: { fontSize: 15, color: Colors.light.textSecondary, textAlign: 'center', lineHeight: 22 },
  section: { padding: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.light.text, marginBottom: 4 },
  infoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.light.card, padding: 16, marginHorizontal: 20, marginBottom: 20, borderRadius: 16, gap: 12, borderWidth: 1, borderColor: Colors.light.borderLight },
  infoIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.light.primaryLight, alignItems: 'center', justifyContent: 'center' },
  formContainer: { flex: 1, padding: 20 },
  formTitle: { fontSize: 24, fontWeight: '800' as const, color: Colors.light.text, marginBottom: 8 },
  formDesc: { fontSize: 15, color: Colors.light.textSecondary, lineHeight: 22, marginBottom: 24 },
  input: { backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: Colors.light.text, marginBottom: 16 },
  submitBtn: { backgroundColor: Colors.light.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center', shadowColor: Colors.light.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitBtnText: { fontSize: 16, fontWeight: '700' as const, color: '#FFF' },
});

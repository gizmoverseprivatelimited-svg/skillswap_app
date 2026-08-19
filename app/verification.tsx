import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  ShieldCheck,
  Mail,
  Smartphone,
  Linkedin,
  Globe,
  ChevronRight,
  Award,
  ArrowLeft,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
// import { trpc } from '@/lib/trpc';
import Colors from '@/constants/colors';
import { VerificationCard } from '@/components/VerificationCard';
import { TrustScoreBadge } from '@/components/TrustScoreBadge';
import { SkillBadge } from '@/components/SkillBadge';
import url from '@/constants/backurl';
import { useCurrentUser } from '@/providers/current-user';
import { useAlert } from '@/providers/alert';

type VerificationType =
  | 'identity'
  | 'email'
  | 'phone'
  | 'linkedin'
  | 'portfolio';

type VerificationStatus = 'none' | 'pending' | 'verified' | 'rejected';

interface VerificationItem {
  status: VerificationStatus;
  id?: string;
}


type StructuredVerifications = {
  trustScore: number;
  skillBadges: any[];
} & Record<VerificationType, VerificationItem>;

export default function VerificationScreen() {
  const { showAlert } = useAlert();

  const [showIdentityForm, setShowIdentityForm] = useState<boolean>(false);
  const [showPhoneForm, setShowPhoneForm] = useState<boolean>(false);
  const [showLinkedInForm, setShowLinkedInForm] = useState<boolean>(false);
  const [showPortfolioForm, setShowPortfolioForm] = useState<boolean>(false);
  const [phone, setPhone] = useState<string>('');
  const [linkedIn, setLinkedIn] = useState<string>('');
  const [portfolio, setPortfolio] = useState<string>('');
  const [verifications, setVerifications] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [documentUrl, setDocumentUrl] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [phoneOtpSent, setPhoneOtpSent] = useState<boolean>(false);
  const [otpCode, setOtpCode] = useState<string>('');
  // showEmailForm


  // const verificationsQuery = trpc.verification.getVerifications.useQuery();
  // const verifyEmailMutation = trpc.verification.verifyEmail.useMutation();
  // const submitIdentityMutation = trpc.verification.submitIdentity.useMutation();
  // const verifyPhoneMutation = trpc.verification.verifyPhone.useMutation();
  // const verifyLinkedInMutation = trpc.verification.verifyLinkedIn.useMutation();
  // const verifyPortfolioMutation = trpc.verification.verifyPortfolio.useMutation();

  // const verifications = verificationsQuery.data;

  const structured: StructuredVerifications = {
    identity: { status: 'none' },
    email: { status: 'none' },
    phone: { status: 'none' },
    linkedin: { status: 'none' },
    portfolio: { status: 'none' },
    trustScore: 0,
    skillBadges: [],
  };

  const router = useRouter();
  let { currentUser } = useCurrentUser();

  const checkGuestAndAction = (action: () => void) => {
    console.log('[Verification] Clicked card. currentUser:', currentUser);
    if (!currentUser || currentUser?.id === '1' || (currentUser as any)?.isDemo) {
      showAlert(
        'Login Required 🔒',
        'Please log in or create an account to use verification tools.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/login' as any) },
        ]
      );
      return;
    }
    action();
  };

  const fetchVerifications = async () => {
    if (currentUser?.id === '1') {
      const structured: StructuredVerifications = {
        identity: { status: 'none' },
        email: { status: 'none' },
        phone: { status: 'none' },
        linkedin: { status: 'none' },
        portfolio: { status: 'none' },
        trustScore: 0,
        skillBadges: [],
      };
      setVerifications(structured);
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${url}/verifications/my/${currentUser?.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch verifications from server');
      }

      const structured: StructuredVerifications = {
        identity: { status: 'none' },
        email: { status: 'none' },
        phone: { status: 'none' },
        linkedin: { status: 'none' },
        portfolio: { status: 'none' },
        trustScore: 0,
        skillBadges: [],
      };

      if (data && Array.isArray(data.verifications)) {
        data.verifications.forEach(
          (v: { type: VerificationType; status: VerificationStatus; _id: string }) => {
            structured[v.type] = {
              status: v.status,
              id: v._id,
            };
          }
        );
      }

      // simple trust score calculation
      const verifiedCount = Object.values(structured)
        .filter((v: any) => v?.status === 'verified').length;

      structured.trustScore = verifiedCount * 20;

      setVerifications(structured);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerifications();
  }, [currentUser?.id]);

  // const handleVerifyEmail = async () => {
  //   try {
  //     await verifyEmailMutation.mutateAsync();
  //     await verificationsQuery.refetch();
  //     Alert.alert('Success', 'Email verified successfully!');
  //   } catch (error) {
  //     Alert.alert('Error', 'Failed to verify email');
  //     console.error('[Verification] Email verification error:', error);
  //   }
  // };

  // const handleSubmitIdentity = async () => {
  //   try {
  //     await submitIdentityMutation.mutateAsync({
  //       documentType: 'passport',
  //       frontImageUrl: 'https://via.placeholder.com/800x600',
  //       backImageUrl: 'https://via.placeholder.com/800x600',
  //     });
  //     setShowIdentityForm(false);
  //     await verificationsQuery.refetch();
  //     Alert.alert(
  //       'Submitted',
  //       'Your identity document has been submitted for review. This usually takes 1-2 business days.'
  //     );
  //   } catch (error) {
  //     Alert.alert('Error', 'Failed to submit identity verification');
  //     console.error('[Verification] Identity submission error:', error);
  //   }
  // };

  // const handleVerifyPhone = async (phoneNumber: string) => {
  //   if (!phoneNumber || phoneNumber.length < 10) {
  //     Alert.alert('Invalid', 'Please enter a valid phone number');
  //     return;
  //   }

  //   try {
  //     await verifyPhoneMutation.mutateAsync({ phoneNumber });
  //     setShowPhoneForm(false);
  //     await verificationsQuery.refetch();
  //     Alert.alert('Success', 'Phone number verified!');
  //   } catch (error) {
  //     Alert.alert('Error', 'Failed to verify phone number');
  //     console.error('[Verification] Phone verification error:', error);
  //   }
  // };

  // const handleVerifyLinkedIn = async (linkedInUrl: string) => {
  //   if (!linkedInUrl || !linkedInUrl.includes('linkedin.com')) {
  //     Alert.alert('Invalid', 'Please enter a valid LinkedIn URL');
  //     return;
  //   }

  //   try {
  //     await verifyLinkedInMutation.mutateAsync({ linkedInUrl });
  //     setShowLinkedInForm(false);
  //     await verificationsQuery.refetch();
  //     Alert.alert('Success', 'LinkedIn profile verified!');
  //   } catch (error) {
  //     Alert.alert('Error', 'Failed to verify LinkedIn profile');
  //     console.error('[Verification] LinkedIn verification error:', error);
  //   }
  // };

  // const handleVerifyPortfolio = async (portfolioUrl: string) => {
  //   if (!portfolioUrl || !portfolioUrl.startsWith('http')) {
  //     Alert.alert('Invalid', 'Please enter a valid portfolio URL');
  //     return;
  //   }

  //   try {
  //     await verifyPortfolioMutation.mutateAsync({ portfolioUrl });
  //     setShowPortfolioForm(false);
  //     await verificationsQuery.refetch();
  //     Alert.alert('Success', 'Portfolio verified!');
  //   } catch (error) {
  //     Alert.alert('Error', 'Failed to verify portfolio');
  //     console.error('[Verification] Portfolio verification error:', error);
  //   }
  // };

  const submitVerification = async (
    type: string,
    details: string,
    documentUrl?: string
  ) => {
    try {
      setLoading(true);

      const response = await fetch(`${url}/verifications/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, details, documentUrl, userId: currentUser?.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        showAlert('Error', data.message || 'Submission failed');
        return;
      }

      showAlert(
        'Submitted',
        'Your verification request has been sent to admin.'
      );

      setDocumentUrl('');
      setPhone('');
      setLinkedIn('');
      setPortfolio('');

      setShowIdentityForm(false);
      setShowPhoneForm(false);
      setShowLinkedInForm(false);
      setShowPortfolioForm(false);

      fetchVerifications();

    } catch (error) {
      showAlert('Error', 'Failed to submit verification');
    } finally {
      setLoading(false);
    }
  };

  const handleSendPhoneOtp = async () => {
    if (!phone) {
      showAlert('Error', 'Please enter your phone number');
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(`${url}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: phone }),
      });
      const data = await response.json();
      if (!response.ok) {
        showAlert('Error', data.message || 'Failed to send OTP');
        return;
      }
      setPhoneOtpSent(true);
      showAlert('Success', 'OTP sent to your phone via SMS');
    } catch (error) {
      showAlert('Error', 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (!otpCode) {
      showAlert('Error', 'Please enter the OTP');
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(`${url}/verifications/verify-phone-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: phone, code: otpCode, userId: currentUser?.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        showAlert('Error', data.message || 'Verification failed');
        return;
      }
      showAlert('Verified', 'Your phone number has been verified successfully!');
      setPhone('');
      setOtpCode('');
      setPhoneOtpSent(false);
      setShowPhoneForm(false);
      fetchVerifications();
    } catch (error) {
      showAlert('Error', 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      </View>
    );
  }

  if (showIdentityForm) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Identity Verification',
            headerStyle: { backgroundColor: Colors.light.card },
            headerTintColor: Colors.light.text,
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => setShowIdentityForm(false)}
                style={styles.backButton}
              >
                <ArrowLeft size={24} color={Colors.light.text} />
              </TouchableOpacity>
            ),
          }}
        />
        <ScrollView style={styles.formContainer}>
          <TextInput
            style={styles.input}
            placeholder="Document Image URL"
            value={documentUrl}
            onChangeText={setDocumentUrl}
          />

          <TouchableOpacity
            style={styles.submitButton}
            onPress={() => {
              if (!documentUrl) {
                showAlert('Error', 'Please enter document image URL');
                return;
              }

              submitVerification(
                'identity',
                'Government ID submitted',
                documentUrl
              );
            }}
          >
            <Text style={styles.submitButtonText}>Submit Document</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (showPhoneForm) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Phone Verification',
            headerStyle: { backgroundColor: Colors.light.card },
            headerTintColor: Colors.light.text,
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => {
                  setShowPhoneForm(false);
                  setPhoneOtpSent(false);
                  setOtpCode('');
                }}
                style={styles.backButton}
              >
                <ArrowLeft size={24} color={Colors.light.text} />
              </TouchableOpacity>
            ),
          }}
        />
        <ScrollView style={styles.formContainer}>
          <Text style={styles.formTitle}>Verify Phone Number</Text>
          <Text style={styles.formDescription}>
            {phoneOtpSent ? 'Enter the OTP sent to your phone.' : 'Enter your phone number to verify your account.'}
          </Text>
          
          {!phoneOtpSent ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="+91 98765 43210"
                placeholderTextColor={Colors.light.textSecondary}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSendPhoneOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Send OTP</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="Enter 6-digit OTP"
                placeholderTextColor={Colors.light.textSecondary}
                value={otpCode}
                onChangeText={setOtpCode}
                keyboardType="number-pad"
              />
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleVerifyPhoneOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Verify OTP</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  if (showEmailForm) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Email Verification',
            headerStyle: { backgroundColor: Colors.light.card },
            headerTintColor: Colors.light.text,
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => setShowEmailForm(false)}
                style={styles.backButton}
              >
                <ArrowLeft size={24} color={Colors.light.text} />
              </TouchableOpacity>
            ),
          }}
        />
        <ScrollView style={styles.formContainer}>
          <Text style={styles.formTitle}>Verify Email</Text>
          <Text style={styles.formDescription}>
            Enter your email to verify your account.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="example@gmail.com"
            placeholderTextColor={Colors.light.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.submitButton}
            onPress={() => submitVerification('email', email)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Verify Email</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (showLinkedInForm) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'LinkedIn Verification',
            headerStyle: { backgroundColor: Colors.light.card },
            headerTintColor: Colors.light.text,
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => setShowLinkedInForm(false)}
                style={styles.backButton}
              >
                <ArrowLeft size={24} color={Colors.light.text} />
              </TouchableOpacity>
            ),
          }}
        />
        <ScrollView style={styles.formContainer}>
          <Text style={styles.formTitle}>Connect LinkedIn</Text>
          <Text style={styles.formDescription}>
            Enter your LinkedIn profile URL to verify your professional background.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="https://linkedin.com/in/yourprofile"
            placeholderTextColor={Colors.light.textSecondary}
            value={linkedIn}
            onChangeText={setLinkedIn}
            keyboardType="url"
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.submitButton}
            onPress={() => submitVerification('linkedin', linkedIn)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Connect LinkedIn</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (showPortfolioForm) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Portfolio Verification',
            headerStyle: { backgroundColor: Colors.light.card },
            headerTintColor: Colors.light.text,
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => setShowPortfolioForm(false)}
                style={styles.backButton}
              >
                <ArrowLeft size={24} color={Colors.light.text} />
              </TouchableOpacity>
            ),
          }}
        />
        <ScrollView style={styles.formContainer}>
          <Text style={styles.formTitle}>Add Portfolio</Text>
          <Text style={styles.formDescription}>
            Add your portfolio website to showcase your work.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="https://yourportfolio.com"
            placeholderTextColor={Colors.light.textSecondary}
            value={portfolio}
            onChangeText={setPortfolio}
            keyboardType="url"
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.submitButton}
            onPress={() => submitVerification('portfolio', portfolio)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Add Portfolio</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Verification',
          headerStyle: { backgroundColor: Colors.light.card },
          headerTintColor: Colors.light.text,
        }}
      />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TrustScoreBadge
            score={verifications?.trustScore ?? 0}
            size="large"
            showLabel={true}
          />
          <Text style={styles.headerTitle}>Build Your Trust Score</Text>
          <Text style={styles.headerSubtitle}>
            Verify your identity to increase credibility and unlock more opportunities
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Verifications</Text>
            <Text style={styles.sectionSubtitle}>
              {
                [
                  verifications?.identity?.status,
                  verifications?.email?.status,
                  verifications?.phone?.status,
                  verifications?.linkedIn?.status,
                  verifications?.portfolio?.status,
                ].filter((v) => v === 'verified').length
              }
              /5 Completed
            </Text>
          </View>

          <View style={styles.cardList}>
            <VerificationCard
              title="Identity Verification"
              description="Verify your identity with a government-issued ID"
              status={verifications?.identity?.status ?? 'none'}
              icon={<ShieldCheck size={24} color="#6366F1" />}
              onPress={() => checkGuestAndAction(() => setShowIdentityForm(true))}
              trustPoints={30}
            />

            <VerificationCard
              title="Email Verification"
              description="Confirm your email address"
              status={verifications?.email?.status ?? 'none'}
              icon={<Mail size={24} color="#10B981" />}
              onPress={() => checkGuestAndAction(() => setShowEmailForm(true))}
              trustPoints={10}
            />

            <VerificationCard
              title="Phone Number"
              description="Add and verify your phone number"
              status={verifications?.phone?.status ?? 'none'}
              icon={<Smartphone size={24} color="#F59E0B" />}
              onPress={() => checkGuestAndAction(() => setShowPhoneForm(true))}
              trustPoints={10}
            />

            <VerificationCard
              title="LinkedIn Profile"
              description="Connect your professional LinkedIn account"
              status={verifications?.linkedin?.status ?? 'none'}
              icon={<Linkedin size={24} color="#0A66C2" />}
              onPress={() => checkGuestAndAction(() => setShowLinkedInForm(true))}
              trustPoints={20}
            />

            <VerificationCard
              title="Portfolio Website"
              description="Showcase your work with a portfolio link"
              status={verifications?.portfolio?.status ?? 'none'}
              icon={<Globe size={24} color="#8B5CF6" />}
              onPress={() => checkGuestAndAction(() => setShowPortfolioForm(true))}
              trustPoints={15}
            />
          </View>
        </View>

        {verifications?.skillBadges?.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Skill Badges</Text>
              <Text style={styles.sectionSubtitle}>
                {verifications.skillBadges.length} Earned
              </Text>
            </View>
            <View style={styles.badgesList}>
              {verifications.skillBadges.map((badge: any) => (
                <SkillBadge key={badge.id} badge={badge} size="medium" />
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity
          style={styles.infoCard}
          onPress={() => {
            showAlert(
              'About Trust Score',
              'Your Trust Score helps other users know they can rely on you. Complete verifications to increase your score and build credibility in the community.'
            );
          }}
        >
          <View style={styles.infoIconContainer}>
            <Award size={24} color={Colors.light.primary} />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Why verify your account?</Text>
            <Text style={styles.infoDescription}>
              Verified users get more exchange requests and build stronger connections
            </Text>
          </View>
          <ChevronRight size={20} color={Colors.light.textSecondary} />
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: Colors.light.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.light.text,
    marginTop: 16,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  cardList: {
    gap: 12,
  },
  badgesList: {
    gap: 12,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.card,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  infoIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
  formContainer: {
    flex: 1,
    padding: 20,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  formDescription: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    lineHeight: 22,
    marginBottom: 24,
  },
  input: {
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.light.text,
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  backButton: {
    marginLeft: 8,
  },
  bottomSpacer: {
    height: 40,
  },
});

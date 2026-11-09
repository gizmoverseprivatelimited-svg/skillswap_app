import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import {
  ShieldCheck,
  Mail,
  Smartphone,
  Linkedin,
    ChevronRight,
  Award,
  ArrowLeft,
  Upload,
  Camera,
  Image as ImageIcon,
  CheckCircle,
  Trash2,
  FileText,
  Info,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
// import { trpc } from '@/lib/trpc';
import Colors from '@/constants/colors';
import { VerificationCard } from '@/components/VerificationCard';
import { TrustScoreBadge } from '@/components/TrustScoreBadge';
import { SkillBadge } from '@/components/SkillBadge';
import url from '@/constants/backurl';
import { useCurrentUser } from '@/providers/current-user';
import { useAuth } from '@/providers/auth';
import { useAlert } from '@/providers/alert';
import { useSocket } from '@/providers/socket';

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

WebBrowser.maybeCompleteAuthSession();

export default function VerificationScreen() {
  const { showAlert } = useAlert();
  const { socket } = useSocket();

  const [showIdentityForm, setShowIdentityForm] = useState<boolean>(false);
  const [showPhoneForm, setShowPhoneForm] = useState<boolean>(false);
  const [showLinkedInForm, setShowLinkedInForm] = useState<boolean>(false);
    const [phone, setPhone] = useState<string>('');
      const [verifications, setVerifications] = useState<any>(null);
  const [serverUser, setServerUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [documentUrl, setDocumentUrl] = useState('');
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<string>('Aadhaar / National ID');
  const [isUploadingDocument, setIsUploadingDocument] = useState<boolean>(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState<boolean>(false);
  const [emailOtpCode, setEmailOtpCode] = useState<string>('');
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
  const { user: authUser } = useAuth();

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
    const defaultStructured: StructuredVerifications = {
      identity: { status: 'none' },
      email: { status: 'none' },
      phone: { status: 'none' },
      linkedin: { status: 'none' },
      portfolio: { status: 'none' },
      trustScore: 0,
      skillBadges: [],
    };

    if (currentUser?.id === '1') {
      setVerifications(defaultStructured);
      setLoading(false);
      return;
    }
    try {
      const targetId = currentUser?.id || (currentUser as any)?._id || authUser?.id || (authUser as any)?._id;
      if (!targetId || targetId === '1') {
        setVerifications(defaultStructured);
        setLoading(false);
        return;
      }

      const response = await fetch(`${url}/verifications/my/${targetId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch verifications from server');
      }

      // Pre-populate email and phone from server response if available
      if (data?.user) {
        setServerUser(data.user);
        if (data.user.email) setEmail((prev) => prev || data.user.email);
        if (data.user.phone) setPhone((prev) => prev || data.user.phone);
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
  }, [currentUser?.id, (currentUser as any)?._id, authUser?.id, (authUser as any)?._id]);

  // Sync email & phone when user object becomes available
  useEffect(() => {
    const userEmail = currentUser?.email || authUser?.email || serverUser?.email;
    if (userEmail) {
      setEmail((prev) => prev || userEmail);
    }
    const userPhone = (currentUser as any)?.phone || (authUser as any)?.phone || serverUser?.phone;
    if (userPhone) {
      setPhone((prev) => prev || userPhone);
    }
  }, [currentUser?.email, (currentUser as any)?.phone, authUser?.email, (authUser as any)?.phone, serverUser?.email, serverUser?.phone]);

  // Real-time socket listener for verification status changes by admin
  useEffect(() => {
    if (!socket) return;

    const handleVerificationEvent = (data: any) => {
      console.log('[Socket.IO VerificationScreen] Verification event received:', data);
      fetchVerifications();
    };

    socket.on('verification_approved', handleVerificationEvent);
    socket.on('verification_rejected', handleVerificationEvent);
    socket.on('verification_updated', handleVerificationEvent);
    socket.on('user_verified', handleVerificationEvent);

    return () => {
      socket.off('verification_approved', handleVerificationEvent);
      socket.off('verification_rejected', handleVerificationEvent);
      socket.off('verification_updated', handleVerificationEvent);
      socket.off('user_verified', handleVerificationEvent);
    };
  }, [socket]);

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
  //       //     await verificationsQuery.refetch();
  //     Alert.alert('Success', 'Portfolio verified!');
  //   } catch (error) {
  //     Alert.alert('Error', 'Failed to verify portfolio');
  //     console.error('[Verification] Portfolio verification error:', error);
  //   }
  // };

  const handlePickDocumentImage = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          showAlert('Permission Required', 'We need photo library permission to select your document.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.85,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImageUri(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Error selecting document image:', err);
      showAlert('Error', 'Failed to pick image');
    }
  };

  const handleTakeDocumentPhoto = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          showAlert('Permission Required', 'We need camera permission to photograph your ID document.');
          return;
        }
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.85,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImageUri(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Error capturing document photo:', err);
      showAlert('Error', 'Failed to capture photo');
    }
  };

  const handleSubmitDocument = async () => {
    if (!selectedImageUri) {
      showAlert('Document Required', 'Please select or capture a photo of your government ID document.');
      return;
    }

    const targetId = currentUser?.id || (currentUser as any)?._id || authUser?.id;
    if (!targetId || targetId === '1') {
      showAlert('Login Required', 'Please log in to submit your verification request.');
      return;
    }

    try {
      setIsUploadingDocument(true);

      const formData = new FormData();
      formData.append('userId', String(targetId));
      formData.append('type', 'identity');
      formData.append('details', selectedDocType || 'Government ID');

      if (Platform.OS === 'web') {
        const response = await fetch(selectedImageUri);
        const blob = await response.blob();
        const ext = blob.type?.split('/')[1] || 'jpg';
        const file = new File([blob], `document-${Date.now()}.${ext}`, { type: blob.type || 'image/jpeg' });
        formData.append('document', file);

        const uploadRes = await fetch(`${url}/verifications/submit`, {
          method: 'POST',
          body: formData,
        });
        const data = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(data.message || 'Failed to submit document');
        }
      } else {
        const filename = selectedImageUri.split('/').pop() || `document-${Date.now()}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const fileType = match ? `image/${match[1]}` : 'image/jpeg';
        formData.append('document', {
          uri: selectedImageUri,
          name: filename,
          type: fileType,
        } as any);

        await new Promise<any>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${url}/verifications/submit`);
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try { resolve(JSON.parse(xhr.responseText)); } catch (e) { resolve({}); }
            } else {
              try {
                const errData = JSON.parse(xhr.responseText);
                reject(new Error(errData.message || 'Submission failed'));
              } catch (e) {
                reject(new Error(`Upload failed with status ${xhr.status}`));
              }
            }
          };
          xhr.onerror = () => reject(new Error('Network error during document upload'));
          xhr.send(formData);
        });
      }

      showAlert(
        'Document Submitted! 🎉',
        'Your identity document has been securely uploaded and submitted. We will inspect the document and verify your identity.'
      );
      setSelectedImageUri(null);
      setShowIdentityForm(false);
      fetchVerifications();
    } catch (err: any) {
      console.error('[Document Upload Error]', err);
      showAlert('Upload Failed', err?.message || 'Could not upload your document. Please try again.');
    } finally {
      setIsUploadingDocument(false);
    }
  };

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
        'Your verification request has been submitted. We will review it shortly.'
      );

      setDocumentUrl('');
      setPhone('');
            
      setShowIdentityForm(false);
      setShowPhoneForm(false);
      setShowLinkedInForm(false);
      
      fetchVerifications();

    } catch (error) {
      showAlert('Error', 'Failed to submit verification');
    } finally {
      setLoading(false);
    }
  };

  const handleSendPhoneOtp = async () => {
    const rawNumber = phone.trim();
    const digitsOnly = rawNumber.replace(/\D/g, '');
    if (!rawNumber || digitsOnly.length < 10) {
      showAlert('Error', 'Please enter a valid 10-digit mobile number');
      return;
    }
    const cleanNumber = `+91${digitsOnly.slice(-10)}`;

    try {
      setLoading(true);
      const targetUserId = currentUser?.id || (currentUser as any)?._id || authUser?.id || (authUser as any)?._id;
      const response = await fetch(`${url}/verifications/send-phone-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanNumber, identifier: cleanNumber, userId: targetUserId, purpose: 'phone_verification' }),
      });
      const data = await response.json();
      if (!response.ok) {
        showAlert('Error', data.message || 'Failed to send OTP');
        return;
      }
      setPhoneOtpSent(true);
      showAlert('Success', '6-digit OTP sent to your phone via SMS');
    } catch (error) {
      showAlert('Error', 'Failed to send OTP. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    const cleanOtp = otpCode.trim();
    if (!cleanOtp) {
      showAlert('Error', 'Please enter the 6-digit OTP');
      return;
    }
    const rawNumber = phone.trim();
    const digitsOnly = rawNumber.replace(/\D/g, '');
    const cleanNumber = `+91${digitsOnly.slice(-10)}`;

    try {
      setLoading(true);
      const response = await fetch(`${url}/verifications/verify-phone-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: cleanNumber, code: cleanOtp, userId: currentUser?.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        showAlert('Error', data.message || 'Verification failed');
        return;
      }
      showAlert('Verified 🎉', 'Your phone number has been verified successfully!');
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

  const handleSendEmailOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      showAlert('Error', 'Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      const targetUserId = currentUser?.id || (currentUser as any)?._id || authUser?.id || (authUser as any)?._id;
      const response = await fetch(`${url}/verifications/send-email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, userId: targetUserId }),
      });
      const data = await response.json();
      if (!response.ok) {
        showAlert('Error', data.message || 'Failed to send OTP');
        return;
      }
      setEmailOtpSent(true);
      showAlert('Code Sent ✉️', 'A 6-digit verification code has been sent to your email.');
    } catch (error) {
      showAlert('Error', 'Failed to send email verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    const cleanOtp = emailOtpCode.trim();
    if (!cleanOtp) {
      showAlert('Error', 'Please enter the 6-digit code');
      return;
    }
    const cleanEmail = email.trim().toLowerCase();

    try {
      setLoading(true);
      const targetUserId = currentUser?.id || (currentUser as any)?._id || authUser?.id || (authUser as any)?._id;
      const response = await fetch(`${url}/verifications/verify-email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, code: cleanOtp, userId: targetUserId }),
      });
      const data = await response.json();
      if (!response.ok) {
        showAlert('Error', data.message || 'Verification failed');
        return;
      }
      showAlert('Verified 🎉', 'Your email address has been verified successfully!');
      setEmail(cleanEmail);
      setEmailOtpCode('');
      setEmailOtpSent(false);
      setShowEmailForm(false);
      fetchVerifications();
    } catch (error) {
      showAlert('Error', 'Failed to verify code');
    } finally {
      setLoading(false);
    }
  };

  const params = useLocalSearchParams<{ linkedin?: string; message?: string; code?: string; state?: string }>();

  useEffect(() => {
    if (params.linkedin === 'verified') {
      showAlert('LinkedIn Verified 🎉', 'Your LinkedIn profile has been verified successfully!');
      fetchVerifications();
      setShowLinkedInForm(false);
    } else if (params.linkedin === 'error') {
      showAlert('LinkedIn Verification Failed', params.message || 'Unable to verify LinkedIn account.');
    } else if (params.code) {
      handleVerifyLinkedInCode(params.code);
    }
  }, [params.linkedin, params.code]);

  const handleLinkedInAuth = async () => {
    try {
      setLoading(true);
      const targetUserId = currentUser?.id || (currentUser as any)?._id || authUser?.id || (authUser as any)?._id;
      if (!targetUserId || targetUserId === '1') {
        showAlert('Login Required 🔒', 'Please log in to verify your LinkedIn account.');
        return;
      }

      let redirectUri = '';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        redirectUri = `${window.location.origin}/verification`;
      } else {
        redirectUri = Linking.createURL('/verification');
      }

      const authEndpoint = `${url}/verifications/linkedin/auth?userId=${encodeURIComponent(targetUserId)}&redirectUrl=${encodeURIComponent(redirectUri)}`;

      if (Platform.OS === 'web') {
        try {
          const res = await WebBrowser.openAuthSessionAsync(authEndpoint, redirectUri);
          if (res.type === 'success' && res.url) {
            const parsed = Linking.parse(res.url);
            if (parsed.queryParams?.linkedin === 'verified') {
              showAlert('LinkedIn Verified 🎉', 'Your LinkedIn profile has been verified successfully!');
              fetchVerifications();
              setShowLinkedInForm(false);
              return;
            }
          }
        } catch (e) {
          console.warn('[LinkedIn] WebBrowser openAuthSessionAsync fallback:', e);
        }
        window.location.href = authEndpoint;
      } else {
        const res = await WebBrowser.openAuthSessionAsync(authEndpoint, redirectUri);
        if (res.type === 'success' && res.url) {
          const parsed = Linking.parse(res.url);
          if (parsed.queryParams?.linkedin === 'verified') {
            showAlert('LinkedIn Verified 🎉', 'Your LinkedIn profile has been verified successfully!');
            fetchVerifications();
            setShowLinkedInForm(false);
          } else if (parsed.queryParams?.linkedin === 'error') {
            showAlert('LinkedIn Error', (parsed.queryParams?.message as string) || 'Verification failed');
          }
        }
      }
    } catch (err: any) {
      console.error('[LinkedIn Auth Error]', err);
      showAlert('Error', err?.message || 'Failed to start LinkedIn verification');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyLinkedInCode = async (codeStr: string) => {
    try {
      setLoading(true);
      const targetUserId = currentUser?.id || (currentUser as any)?._id || authUser?.id || (authUser as any)?._id;
      let redirectUri = '';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        redirectUri = `${window.location.origin}/verification`;
      } else {
        redirectUri = Linking.createURL('/verification');
      }

      const response = await fetch(`${url}/verifications/linkedin/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeStr, redirectUri, userId: targetUserId }),
      });
      const data = await response.json();
      if (!response.ok) {
        showAlert('Verification Failed', data.message || 'Could not verify LinkedIn profile');
        return;
      }

      showAlert('LinkedIn Verified 🎉', `Verified as ${data.profile?.name || 'LinkedIn User'}!`);
      fetchVerifications();
      setShowLinkedInForm(false);
    } catch (error: any) {
      showAlert('Error', error?.message || 'Failed to verify LinkedIn code');
    } finally {
      setLoading(false);
    }
  };


  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/profile' as any);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Verification',
            headerStyle: { backgroundColor: Colors.light.card },
            headerTintColor: Colors.light.text,
            headerLeft: () => (
              <TouchableOpacity
                onPress={handleBack}
                style={styles.backButton}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <ArrowLeft size={24} color={Colors.light.text} />
              </TouchableOpacity>
            ),
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      </View>
    );
  }

  if (showIdentityForm) {
    const docTypes = [
      'Aadhaar / National ID',
      'Passport',
      "Driver's License",
      'Voter ID',
      'Government Photo ID',
    ];

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
                onPress={() => {
                  setShowIdentityForm(false);
                  setSelectedImageUri(null);
                }}
                style={styles.backButton}
              >
                <ArrowLeft size={24} color={Colors.light.text} />
              </TouchableOpacity>
            ),
          }}
        />
        <ScrollView style={styles.formContainer} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Info Card */}
          <View style={styles.idInfoCard}>
            <Info size={20} color="#2563EB" style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.idInfoTitle}>Government ID Document</Text>
              <Text style={styles.idInfoSubtitle}>
                Upload an official ID document. We will verify your identity to issue your verified badge.
              </Text>
            </View>
          </View>

          {/* Document Type Selector */}
          <Text style={styles.inputSectionLabel}>Select Document Type</Text>
          <View style={styles.docTypeRow}>
            {docTypes.map((type) => {
              const isSelected = selectedDocType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.docTypeChip, isSelected && styles.docTypeChipActive]}
                  onPress={() => setSelectedDocType(type)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.docTypeChipText, isSelected && styles.docTypeChipTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Document Upload Area */}
          <Text style={styles.inputSectionLabel}>Document Photo</Text>
          {selectedImageUri ? (
            <View style={styles.previewBox}>
              <Image source={{ uri: selectedImageUri }} style={styles.uploadedDocImage} resizeMode="contain" />
              <View style={styles.previewBadge}>
                <CheckCircle size={14} color="#10B981" />
                <Text style={styles.previewBadgeText}>Ready to submit</Text>
              </View>
              <View style={styles.previewActions}>
                <TouchableOpacity
                  style={styles.previewChangeBtn}
                  onPress={handlePickDocumentImage}
                  disabled={isUploadingDocument}
                >
                  <ImageIcon size={16} color={Colors.light.primary} />
                  <Text style={styles.previewChangeBtnText}>Change Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.previewRemoveBtn}
                  onPress={() => setSelectedImageUri(null)}
                  disabled={isUploadingDocument}
                >
                  <Trash2 size={16} color="#EF4444" />
                  <Text style={styles.previewRemoveBtnText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.uploadDashedBox}>
              <View style={styles.uploadIconCircle}>
                <Upload size={28} color={Colors.light.primary} />
              </View>
              <Text style={styles.uploadPromptTitle}>Upload Document Photo</Text>
              <Text style={styles.uploadPromptSubtitle}>
                Clear picture of the front of your document (Max 10MB)
              </Text>

              <View style={styles.uploadBtnRow}>
                <TouchableOpacity
                  style={styles.uploadChoiceBtn}
                  onPress={handlePickDocumentImage}
                  activeOpacity={0.8}
                >
                  <ImageIcon size={18} color="#FFFFFF" />
                  <Text style={styles.uploadChoiceBtnText}>Choose from Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.uploadChoiceBtn, styles.uploadChoiceBtnSecondary]}
                  onPress={handleTakeDocumentPhoto}
                  activeOpacity={0.8}
                >
                  <Camera size={18} color={Colors.light.primary} />
                  <Text style={styles.uploadChoiceBtnSecondaryText}>Take Photo</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Guidelines */}
          <View style={styles.guidelinesCard}>
            <Text style={styles.guidelinesTitle}>Verification Guidelines:</Text>
            <View style={styles.guidelineItem}>
              <CheckCircle size={14} color="#10B981" />
              <Text style={styles.guidelineText}>All four corners of the document must be visible.</Text>
            </View>
            <View style={styles.guidelineItem}>
              <CheckCircle size={14} color="#10B981" />
              <Text style={styles.guidelineText}>Name and photo must be clearly readable without glare.</Text>
            </View>
            <View style={styles.guidelineItem}>
              <CheckCircle size={14} color="#10B981" />
              <Text style={styles.guidelineText}>Document must be government-issued and currently valid.</Text>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!selectedImageUri || isUploadingDocument) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmitDocument}
            disabled={!selectedImageUri || isUploadingDocument}
            activeOpacity={0.85}
          >
            {isUploadingDocument ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Uploading & Submitting...</Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>Submit Document for Review</Text>
            )}
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
                onPress={() => {
                  setShowEmailForm(false);
                  setEmailOtpSent(false);
                  setEmailOtpCode('');
                }}
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
            {emailOtpSent
              ? 'Enter the 6-digit code sent to your email.'
              : 'Enter your email address to receive a verification code.'}
          </Text>

          {!emailOtpSent ? (
            <>
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
                onPress={handleSendEmailOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Send Code</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="Enter 6-digit code"
                placeholderTextColor={Colors.light.textSecondary}
                value={emailOtpCode}
                onChangeText={setEmailOtpCode}
                keyboardType="number-pad"
              />
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleVerifyEmailOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Verify Code</Text>
                )}
              </TouchableOpacity>
            </>
          )}
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
        <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.linkedinIconBanner}>
            <View style={styles.linkedinBadge}>
              <Linkedin size={36} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.formTitle}>Connect with LinkedIn</Text>
          <Text style={styles.formDescription}>
            Authenticate with your LinkedIn account to verify your professional identity and increase your Trust Score by +20 points.
          </Text>

          <TouchableOpacity
            style={styles.linkedinAuthButton}
            onPress={handleLinkedInAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={styles.linkedinButtonContent}>
                <Linkedin size={22} color="#FFFFFF" />
                <Text style={styles.linkedinAuthButtonText}>Verify with LinkedIn</Text>
              </View>
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
          headerLeft: () => (
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <ArrowLeft size={24} color={Colors.light.text} />
            </TouchableOpacity>
          ),
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
                ].filter((v) => v === 'verified').length
              }
              /4 Completed
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
              description={
                currentUser?.email || authUser?.email || serverUser?.email
                  ? `Verify your email: ${currentUser?.email || authUser?.email || serverUser?.email}`
                  : 'Confirm your email address'
              }
              status={verifications?.email?.status ?? 'none'}
              icon={<Mail size={24} color="#10B981" />}
              onPress={() =>
                checkGuestAndAction(() => {
                  const targetEmail = currentUser?.email || authUser?.email || serverUser?.email || email || '';
                  if (targetEmail) {
                    setEmail(targetEmail);
                  }
                  setShowEmailForm(true);
                })
              }
              trustPoints={10}
              hideActionWhenVerified
            />

            <VerificationCard
              title="Phone Number"
              description={
                (currentUser as any)?.phone || (authUser as any)?.phone || serverUser?.phone
                  ? `Verify your phone: ${(currentUser as any)?.phone || (authUser as any)?.phone || serverUser?.phone}`
                  : 'Add and verify your phone number'
              }
              status={verifications?.phone?.status ?? 'none'}
              icon={<Smartphone size={24} color="#F59E0B" />}
              onPress={() =>
                checkGuestAndAction(() => {
                  const targetPhone = (currentUser as any)?.phone || (authUser as any)?.phone || serverUser?.phone || phone || '';
                  if (targetPhone) {
                    setPhone(targetPhone);
                  }
                  setShowPhoneForm(true);
                })
              }
              trustPoints={10}
              hideActionWhenVerified
            />

            <VerificationCard
              title="LinkedIn Profile"
              description="Connect your professional LinkedIn account"
              status={verifications?.linkedin?.status ?? 'none'}
              icon={<Linkedin size={24} color="#0A66C2" />}
              onPress={() => checkGuestAndAction(() => setShowLinkedInForm(true))}
              trustPoints={20}
              hideActionWhenVerified
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

  linkedinIconBanner: {
    alignItems: 'center',
    marginVertical: 16,
  },
  linkedinBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#0A66C2',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0A66C2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  linkedinAuthButton: {
    backgroundColor: '#0A66C2',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#0A66C2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  linkedinButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  linkedinAuthButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  

  idInfoCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  idInfoTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#1E40AF',
    marginBottom: 4,
  },
  idInfoSubtitle: {
    fontSize: 13,
    color: '#3B82F6',
    lineHeight: 18,
  },
  inputSectionLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 10,
    marginTop: 6,
  },
  docTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 22,
  },
  docTypeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.light.card,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
  },
  docTypeChipActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  docTypeChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  docTypeChipTextActive: {
    color: '#FFFFFF',
  },
  uploadDashedBox: {
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    padding: 24,
    alignItems: 'center',
    marginBottom: 22,
  },
  uploadIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  uploadPromptTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  uploadPromptSubtitle: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: 18,
  },
  uploadBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    flexWrap: 'wrap',
  },
  uploadChoiceBtn: {
    flex: 1,
    minWidth: 130,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.light.primary,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  uploadChoiceBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  uploadChoiceBtnSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
  },
  uploadChoiceBtnSecondaryText: {
    color: Colors.light.primary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  previewBox: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 12,
    marginBottom: 22,
    alignItems: 'center',
  },
  uploadedDocImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 10,
  },
  previewBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#065F46',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    width: '100%',
  },
  previewChangeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    backgroundColor: '#F5F3FF',
  },
  previewChangeBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.primary,
  },
  previewRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  previewRemoveBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#DC2626',
  },
  guidelinesCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  guidelinesTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 10,
  },
  guidelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  guidelineText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    flex: 1,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
});

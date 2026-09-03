// Profile screen component
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Share,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  MapPin,
  Star,
  Calendar,
  Sparkles,
  TrendingUp,
  Award,
  LogOut,
  LogIn,
  Coins,
  Crown,
  ShoppingBag,
  ShieldCheck,
  Settings,
  Plus,
  HelpCircle,
  FileText,
  Lock,
  MessageSquare,
  Info,
  Wallet,
  History,
  Users,
  Edit,
  Pencil,
  Trash2,
  UserX,
  Share2,
  Download,
  ScrollText,
  GraduationCap,
  BadgeCheck,
  Languages,
  FileCheck2,
  Briefcase,
  Clock,
  Upload,
  XCircle,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAdmin } from '@/providers/admin';
import { useAuth } from '@/providers/auth';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { TrustScoreBadge } from '@/components/TrustScoreBadge';
import ReviewsSection from '@/components/ReviewsSection';
import { useCurrentUser } from '@/providers/current-user';
import { useAlert } from '@/providers/alert';
import { useSkillSwaps } from '@/providers/skill-swaps';
import { useClasses } from '@/providers/classes';
import { useEarnings } from '@/providers/earnings';
import { useSafety } from '@/providers/safety';
import { resolveImageUrl } from '@/lib/resolveImageUrl';
import { formatPrice } from '@/constants/locale';
import url from '@/constants/backurl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildSwapCertificates,
  buildClassCertificates,
  getCertificateLabel,
  formatDate,
  type CertificateData,
} from '@/lib/certificate';

import { useSocket } from '@/providers/socket';

export default function ProfileScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { showAlert } = useAlert();
  const { blockedUsers } = useSafety();
  const currentUserContext = useCurrentUser();
  const currentUser = currentUserContext?.currentUser;
  const allUsers = currentUserContext?.allUsers || [];
  const loadUser = currentUserContext?.loadUser;
  const removeSkill = currentUserContext?.removeSkill;
  const attachSkillCertificate = currentUserContext?.attachSkillCertificate;
  const removeSkillCertificate = currentUserContext?.removeSkillCertificate;
  const userRole = currentUserContext?.userRole;
  const { submitCertification, getSkillCertificationStatus } = useAdmin();
  const { swaps } = useSkillSwaps();
  const { classes, enrollments } = useClasses();
  const { getSummary, refreshUserEarnings } = useEarnings();
  const { socket } = useSocket();

  const [verifications, setVerifications] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reviews, setReviews] = useState<any>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const { width: windowWidth } = useWindowDimensions();

  const numSkillColumns = useMemo(() => {
    if (windowWidth >= 1024) return 3;
    if (windowWidth >= 640) return 2;
    return 1;
  }, [windowWidth]);

  const skillCardWidth = useMemo(() => {
    if (numSkillColumns === 1) return '100%';
    const totalPadding = 40;
    const totalGap = (numSkillColumns - 1) * 16;
    const availableWidth = windowWidth - totalPadding - totalGap;
    return Math.max(240, Math.floor(availableWidth / numSkillColumns));
  }, [windowWidth, numSkillColumns]);

  const isTeacher = Boolean(
    currentUser?.teacherProfile ||
    currentUser?.role === 'teacher' ||
    userRole === 'teacher' ||
    (currentUser?.skillsOffered && currentUser.skillsOffered.length > 0)
  );

  const certificates = useMemo(() => {
    if (!currentUser) return [];
    const swapCerts = buildSwapCertificates(swaps, currentUser, allUsers);
    const classCerts = buildClassCertificates(classes, enrollments as any, currentUser, allUsers);
    return [...swapCerts, ...classCerts];
  }, [swaps, currentUser, allUsers, classes, enrollments]);

  const handleUploadCertificate = async (skillId: string, skillTitle: string) => {
    if (isDemoUser) {
      handleRequireLogin('upload certificates');
      return;
    }
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          showAlert('Permission needed', 'Please allow access to your photos to upload a certificate document.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });
      const asset = result.assets?.[0];
      if (!result.canceled && asset) {
        const formData = new FormData();
        const filename = asset.fileName || asset.uri.split('/').pop() || 'certificate.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = asset.mimeType || (match ? `image/${match[1]}` : 'image/jpeg');

        if (Platform.OS === 'web') {
          const resp = await fetch(asset.uri);
          const blob = await resp.blob();
          formData.append('certificate', blob, filename);
        } else {
          // @ts-ignore
          formData.append('certificate', {
            uri: asset.uri,
            name: filename,
            type,
          });
        }

        const uploadEndpoint = skillId && !String(skillId).startsWith('onboard-')
          ? `${url}/skills/${skillId}/certificate`
          : `${url}/skills/upload-certificate`;

        const uploadRes = await fetch(uploadEndpoint, {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          const errorData = await uploadRes.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || 'Failed to upload certificate');
        }

        const uploadData = await uploadRes.json();
        const savedUri = uploadData.certificateUri;

        if (attachSkillCertificate) attachSkillCertificate(skillId, savedUri);
        if (currentUser) {
          const uid = String(currentUser.id || (currentUser as any)._id || '');
          submitCertification({
            userId: uid,
            userName: currentUser.name || 'Teacher',
            userAvatar: currentUser.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
            skillId: String(skillId),
            skillTitle: skillTitle || 'Skill',
            documentUri: savedUri,
          });
        }
        showAlert('Certificate submitted', `Your certificate for "${skillTitle}" has been uploaded and submitted for admin verification.`);
      }
    } catch (error: any) {
      console.warn('[Profile] Certificate upload failed:', error);
      showAlert('Upload failed', error?.message || 'Could not upload the document. Please try again.');
    }
  };

  const handleRemoveCertificate = (skillId: string, skillTitle: string) => {
    if (isDemoUser) {
      handleRequireLogin('manage certificates');
      return;
    }
    showAlert(
      'Remove certificate?',
      `The document attached to "${skillTitle}" will be removed from this skill.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            if (removeSkillCertificate) removeSkillCertificate(skillId);
          },
        },
      ],
    );
  };

  const handleShareProfile = async () => {
    if (!currentUser || currentUser?.id === '1' || (currentUser as any)?.isDemo) {
      showAlert(
        'Login Required 🔒',
        'Please log in or create an account to share your profile.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/login' as any) },
        ]
      );
      return;
    }
    const message = `Check out ${currentUser?.name || 'my'}'s profile on leteski!`;
    const shareUrl = `https://leteski.com/profile/${currentUser?.id || ''}`;
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.share) {
          await navigator.share({ title: 'leteski Profile', text: message, url: shareUrl });
        } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(`${message} ${shareUrl}`);
          showAlert('Copied', 'Profile link copied to clipboard');
        }
      } else {
        await Share.share({
          message: `${message} ${shareUrl}`,
          title: 'leteski Profile',
        });
      }
    } catch (error) {
      console.log('[Profile] Share error:', error);
    }
  };

  const earningsSummary = useMemo(() => {
    if (!currentUser?.id) {
      return {
        availablePoints: 0,
        currentMonthPoints: 0,
        currentMonthClasses: 0,
      };
    }
    return getSummary(currentUser.id);
  }, [currentUser?.id, getSummary]);

  const completedSwapsCount = useMemo(() => {
    return swaps.filter((s: any) => s.status === 'completed').length;
  }, [swaps]);

  const displayTotalSwaps = useMemo(() => {
    return Math.max(currentUser?.totalSwaps || 0, completedSwapsCount);
  }, [currentUser?.totalSwaps, completedSwapsCount]);

  const fetchReviews = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setIsLoading(true);
      }
      setFetchError(null);
      const res = await fetch(
        `${url}/reviews?revieweeId=${currentUser?.id}&skillId=${""}`
      );

      if (!res.ok) throw new Error("Failed to fetch reviews");

      const data = await res.json();

      setReviews(data);
    } catch (err) {
      console.error("[Reviews] Fetch error", err);
      if (!silent) {
        setFetchError("Failed to load reviews");
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [currentUser?.id]);

  const fetchVerifications = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const response = await fetch(`${url}/verifications/my/${currentUser?.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch verifications from server');
      }

      const structured: any = {
        identity: { status: 'none' },
        email: { status: 'none' },
        phone: { status: 'none' },
        linkedIn: { status: 'none' },
        portfolio: { status: 'none' },
        trustScore: 0,
      };

      if (data && Array.isArray(data.verifications)) {
        data.verifications.forEach((v: any) => {
          const key = v.type === 'linkedin' ? 'linkedIn' : v.type;
          structured[key] = {
            status: v.status,
            id: v._id,
          };
        });
      }

      const verifiedCount = Object.values(structured)
        .filter((v: any) => v && typeof v === 'object' && v.status === 'verified').length;
      structured.trustScore = verifiedCount * 20;

      setVerifications(structured);
    } catch (error) {
      console.error('[Profile] Failed to fetch verifications:', error);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    loadUser?.(true);
    fetchReviews();
    fetchVerifications();

    if (socket) {
      const handleReviewCreated = () => fetchReviews(true);
      socket.on('review_created', handleReviewCreated);
      return () => {
        socket.off('review_created', handleReviewCreated);
      };
    }
  }, [loadUser, fetchReviews, fetchVerifications, socket]);

  const isDemoUser = Boolean(!auth.isAuthenticated || currentUser?.id === '1' || currentUser?.isDemo || auth.user?.isDemo);

  const handleDemoLogin = async () => {
    try {
      await auth.signOut();
    } catch (e) {
      console.warn('[Profile] Error signing out guest:', e);
    }
    router.replace('/login' as any);
  };

  const handleRequireLogin = (featureName = 'this feature') => {
    showAlert(
      'Login Required 🔒',
      `Please log in or create an account to access ${featureName}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log In',
          onPress: () => {
            void handleDemoLogin();
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    console.log('[Profile] Signing out');
    await auth.signOut();
    router.replace('/login');
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[Colors.light.primary, Colors.light.primaryLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: resolveImageUrl(currentUser?.avatarUrl) }}
              style={styles.avatar}
            />
            <View style={styles.badgeContainer}>
              <Award size={16} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{currentUser?.name}</Text>
            <TouchableOpacity
              style={styles.nameEditButton}
              onPress={() => isDemoUser ? handleRequireLogin('edit your profile') : router.push('/edit-profile')}
              activeOpacity={0.7}
              accessibilityLabel="Edit Profile"
              testID="edit-profile-pen-button"
            >
              <Pencil size={15} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.shareIconBtn}
              onPress={handleShareProfile}
              activeOpacity={0.7}
              accessibilityLabel="Share Profile"
              testID="share-profile-button"
            >
              <Share2 size={15} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.locationRow}>
            <MapPin size={16} color="rgba(255,255,255,0.9)" />
            <Text style={styles.location}>{currentUser?.location || 'Location not set'}</Text>
          </View>
          {verifications && verifications.trustScore > 0 && (
            <TouchableOpacity
              style={styles.trustScoreContainer}
              onPress={() => isDemoUser ? handleRequireLogin('account verification tools') : router.push('/verification')}
              activeOpacity={0.7}
            >
              <TrustScoreBadge score={verifications.trustScore} size="small" showLabel={false} />
              <Text style={styles.trustScoreLabel}>Trust Score</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>

        <View style={styles.content}>
          {currentUser?.premiumTier && currentUser?.premiumTier !== 'free' && (
            <View style={styles.premiumBanner}>
              <View style={[styles.premiumGlow, { backgroundColor: currentUser?.premiumTier === 'elite' ? '#F59E0B' : currentUser?.premiumTier === 'premium' ? '#8B5CF6' : '#6366F1' }]} />
              <View style={styles.premiumContent}>
                <Crown size={24} color="#FFFFFF" fill="#FFFFFF" />
                <View style={styles.premiumInfo}>
                  <Text style={styles.premiumTitle}>{currentUser?.premiumTier.toUpperCase()} MEMBER</Text>
                  <Text style={styles.premiumExpiry}>
                    {currentUser?.premiumExpiresAt ? `Active until ${new Date(currentUser?.premiumExpiresAt).toLocaleDateString()}` : 'Active'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.creditsCard}
            onPress={() => isDemoUser ? handleRequireLogin('purchase credits and store') : router.push('/store')}
          >
            <View style={styles.creditsLeft}>
              <View style={styles.creditsIcon}>
                <Coins size={24} color="#F59E0B" />
              </View>
              <View style={styles.creditsInfo}>
                <Text style={styles.creditsLabel}>Your Credits</Text>
                <Text style={styles.creditsValue}>{currentUser?.credits}</Text>
              </View>
            </View>
            <View style={styles.creditsButton}>
              <ShoppingBag size={18} color={Colors.light.primary} />
              <Text style={styles.creditsButtonText}>Get Credits</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.earningsCard}
            onPress={() => router.push('/earnings' as any)}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['#6366F1', '#4F46E5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.earningsGradient}
            >
              <View style={styles.earningsIconWrap}>
                <Wallet size={22} color="#FFFFFF" />
              </View>
              <View style={styles.earningsInfo}>
                <Text style={styles.earningsLabel}>Teaching Earnings</Text>
                <Text style={styles.earningsPoints}>{earningsSummary.availablePoints.toLocaleString()} credits available</Text>
                <Text style={styles.earningsSub}>This month: +{earningsSummary.currentMonthPoints} cr · {earningsSummary.currentMonthClasses} classes</Text>
              </View>
              <View style={styles.earningsArrow}>
                <Text style={styles.earningsArrowText}>View →</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <TrendingUp size={20} color={Colors.light.primary} />
              </View>
              <Text style={styles.statValue}>{displayTotalSwaps}</Text>
              <Text style={styles.statLabel}>Total Exchanges</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Star size={20} fill={Colors.light.accent} color={Colors.light.accent} />
              </View>
              <Text style={styles.statValue}>{reviews?.stats?.averageRating ?? currentUser?.rating ?? 5.0}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Calendar size={20} color={Colors.light.secondary} />
              </View>
              <Text style={styles.statValue}>{currentUser?.joinedDate ? new Date(currentUser.joinedDate).getFullYear() : '2024'}</Text>
              <Text style={styles.statLabel}>Joined</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.verificationCard}
            onPress={() => isDemoUser ? handleRequireLogin('exchange history') : router.push('/swaps/history' as any)}
            activeOpacity={0.7}
            testID="swap-history-button"
          >
            <View style={[styles.verificationIcon, { backgroundColor: '#EEF2FF' }]}>
              <History size={24} color="#6366F1" />
            </View>
            <View style={styles.verificationContent}>
              <Text style={styles.verificationTitle}>Exchange History</Text>
              <Text style={styles.verificationSubtitle}>
                {swaps.length > 0 ? `${swaps.length} total exchanges (ongoing & completed)` : 'View all past and ongoing exchanges'}
              </Text>
            </View>
            <Text style={[styles.verificationAction, { color: '#6366F1' }]}>View →</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.verificationCard}
            onPress={() => isDemoUser ? handleRequireLogin('account verification tools') : router.push('/verification')}
            activeOpacity={0.7}
          >
            <View style={styles.verificationIcon}>
              <ShieldCheck size={24} color={Colors.light.primary} />
            </View>
            <View style={styles.verificationContent}>
              <Text style={styles.verificationTitle}>Account Verification</Text>
              <Text style={styles.verificationSubtitle}>
                {verifications ?
                  `${[
                    verifications.identity,
                    verifications.email,
                    verifications.phone,
                    verifications.linkedIn,
                    verifications.portfolio,
                  ].filter((v) => v.status === 'verified').length}/5 verifications completed` :
                  'Build your trust score'}
              </Text>
            </View>
            <Text style={styles.verificationAction}>View</Text>
          </TouchableOpacity>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.bioContainer}>
              <Text style={styles.bioText}>{currentUser?.bio || 'No bio added yet.'}</Text>
            </View>
          </View>

          {currentUser?.teacherProfile && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.credTitleRow}>
                  <GraduationCap size={20} color={Colors.light.primary} />
                  <Text style={styles.sectionTitle}>Teaching Credentials</Text>
                </View>
                {currentUser.teacherProfile.isCertified && (
                  <View style={styles.verifiedChip}>
                    <BadgeCheck size={13} color="#10B981" />
                    <Text style={styles.verifiedChipText}>Certified</Text>
                  </View>
                )}
              </View>

              {currentUser.teacherProfile.languages && currentUser.teacherProfile.languages.length > 0 && (
                <View style={styles.credRow}>
                  <Languages size={16} color={Colors.light.primary} />
                  <Text style={styles.credText}>Teaches in {currentUser.teacherProfile.languages.join(', ')}</Text>
                </View>
              )}
              {currentUser.teacherProfile.qualifications && currentUser.teacherProfile.qualifications.length > 0 && (
                <View style={styles.credRow}>
                  <Award size={16} color={Colors.light.primary} />
                  <Text style={styles.credText}>{currentUser.teacherProfile.qualifications.join(' · ')}</Text>
                </View>
              )}
              {currentUser.teacherProfile.yearsTeaching ? (
                <View style={styles.credRow}>
                  <Clock size={16} color={Colors.light.primary} />
                  <Text style={styles.credText}>{currentUser.teacherProfile.yearsTeaching} teaching experience</Text>
                </View>
              ) : null}
              {currentUser.teacherProfile.privateTuition && (
                <View style={styles.credRow}>
                  <Users size={16} color={Colors.light.primary} />
                  <Text style={styles.credText}>Private tuition & coaching experience</Text>
                </View>
              )}

              {(currentUser.teacherProfile.certifications || []).map((cert: any) => {
                const adminStatus = getSkillCertificationStatus(currentUser.id, cert.id) || cert.status || 'pending';
                const isApproved = adminStatus === 'approved';
                const isRejected = adminStatus === 'rejected';

                return (
                  <View key={cert.id} style={styles.certRow}>
                    <View style={[styles.certIconWrap, isApproved && { backgroundColor: '#ECFDF5' }, isRejected && { backgroundColor: '#FEF2F2' }]}>
                      <Award size={14} color={isApproved ? '#10B981' : isRejected ? '#EF4444' : '#F59E0B'} />
                    </View>
                    <View style={styles.certContent}>
                      <Text style={styles.certTitle}>{cert.title}</Text>
                      {cert.documentUri ? (
                        <View style={[
                          styles.docBadge,
                          isApproved && { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
                          isRejected && { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
                          !isApproved && !isRejected && { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }
                        ]}>
                          {isApproved ? (
                            <>
                              <BadgeCheck size={11} color="#059669" />
                              <Text style={[styles.docBadgeText, { color: '#059669', fontWeight: '700' as const }]}>Verified by Admin ✓</Text>
                            </>
                          ) : isRejected ? (
                            <>
                              <XCircle size={11} color="#DC2626" />
                              <Text style={[styles.docBadgeText, { color: '#DC2626' }]}>Certificate rejected</Text>
                            </>
                          ) : (
                            <>
                              <Clock size={11} color="#D97706" />
                              <Text style={[styles.docBadgeText, { color: '#D97706' }]}>Under admin review ⏳</Text>
                            </>
                          )}
                        </View>
                      ) : (
                        <Text style={styles.certMeta}>Certificate</Text>
                      )}
                    </View>
                  </View>
                );
              })}

              {currentUser.teacherProfile.careerHistory && currentUser.teacherProfile.careerHistory.length > 0 && (
                <View style={styles.careerBlock}>
                  <Text style={styles.careerBlockTitle}>Past Experience</Text>
                  {currentUser.teacherProfile.careerHistory.map((entry: any) => (
                    <View key={entry.id} style={styles.certRow}>
                      <View style={[styles.certIconWrap, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                        <Briefcase size={14} color={Colors.light.primary} />
                      </View>
                      <View style={styles.certContent}>
                        <Text style={styles.certTitle}>{entry.role}</Text>
                        <Text style={styles.certMeta}>
                          {[entry.organization, entry.years].filter(Boolean).join(' · ') || '—'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Skills I Offer</Text>
              <TouchableOpacity
                style={styles.addSkillButton}
                onPress={() => isDemoUser ? handleRequireLogin('add an offer skill') : router.push('/add-skill' as any)}
                activeOpacity={0.7}
              >
                <Plus size={16} color="#FFFFFF" />
                <Text style={styles.addSkillButtonText}>Add Skill</Text>
              </TouchableOpacity>
            </View>
            <View
              style={[
                styles.skillsGrid,
                numSkillColumns > 1 && {
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 16,
                },
              ]}
            >
              {(currentUser?.skillsOffered || []).map((skill, index) => {
                const skId = skill._id || skill.id;
                const certStatus = skill.certificateUri && currentUser ? getSkillCertificationStatus(currentUser.id, skId) : null;
                const certView = certStatus === 'approved'
                  ? { Icon: BadgeCheck, color: '#10B981', label: 'Certificate verified' }
                  : certStatus === 'rejected'
                    ? { Icon: XCircle, color: '#EF4444', label: 'Certificate rejected' }
                    : { Icon: Clock, color: '#F59E0B', label: 'Under admin review' };

                return (
                  <View
                    key={skId || index}
                    style={[
                      styles.skillCardWrap,
                      numSkillColumns > 1 && {
                        width: skillCardWidth,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.skillCard}
                      onPress={() => router.push(`/skill/${skId}` as any)}
                      activeOpacity={0.85}
                    >
                      {skill.imageUrl ? (
                        <Image
                          source={{ uri: resolveImageUrl(skill.imageUrl, 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800') }}
                          style={styles.skillImage}
                        />
                      ) : (
                        <View style={[styles.skillImage, { backgroundColor: Colors.light.backgroundTertiary }]} />
                      )}
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.85)']}
                        style={styles.skillOverlay}
                      >
                        <View style={styles.skillBadgeRow}>
                          {skill.promoted ? (
                            <View style={styles.skillPromotedBadge}>
                              <Sparkles size={8} color="#F59E0B" />
                              <Text style={styles.skillPromotedBadgeText}>PROMOTED</Text>
                            </View>
                          ) : null}
                          {skill.pricingModel && skill.pricingModel !== 'free' ? (
                            <View style={styles.skillPriceBadge}>
                              <Text style={styles.skillPriceBadgeText}>
                                {skill.pricingModel === 'per_session'
                                  ? `${formatPrice(skill.pricePerSession ?? 0)}/s`
                                  : `${formatPrice(skill.monthlyPrice ?? 0)}/m`}
                              </Text>
                            </View>
                          ) : null}
                          {skill.certificateUri ? (
                            <View style={[styles.skillCertChip, { backgroundColor: certStatus === 'approved' ? '#10B981' : certStatus === 'rejected' ? '#EF4444' : '#F59E0B' }]}>
                              {certStatus === 'approved' ? <BadgeCheck size={13} color="#FFFFFF" /> : <Clock size={13} color="#FFFFFF" />}
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.skillCardTitle} numberOfLines={2}>
                          {skill.title}
                        </Text>
                        <View style={styles.skillCardBadge}>
                          <Text style={styles.skillCardBadgeText}>{skill.level}</Text>
                        </View>
                      </LinearGradient>

                      {/* Top Right Action Buttons: Edit & Delete */}
                      <View style={styles.cardActionsOverlay}>
                        <TouchableOpacity
                          style={styles.cardActionBtnEdit}
                          onPress={(e) => {
                            e.stopPropagation();
                            if (isDemoUser) {
                              handleRequireLogin('edit offer skills');
                              return;
                            }
                            router.push(`/add-skill?id=${skId}` as any);
                          }}
                          activeOpacity={0.8}
                        >
                          <Edit size={12} color="#FFFFFF" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.cardActionBtnDelete}
                          onPress={(e) => {
                            e.stopPropagation();
                            if (isDemoUser) {
                              handleRequireLogin('delete offer skills');
                              return;
                            }
                            showAlert(
                              'Delete Skill',
                              `Remove "${skill.title}" from your offered skills?`,
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Delete',
                                  style: 'destructive',
                                  onPress: () => {
                                    if (removeSkill && skId) removeSkill(skId);
                                  },
                                },
                              ],
                            );
                          }}
                          activeOpacity={0.8}
                        >
                          <Trash2 size={12} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>

                    {isTeacher ? (
                      skill.certificateUri ? (
                        <View style={styles.skillCertRow}>
                          <View style={[styles.skillCertAttached, { backgroundColor: certView.color + '14' }]}>
                            <certView.Icon size={14} color={certView.color} />
                            <Text style={[styles.skillCertAttachedText, { color: certView.color }]} numberOfLines={1}>
                              {certView.label}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.skillCertAction}
                            onPress={() => handleUploadCertificate(skId, skill.title)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.skillCertActionText}>Replace</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.skillCertAction}
                            onPress={() => handleRemoveCertificate(skId, skill.title)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.skillCertActionText, { color: Colors.light.error }]}>Remove</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.skillCertUploadBtn}
                          onPress={() => handleUploadCertificate(skId, skill.title)}
                          activeOpacity={0.75}
                        >
                          <Upload size={14} color="#059669" />
                          <Text style={styles.skillCertUploadText}>Upload certificate / document</Text>
                        </TouchableOpacity>
                      )
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Want to Learn</Text>
              <TouchableOpacity
                style={styles.addWantButton}
                onPress={() => isDemoUser ? handleRequireLogin('edit learning skills') : router.push('/edit-profile' as any)}
                activeOpacity={0.7}
              >
                <Plus size={14} color={Colors.light.primary} />
                <Text style={styles.addWantButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.wantsList}>
              {(currentUser?.skillsWanted || []).map((skill, index) => (
                <View key={index} style={styles.wantCard}>
                  <View style={styles.wantIconContainer}>
                    <Sparkles size={16} color={Colors.light.primary} />
                  </View>
                  <Text style={styles.wantText}>{skill}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <ReviewsSection
              revieweeId={currentUser?.id || ''}
              headline="Reviews You've Received"
            />
          </View>

          {/* Certificates Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Certificates</Text>
              {certificates.length > 0 && (
                <View style={styles.certCountBadge}>
                  <Text style={styles.certCountText}>{certificates.length}</Text>
                </View>
              )}
            </View>
            {certificates.length === 0 ? (
              <View style={styles.certEmpty}>
                <ScrollText size={36} color={Colors.light.textTertiary} />
                <Text style={styles.certEmptyTitle}>No certificates yet</Text>
                <Text style={styles.certEmptySub}>Complete swaps and classes to earn certificates</Text>
              </View>
            ) : (
              <View style={styles.certList}>
                {certificates.map((cert: CertificateData) => {
                  const label = getCertificateLabel(cert.type);
                  return (
                    <TouchableOpacity
                      key={cert.id}
                      style={styles.certCard}
                      onPress={() => router.push(`/certificate/${cert.id}` as any)}
                      activeOpacity={0.7}
                    >
                      <LinearGradient
                        colors={['#6366F1', '#4F46E5']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.certCardIcon}
                      >
                        <Award size={22} color="#FFFFFF" />
                      </LinearGradient>
                      <View style={styles.certCardInfo}>
                        <Text style={styles.certCardTitle} numberOfLines={1}>{cert.skillTitle}</Text>
                        <Text style={styles.certCardSub} numberOfLines={1}>{label.subtitle}</Text>
                        <Text style={styles.certCardDate}>{formatDate(cert.completedAt)}</Text>
                      </View>
                      <View style={styles.certCardActions}>
                        <TouchableOpacity
                          style={styles.certDownloadBtn}
                          onPress={() => router.push(`/certificate/${cert.id}` as any)}
                        >
                          <Download size={16} color={Colors.light.primary} />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Support & Info Section (Last Section) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Support & Info</Text>
            <View style={styles.supportGrid}>
              <TouchableOpacity
                style={styles.supportCard}
                onPress={() => isDemoUser ? handleRequireLogin('create a group class') : router.push('/class/create' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.supportIcon, { backgroundColor: Colors.light.accent + '20' }]}>
                  <Plus size={22} color={Colors.light.accent} />
                </View>
                <Text style={styles.supportLabel}>Create a Group Class</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.supportCard}
                onPress={() => isDemoUser ? handleRequireLogin('view your enrolled classes') : router.push('/class/my' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.supportIcon, { backgroundColor: Colors.light.primary + '20' }]}>
                  <Users size={22} color={Colors.light.primary} />
                </View>
                <Text style={styles.supportLabel}>My Classes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.supportCard}
                onPress={() => router.push('/help' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.supportIcon, { backgroundColor: Colors.light.primaryLight + '20' }]}>
                  <HelpCircle size={22} color={Colors.light.primary} />
                </View>
                <Text style={styles.supportLabel}>Help & Support</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.supportCard}
                onPress={() => router.push('/contact' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.supportIcon, { backgroundColor: Colors.light.secondary + '20' }]}>
                  <MessageSquare size={22} color={Colors.light.secondary} />
                </View>
                <Text style={styles.supportLabel}>Contact Us</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.supportCard}
                onPress={() => router.push('/about' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.supportIcon, { backgroundColor: Colors.light.accentLight + '40' }]}>
                  <Info size={22} color={Colors.light.accent} />
                </View>
                <Text style={styles.supportLabel}>About Us</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.supportCard}
                onPress={() => router.push('/terms' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.supportIcon, { backgroundColor: Colors.light.backgroundTertiary }]}>
                  <FileText size={22} color={Colors.light.textSecondary} />
                </View>
                <Text style={styles.supportLabel}>Terms</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.supportCard}
                onPress={() => router.push('/privacy' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.supportIcon, { backgroundColor: Colors.light.backgroundTertiary }]}>
                  <Lock size={22} color={Colors.light.textSecondary} />
                </View>
                <Text style={styles.supportLabel}>Privacy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.supportCard}
                onPress={() => router.push('/blocked-users' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.supportIcon, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                  <UserX size={22} color="#EF4444" />
                </View>
                <Text style={styles.supportLabel}>
                  Blocked Users{blockedUsers.length > 0 ? ` (${blockedUsers.length})` : ''}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Login / Sign Out Button (Just After Support & Info) */}
          <View style={styles.buttonRow}>
            {isDemoUser ? (
              <TouchableOpacity
                style={styles.loginButton}
                onPress={handleDemoLogin}
                activeOpacity={0.85}
                testID="login-button"
              >
                <LogIn size={20} color="#FFFFFF" />
                <Text style={styles.loginButtonText}>Log In to Your Account</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.signOutButton}
                onPress={handleSignOut}
                activeOpacity={0.8}
                testID="sign-out-button"
              >
                <LogOut size={18} color={Colors.light.error} />
                <Text style={styles.signOutButtonText}>Sign Out</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.companyFooter}>
            <Text style={styles.companyName}>Gizmoverse Private Limited</Text>
            <Text style={styles.companyTagline}>leteski is a product of Gizmoverse Private Limited</Text>
          </View>

          <View style={styles.bottomSpacer} />
        </View>
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  badgeContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.light.accent,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  name: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  nameEditButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  shareIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  location: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500' as const,
  },
  trustScoreContainer: {
    marginTop: 12,
    alignItems: 'center',
    gap: 6,
  },
  trustScoreLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.95)',
  },
  content: {
    marginTop: -20,
    backgroundColor: Colors.light.backgroundSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.light.card,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
  },
  premiumBanner: {
    position: 'relative',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  premiumGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  premiumContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 14,
  },
  premiumInfo: {
    flex: 1,
  },
  premiumTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    letterSpacing: 1,
    marginBottom: 4,
  },
  premiumExpiry: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500' as const,
  },
  creditsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.card,
    padding: 18,
    borderRadius: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  creditsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  creditsIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditsInfo: {
    flex: 1,
  },
  creditsLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 2,
    fontWeight: '500' as const,
  },
  creditsValue: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: Colors.light.text,
  },
  creditsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.light.primaryLight,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  creditsButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.primary,
  },
  earningsCard: {
    marginBottom: 20,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  earningsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 14,
  },
  earningsIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  earningsInfo: {
    flex: 1,
  },
  earningsLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  earningsPoints: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '800' as const,
    marginBottom: 2,
  },
  earningsSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500' as const,
  },
  earningsArrow: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  earningsArrowText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  verificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.card,
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    gap: 12,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  verificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verificationContent: {
    flex: 1,
  },
  verificationTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  verificationSubtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  verificationAction: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.primary,
  },
  buttonRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  signOutButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.light.backgroundTertiary,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.error,
  },
  loginButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    gap: 14,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  adminIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminTextWrap: {
    flex: 1,
  },
  adminTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  adminSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500' as const,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  addSkillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  addSkillButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  addWantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.primaryLight + '20',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.primaryLight,
  },
  addWantButtonText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.primary,
  },
  bioContainer: {
    backgroundColor: Colors.light.card,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  bioText: {
    fontSize: 15,
    lineHeight: 24,
    color: Colors.light.textSecondary,
  },
  skillsGrid: {
    gap: 12,
  },
  skillCard: {
    height: 170,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: Colors.light.backgroundTertiary,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  skillImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  skillOverlay: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  skillBadgeRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  skillPromotedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  skillPromotedBadgeText: {
    fontSize: 9,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  skillPriceBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  skillPriceBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  skillCardTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  skillCardBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  skillCardBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  cardActionsOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 10,
  },
  cardActionBtnEdit: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  cardActionBtnDelete: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  wantsList: {
    gap: 10,
  },
  wantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.card,
    padding: 14,
    borderRadius: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  wantIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.primaryLight + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wantText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  supportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  supportCard: {
    width: '48%',
    backgroundColor: Colors.light.card,
    padding: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  supportIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  bottomSpacer: {
    height: 40,
  },
  certCountBadge: {
    backgroundColor: Colors.light.primary + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  certCountText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.primary,
  },
  certEmpty: {
    alignItems: 'center',
    padding: 32,
    gap: 10,
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  certEmptyTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  certEmptySub: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center' as const,
  },
  certList: {
    gap: 12,
  },
  certCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.card,
    padding: 14,
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  certCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  certCardInfo: {
    flex: 1,
    gap: 2,
  },
  certCardTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  certCardSub: {
    fontSize: 12,
    color: Colors.light.primary,
    fontWeight: '600' as const,
  },
  certCardDate: {
    fontSize: 11,
    color: Colors.light.textTertiary,
  },
  certCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  certDownloadBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.light.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyFooter: {
    alignItems: 'center',
    padding: 20,
    marginTop: 16,
  },
  companyName: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  companyTagline: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    marginTop: 4,
  },
  credTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16,185,129,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  verifiedChipText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#10B981',
  },
  credRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.light.backgroundSecondary,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  credText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.text,
    flex: 1,
  },
  certRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  certIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(16,185,129,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  certContent: {
    flex: 1,
  },
  certTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  certMeta: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  docBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    backgroundColor: 'rgba(16,185,129,0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  docBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#10B981',
  },
  careerBlock: {
    marginTop: 8,
  },
  careerBlockTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginBottom: 10,
  },
  skillCardWrap: {
    marginBottom: 12,
    gap: 8,
  },
  skillCertChip: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  skillCertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  skillCertAttached: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    backgroundColor: 'rgba(16,185,129,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  skillCertAttachedText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#10B981',
    flex: 1,
  },
  skillCertAction: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  skillCertActionText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.light.primary,
  },
  skillCertUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#10B981',
    borderStyle: 'dashed' as const,
    backgroundColor: 'rgba(16,185,129,0.06)',
  },
  skillCertUploadText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#059669',
  },
});

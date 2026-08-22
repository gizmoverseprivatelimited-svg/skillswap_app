import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  MapPin,
  Star,
  Calendar,
  Sparkles,
  Users,
  Clock,
  Coins,
  Repeat,
  CreditCard,
  ArrowRight,
  Flag,
  Ban,
  ShieldAlert,
  X,
  GraduationCap,
  BadgeCheck,
  Languages,
  Award,
  FileCheck2,
  Briefcase,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '../../constants/colors';
import { mockUsers } from '../../mocks/data';

import ReviewsSection from '../../components/ReviewsSection';
import { useCurrentUser } from '@/providers/current-user';
import { useAlert } from '@/providers/alert';
import { resolveImageUrl } from '@/lib/resolveImageUrl';
import url from '@/constants/backurl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSkillSwaps } from '@/providers/skill-swaps';
import { useClasses } from '@/providers/classes';
import { useSafety } from '@/providers/safety';
import { formatCredits, formatClassSchedule, formatBillingCycle, getClassEnrollmentCost } from '@/lib/payments';
import { getSkillsWithUsers } from '@/mocks/data';
import { ClassWithTeacher, ReviewWithAuthor, SkillWithUser } from '@/types';
import SkillSwapRequestModal from '@/components/SkillSwapRequestModal';

import { useSocket } from '@/providers/socket';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // console.log(id);

  let { allUsers, currentUser } = useCurrentUser();
  const { showAlert } = useAlert();
  const { socket } = useSocket();
  const { getClassesByTeacher, enrollInClass, isEnrolled } = useClasses();
  const [selectedSkill, setSelectedSkill] = useState<SkillWithUser | null>(null);
  const [swapModalVisible, setSwapModalVisible] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [reviews, setReviews] = useState<any>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Safety state
  const { submitReport, isBlocked, checkBlockStatus, blockUser, unblockUser, reportReasons } = useSafety();
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [reportDescription, setReportDescription] = useState('');
  const [reportError, setReportError] = useState<string | null>(null);
  const [isBlockedRelation, setIsBlockedRelation] = useState(false);

  const router = useRouter();
  const { swaps, allSwaps } = useSkillSwaps();
  const [profileUser, setProfileUser] = useState<any>(null);

  // Find in memory or fetch fresh from backend
  const user = useMemo(() => {
    let resolved = profileUser;
    if (!resolved) {
      resolved = allUsers.find((u) => String(u.id) === String(id) || String((u as any)._id) === String(id));
    }
    if (!resolved && currentUser && (String(currentUser.id) === String(id) || String((currentUser as any)._id) === String(id))) {
      resolved = currentUser;
    }
    if (!resolved) {
      resolved = mockUsers.find((u) => String(u.id) === String(id));
    }
    if (resolved && !resolved.teacherProfile) {
      const mockMatch = mockUsers.find(
        (m) => String(m.id) === String(id) || (m.name && resolved.name && m.name.toLowerCase() === resolved.name.toLowerCase())
      );
      if (mockMatch?.teacherProfile) {
        resolved = { ...resolved, teacherProfile: mockMatch.teacherProfile };
      }
    }
    return resolved;
  }, [profileUser, allUsers, currentUser, id]);

  const insets = useSafeAreaInsets();
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

  const fetchProfileUser = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const res = await fetch(`${url}/users/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data && (data.id || data._id)) {
          setProfileUser(data);
        }
      }
    } catch (e) {
      console.warn('[Profile] Failed to fetch user directly:', e);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchProfileUser();
  }, [id, fetchProfileUser]);

  const uId = useMemo(() => {
    return user ? String(user.id || user._id || '') : '';
  }, [user]);

  const userIsBlocked = useMemo(() => {
    return uId ? isBlocked(uId) : false;
  }, [uId, isBlocked]);

  useEffect(() => {
    let isMounted = true;
    if (uId && currentUser?.id && uId !== String(currentUser.id)) {
      if (userIsBlocked) {
        setIsBlockedRelation(true);
      } else {
        checkBlockStatus(uId).then((res) => {
          if (isMounted) {
            setIsBlockedRelation(res.isBlocked);
          }
        });
      }
    } else {
      setIsBlockedRelation(false);
    }
    return () => {
      isMounted = false;
    };
  }, [uId, currentUser?.id, userIsBlocked, checkBlockStatus]);

  const teacherClasses = useMemo(() =>
    uId ? getClassesByTeacher(uId) : [],
  [uId, getClassesByTeacher]);

  const handleQuickEnroll = useCallback((cls: ClassWithTeacher) => {
    if (!currentUser || currentUser.id === '1') {
      showAlert('Sign In Required', 'Please sign in to your account to enroll in group classes.');
      return;
    }
    if (userIsBlocked || isBlockedRelation) {
      showAlert('Action Blocked', 'You cannot enroll in classes hosted by this user due to block settings.');
      return;
    }
    const cost = getClassEnrollmentCost(cls.seatPriceCredits);
    const userCredits = currentUser.credits ?? 0;
    const balanceAfter = userCredits - cost;
    if (cost > 0 && balanceAfter < 0) {
      showAlert('Not enough credits', `You need ${cost} credits but have ${userCredits}. Top up in the Store to enroll.`);
      return;
    }
    showAlert(
      'Confirm Enrollment',
      cost > 0
        ? `Pay ${cost} credits to enroll in "${cls.title}"?\n\nCurrent balance: ${userCredits}\nAfter enrollment: ${balanceAfter}`
        : `Enroll in "${cls.title}" for free?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Enroll',
          onPress: () => {
            const result = enrollInClass(cls.id);
            if (result.success) {
              showAlert('Enrolled!', `You're signed up for "${cls.title}".`, [
                { text: 'OK' },
                { text: 'View Class', onPress: () => router.push(`/class/${cls.id}` as any) },
              ]);
            } else {
              showAlert('Cannot enroll', result.error ?? 'Something went wrong.');
            }
          },
        },
      ],
    );
  }, [currentUser, userIsBlocked, isBlockedRelation, enrollInClass, router, showAlert]);

  const fetchReviews = useCallback(async () => {
    const uId = user?.id || user?._id;
    if (!uId) return;
    try {
      setFetchError(null);
      const res = await fetch(
        `${url}/reviews?revieweeId=${uId}&skillId=${""}`
      );
      if (res.ok) {
        const data = await res.json();
        setReviews(Array.isArray(data) ? data : []);
      }
    } catch (err: any) {
      console.warn("[Profile] Failed to fetch reviews:", err);
    }
  }, [user?.id, user?._id]);

  useEffect(() => {
    if (user?.id || user?._id) {
      void fetchReviews();
    }
  }, [user?.id, user?._id, fetchReviews]);

  useEffect(() => {
    if (socket) {
      const handleReviewUpdate = () => {
        void fetchReviews();
      };
      socket.on("review_updated", handleReviewUpdate);
      return () => {
        socket.off("review_updated", handleReviewUpdate);
      };
    }
  }, [fetchReviews, socket]);

  const handleSendMessage = useCallback(async () => {
    if (currentUser?.id === '1') {
      showAlert('Login Required', 'To start a message or request a swap, please log in with a real account.');
      return;
    }
    if (!user || !currentUser) return;

    if (userIsBlocked || isBlockedRelation) {
      showAlert('Action Blocked', 'You cannot initiate exchanges or send messages to this user due to block settings.');
      return;
    }
    console.log(swaps);

    const existingSwap = swaps.find(
      (s) => {
        if (s.status === 'completed' || s.status === 'declined') {
          return false;
        }
        return (s.requesterId === currentUser.id && s.recipientId === user.id) ||
          (s.requesterId === user.id && s.recipientId === currentUser.id);
      }
    );

    if (existingSwap) {
      console.log('[Profile] Navigating to existing swap:', existingSwap.id);
      router.push(`/swaps/${existingSwap.id}` as any);
      return;
    }

    const allSkills = await getSkillsWithUsers();

    const userSkills = allSkills.filter((s) => s.userId === user.id);

    if (userSkills.length > 0) {
      console.log('[Profile] Opening swap request modal for skill:', userSkills[0].id);
      setSelectedSkill(userSkills[0]);
      setSwapModalVisible(true);
    } else {
      showAlert(
        'No Skills Available',
        `${user.username ? (user.username.startsWith('@') ? user.username : `@${user.username}`) : `@${user.name.toLowerCase().replace(/\s+/g, '')}`} hasn't listed any skills yet. Check back later!`,
        [{ text: 'OK' }]
      );
    }
  }, [user, currentUser, userIsBlocked, isBlockedRelation, swaps, router, showAlert]);

  const handleReport = useCallback(() => {
    if (!user) return;
    if (!currentUser || currentUser.id === '1' || (currentUser as any).isDemo) {
      showAlert(
        'Login Required 🔒',
        'Please log in or create an account to report a user.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/login' as any) },
        ]
      );
      return;
    }
    setReportModalVisible(true);
    setSelectedReason(null);
    setReportDescription('');
    setReportError(null);
  }, [user, currentUser, router, showAlert]);

  const handleSubmitReport = useCallback(() => {
    if (!user || !currentUser) return;
    if (!selectedReason) {
      setReportError('Please select a reason for your report.');
      return;
    }
    if (reportDescription.trim().length < 10) {
      setReportError('Please provide at least 10 characters describing what happened.');
      return;
    }
    submitReport(currentUser.id, user.id, selectedReason as any, reportDescription, {
      reporterName: currentUser.name,
      reporterAvatar: currentUser.avatarUrl,
      reportedUserName: user.name,
      reportedUserAvatar: user.avatarUrl,
    });
    setReportModalVisible(false);
    showAlert(
      'Report Submitted',
      'Thank you for helping keep leteski safe. Our team will review this report within 24 hours.',
    );
  }, [user, currentUser, selectedReason, reportDescription, submitReport, showAlert]);

  const handleBlock = useCallback(() => {
    if (!user) return;
    if (!currentUser || currentUser.id === '1' || (currentUser as any).isDemo) {
      showAlert(
        'Login Required 🔒',
        'Please log in or create an account to block a user.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/login' as any) },
        ]
      );
      return;
    }
    const targetId = user.id || user._id;
    showAlert(
      'Block User',
      `Are you sure you want to block ${user.name}? They won't be able to send you exchange requests, enroll in your classes, or see each other in matches.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            await blockUser(currentUser.id, targetId, { name: user.name, avatarUrl: user.avatarUrl });
            showAlert('User Blocked', `${user.name} has been blocked.`);
          },
        },
      ],
    );
  }, [user, currentUser, blockUser, router, showAlert]);

  const handleUnblock = useCallback(async () => {
    if (!user) return;
    if (!currentUser || currentUser.id === '1' || (currentUser as any).isDemo) {
      showAlert(
        'Login Required 🔒',
        'Please log in or create an account to manage blocked users.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/login' as any) },
        ]
      );
      return;
    }
    const targetId = user.id || user._id;
    await unblockUser(targetId, currentUser?.id);
    showAlert('User Unblocked', `${user.name} has been unblocked.`);
  }, [user, currentUser, unblockUser, router, showAlert]);

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom, justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.errorText}>User not found</Text>
      </View>
    );
  }

  const averageRating = reviews?.stats?.averageRating ?? user.rating ?? 0;
  const totalReviews = reviews?.stats?.totalReviews ?? 0;

  const swapcount = Math.max(
    user.totalSwaps || 0,
    (allSwaps?.filter((s: any) => s.requesterId == user.id || s.recipientId == user.id) || []).length
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: user.username ? (user.username.startsWith('@') ? user.username : `@${user.username}`) : `@${user.name.toLowerCase().replace(/\s+/g, '')}`,
          headerStyle: {
            backgroundColor: Colors.light.background,
          },
          headerTintColor: Colors.light.text,
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image
            source={{ uri: resolveImageUrl(user?.avatarUrl) }}
            style={styles.avatar}
          />
          <Text style={styles.name}>{user.username ? (user.username.startsWith('@') ? user.username : `@${user.username}`) : `@${user.name.toLowerCase().replace(/\s+/g, '')}`}</Text>
          <View style={styles.locationRow}>
            <MapPin size={16} color={Colors.light.textSecondary} />
            <Text style={styles.location}>{user.location}</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{swapcount}</Text>
              <Text style={styles.statLabel}>Total Exchanges</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.ratingRow}>
                <Star size={20} fill={Colors.light.accent} color={Colors.light.accent} />
                <Text style={styles.statValue}>{averageRating.toFixed(1)}</Text>
              </View>
              <Text style={styles.statLabel}>Rating</Text>
              <Text style={styles.statHint}>{totalReviews} review{totalReviews === 1 ? '' : 's'}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.joinedRow}>
                <Calendar size={16} color={Colors.light.primary} />
                <Text style={styles.statValue}>{user?.joinedDate ? new Date(user.joinedDate).getFullYear() : '—'}</Text>
              </View>
              <Text style={styles.statLabel}>Joined</Text>
            </View>
          </View>

          <TouchableOpacity onPress={handleSendMessage} activeOpacity={0.8} style={styles.messageButton}>
            <Text style={styles.messageButtonText}>Send Message</Text>
          </TouchableOpacity>

          {currentUser?.id !== user.id && (
            userIsBlocked ? (
              <View style={styles.safetyRow}>
                <View style={styles.blockedBadge}>
                  <Ban size={14} color="#FFFFFF" />
                  <Text style={styles.blockedBadgeText}>Blocked</Text>
                </View>
                <TouchableOpacity onPress={handleUnblock} style={styles.unblockBtn} activeOpacity={0.7}>
                  <Text style={styles.unblockBtnText}>Unblock</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.safetyRow}>
                <TouchableOpacity onPress={handleReport} style={styles.reportBtn} activeOpacity={0.7}>
                  <Flag size={14} color="#EF4444" />
                  <Text style={styles.reportBtnText}>Report</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleBlock} style={styles.blockBtn} activeOpacity={0.7}>
                  <Ban size={14} color={Colors.light.textSecondary} />
                  <Text style={styles.blockBtnText}>Block</Text>
                </TouchableOpacity>
              </View>
            )
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.bioText}>{user.bio}</Text>
        </View>

        {user.teacherProfile && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.credTitleRow}>
                <GraduationCap size={20} color={Colors.light.primary} />
                <Text style={styles.sectionTitle}>Teaching Credentials</Text>
              </View>
              {user.teacherProfile.isCertified && (
                <View style={styles.verifiedChip}>
                  <BadgeCheck size={13} color="#10B981" />
                  <Text style={styles.verifiedChipText}>Certified</Text>
                </View>
              )}
            </View>

            {user.teacherProfile.languages && user.teacherProfile.languages.length > 0 && (
              <View style={styles.credRow}>
                <Languages size={16} color={Colors.light.primary} />
                <Text style={styles.credText}>Teaches in {user.teacherProfile.languages.join(', ')}</Text>
              </View>
            )}
            {user.teacherProfile.qualifications && user.teacherProfile.qualifications.length > 0 && (
              <View style={styles.credRow}>
                <Award size={16} color={Colors.light.primary} />
                <Text style={styles.credText}>{user.teacherProfile.qualifications.join(' · ')}</Text>
              </View>
            )}
            {user.teacherProfile.yearsTeaching ? (
              <View style={styles.credRow}>
                <Clock size={16} color={Colors.light.primary} />
                <Text style={styles.credText}>{user.teacherProfile.yearsTeaching} teaching experience</Text>
              </View>
            ) : null}
            {user.teacherProfile.privateTuition && (
              <View style={styles.credRow}>
                <Users size={16} color={Colors.light.primary} />
                <Text style={styles.credText}>Private tuition & coaching experience</Text>
              </View>
            )}

            {(user.teacherProfile.certifications || []).map((cert: any) => (
              <View key={cert.id} style={styles.certRow}>
                <View style={styles.certIconWrap}>
                  <Award size={14} color="#10B981" />
                </View>
                <View style={styles.certContent}>
                  <Text style={styles.certTitle}>{cert.title}</Text>
                  {cert.documentUri ? (
                    <View style={styles.docBadge}>
                      <FileCheck2 size={11} color="#10B981" />
                      <Text style={styles.docBadgeText}>Document on file</Text>
                    </View>
                  ) : (
                    <Text style={styles.certMeta}>Certificate</Text>
                  )}
                </View>
              </View>
            ))}

            {user.teacherProfile.careerHistory && user.teacherProfile.careerHistory.length > 0 && (
              <View style={styles.careerBlock}>
                <Text style={styles.careerBlockTitle}>Past Experience</Text>
                {user.teacherProfile.careerHistory.map((entry: any) => (
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
            <Text style={styles.sectionTitle}>Skills Offered</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{(user.skillsOffered || []).length}</Text>
            </View>
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
            {(user.skillsOffered || []).map((skill: any, i: number) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.skillCard,
                  numSkillColumns > 1 && {
                    width: skillCardWidth,
                  },
                ]}
                onPress={() => router.push(`/skill/${skill._id || skill.id}` as any)}
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
                <View style={styles.skillOverlay}>
                  {skill.certificateUri && (
                    <View style={styles.skillCertChip}>
                      <BadgeCheck size={13} color="#FFFFFF" />
                    </View>
                  )}
                  <Text style={styles.skillCardTitle} numberOfLines={2}>
                    {skill.title}
                  </Text>
                  <View style={styles.skillCardBadge}>
                    <Text style={styles.skillCardBadgeText}>{skill.level}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {teacherClasses.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Classes by {user.name.split(' ')[0]}</Text>
              <View style={[styles.badge, { backgroundColor: Colors.light.secondary }]}>
                <Text style={styles.badgeText}>{teacherClasses.length}</Text>
              </View>
            </View>
            <View style={styles.teacherClassesList}>
              {teacherClasses.map((cls) => {
                const isOwner = String(currentUser?.id) === String(user?.id) || String(currentUser?.id) === String(cls.teacherId);
                const seatsLeft = cls.maxCapacity - cls.enrolledCount;
                const isFree = cls.seatPriceCredits === 0;
                const enrolled = isEnrolled(cls.id, currentUser?.id ?? '');
                const isFull = seatsLeft <= 0;
                const isRecurring = cls.sessionType !== 'single';
                const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                const timeStr = new Date(cls.startISO).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                return (
                  <View key={cls.id} style={styles.classCard}>
                    <TouchableOpacity
                      onPress={() => router.push(`/class/${cls.id}` as any)}
                      activeOpacity={0.85}
                    >
                      <Image source={{ uri: resolveImageUrl(cls.coverImageUrl) }} style={styles.classCover} />
                      <View style={styles.classBody}>
                        <View style={styles.classTopRow}>
                          <Text style={styles.classCatBadge}>{cls.category}</Text>
                          <View style={styles.classLevelPill}>
                            <Text style={styles.classLevelText}>{cls.level}</Text>
                          </View>
                        </View>
                        <Text style={styles.classTitle} numberOfLines={2}>{cls.title}</Text>
                        <View style={styles.classMetaRow}>
                          <Calendar size={12} color={Colors.light.textTertiary} />
                          <Text style={styles.classMetaText}>
                            {isRecurring
                              ? `${shortDate(cls.startISO)} — ${shortDate(cls.endISO)}`
                              : shortDate(cls.startISO)}
                          </Text>
                          <Clock size={12} color={Colors.light.textTertiary} />
                          <Text style={styles.classMetaText}>{timeStr}</Text>
                        </View>
                        <View style={styles.classMetaRow}>
                          <Repeat size={12} color={Colors.light.primary} />
                          <Text style={[styles.classMetaText, { color: Colors.light.primary }]}>
                            {formatClassSchedule(cls.sessionType, cls.sessionCount, cls.scheduleDays)}
                          </Text>
                          <CreditCard size={12} color={Colors.light.secondary} />
                          <Text style={[styles.classMetaText, { color: Colors.light.secondary }]}>
                            {formatBillingCycle(cls.billingCycle)}
                          </Text>
                        </View>
                        <View style={styles.classSeatRow}>
                          <View style={styles.classSeatInfo}>
                            <Users size={13} color={Colors.light.primary} />
                            <Text style={styles.classSeatText}>{cls.enrolledCount}/{cls.maxCapacity} enrolled</Text>
                          </View>
                          {isFree ? (
                            <View style={styles.classFreeTag}>
                              <Sparkles size={12} color="#10B981" />
                              <Text style={styles.classFreeText}>Free</Text>
                            </View>
                          ) : (
                            <View style={styles.classPriceTag}>
                              <Coins size={13} color="#F59E0B" />
                              <Text style={styles.classPriceText}>{formatCredits(cls.seatPriceCredits)}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>

                    <View style={[styles.classBody, { paddingTop: 0 }]}>
                      <View style={styles.classActionRow}>
                        {isOwner ? (
                          <View style={styles.classOwnerBadge}>
                            <Text style={styles.classOwnerText}>Your Class</Text>
                          </View>
                        ) : enrolled ? (
                          <View style={styles.classEnrolledBadge}>
                            <Sparkles size={14} color="#10B981" />
                            <Text style={styles.classEnrolledText}>Enrolled</Text>
                          </View>
                        ) : isFull ? (
                          <View style={styles.classFullBadge}>
                            <Text style={styles.classFullText}>Class Full</Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.classEnrollBtn}
                            onPress={() => handleQuickEnroll(cls)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.classEnrollBtnText}>
                              {isFree ? 'Enroll Free' : `Enroll · ${cls.seatPriceCredits} cr`}
                            </Text>
                            <ArrowRight size={14} color="#FFFFFF" />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={styles.classDetailLink}
                          onPress={() => router.push(`/class/${cls.id}` as any)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.classDetailLinkText}>Details</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Looking to Learn</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{(user.skillsWanted || []).length}</Text>
            </View>
          </View>
          <View style={styles.wantsList}>
            {(user.skillsWanted || []).map((skill: any, index: number) => (
              <View key={index} style={styles.wantCard}>
                <Sparkles size={18} color={Colors.light.primary} />
                <Text style={styles.wantText}>{skill}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.reviewsWrapper}>
          <ReviewsSection revieweeId={user.id} headline="What learners are saying" />
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {selectedSkill && (
        <SkillSwapRequestModal
          visible={swapModalVisible}
          skill={selectedSkill}
          onClose={() => {
            setSwapModalVisible(false);
            setSelectedSkill(null);
          }}
        />
      )}

      {/* Report User Modal */}
      <Modal
        visible={reportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.reportModalCard}>
            <View style={styles.reportModalHeader}>
              <View style={styles.reportModalTitleRow}>
                <Flag size={20} color="#EF4444" />
                <Text style={styles.reportModalTitle}>Report {user.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setReportModalVisible(false)}>
                <X size={20} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.reportModalDesc}>
              Select a reason for reporting this user. Our team reviews all reports within 24 hours.
            </Text>

            <View style={styles.reasonList}>
              {reportReasons.map((r) => {
                const isSelected = selectedReason === r.key;
                return (
                  <TouchableOpacity
                    key={r.key}
                    style={[styles.reasonChip, isSelected && styles.reasonChipActive]}
                    onPress={() => setSelectedReason(r.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.reasonChipIcon}>{r.icon}</Text>
                    <Text style={[styles.reasonChipText, isSelected && styles.reasonChipTextActive]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.inputLabel}>Additional Details</Text>
            <TextInput
              style={styles.reportInput}
              placeholder="Describe what happened (min 10 characters)..."
              placeholderTextColor={Colors.light.textTertiary}
              value={reportDescription}
              onChangeText={setReportDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {reportError && (
              <Text style={styles.reportModalError}>{reportError}</Text>
            )}

            <TouchableOpacity
              style={styles.reportSubmitBtn}
              onPress={handleSubmitReport}
              activeOpacity={0.8}
            >
              <Text style={styles.reportSubmitBtnText}>Submit Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: Colors.light.background,
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: Colors.light.primary,
  },
  name: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 24,
  },
  location: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.light.backgroundSecondary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  statHint: {
    fontSize: 11,
    color: Colors.light.textTertiary,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  joinedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  messageButton: {
    width: '100%',
    backgroundColor: Colors.light.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  messageButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  safetyRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 10,
  },
  reportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.06)',
  },
  reportBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#EF4444',
  },
  blockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    backgroundColor: Colors.light.backgroundTertiary,
  },
  blockBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  blockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#64748B',
  },
  blockedBadgeText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  unblockBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    backgroundColor: Colors.light.backgroundTertiary,
  },
  unblockBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  reportModalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.light.background,
    borderRadius: 20,
    padding: 20,
  },
  reportModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reportModalTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  reportModalDesc: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  reasonList: {
    gap: 8,
    marginBottom: 16,
  },
  reasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  reasonChipActive: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239,68,68,0.06)',
  },
  reasonChipIcon: {
    fontSize: 16,
  },
  reasonChipText: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '500' as const,
    flex: 1,
  },
  reasonChipTextActive: {
    color: '#EF4444',
    fontWeight: '600' as const,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginBottom: 6,
  },
  reportInput: {
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.light.text,
    backgroundColor: Colors.light.backgroundSecondary,
    minHeight: 80,
    marginBottom: 8,
  },
  reportModalError: {
    fontSize: 13,
    color: '#EF4444',
    marginBottom: 8,
  },
  reportSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 12,
  },
  reportSubmitBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  section: {
    backgroundColor: Colors.light.background,
    padding: 20,
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  badge: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  bioText: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.light.textSecondary,
  },
  skillsGrid: {
    gap: 12,
  },
  skillCard: {
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.light.backgroundSecondary,
  },
  skillImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  skillOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: 16,
    justifyContent: 'space-between',
  },
  skillCardTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  skillCardBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  skillCardBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.primary,
  },
  wantsList: {
    gap: 12,
  },
  wantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundSecondary,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  wantText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.light.text,
  },
  teacherClassesList: {
    gap: 14,
  },
  classCard: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  classCover: {
    width: '100%',
    height: 120,
    backgroundColor: Colors.light.backgroundTertiary,
  },
  classBody: {
    padding: 14,
  },
  classTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  classCatBadge: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  classLevelPill: {
    backgroundColor: Colors.light.backgroundTertiary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  classLevelText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.primary,
  },
  classTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 8,
    lineHeight: 20,
  },
  classMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  classMetaText: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    fontWeight: '500' as const,
    marginRight: 6,
  },
  classSeatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  classSeatInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  classSeatText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.primary,
  },
  classFreeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16,185,129,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  classFreeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#10B981',
  },
  classPriceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245,158,11,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  classPriceText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#F59E0B',
  },
  classActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  classEnrollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
  },
  classEnrollBtnText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  classEnrolledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16,185,129,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
  },
  classEnrolledText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#10B981',
  },
  classFullBadge: {
    backgroundColor: Colors.light.backgroundTertiary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    flex: 1,
    alignItems: 'center',
  },
  classFullText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.textTertiary,
  },
  classOwnerBadge: {
    backgroundColor: Colors.light.backgroundTertiary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    flex: 1,
    alignItems: 'center',
  },
  classOwnerText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.primary,
  },
  classDetailLink: {
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  classDetailLinkText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.primary,
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
  reviewsWrapper: {
    paddingHorizontal: 20,
  },
  bottomSpacer: {
    height: 40,
  },
  errorText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  skillCertChip: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
    zIndex: 10,
  },
});

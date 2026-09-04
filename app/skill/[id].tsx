import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { MapPin, Star, Users, ArrowRight, Award, Clock, CalendarCheck2, IndianRupee, Sparkles, Coins, Trash2, Edit, Calendar, Repeat, CreditCard, BadgeCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '../../constants/colors';
import { getSkillsWithUsers } from '../../mocks/data';
import ReviewsSection from '../../components/ReviewsSection';
import SkillSwapRequestModal from '../../components/SkillSwapRequestModal';
import { useSkillSwaps } from '../../providers/skill-swaps';
import { useCurrentUser } from '../../providers/current-user';
import { useClasses } from '@/providers/classes';
import { useAlert } from '../../providers/alert';
import type { ClassWithTeacher, SkillSwapStatus, SkillWithUser } from '../../types';
import { formatPrice } from '@/constants/locale';
import { formatCredits, formatClassSchedule, formatBillingCycle, getClassEnrollmentCost, getSessionCreditCost } from '@/lib/payments';
import { resolveImageUrl } from '@/lib/resolveImageUrl';
import { getCategoryImageUrl } from '@/constants/categories';
import url from '@/constants/backurl';

import { useSafety } from '@/providers/safety';

const swapStatusPalette: Record<SkillSwapStatus | 'fallback', { bg: string; border: string }> = {
  pending: { bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.4)' },
  negotiating: { bg: 'rgba(59, 130, 246, 0.16)', border: 'rgba(59, 130, 246, 0.45)' },
  scheduled: { bg: 'rgba(16, 185, 129, 0.18)', border: 'rgba(16, 185, 129, 0.5)' },
  declined: { bg: 'rgba(248, 113, 113, 0.18)', border: 'rgba(248, 113, 113, 0.45)' },
  completed: { bg: 'rgba(139, 92, 246, 0.18)', border: 'rgba(139, 92, 246, 0.45)' },
  fallback: { bg: 'rgba(148, 163, 184, 0.18)', border: 'rgba(148, 163, 184, 0.35)' },
};

const resolveSwapTagStyle = (status: SkillSwapStatus | string) => {
  const palette = swapStatusPalette[status as SkillSwapStatus] ?? swapStatusPalette.fallback;
  return {
    backgroundColor: palette.bg,
    borderColor: palette.border,
  };
};

export default function SkillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [skill, setSkill] = useState<SkillWithUser>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { swaps, allSwaps, fetchSwaps } = useSkillSwaps();
  const { currentUser, allUsers, removeSkill } = useCurrentUser();

  useEffect(() => {
    fetchSwaps();
    setIsLoading(true);

    const loadSkillData = async () => {
      try {
        const list = await getSkillsWithUsers();
        let found = list.find(s => (s._id || s.id) === id);

        if (!found && currentUser) {
          const mySkill = currentUser.skillsOffered?.find(s => ((s as any)._id || s.id) === id);
          if (mySkill) {
            found = {
              ...mySkill,
              user: currentUser,
            } as SkillWithUser;
          }
        }

        if (!found && Array.isArray(allUsers)) {
          for (const u of allUsers) {
            const matched = u.skillsOffered?.find(s => ((s as any)._id || s.id) === id);
            if (matched) {
              found = {
                ...matched,
                user: u,
              } as SkillWithUser;
              break;
            }
          }
        }

        if (!found && id && !id.startsWith('onboard-') && !id.startsWith('guest_skill_')) {
          try {
            const res = await fetch(`${url}/skills/${id}`);
            if (res.ok) {
              const data = await res.json();
              if (data && (data._id || data.id)) {
                const owner = allUsers.find(u => u.id === data.userId || (u as any)._id === data.userId) || currentUser;
                found = {
                  ...data,
                  user: owner || undefined,
                } as SkillWithUser;
              }
            }
          } catch (fetchErr) {
            console.warn('[SkillDetail] Direct fetch failed:', fetchErr);
          }
        }

        setSkill(found);
      } catch (err) {
        console.warn('[SkillDetail] Failed to load skill data:', err);
        if (currentUser) {
          const mySkill = currentUser.skillsOffered?.find(s => ((s as any)._id || s.id) === id);
          if (mySkill) {
            setSkill({
              ...mySkill,
              user: currentUser,
            } as SkillWithUser);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    void loadSkillData();
  }, [id, currentUser, allUsers]);
  const { isBlocked, checkBlockStatus } = useSafety();
  const { classes, getClassesByTeacher, enrollInClass, isEnrolled } = useClasses();
  const { showAlert } = useAlert();
  const [isSwapModalVisible, setSwapModalVisible] = useState<boolean>(false);
  const [isBlockedRelation, setIsBlockedRelation] = useState<boolean>(false);

  const isOwner = skill?.userId === currentUser?.id || skill?.user?.id === currentUser?.id;

  const teacherUser = useMemo(() => {
    if (!skill?.user?.id) return skill?.user;
    return allUsers.find(u => u.id === skill.user.id) || skill.user;
  }, [allUsers, skill?.user]);

  const targetUserId = useMemo(() => {
    return teacherUser?.id || skill?.userId || skill?.user?.id;
  }, [teacherUser?.id, skill?.userId, skill?.user?.id]);

  useEffect(() => {
    let isMounted = true;
    if (targetUserId && currentUser?.id) {
      if (isBlocked(targetUserId)) {
        setIsBlockedRelation(true);
      } else {
        checkBlockStatus(targetUserId).then((res) => {
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
  }, [targetUserId, currentUser?.id, isBlocked, checkBlockStatus]);

  const teacherClasses = useMemo(() => {
    return targetUserId ? getClassesByTeacher(targetUserId) : [];
  }, [targetUserId, getClassesByTeacher]);

  const hasActiveClassForSkill = useMemo(() => {
    if (!skill || !classes) return false;
    const skillId = skill._id || skill.id;
    return classes.some(
      (c) =>
        c.status === 'open' &&
        (c.teacherId === skill.userId || c.teacherId === skill.user?.id) &&
        c.category === skill.category,
    );
  }, [skill, classes]);

  const canCreateGroupClass = isOwner && !hasActiveClassForSkill;

  const handleQuickEnroll = useCallback((cls: ClassWithTeacher) => {
    if (!currentUser || currentUser.id === '1' || (currentUser as any).isDemo) {
      showAlert(
        'Login Required 🔒',
        'Please log in or create an account to enroll in group classes.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/login' as any) },
        ]
      );
      return;
    }
    if ((targetUserId && isBlocked(targetUserId)) || isBlockedRelation) {
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
  }, [currentUser, targetUserId, isBlocked, isBlockedRelation, enrollInClass, router, showAlert]);

  const [reviewsStats, setReviewsStats] = useState<{ averageRating: number; totalReviews: number } | null>(null);

  useEffect(() => {
    const targetUserId = teacherUser?.id || skill?.user?.id;
    if (!targetUserId) return;
    fetch(`${url}/reviews?revieweeId=${targetUserId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.stats) {
          setReviewsStats({
            averageRating: data.stats.averageRating || 0,
            totalReviews: data.stats.totalReviews || 0,
          });
        }
      })
      .catch((err) => console.error('[SkillDetail] Failed to fetch review stats:', err));
  }, [teacherUser?.id, skill?.user?.id]);

  const skillAverageRating = reviewsStats?.averageRating ?? teacherUser?.rating ?? skill?.user?.rating ?? 0;
  const skillTotalReviews = reviewsStats?.totalReviews ?? 0;

  const teacherTotalSwaps = useMemo(() => {
    const targetUser = teacherUser || skill?.user;
    if (!targetUser?.id) return 0;
    const count = (allSwaps || []).filter(
      (s: any) => s.requesterId === targetUser.id || s.recipientId === targetUser.id
    ).length;
    return Math.max(targetUser.totalSwaps || 0, count);
  }, [allSwaps, teacherUser, skill?.user]);

  const activeSwap = useMemo(() => {
    return swaps.find((candidate) => {
      if (candidate.status === 'completed' || candidate.status === 'declined') {
        return false;
      }
      if (candidate.recipientId === skill?.user?.id && candidate.requesterId === currentUser?.id) {
        return true;
      }
      if (candidate.requesterId === skill?.user?.id && candidate.recipientId === currentUser?.id) {
        return true;
      }
      return false;
    }) ?? null;
  }, [currentUser?.id, skill?.user?.id, swaps]);

  const swapStatusLabel = useMemo(() => {
    if (!activeSwap) {
      return null;
    }
    switch (activeSwap.status) {
      case 'pending':
        return 'Awaiting their response';
      case 'negotiating':
        return 'Coordinate details together';
      case 'scheduled':
        return 'Session locked in';
      case 'completed':
        return 'Swap wrapped';
      case 'declined':
        return 'Swap declined';
      default:
        return null;
    }
  }, [activeSwap]);

  const nextSwapTime = useMemo(() => {
    if (!activeSwap) {
      return null;
    }
    const acceptedSlot = activeSwap.acceptedTimeId
      ? activeSwap.proposedTimes.find((slot) => slot.id === activeSwap.acceptedTimeId)
      : null;
    const fallbackSlot = activeSwap.proposedTimes.find((slot) => slot.status === 'pending');
    const slot = acceptedSlot ?? fallbackSlot ?? null;
    if (!slot) {
      return null;
    }
    const startDate = new Date(slot.startISO);
    return startDate.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [activeSwap]);

  const handleRequestPress = useCallback(() => {
    if (!currentUser || currentUser.id === '1' || (currentUser as any).isDemo) {
      showAlert(
        'Login Required 🔒',
        'Please log in or create an account to request a skill exchange.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/login' as any) },
        ]
      );
      return;
    }
    const tId = skill?.userId || skill?.user?.id;
    if ((tId && isBlocked(tId)) || isBlockedRelation) {
      showAlert('Action Blocked', 'You cannot request swaps with this user due to block settings.');
      return;
    }
    if (activeSwap) {
      router.push(`/swaps/${activeSwap.id}` as never);
      return;
    }
    setSwapModalVisible(true);
  }, [activeSwap, skill, isBlocked, isBlockedRelation, router, currentUser?.id, showAlert]);

  const handleDeleteSkill = useCallback(() => {
    showAlert(
      'Delete Skill',
      `Remove "${skill?.title}" from your teaching skills? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (skill) removeSkill(skill._id || skill.id);
            router.back();
          },
        },
      ],
    );
  }, [skill, removeSkill, router, showAlert]);
  const contentContainerStyle = useMemo(() => {
    return {
      paddingBottom: insets.bottom + 140,
      paddingTop: insets.top,
    };
  }, [insets.bottom, insets.top]);

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  if (!skill) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.errorText}>Skill not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerTransparent: true,
          headerTintColor: '#FFFFFF',
        }}
      />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={contentContainerStyle}
      >
        <View style={styles.heroContainer}>
          <Image
            source={{ uri: resolveImageUrl(skill.imageUrl, getCategoryImageUrl(skill.category || skill.title)) }}
            style={styles.headerImage}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)']}
            style={styles.heroGradient}
          />
        </View>

        <View style={styles.content}>
          {activeSwap && swapStatusLabel ? (
            <View style={styles.swapStatusCard} testID="existing-swap-status">
              <View style={styles.swapStatusHeader}>
                <View style={[styles.swapTagBase, resolveSwapTagStyle(activeSwap.status)]}>
                  <Text style={styles.swapTagText}>{activeSwap.status.toUpperCase()}</Text>
                </View>
                {Boolean(nextSwapTime) ? (
                  <View style={styles.swapTimeRow}>
                    <CalendarCheck2 size={16} color={Colors.light.primary} />
                    <Text style={styles.swapTimeText}>{nextSwapTime}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.swapStatusBody}>{swapStatusLabel}</Text>
              {activeSwap.locationPreference ? (
                <View style={styles.swapFooter}>
                  <MapPin size={16} color={Colors.light.textSecondary} />
                  <Text style={styles.swapLocationText}>{activeSwap.locationPreference}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <View style={styles.header}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{skill.category}</Text>
            </View>
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>{skill.level}</Text>
            </View>
            {Boolean(skill.certificateUri) ? (
              <View style={styles.certVerifiedBadge}>
                <BadgeCheck size={14} color="#10B981" />
                <Text style={styles.certVerifiedBadgeText}>Certified</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.titleRow}>
            <Text style={styles.title}>{skill.title}</Text>
            {Boolean(isOwner) ? (
              <View style={styles.ownerActionsRow}>
                <TouchableOpacity
                  onPress={() => router.push(`/add-skill?id=${skill._id || skill.id}` as any)}
                  style={styles.editButton}
                  activeOpacity={0.7}
                  testID="edit-skill-button"
                >
                  <Edit size={18} color={Colors.light.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDeleteSkill}
                  style={styles.deleteButton}
                  activeOpacity={0.7}
                  testID="delete-skill-button"
                >
                  <Trash2 size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          {Boolean(skill.promoted || (skill.pricingModel && skill.pricingModel !== 'free')) ? (
            <View style={styles.pricingCard}>
              {Boolean(skill.promoted && skill.promoTagline) ? (
                <View style={styles.promoBanner}>
                  <Sparkles size={16} color="#F59E0B" />
                  <Text style={styles.promoText}>{skill.promoTagline}</Text>
                </View>
              ) : null}
              {Boolean(skill.pricingModel && skill.pricingModel !== 'free') ? (
                <View>
                  <View style={styles.priceRow}>
                    <IndianRupee size={20} color="#10B981" />
                    <Text style={styles.priceValue}>
                      {skill.pricingModel === 'per_session'
                        ? `${formatPrice(skill.pricePerSession ?? 0)}`
                        : `${formatPrice(skill.monthlyPrice ?? 0)}`}
                    </Text>
                    <Text style={styles.priceUnit}>
                      {skill.pricingModel === 'per_session' ? '/ session' : '/ month'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <Coins size={14} color="#F59E0B" />
                    <Text style={{ fontSize: 13, color: Colors.light.textSecondary, fontWeight: '500' }}>
                      = {formatCredits(getSessionCreditCost(skill))}
                    </Text>
                  </View>
                </View>
              ) : null}
              {Boolean(skill.pricingModel === 'free') ? (
                <View style={styles.priceRow}>
                  <Text style={styles.freeTag}>Free — Skill Exchange</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {Boolean(skill.description) ? (
            <View style={styles.description}>
              <Text style={styles.descriptionText}>{skill.description}</Text>
            </View>
          ) : null}

          <View style={styles.divider} />

          <View style={styles.teacherSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Teacher</Text>
              <Award size={18} color={Colors.light.primary} />
            </View>
            <TouchableOpacity
              style={styles.teacherCard}
              onPress={() => router.push(`/profile/${skill?.user?.id}` as any)}
            >
              <Image
                source={{ uri: resolveImageUrl(skill.user?.avatarUrl) }}
                style={styles.teacherAvatar}
              />
              <View style={styles.teacherInfo}>
                <Text style={styles.teacherName}>{skill.user?.username ? (skill.user.username.startsWith('@') ? skill.user.username : `@${skill.user.username}`) : skill.user?.name ? `@${skill.user.name.toLowerCase().replace(/\s+/g, '')}` : '@teacher'}</Text>
                <View style={styles.teacherStats}>
                  <View style={styles.statItem}>
                    <Star size={14} fill={Colors.light.accent} color={Colors.light.accent} />
                    <Text style={styles.statText}>{skillAverageRating?.toFixed(1)} ({skillTotalReviews})</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Users size={14} color={Colors.light.textSecondary} />
                    <Text style={styles.statText}>{teacherTotalSwaps} exchanges</Text>
                  </View>
                </View>
                <View style={styles.locationRow}>
                  <MapPin size={14} color={Colors.light.textSecondary} />
                  <Text style={styles.locationText}>{skill.user?.location || 'Location not set'}</Text>
                </View>
              </View>
              <View style={styles.arrowIcon}>
                <ArrowRight size={20} color={Colors.light.textSecondary} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <View style={styles.aboutSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>About</Text>
              <Clock size={18} color={Colors.light.secondary} />
            </View>
            <View style={styles.aboutCard}>
              <Text style={styles.aboutText}>{skill.user?.bio || 'No bio available.'}</Text>
            </View>
          </View>

          <View style={styles.wantsSection}>
            <Text style={styles.sectionTitle}>Looking to Learn</Text>
            <View style={styles.wantsTags}>
              {(skill?.user?.skillsWanted || []).map((wantedSkill, index) => (
                <View key={index} style={styles.wantTag}>
                  <Text style={styles.wantTagText}>{wantedSkill}</Text>
                </View>
              ))}
            </View>
          </View>

          {Boolean(teacherClasses && teacherClasses.length > 0) ? (
            <View style={styles.classesSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Classes by {skill?.user?.name?.split(' ')[0] || 'Teacher'}
                </Text>
                <View style={styles.classCountBadge}>
                  <Text style={styles.classCountBadgeText}>{teacherClasses.length}</Text>
                </View>
              </View>
              <View style={styles.teacherClassesList}>
                {teacherClasses.map((cls) => {
                  const isClassOwner = String(currentUser?.id) === String(skill?.userId || skill?.user?.id) || String(currentUser?.id) === String(cls.teacherId);
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
                          {isClassOwner ? (
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
          ) : null}
        </View>

        <View style={styles.reviewsWrapper}>
          <ReviewsSection revieweeId={skill?.user?.id} skillId={skill?.id} headline="Session reflections" />
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={styles.footer}>
        {Boolean(canCreateGroupClass) ? (
          <TouchableOpacity
            style={styles.groupClassButton}
            onPress={() => router.push(`/class/create?skillId=${skill.id}` as any)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#10B981', '#34D399']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.groupClassButtonGradient}
            >
              <Users size={20} color="#FFFFFF" />
              <Text style={styles.groupClassButtonText}>Create Group Class</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : null}
        {Boolean(!isOwner) ? (
          <TouchableOpacity
            style={[styles.requestButton, activeSwap && styles.requestButtonActive]}
            onPress={handleRequestPress}
            activeOpacity={0.85}
            testID="request-swap-button"
          >
            <LinearGradient
              colors={activeSwap ? ['#38BDF8', '#6366F1'] : [Colors.light.primary, Colors.light.primaryLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.requestButtonGradient}
            >
              <Text style={styles.requestButtonText}>{activeSwap ? 'Open Exchange Thread' : 'Request Skill Exchange'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : null}
      </View>

      <SkillSwapRequestModal
        visible={isSwapModalVisible}
        skill={skill}
        onClose={() => setSwapModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollView: {
    flex: 1,
  },
  heroContainer: {
    height: 360,
    position: 'relative',
  },
  headerImage: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.light.backgroundSecondary,
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  content: {
    padding: 20,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryBadge: {
    backgroundColor: Colors.light.secondary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  levelBadge: {
    backgroundColor: Colors.light.backgroundTertiary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.light.primary,
  },
  certVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  certVerifiedBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#10B981',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 30,
    fontWeight: '800' as const,
    color: Colors.light.text,
    lineHeight: 38,
  },
  ownerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  editButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.light.primaryLight + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    marginBottom: 24,
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 26,
    color: Colors.light.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.borderLight,
    marginVertical: 24,
  },
  teacherSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  teacherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundTertiary,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  teacherAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    marginRight: 16,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  teacherInfo: {
    flex: 1,
    gap: 6,
  },
  teacherName: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  teacherStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statDivider: {
    width: 1,
    height: 12,
    backgroundColor: Colors.light.border,
  },
  statText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  arrowIcon: {
    marginLeft: 8,
  },
  aboutSection: {
    marginBottom: 24,
  },
  aboutCard: {
    backgroundColor: Colors.light.backgroundTertiary,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  aboutText: {
    fontSize: 15,
    lineHeight: 24,
    color: Colors.light.textSecondary,
  },
  wantsSection: {
    marginBottom: 24,
  },
  pricingCard: {
    backgroundColor: Colors.light.backgroundTertiary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    gap: 12,
  },
  promoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  promoText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#92400E',
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceValue: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: '#10B981',
  },
  priceUnit: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
    marginLeft: 6,
  },
  freeTag: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#10B981',
  },
  wantsTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  wantTag: {
    backgroundColor: Colors.light.card,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.light.primary,
  },
  wantTagText: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '600' as const,
  },
  reviewsWrapper: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  bottomSpacer: {
    height: 40,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.light.background,
    padding: 20,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
    gap: 10,
  },
  groupClassButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  groupClassButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  groupClassButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  requestButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  requestButtonActive: {
    shadowColor: '#38BDF8',
  },
  requestButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  requestButtonText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  swapStatusCard: {
    backgroundColor: Colors.light.backgroundTertiary,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    marginBottom: 24,
    gap: 14,
  },
  swapStatusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  swapTagBase: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  swapTagText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.light.text,
    letterSpacing: 0.5,
  },
  swapStatusBody: {
    fontSize: 15,
    color: Colors.light.text,
    lineHeight: 22,
  },
  swapFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swapLocationText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  swapTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swapTimeText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.primary,
  },
  errorText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  classesSection: {
    marginBottom: 24,
  },
  classCountBadge: {
    backgroundColor: Colors.light.secondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  classCountBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  teacherClassesList: {
    gap: 14,
  },
  classCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: Colors.light.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
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
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.primary,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  classLevelPill: {
    backgroundColor: Colors.light.backgroundTertiary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  classLevelText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  classTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 8,
    lineHeight: 22,
  },
  classMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
    flexWrap: 'wrap' as const,
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
    marginTop: 4,
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
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
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
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: Colors.light.backgroundTertiary,
  },
  classDetailLinkText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
});

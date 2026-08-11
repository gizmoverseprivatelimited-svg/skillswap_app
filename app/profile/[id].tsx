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
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { MapPin, Star, Calendar, Sparkles, Users, Clock, Coins, Repeat, CreditCard, ArrowRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '../../constants/colors';
// import { mockUsers } from '../../mocks/data';

import ReviewsSection from '../../components/ReviewsSection';
import { useCurrentUser } from '@/providers/current-user';
import { useAlert } from '@/providers/alert';
import { resolveImageUrl } from '@/lib/resolveImageUrl';
import url from '@/constants/backurl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSkillSwaps } from '@/providers/skill-swaps';
import { useClasses } from '@/providers/classes';
import { formatCredits, formatClassSchedule, formatBillingCycle, getClassEnrollmentCost } from '@/lib/payments';
import { getSkillsWithUsers } from '@/mocks/data';
import { ClassWithTeacher, ReviewWithAuthor, SkillWithUser } from '@/types';
import SkillSwapRequestModal from '@/components/SkillSwapRequestModal';

import { useSocket } from '@/providers/socket';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // console.log(id);

  let { allUsers, currentUser } = useCurrentUser()
  const { showAlert } = useAlert();
  const { socket } = useSocket();
  const { getClassesByTeacher, enrollInClass, isEnrolled } = useClasses();
  const [selectedSkill, setSelectedSkill] = useState<SkillWithUser | null>(null);
  const [swapModalVisible, setSwapModalVisible] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [reviews, setReviews] = useState<any>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const router = useRouter();
  const { swaps, allSwaps } = useSkillSwaps()
  const user = allUsers.find(u => u.id === id);
  const insets = useSafeAreaInsets();

  const teacherClasses = useMemo(() =>
    user ? getClassesByTeacher(user.id) : [],
  [user, getClassesByTeacher]);

  const handleQuickEnroll = useCallback((cls: ClassWithTeacher) => {
    if (!currentUser || currentUser.id === '1') {
      showAlert('Sign In Required', 'Please sign in to your account to enroll in group classes.');
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
  }, [currentUser, enrollInClass, router, showAlert]);

  const fetchReviews = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setIsLoading(true);
      }
      setFetchError(null);
      const res = await fetch(
        `${url}/reviews?revieweeId=${user?.id}&skillId=${""}`
      );

      if (!res.ok) throw new Error("Failed to fetch reviews");

      const data = await res.json();
      console.log("reviews", data);

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
  }, [user?.id]);

  useEffect(() => {
    fetchReviews();

    if (socket) {
      const handleReviewCreated = () => fetchReviews(true);
      socket.on('review_created', handleReviewCreated);
      return () => {
        socket.off('review_created', handleReviewCreated);
      };
    }
  }, [fetchReviews, socket]);

  const handleSendMessage = useCallback(async () => {
    if (currentUser?.id === '1') {
      showAlert('Login Required', 'To start a message or request a swap, please log in with a real account.');
      return;
    }
    if (!user || !currentUser) return;
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
  }, [user, currentUser, swaps, router]);

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
              <Text style={styles.statLabel}>Total Swaps</Text>
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
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.bioText}>{user.bio}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Skills Offered</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{(user.skillsOffered || []).length}</Text>
            </View>
          </View>
          <View style={styles.skillsGrid}>
            {(user.skillsOffered || []).map((skill, i) => (
              <TouchableOpacity
                key={i}
                style={styles.skillCard}
                onPress={() => router.push(`/skill/${skill._id}` as any)}
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
            {(user.skillsWanted || []).map((skill, index) => (
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
});

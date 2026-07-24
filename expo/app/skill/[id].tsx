import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Image, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { MapPin, Star, Users, ArrowRight, Award, Clock, CalendarCheck2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '../../constants/colors';
import { getSkillsWithUsers } from '../../mocks/data';
import ReviewsSection from '../../components/ReviewsSection';
import { trpc } from '../../lib/trpc';
import SkillSwapRequestModal from '../../components/SkillSwapRequestModal';
import { useSkillSwaps } from '../../providers/skill-swaps';
import { useCurrentUser } from '../../providers/current-user';
import type { SkillSwapStatus } from '../../types';

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
  const skillsWithUsers = getSkillsWithUsers();
  const skill = skillsWithUsers.find(s => s.id === id);
  const { swaps } = useSkillSwaps();
  const { currentUser } = useCurrentUser();
  const [isSwapModalVisible, setSwapModalVisible] = useState<boolean>(false);

  const reviewsSummary = trpc.reviews.list.useQuery(
    { revieweeId: skill?.user.id ?? '', skillId: skill?.id ?? '' },
    { enabled: Boolean(skill?.user.id && skill?.id) }
  );
  const skillAverageRating = reviewsSummary.data?.stats.averageRating ?? skill?.user.rating ?? 0;
  const skillTotalReviews = reviewsSummary.data?.stats.totalReviews ?? 0;

  const activeSwap = useMemo(() => {
    if (!skill) return null;
    return swaps.find((candidate) => {
      if (candidate.recipientId === skill.user.id && candidate.requesterId === currentUser.id) {
        return true;
      }
      if (candidate.requesterId === skill.user.id && candidate.recipientId === currentUser.id) {
        return true;
      }
      return false;
    }) ?? null;
  }, [currentUser.id, skill, swaps]);

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
    if (activeSwap) {
      router.push(`/swaps/${activeSwap.id}` as never);
      return;
    }
    setSwapModalVisible(true);
  }, [activeSwap, router]);

  const contentContainerStyle = useMemo(() => {
    return {
      paddingBottom: insets.bottom + 140,
      paddingTop: insets.top,
    };
  }, [insets.bottom, insets.top]);

  if (!skill) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Skill not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
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
          <Image source={{ uri: skill.imageUrl }} style={styles.headerImage} />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)']}
            style={styles.heroGradient}
          />
        </View>
        
        <View style={styles.content}>
          {activeSwap && swapStatusLabel && (
            <View style={styles.swapStatusCard} testID="existing-swap-status">
              <View style={styles.swapStatusHeader}>
                <View style={[styles.swapTagBase, resolveSwapTagStyle(activeSwap.status)]}>
                  <Text style={styles.swapTagText}>{activeSwap.status.toUpperCase()}</Text>
                </View>
                {nextSwapTime && (
                  <View style={styles.swapTimeRow}>
                    <CalendarCheck2 size={16} color={Colors.light.primary} />
                    <Text style={styles.swapTimeText}>{nextSwapTime}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.swapStatusBody}>{swapStatusLabel}</Text>
              {activeSwap.locationPreference && (
                <View style={styles.swapFooter}>
                  <MapPin size={16} color={Colors.light.textSecondary} />
                  <Text style={styles.swapLocationText}>{activeSwap.locationPreference}</Text>
                </View>
              )}
            </View>
          )}
          <View style={styles.header}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{skill.category}</Text>
            </View>
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>{skill.level}</Text>
            </View>
          </View>

          <Text style={styles.title}>{skill.title}</Text>
          
          <View style={styles.description}>
            <Text style={styles.descriptionText}>{skill.description}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.teacherSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Teacher</Text>
              <Award size={18} color={Colors.light.primary} />
            </View>
            <TouchableOpacity 
              style={styles.teacherCard}
              onPress={() => router.push(`/profile/${skill.user.id}` as any)}
            >
              <Image
                source={{ uri: skill.user.avatarUrl }}
                style={styles.teacherAvatar}
              />
              <View style={styles.teacherInfo}>
                <Text style={styles.teacherName}>{skill.user.name}</Text>
                <View style={styles.teacherStats}>
                  <View style={styles.statItem}>
                    <Star size={14} fill={Colors.light.accent} color={Colors.light.accent} />
                    <Text style={styles.statText}>{skillAverageRating.toFixed(1)} ({skillTotalReviews})</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Users size={14} color={Colors.light.textSecondary} />
                    <Text style={styles.statText}>{skill.user.totalSwaps} swaps</Text>
                  </View>
                </View>
                <View style={styles.locationRow}>
                  <MapPin size={14} color={Colors.light.textSecondary} />
                  <Text style={styles.locationText}>{skill.user.location}</Text>
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
              <Text style={styles.aboutText}>{skill.user.bio}</Text>
            </View>
          </View>

          <View style={styles.wantsSection}>
            <Text style={styles.sectionTitle}>Looking to Learn</Text>
            <View style={styles.wantsTags}>
              {skill.user.skillsWanted.map((wantedSkill, index) => (
                <View key={index} style={styles.wantTag}>
                  <Text style={styles.wantTagText}>{wantedSkill}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.reviewsWrapper}>
          <ReviewsSection revieweeId={skill.user.id} skillId={skill.id} headline="Session reflections" />
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={styles.footer}>
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
            <Text style={styles.requestButtonText}>{activeSwap ? 'Open Swap Thread' : 'Request Skill Swap'}</Text>
          </LinearGradient>
        </TouchableOpacity>
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
  title: {
    fontSize: 30,
    fontWeight: '800' as const,
    color: Colors.light.text,
    marginBottom: 16,
    lineHeight: 38,
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
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
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
});

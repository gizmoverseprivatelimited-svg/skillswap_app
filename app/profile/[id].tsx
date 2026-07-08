import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { MapPin, Star, Calendar, Sparkles } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '../../constants/colors';
// import { mockUsers } from '../../mocks/data';

import ReviewsSection from '../../components/ReviewsSection';
import { useCurrentUser } from '@/providers/current-user';
import { useAlert } from '@/providers/alert';
import { resolveImageUrl } from '@/lib/resolveImageUrl';
import url from '@/constants/backurl';
import { useCallback, useEffect, useState } from 'react';
import { useSkillSwaps } from '@/providers/skill-swaps';
import { getSkillsWithUsers } from '@/mocks/data';
import { ReviewWithAuthor, SkillWithUser } from '@/types';
import SkillSwapRequestModal from '@/components/SkillSwapRequestModal';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // console.log(id);

  let { allUsers, currentUser } = useCurrentUser()
  const { showAlert } = useAlert();
  const [selectedSkill, setSelectedSkill] = useState<SkillWithUser | null>(null);
  const [swapModalVisible, setSwapModalVisible] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [reviews, setReviews] = useState<any>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const router = useRouter();
  const { swaps, allSwaps } = useSkillSwaps()
  const user = allUsers.find(u => u.id === id);
  const insets = useSafeAreaInsets();

  const fetchReviews = useCallback(async () => {
    try {
      setIsLoading(true);
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
      setFetchError("Failed to load reviews");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleSendMessage = useCallback(async () => {
    if (!user || !currentUser) return;
    console.log(swaps);

    const existingSwap = swaps.find(
      (s) => {
        console.log(s, currentUser, user);

        return (s.requesterId === currentUser.id && s.recipientId === user.id) ||
          (s.requesterId === user.id && s.recipientId === currentUser.id)
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
        `${user.name} hasn't listed any skills yet. Check back later!`,
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

  let swapcount = (allSwaps?.filter((s: any) => {
    return s.requesterId == user.id || s.recipientId == user.id
  })).length;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: user.name,
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
          <Text style={styles.name}>{user.name}</Text>
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
                <Text style={styles.statValue}>{new Date(user?.joinedDate || "").getFullYear()}</Text>
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
                    source={{ uri: resolveImageUrl(skill.imageUrl) }}
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

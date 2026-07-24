import { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { RefreshCcw, Star, TrendingUp, Users, Zap, GraduationCap, BookOpen, ArrowLeftRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '../../constants/colors';
import { getSkillsWithUsers, categories } from '../../mocks/data';
import MatchCard from '../../components/MatchCard';
import { useCurrentUser } from '../../providers/current-user';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const skillsWithUsers = getSkillsWithUsers();
  const { currentUser, topRecommendations, teachMatches, learnMatches, swapMatches, userRole, refreshRecommendations } = useCurrentUser();

  const filteredSkills = selectedCategory === 'All' 
    ? skillsWithUsers 
    : skillsWithUsers.filter(skill => skill.category === selectedCategory);

  const featuredSkills = skillsWithUsers.slice(0, 3);
  const topTeachMatches = useMemo(() => teachMatches.slice(0, 4), [teachMatches]);
  const topLearnMatches = useMemo(() => learnMatches.slice(0, 4), [learnMatches]);
  const topSwapMatches = useMemo(() => swapMatches.slice(0, 4), [swapMatches]);
  const hasMatches = topRecommendations.length > 0;
  const firstName = useMemo(() => {
    const [first] = currentUser.name.split(' ');
    return first ?? currentUser.name;
  }, [currentUser.name]);
  const matchesSubtitle = useMemo(() => {
    if (userRole === 'teacher') return `Learners who need ${firstName}'s skills`;
    if (userRole === 'learner') return `Teachers who can help ${firstName} grow`;
    return `Perfect swap partners for ${firstName}`;
  }, [userRole, firstName]);

  const secondarySection = useMemo<{
    title: string;
    subtitle: string;
    items: typeof topTeachMatches;
    chips: (m: typeof topTeachMatches[number]) => string[];
    icon: typeof GraduationCap;
    color: string;
  } | null>(() => {
    if (userRole === 'teacher') {
      return {
        title: 'They want to learn from you',
        subtitle: 'Based on the skills you offer',
        items: topTeachMatches,
        chips: (m) => m.theyCanLearn.slice(0, 2),
        icon: GraduationCap,
        color: Colors.light.primary,
      };
    }
    if (userRole === 'learner') {
      return {
        title: 'They can teach you',
        subtitle: 'People offering what you want to learn',
        items: topLearnMatches,
        chips: (m) => m.youCanLearn.slice(0, 2),
        icon: BookOpen,
        color: '#6366F1',
      };
    }
    return {
      title: 'Mutual skill swaps',
      subtitle: 'Teach each other — give & get',
      items: topSwapMatches,
      chips: (m) => [...m.youCanLearn.slice(0, 1), ...m.theyCanLearn.slice(0, 1)],
      icon: ArrowLeftRight,
      color: '#F59E0B',
    };
  }, [userRole, topTeachMatches, topLearnMatches, topSwapMatches]);

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#6366F1', '#818CF8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 24 }]}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greeting}>Hi, {firstName}</Text>
              <Text style={styles.subtitle}>Curated swaps to accelerate your growth</Text>
            </View>
            <View style={styles.logo} />
          </View>
        </LinearGradient>

        <View style={styles.content}>
          <View style={styles.matchesSection} testID="smart-matches-section">
            <View style={styles.matchesHeader}>
              <View style={styles.matchesTitleGroup}>
                <Text style={styles.matchesTitle}>Smart Matches</Text>
                <Text style={styles.matchesSubtitle}>{matchesSubtitle}</Text>
              </View>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={refreshRecommendations}
                activeOpacity={0.85}
                testID="refresh-matches"
              >
                <RefreshCcw size={16} color={Colors.light.primary} />
                <Text style={styles.refreshText}>Refresh</Text>
              </TouchableOpacity>
            </View>
            {hasMatches ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.matchesScroll}
              >
                {topRecommendations.map((match) => (
                  <MatchCard
                    key={match.user.id}
                    recommendation={match}
                    onPress={() => router.push(`/profile/${match.user.id}` as any)}
                    testID={`match-card-${match.user.id}`}
                  />
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyMatchesCard}>
                <Users size={22} color={Colors.light.textSecondary} />
                <Text style={styles.emptyMatchesTitle}>No matches yet</Text>
                <Text style={styles.emptyMatchesSubtitle}>Share what you can teach to see instant connections.</Text>
              </View>
            )}
          </View>

          <View style={styles.teachSection} testID="teach-matches-section">
            <View style={styles.matchesHeader}>
              <View style={styles.matchesTitleGroup}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {secondarySection && <secondarySection.icon size={20} color={secondarySection.color} />}
                  <Text style={styles.teachTitle}>{secondarySection?.title ?? ''}</Text>
                </View>
                <Text style={styles.matchesSubtitle}>{secondarySection?.subtitle ?? ''}</Text>
              </View>
            </View>
            {secondarySection?.items.map((match) => (
              <TouchableOpacity
                key={`sec-${match.user.id}`}
                style={styles.teachCard}
                onPress={() => router.push(`/profile/${match.user.id}` as any)}
                activeOpacity={0.85}
                testID={`sec-card-${match.user.id}`}
              >
                {match.user.avatarUrl ? (
                  <Image source={{ uri: match.user.avatarUrl }} style={styles.teachAvatar} />
                ) : (
                  <View style={[styles.teachAvatar, { backgroundColor: Colors.light.backgroundTertiary }]} />
                )}
                <View style={styles.teachInfo}>
                  <Text style={styles.teachName}>{match.user.name}</Text>
                  <View style={styles.teachSkillsRow}>
                    {secondarySection.chips(match).map((skill) => (
                      <View key={`${match.user.id}-${skill}`} style={styles.teachChip}>
                        <Text style={styles.teachChipText}>{skill}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <View style={styles.teachCompatibility}>
                  <Text style={styles.teachCompatibilityValue}>{match.compatibility}</Text>
                  <Text style={styles.teachCompatibilityLabel}>match</Text>
                </View>
              </TouchableOpacity>
            ))}
            {secondarySection && secondarySection.items.length === 0 && (
              <View style={styles.emptyTeachCard}>
                <Text style={styles.emptyMatchesTitle}>No matches here yet — add more skills to your profile.</Text>
              </View>
            )}
          </View>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Featured</Text>
              <Zap size={18} color={Colors.light.accent} fill={Colors.light.accent} />
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredScroll}
            >
              {featuredSkills.map((skill) => (
                <TouchableOpacity
                  key={skill.id}
                  style={styles.featuredCard}
                  onPress={() => router.push(`/skill/${skill.id}` as any)}
                >
                  {skill.imageUrl ? (
                    <Image
                      source={{ uri: skill.imageUrl }}
                      style={styles.featuredImage}
                    />
                  ) : (
                    <View style={[styles.featuredImage, { backgroundColor: Colors.light.backgroundTertiary }]} />
                  )}
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.85)']}
                    style={styles.featuredOverlay}
                  >
                    <View style={styles.featuredBadgeRow}>
                      <View style={styles.levelBadge}>
                        <Text style={styles.levelBadgeText}>{skill.level}</Text>
                      </View>
                      <View style={styles.trendingBadge}>
                        <TrendingUp size={12} color="#FFFFFF" />
                      </View>
                    </View>
                    <View style={styles.featuredContent}>
                      <Text style={styles.featuredCategory}>{skill.category}</Text>
                      <Text style={styles.featuredTitle} numberOfLines={2}>
                        {skill.title}
                      </Text>
                      <View style={styles.featuredUser}>
                        {skill.user.avatarUrl ? (
                          <Image
                            source={{ uri: skill.user.avatarUrl }}
                            style={styles.featuredAvatar}
                          />
                        ) : (
                          <View style={[styles.featuredAvatar, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
                        )}
                        <View style={styles.featuredUserInfo}>
                          <Text style={styles.featuredUserName} numberOfLines={1}>
                            {skill.user.name}
                          </Text>
                          <View style={styles.featuredRating}>
                            <Star size={10} fill={Colors.light.accent} color={Colors.light.accent} />
                            <Text style={styles.featuredRatingText}>{skill.user.rating}</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesScroll}
            >
              {categories.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryChip,
                    selectedCategory === category && styles.categoryChipActive,
                  ]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      selectedCategory === category && styles.categoryTextActive,
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {selectedCategory === 'All' ? 'All Skills' : selectedCategory}
            </Text>
            <View style={styles.skillsGrid}>
              {filteredSkills.map((skill) => (
                <TouchableOpacity
                  key={skill.id}
                  style={styles.skillCard}
                  onPress={() => router.push(`/skill/${skill.id}` as any)}
                >
                  {skill.imageUrl ? (
                    <Image
                      source={{ uri: skill.imageUrl }}
                      style={styles.skillImage}
                    />
                  ) : (
                    <View style={[styles.skillImage, { backgroundColor: Colors.light.backgroundTertiary }]} />
                  )}
                  <View style={styles.skillContent}>
                    <View style={styles.skillHeader}>
                      <Text style={styles.categoryLabel}>{skill.category}</Text>
                      <View style={styles.skillLevelBadge}>
                        <Text style={styles.skillLevelText}>{skill.level}</Text>
                      </View>
                    </View>
                    <Text style={styles.skillTitle} numberOfLines={2}>
                      {skill.title}
                    </Text>
                    <View style={styles.skillFooter}>
                      <View style={styles.userInfo}>
                        {skill.user.avatarUrl ? (
                          <Image
                            source={{ uri: skill.user.avatarUrl }}
                            style={styles.userAvatar}
                          />
                        ) : (
                          <View style={[styles.userAvatar, { backgroundColor: Colors.light.backgroundTertiary }]} />
                        )}
                        <Text style={styles.userName} numberOfLines={1}>
                          {skill.user.name}
                        </Text>
                      </View>
                      <View style={styles.ratingContainer}>
                        <Star size={12} fill={Colors.light.accent} color={Colors.light.accent} />
                        <Text style={styles.ratingText}>{skill.user.rating}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
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
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#FFFFFF20',
  },
  content: {
    marginTop: -16,
    backgroundColor: Colors.light.backgroundSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
  },
  matchesSection: {
    marginTop: 24,
    paddingBottom: 12,
  },
  matchesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  matchesTitleGroup: {
    flex: 1,
    gap: 6,
  },
  matchesTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.light.text,
  },
  teachTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.light.text,
  },
  matchesSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.background,
  },
  refreshText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.primary,
  },
  matchesScroll: {
    paddingLeft: 20,
    paddingRight: 12,
  },
  emptyMatchesCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  emptyMatchesTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  emptyMatchesSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    paddingHorizontal: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  teachSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 12,
  },
  teachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  teachAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  teachInfo: {
    flex: 1,
    gap: 8,
  },
  teachName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  teachSkillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  teachChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: Colors.light.backgroundTertiary,
  },
  teachChipText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.primary,
  },
  teachCompatibility: {
    alignItems: 'flex-end',
    gap: 2,
  },
  teachCompatibilityValue: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.light.primary,
  },
  teachCompatibilityLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  emptyTeachCard: {
    backgroundColor: Colors.light.backgroundTertiary,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.light.text,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  featuredScroll: {
    paddingLeft: 20,
    paddingRight: 4,
  },
  featuredCard: {
    width: 300,
    height: 400,
    marginRight: 16,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: Colors.light.card,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  featuredImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  featuredOverlay: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  featuredBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  levelBadge: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  levelBadgeText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.primary,
  },
  trendingBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.95)',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredContent: {
    gap: 8,
  },
  featuredCategory: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  featuredTitle: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    lineHeight: 32,
  },
  featuredUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  featuredAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  featuredUserInfo: {
    flex: 1,
    gap: 4,
  },
  featuredUserName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  featuredRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featuredRatingText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  categoriesScroll: {
    paddingLeft: 20,
    paddingRight: 4,
  },
  categoryChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: Colors.light.background,
    marginRight: 10,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  categoryChipActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  categoryText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },
  skillsGrid: {
    paddingHorizontal: 20,
    gap: 16,
  },
  skillCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  skillImage: {
    width: '100%',
    height: 200,
    backgroundColor: Colors.light.backgroundTertiary,
  },
  skillContent: {
    padding: 16,
  },
  skillHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  skillLevelBadge: {
    backgroundColor: Colors.light.backgroundTertiary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  skillLevelText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.primary,
  },
  skillTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 14,
    lineHeight: 24,
  },
  skillFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  userName: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
    flex: 1,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  bottomSpacer: {
    height: 40,
  },
});

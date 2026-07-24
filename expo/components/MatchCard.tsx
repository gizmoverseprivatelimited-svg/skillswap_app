import { memo, useCallback, useMemo, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, ArrowRight, BookOpen, GraduationCap } from 'lucide-react-native';
import Colors from '../constants/colors';
import type { MatchRecommendation } from '../types';

interface MatchCardProps {
  recommendation: MatchRecommendation;
  onPress: () => void;
  testID?: string;
}

const MatchCardComponent = ({ recommendation, onPress, testID }: MatchCardProps) => {
  const scale = useRef(new Animated.Value(1)).current;

  const spotlightSkill = useMemo<string | null>(() => {
    const fallback = recommendation.user.skillsOffered[0]?.title ?? null;
    return recommendation.primarySkill ?? fallback;
  }, [recommendation.primarySkill, recommendation.user.skillsOffered]);

  const youCanLearn = useMemo<string[]>(() => {
    return recommendation.youCanLearn.slice(0, 3);
  }, [recommendation.youCanLearn]);

  const theyCanLearn = useMemo<string[]>(() => {
    return recommendation.theyCanLearn.slice(0, 2);
  }, [recommendation.theyCanLearn]);

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  }, [scale]);

  return (
    <Animated.View style={[styles.card, { transform: [{ scale }] }]}
      testID={testID ? `${testID}-container` : undefined}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.pressable}
        testID={testID}
      >
        <LinearGradient
          colors={["#1E293B", Colors.light.primaryDark, "#0F172A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.headerRow}>
            <View style={styles.badge}>
              <Sparkles size={16} color="#F8FAFC" />
              <Text style={styles.badgeText}>Smart Match</Text>
            </View>
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreValue}>{recommendation.compatibility}</Text>
              <Text style={styles.scoreLabel}>Match</Text>
            </View>
          </View>

          <View style={styles.userRow}>
            {recommendation.user.avatarUrl ? (
              <Image
                source={{ uri: recommendation.user.avatarUrl }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: Colors.light.backgroundTertiary }]} />
            )}
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{recommendation.user.name}</Text>
              {spotlightSkill && (
                <View style={styles.spotlightRow}>
                  <GraduationCap size={14} color="rgba(148, 163, 184, 0.9)" />
                  <Text style={styles.spotlightText}>{spotlightSkill}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.skillBlock}>
            <View style={styles.skillHeader}>
              <BookOpen size={16} color="#F8FAFC" />
              <Text style={styles.skillHeaderText}>You can learn</Text>
            </View>
            <View style={styles.chipRow}>
              {youCanLearn.map((skill) => (
                <View key={skill} style={styles.chip}>
                  <Text style={styles.chipText}>{skill}</Text>
                </View>
              ))}
              {youCanLearn.length === 0 && (
                <Text style={styles.emptyText}>Explore their profile for more</Text>
              )}
            </View>
          </View>

          {theyCanLearn.length > 0 && (
            <View style={styles.skillBlock}>
              <View style={styles.skillHeader}>
                <Sparkles size={16} color="#F472B6" />
                <Text style={styles.skillHeaderText}>They want from you</Text>
              </View>
              <View style={styles.chipRow}>
                {theyCanLearn.map((skill) => (
                  <View key={skill} style={styles.inverseChip}>
                    <Text style={styles.inverseChipText}>{skill}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.footerRow}>
            <View style={styles.categoryRow}>
              {recommendation.categoryMatches.map((category) => (
                <View key={category} style={styles.categoryPill}>
                  <Text style={styles.categoryText}>{category}</Text>
                </View>
              ))}
            </View>
            <View style={styles.ctaIcon}>
              <ArrowRight size={20} color="#F8FAFC" />
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 280,
    marginRight: 18,
    borderRadius: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  pressable: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    padding: 20,
    borderRadius: 24,
    gap: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(148, 163, 184, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#E2E8F0',
  },
  scoreBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    minWidth: 68,
  },
  scoreValue: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  scoreLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: 'rgba(226, 232, 240, 0.8)',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: 'rgba(248, 250, 252, 0.65)',
  },
  userInfo: {
    flex: 1,
    gap: 6,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  spotlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  spotlightText: {
    fontSize: 13,
    color: 'rgba(203, 213, 225, 0.9)',
    fontWeight: '600' as const,
  },
  skillBlock: {
    gap: 10,
  },
  skillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  skillHeaderText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#E2E8F0',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.4)',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#E2E8F0',
  },
  inverseChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(240, 249, 255, 0.2)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.45)',
  },
  inverseChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#F8FAFC',
  },
  emptyText: {
    fontSize: 13,
    color: 'rgba(226, 232, 240, 0.7)',
    fontWeight: '500' as const,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 6,
    flex: 1,
  },
  categoryPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 64, 175, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.4)',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#C7D2FE',
  },
  ctaIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    marginLeft: 12,
  },
});

const MatchCard = memo(MatchCardComponent);
MatchCard.displayName = 'MatchCard';

export default MatchCard;

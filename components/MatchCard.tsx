import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, ArrowRight, BookOpen, GraduationCap, Bot } from 'lucide-react-native';
import Colors from '../constants/colors';
import { generateMatchInsight } from '../lib/ai';
import type { MatchRecommendation } from '../types';
import { resolveImageUrl } from '@/lib/resolveImageUrl';

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';

interface MatchCardProps {
  recommendation: MatchRecommendation;
  onPress: () => void;
  testID?: string;
  cardWidth?: number;
  cardMarginRight?: number;
}

const MatchCardComponent = ({ recommendation, onPress, testID, cardWidth, cardMarginRight }: MatchCardProps) => {
  const scale = useRef(new Animated.Value(1)).current;
  const avatarErrorRef = useRef(false);
  const [avatarError, setAvatarError] = useState(false);
  const { width: windowWidth } = useWindowDimensions();
  const isSmall = windowWidth < 600;
  const isVeryCompact = isSmall && (cardWidth !== undefined ? cardWidth < 200 : false);

  const dynamicCardStyle = useMemo(() => ({
    card: {
      width: cardWidth ?? (isSmall ? 230 : 280),
      marginRight: cardMarginRight ?? (isSmall ? 12 : 18),
      borderRadius: isVeryCompact ? 16 : isSmall ? 18 : 24,
    },
    pressable: {
      borderRadius: isVeryCompact ? 16 : isSmall ? 18 : 24,
    },
    gradient: {
      padding: isVeryCompact ? 10 : isSmall ? 14 : 20,
      gap: isVeryCompact ? 8 : isSmall ? 12 : 18,
      borderRadius: isVeryCompact ? 16 : isSmall ? 18 : 24,
    },
    badge: {
      paddingHorizontal: isVeryCompact ? 6 : isSmall ? 9 : 12,
      paddingVertical: isVeryCompact ? 3 : isSmall ? 5 : 8,
      borderRadius: isVeryCompact ? 8 : isSmall ? 10 : 14,
      gap: isVeryCompact ? 3 : isSmall ? 5 : 8,
    },
    badgeText: {
      fontSize: isVeryCompact ? 9.5 : isSmall ? 11 : 13,
    },
    scoreBadge: {
      paddingHorizontal: isVeryCompact ? 6 : isSmall ? 10 : 16,
      paddingVertical: isVeryCompact ? 3 : isSmall ? 6 : 10,
      minWidth: isVeryCompact ? 42 : isSmall ? 54 : 68,
      borderRadius: isVeryCompact ? 10 : isSmall ? 12 : 16,
    },
    scoreValue: {
      fontSize: isVeryCompact ? 14 : isSmall ? 18 : 22,
    },
    scoreLabel: {
      fontSize: isVeryCompact ? 8 : isSmall ? 9 : 11,
    },
    avatar: {
      width: isVeryCompact ? 34 : isSmall ? 44 : 58,
      height: isVeryCompact ? 34 : isSmall ? 44 : 58,
      borderRadius: isVeryCompact ? 17 : isSmall ? 22 : 29,
    },
    userName: {
      fontSize: isVeryCompact ? 12 : isSmall ? 15 : 18,
    },
    spotlightText: {
      fontSize: isVeryCompact ? 9.5 : isSmall ? 11 : 13,
    },
    skillHeaderText: {
      fontSize: isVeryCompact ? 9.5 : isSmall ? 11 : 14,
    },
    chip: {
      paddingHorizontal: isVeryCompact ? 6 : isSmall ? 9 : 12,
      paddingVertical: isVeryCompact ? 3 : isSmall ? 5 : 8,
      borderRadius: isVeryCompact ? 7 : isSmall ? 9 : 12,
    },
    chipText: {
      fontSize: isVeryCompact ? 9 : isSmall ? 11 : 13,
    },
    ctaIcon: {
      width: isVeryCompact ? 26 : isSmall ? 32 : 38,
      height: isVeryCompact ? 26 : isSmall ? 32 : 38,
      borderRadius: isVeryCompact ? 13 : isSmall ? 16 : 19,
    },
    aiInsightBtn: {
      paddingHorizontal: isVeryCompact ? 6 : isSmall ? 9 : 12,
      paddingVertical: isVeryCompact ? 3 : isSmall ? 5 : 8,
      borderRadius: isVeryCompact ? 7 : isSmall ? 9 : 12,
    },
    aiInsightText: {
      fontSize: isVeryCompact ? 8.5 : isSmall ? 10 : 12,
    },
  }), [isSmall, isVeryCompact, cardWidth, cardMarginRight]);
  const [insight, setInsight] = useState<string | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  const handleAvatarError = useCallback(() => {
    if (!avatarErrorRef.current) {
      avatarErrorRef.current = true;
      setAvatarError(true);
    }
  }, []);

  const avatarUri = useMemo(() => {
    if (avatarError) return DEFAULT_AVATAR;
    return resolveImageUrl(recommendation.user.avatarUrl, DEFAULT_AVATAR) || DEFAULT_AVATAR;
  }, [recommendation.user.avatarUrl, avatarError]);

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

  const handleGenerateInsight = useCallback(async () => {
    if (insight || loadingInsight) return;
    setLoadingInsight(true);
    try {
      const userSkills = recommendation.user.skillsOffered.map(s => s.title);
      const result = await generateMatchInsight(
        'You',
        recommendation.user.skillsWanted,
        recommendation.user.name,
        userSkills,
        recommendation.youCanLearn,
        recommendation.theyCanLearn,
      );
      setInsight(result);
    } catch (e) {
      console.error('[MatchCard] AI insight error:', e);
      setInsight('A great match based on your complementary skills!');
    } finally {
      setLoadingInsight(false);
    }
  }, [insight, loadingInsight, recommendation]);

  return (
    <Animated.View style={[styles.card, dynamicCardStyle.card, { transform: [{ scale }] }]}
      testID={testID ? `${testID}-container` : undefined}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.pressable, dynamicCardStyle.pressable]}
        testID={testID}
      >
        <LinearGradient
          colors={["#1E293B", Colors.light.primaryDark, "#0F172A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradient, dynamicCardStyle.gradient]}
        >
          <View style={styles.headerRow}>
            <View style={[styles.badge, dynamicCardStyle.badge]}>
              <Sparkles size={isVeryCompact ? 11 : 16} color="#F8FAFC" />
              <Text style={[styles.badgeText, dynamicCardStyle.badgeText]}>Smart Match</Text>
            </View>
            <View style={[styles.scoreBadge, dynamicCardStyle.scoreBadge]}>
              <Text style={[styles.scoreValue, dynamicCardStyle.scoreValue]}>{recommendation.compatibility}</Text>
              <Text style={[styles.scoreLabel, dynamicCardStyle.scoreLabel]}>Match</Text>
            </View>
          </View>

          <View style={styles.userRow}>
            <Image
              source={{ uri: avatarUri }}
              style={[styles.avatar, dynamicCardStyle.avatar]}
              onError={avatarError ? undefined : handleAvatarError}
            />
            <View style={styles.userInfo}>
              <Text style={[styles.userName, dynamicCardStyle.userName]}>
                {recommendation.user.username ? `@${recommendation.user.username}` : recommendation.user.name}
              </Text>
              {spotlightSkill && (
                <View style={styles.spotlightRow}>
                  <GraduationCap size={isVeryCompact ? 11 : 14} color="rgba(148, 163, 184, 0.9)" />
                  <Text style={[styles.spotlightText, dynamicCardStyle.spotlightText]}>{spotlightSkill}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.skillBlock}>
            <View style={styles.skillHeader}>
              <BookOpen size={isVeryCompact ? 13 : 16} color="#F8FAFC" />
              <Text style={[styles.skillHeaderText, dynamicCardStyle.skillHeaderText]}>You can learn</Text>
            </View>
            <View style={styles.chipRow}>
              {youCanLearn.map((skill) => (
                <View key={skill} style={[styles.chip, dynamicCardStyle.chip]}>
                  <Text style={[styles.chipText, dynamicCardStyle.chipText]}>{skill}</Text>
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
                <Sparkles size={isVeryCompact ? 13 : 16} color="#F472B6" />
                <Text style={[styles.skillHeaderText, dynamicCardStyle.skillHeaderText]}>They want from you</Text>
              </View>
              <View style={styles.chipRow}>
                {theyCanLearn.map((skill) => (
                  <View key={skill} style={[styles.inverseChip, dynamicCardStyle.chip]}>
                    <Text style={[styles.inverseChipText, dynamicCardStyle.chipText]}>{skill}</Text>
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
            <View style={[styles.ctaIcon, dynamicCardStyle.ctaIcon]}>
              <ArrowRight size={isVeryCompact ? 14 : 20} color="#F8FAFC" />
            </View>
          </View>

          {insight ? (
            <View
              style={styles.insightBox}
              onStartShouldSetResponder={() => true}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              <Bot size={14} color="#A5B4FC" />
              <Text style={styles.insightText}>{insight}</Text>
            </View>
          ) : (
            <View onStartShouldSetResponder={() => true}>
              <TouchableOpacity
                style={[styles.aiInsightBtn, dynamicCardStyle.aiInsightBtn]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleGenerateInsight();
                }}
                disabled={loadingInsight}
                activeOpacity={0.7}
              >
                {loadingInsight ? (
                  <ActivityIndicator size={12} color="#A5B4FC" />
                ) : (
                  <Bot size={12} color="#A5B4FC" />
                )}
                <Text style={[styles.aiInsightText, dynamicCardStyle.aiInsightText]}>
                  {loadingInsight ? 'Analyzing match...' : 'Why this match?'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
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
  aiInsightBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    alignSelf: 'flex-start',
  },
  aiInsightText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#A5B4FC',
  },
  insightBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
  },
  insightText: {
    fontSize: 13,
    color: '#C7D2FE',
    lineHeight: 19,
    flex: 1,
    fontWeight: '500' as const,
  },
});

const MatchCard = memo(MatchCardComponent);
MatchCard.displayName = 'MatchCard';

export default MatchCard;

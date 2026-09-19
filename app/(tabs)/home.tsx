import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { RefreshCcw, Star, TrendingUp, Users, Zap, GraduationCap, BookOpen, ArrowLeftRight, Sparkles, Bell, Bot, ChevronLeft, ChevronRight, BadgeCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '../../constants/colors';
import { getSkillsWithUsers } from '../../mocks/data';
import { formatPrice } from '../../constants/locale';
import MatchCard from '../../components/MatchCard';
import { useCurrentUser } from '../../providers/current-user';
import { useNotifications } from '../../providers/notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveImageUrl } from '../../lib/resolveImageUrl';
import {
  MAIN_CATEGORIES,
  getSubcategoriesForCategory,
  findCategoryForSubcategory,
  getCategoryImageUrl,
} from '@/constants/categories';
import { useSafety } from '@/providers/safety';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
const DEFAULT_SKILL_IMAGE = 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('All');
  const [skillsWithUsers, setSkillsWithUsers] = useState<any[]>([]);

  const promotedScrollRef = useRef<ScrollView>(null);
  const promotedPosRef = useRef({ x: 0, contentWidth: 0, layoutWidth: 0 });
  const [promotedNav, setPromotedNav] = useState({ canLeft: false, canRight: true });

  const matchesScrollRef = useRef<ScrollView>(null);
  const matchesPosRef = useRef({ x: 0, contentWidth: 0, layoutWidth: 0 });
  const [matchesNav, setMatchesNav] = useState({ canLeft: false, canRight: true });

  const featuredScrollRef = useRef<ScrollView>(null);
  const featuredPosRef = useRef({ x: 0, contentWidth: 0, layoutWidth: 0 });
  const [featuredNav, setFeaturedNav] = useState({ canLeft: false, canRight: true });

  const updateCarouselMetrics = (
    posRef: React.MutableRefObject<{ x: number; contentWidth: number; layoutWidth: number }>,
    setNav: React.Dispatch<React.SetStateAction<{ canLeft: boolean; canRight: boolean }>>,
    updates: Partial<{ x: number; contentWidth: number; layoutWidth: number }>
  ) => {
    Object.assign(posRef.current, updates);
    const { x, contentWidth, layoutWidth } = posRef.current;
    const maxX = Math.max(0, contentWidth - layoutWidth);

    if (maxX > 0 && posRef.current.x > maxX) {
      posRef.current.x = maxX;
    }
    if (posRef.current.x < 0) {
      posRef.current.x = 0;
    }

    const currentX = posRef.current.x;
    const isMeasured = contentWidth > 0 && layoutWidth > 0;
    const canLeft = currentX > 5;
    const canRight = isMeasured ? (maxX > 5 && currentX < maxX - 5) : true;

    setNav((prev) => (prev.canLeft !== canLeft || prev.canRight !== canRight ? { canLeft, canRight } : prev));
  };

  const handleScrollCarouselStep = (
    scrollRef: React.RefObject<ScrollView | null>,
    posRef: React.MutableRefObject<{ x: number; contentWidth: number; layoutWidth: number }>,
    setNav: React.Dispatch<React.SetStateAction<{ canLeft: boolean; canRight: boolean }>>,
    direction: 'left' | 'right',
    step = 300
  ) => {
    const { x, contentWidth, layoutWidth } = posRef.current;
    const maxX = Math.max(0, contentWidth - layoutWidth);

    if (direction === 'right' && (maxX <= 5 || x >= maxX - 5)) {
      updateCarouselMetrics(posRef, setNav, { x: maxX });
      return;
    }
    if (direction === 'left' && x <= 5) {
      updateCarouselMetrics(posRef, setNav, { x: 0 });
      return;
    }

    let nextX = direction === 'left' ? x - step : x + step;
    if (nextX < 0) nextX = 0;
    if (maxX > 0 && nextX > maxX) nextX = maxX;

    posRef.current.x = nextX;
    scrollRef.current?.scrollTo({ x: nextX, animated: true });
    updateCarouselMetrics(posRef, setNav, { x: nextX });
  };

  const numSkillColumns = useMemo(() => {
    if (windowWidth >= 840) return 4;
    if (windowWidth >= 600) return 3;
    if (windowWidth >= 400) return 2;
    return 1;
  }, [windowWidth]);

  const skillCardWidth = useMemo(() => {
    if (numSkillColumns === 1) return '100%';
    const totalPadding = 40;
    const totalGap = (numSkillColumns - 1) * 16;
    const availableWidth = windowWidth - totalPadding - totalGap;
    return Math.max(160, Math.floor(availableWidth / numSkillColumns));
  }, [windowWidth, numSkillColumns]);

  const { unreadCount } = useNotifications();
  const { currentUser, topRecommendations, teachMatches, learnMatches, swapMatches, userRole, refreshRecommendations, isLoading: isUserLoading } = useCurrentUser();
  const { isBlocked } = useSafety();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSkillsLoading, setIsSkillsLoading] = useState(true);
  const [hasFetchedSkills, setHasFetchedSkills] = useState(false);

  const fetchSkillsData = useCallback(async () => {
    try {
      const data = await getSkillsWithUsers();
      setSkillsWithUsers(data || []);
    } catch (err) {
      console.error('Failed to fetch skills data:', err);
    } finally {
      setIsSkillsLoading(false);
      setHasFetchedSkills(true);
    }
  }, []);

  useEffect(() => {
    fetchSkillsData();
  }, [fetchSkillsData]);



  useFocusEffect(
    useCallback(() => {
      fetchSkillsData();
    }, [fetchSkillsData])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 5000));
      await Promise.race([
        Promise.all([
          fetchSkillsData(),
          refreshRecommendations(),
        ]),
        timeoutPromise,
      ]);
    } catch (err) {
      console.error('Error refreshing home data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const allAvailableSkills = useMemo(() => {
    const list = [...skillsWithUsers];
    if (currentUser?.skillsOffered) {
      currentUser.skillsOffered.forEach((userSkill) => {
        const skillId = String(userSkill.id || userSkill._id || '');
        const exists = list.some((item) => String(item.id || item._id || '') === skillId);
        if (!exists) {
          list.unshift({
            ...userSkill,
            id: userSkill.id || userSkill._id,
            user: currentUser,
          });
        } else {
          const idx = list.findIndex((item) => String(item.id || item._id || '') === skillId);
          if (idx !== -1) {
            list[idx] = {
              ...list[idx],
              promoted: userSkill.promoted ?? list[idx].promoted,
              promoTagline: userSkill.promoTagline ?? list[idx].promoTagline,
              user: list[idx].user || currentUser,
            };
          }
        }
      });
    }
    return list;
  }, [skillsWithUsers, currentUser]);

  const otherSkillsWithUsers = useMemo(() => {
    if (!currentUser?.id) return allAvailableSkills;
    const currentId = String(currentUser.id || (currentUser as any)._id || '');
    return allAvailableSkills.filter((item) => {
      const itemUserId = String(item.userId || item.user?.id || item.user?._id || '');
      if (itemUserId === currentId) return false;
      if (isBlocked(itemUserId, currentId)) return false;
      return true;
    });
  }, [allAvailableSkills, currentUser, isBlocked]);

  const filteredSkills = useMemo(() => {
    if (selectedCategory === 'All') {
      return otherSkillsWithUsers;
    }

    const subcategories = getSubcategoriesForCategory(selectedCategory);

    return otherSkillsWithUsers.filter((skill) => {
      const skillCat = (skill.category || '').trim();
      const skillSubCat = (skill.subCategory || (skill as any).subcategory || '').trim();
      const skillTitle = (skill.title || '').trim().toLowerCase();
      const skillDesc = (skill.description || '').trim().toLowerCase();

      // If a specific subcategory is selected
      if (selectedSubcategory !== 'All') {
        const subQ = selectedSubcategory.toLowerCase();
        return (
          skillSubCat.toLowerCase() === subQ ||
          skillCat.toLowerCase() === subQ ||
          skillTitle.includes(subQ) ||
          skillDesc.includes(subQ)
        );
      }

      // If category is selected without a specific subcategory
      const isDirectCat = skillCat.toLowerCase() === selectedCategory.toLowerCase();
      const isParentCat = findCategoryForSubcategory(skillCat)?.toLowerCase() === selectedCategory.toLowerCase();
      const isParentSubCat = findCategoryForSubcategory(skillSubCat)?.toLowerCase() === selectedCategory.toLowerCase();
      const isSubInList = subcategories.some((sub) => sub.toLowerCase() === skillSubCat.toLowerCase() || sub.toLowerCase() === skillCat.toLowerCase());

      return isDirectCat || isParentCat || isParentSubCat || isSubInList;
    });
  }, [otherSkillsWithUsers, selectedCategory, selectedSubcategory]);

  const featuredSkills = otherSkillsWithUsers.slice(0, 3);
  const promotedSkills = useMemo(() => otherSkillsWithUsers.filter(s => s.promoted).slice(0, 10), [otherSkillsWithUsers]);
  const topTeachMatches = useMemo(() => teachMatches.slice(0, 4), [teachMatches]);
  const topLearnMatches = useMemo(() => learnMatches.slice(0, 4), [learnMatches]);
  const topSwapMatches = useMemo(() => swapMatches.slice(0, 4), [swapMatches]);
  const hasMatches = topRecommendations.length > 0;
  const userDisplayName = useMemo(() => {
    if (!currentUser) return '';
    const username = currentUser.username;
    if (username) {
      return username.startsWith('@') ? username : `@${username}`;
    }
    return `@${currentUser.name.toLowerCase().replace(/\s+/g, '')}`;
  }, [currentUser?.username, currentUser?.name]);
  const matchesSubtitle = useMemo(() => {
    if (userRole === 'teacher') return `Learners who need ${userDisplayName}'s skills`;
    if (userRole === 'learner') return `Teachers who can help ${userDisplayName} grow`;
    return `Perfect exchange partners for ${userDisplayName}`;
  }, [userRole, userDisplayName]);

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
      title: 'Mutual skill exchanges',
      subtitle: 'Teach each other — give & get',
      items: topSwapMatches,
      chips: (m) => [...m.youCanLearn.slice(0, 1), ...m.theyCanLearn.slice(0, 1)],
      icon: ArrowLeftRight,
      color: '#F59E0B',
    };
  }, [userRole, topTeachMatches, topLearnMatches, topSwapMatches]);

  const isInitialBackendLoading = (isSkillsLoading || isUserLoading || !hasFetchedSkills) && skillsWithUsers.length === 0;

  return (
    <View style={styles.container}>
      <Modal
        visible={isInitialBackendLoading}
        animationType="fade"
        statusBarTranslucent
        transparent={false}
      >
        <View style={styles.fullScreenLoaderContainer}>
          <LinearGradient
            colors={['#0F172A', '#1E1B4B', '#0F172A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fullScreenLoaderGradient}
          >
            <View style={styles.loaderCenterBox}>
              <View style={styles.loaderIconHalo}>
                <LinearGradient
                  colors={['#6366F1', '#8B5CF6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.loaderIconCircle}
                >
                  <Sparkles size={32} color="#FFFFFF" />
                </LinearGradient>
              </View>

              <ActivityIndicator size="large" color="#818CF8" style={{ marginTop: 16 }} />

              <Text style={styles.loaderTitle}>Finding Best Matches...</Text>
              <Text style={styles.loaderSubtitle}>Curating teachers and exchange partners for you</Text>
            </View>
          </LinearGradient>
        </View>
      </Modal>

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
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>Hi, {userDisplayName}</Text>
              <Text style={styles.subtitle}>Curated exchanges to accelerate your growth</Text>
            </View>
            <TouchableOpacity
              style={styles.bellButton}
              onPress={() => router.push('/(tabs)/notifications' as any)}
              activeOpacity={0.8}
              testID="home-alerts-bell-button"
            >
              <Bell size={22} color="#FFFFFF" />
              {unreadCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {promotedSkills.length > 0 && (
            <View style={styles.promotedSection} testID="promoted-teachers-section">
              <View style={styles.matchesHeader}>
                <View style={styles.matchesTitleGroup}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={18} color="#F59E0B" />
                    <Text style={styles.promotedTitle}>Promoted Teachers</Text>
                  </View>
                  <Text style={styles.matchesSubtitle}>Featured classes with special offers</Text>
                </View>
                <View style={styles.carouselNavRow}>
                  <TouchableOpacity
                    style={[styles.carouselNavBtn, !promotedNav.canLeft && styles.carouselNavBtnDisabled]}
                    onPress={() => handleScrollCarouselStep(promotedScrollRef, promotedPosRef, setPromotedNav, 'left', 300)}
                    activeOpacity={0.7}
                    disabled={!promotedNav.canLeft}
                  >
                    <ChevronLeft size={16} color={!promotedNav.canLeft ? '#CCC' : '#333'} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.carouselNavBtn, !promotedNav.canRight && styles.carouselNavBtnDisabled]}
                    onPress={() => handleScrollCarouselStep(promotedScrollRef, promotedPosRef, setPromotedNav, 'right', 300)}
                    activeOpacity={0.7}
                    disabled={!promotedNav.canRight}
                  >
                    <ChevronRight size={16} color={!promotedNav.canRight ? '#CCC' : '#333'} />
                  </TouchableOpacity>
                </View>
              </View>
              <ScrollView
                ref={promotedScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.promotedScroll}
                onLayout={(e) => updateCarouselMetrics(promotedPosRef, setPromotedNav, { layoutWidth: e.nativeEvent.layout.width })}
                onContentSizeChange={(w) => updateCarouselMetrics(promotedPosRef, setPromotedNav, { contentWidth: w })}
                onScroll={(e) => {
                  updateCarouselMetrics(promotedPosRef, setPromotedNav, {
                    x: e.nativeEvent.contentOffset.x,
                    contentWidth: e.nativeEvent.contentSize.width,
                    layoutWidth: e.nativeEvent.layoutMeasurement.width,
                  });
                }}
                scrollEventThrottle={16}
              >
                {promotedSkills.map((skill) => (
                  <TouchableOpacity
                    key={`promo-${skill.id}`}
                    style={styles.promotedCard}
                    onPress={() => router.push(`/skill/${skill.id}` as any)}
                    activeOpacity={0.85}
                  >
                    <Image source={{ uri: resolveImageUrl(skill.imageUrl, DEFAULT_SKILL_IMAGE) }} style={styles.promotedImage} defaultSource={{ uri: DEFAULT_SKILL_IMAGE }} />
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.8)']}
                      style={styles.promotedGradient}
                    >
                      <View style={styles.promotedBadgeRow}>
                        <View style={styles.promotedBadgesGroup}>
                          <View style={styles.promotedBadge}>
                            <Sparkles size={10} color="#FFFFFF" />
                            <Text style={styles.promotedBadgeText}>PROMOTED</Text>
                          </View>
                          {skill.certificateStatus === 'approved' && (
                            <View style={styles.promotedCertBadge}>
                              <BadgeCheck size={11} color="#FFFFFF" />
                              <Text style={styles.promotedCertBadgeText}>CERTIFIED</Text>
                            </View>
                          )}
                        </View>
                        {skill.pricingModel !== 'free' && (
                          <View style={styles.promotedPriceBadge}>
                            <Text style={styles.promotedPriceText}>
                              {skill.pricingModel === 'per_session'
                                ? `${formatPrice(skill.pricePerSession ?? 0)}/session`
                                : `${formatPrice(skill.monthlyPrice ?? 0)}/mo`}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.promotedContent}>
                        <Text style={styles.promotedSkillTitle} numberOfLines={1}>{skill.title}</Text>
                        <Text style={styles.promotedTagline} numberOfLines={2}>{skill.promoTagline}</Text>
                        <View style={styles.promotedTeacherRow}>
                          <Image source={{ uri: resolveImageUrl(skill.user?.avatarUrl, DEFAULT_AVATAR) }} style={styles.promotedAvatar} defaultSource={{ uri: DEFAULT_AVATAR }} />
                          <Text style={styles.promotedTeacherName} numberOfLines={1}>{skill.user?.name}</Text>
                          <View style={styles.promotedRating}>
                            <Star size={10} fill={Colors.light.accent} color={Colors.light.accent} />
                            <Text style={styles.promotedRatingText}>{skill.user?.rating}</Text>
                          </View>
                        </View>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.matchesSection} testID="smart-matches-section">
            <View style={styles.matchesHeader}>
              <View style={styles.matchesTitleGroup}>
                <Text style={styles.matchesTitle}>Smart Matches</Text>
                <Text style={styles.matchesSubtitle}>{matchesSubtitle}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  style={[styles.refreshButton, isRefreshing && { opacity: 0.8 }]}
                  onPress={handleRefresh}
                  disabled={isRefreshing}
                  activeOpacity={0.85}
                  testID="refresh-matches"
                >
                  {isRefreshing ? (
                    <ActivityIndicator size="small" color={Colors.light.primary} style={{ marginRight: 4 }} />
                  ) : (
                    <RefreshCcw size={16} color={Colors.light.primary} />
                  )}
                  <Text style={styles.refreshText}>{isRefreshing ? 'Loading...' : 'Refresh'}</Text>
                </TouchableOpacity>

                {hasMatches && (
                  <View style={styles.carouselNavRow}>
                    <TouchableOpacity
                      style={[styles.carouselNavBtn, !matchesNav.canLeft && styles.carouselNavBtnDisabled]}
                      onPress={() => handleScrollCarouselStep(matchesScrollRef, matchesPosRef, setMatchesNav, 'left', 300)}
                      activeOpacity={0.7}
                      disabled={!matchesNav.canLeft}
                    >
                      <ChevronLeft size={16} color={!matchesNav.canLeft ? '#CCC' : '#333'} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.carouselNavBtn, !matchesNav.canRight && styles.carouselNavBtnDisabled]}
                      onPress={() => handleScrollCarouselStep(matchesScrollRef, matchesPosRef, setMatchesNav, 'right', 300)}
                      activeOpacity={0.7}
                      disabled={!matchesNav.canRight}
                    >
                      <ChevronRight size={16} color={!matchesNav.canRight ? '#CCC' : '#333'} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
            {hasMatches ? (
              <ScrollView
                ref={matchesScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.matchesScroll}
                onLayout={(e) => updateCarouselMetrics(matchesPosRef, setMatchesNav, { layoutWidth: e.nativeEvent.layout.width })}
                onContentSizeChange={(w) => updateCarouselMetrics(matchesPosRef, setMatchesNav, { contentWidth: w })}
                onScroll={(e) => {
                  updateCarouselMetrics(matchesPosRef, setMatchesNav, {
                    x: e.nativeEvent.contentOffset.x,
                    contentWidth: e.nativeEvent.contentSize.width,
                    layoutWidth: e.nativeEvent.layoutMeasurement.width,
                  });
                }}
                scrollEventThrottle={16}
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
                  <Image source={{ uri: resolveImageUrl(match.user.avatarUrl, DEFAULT_AVATAR) }} style={styles.teachAvatar} defaultSource={{ uri: DEFAULT_AVATAR }} />
                ) : (
                  <Image source={{ uri: DEFAULT_AVATAR }} style={styles.teachAvatar} />
                )}
                <View style={styles.teachInfo}>
                  <Text style={styles.teachName}>{match.user.username ? (match.user.username.startsWith('@') ? match.user.username : `@${match.user.username}`) : `@${match.user.name.toLowerCase().replace(/\s+/g, '')}`}</Text>
                  <View style={styles.teachSkillsRow}>
                    {secondarySection.chips(match).map((skill, index) => {
                      const skillText = typeof skill === 'string' ? skill : (skill as any)?.title || String(skill);
                      return (
                        <View key={`${match.user.id}-${index}`} style={styles.teachChip}>
                          <Text style={styles.teachChipText}>{skillText}</Text>
                        </View>
                      );
                    })}
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Text style={styles.sectionTitleWithoutPadding}>Featured</Text>
                <Zap size={18} color={Colors.light.accent} fill={Colors.light.accent} />
              </View>
              <View style={styles.carouselNavRow}>
                <TouchableOpacity
                  style={[styles.carouselNavBtn, !featuredNav.canLeft && styles.carouselNavBtnDisabled]}
                  onPress={() => handleScrollCarouselStep(featuredScrollRef, featuredPosRef, setFeaturedNav, 'left', 320)}
                  activeOpacity={0.7}
                  disabled={!featuredNav.canLeft}
                >
                  <ChevronLeft size={16} color={!featuredNav.canLeft ? '#CCC' : '#333'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.carouselNavBtn, !featuredNav.canRight && styles.carouselNavBtnDisabled]}
                  onPress={() => handleScrollCarouselStep(featuredScrollRef, featuredPosRef, setFeaturedNav, 'right', 320)}
                  activeOpacity={0.7}
                  disabled={!featuredNav.canRight}
                >
                  <ChevronRight size={16} color={!featuredNav.canRight ? '#CCC' : '#333'} />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView
              ref={featuredScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredScroll}
              onLayout={(e) => updateCarouselMetrics(featuredPosRef, setFeaturedNav, { layoutWidth: e.nativeEvent.layout.width })}
              onContentSizeChange={(w) => updateCarouselMetrics(featuredPosRef, setFeaturedNav, { contentWidth: w })}
              onScroll={(e) => {
                updateCarouselMetrics(featuredPosRef, setFeaturedNav, {
                  x: e.nativeEvent.contentOffset.x,
                  contentWidth: e.nativeEvent.contentSize.width,
                  layoutWidth: e.nativeEvent.layoutMeasurement.width,
                });
              }}
              scrollEventThrottle={16}
            >
              {featuredSkills.map((skill) => (
                <TouchableOpacity
                  key={skill.id}
                  style={styles.featuredCard}
                  onPress={() => router.push(`/skill/${skill.id}` as any)}
                >
                  <Image
                    source={{ uri: resolveImageUrl(skill.imageUrl, DEFAULT_SKILL_IMAGE) }}
                    style={styles.featuredImage}
                    defaultSource={{ uri: DEFAULT_SKILL_IMAGE }}
                  />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.85)']}
                    style={styles.featuredOverlay}
                  >
                    <View style={styles.featuredBadgeRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={styles.levelBadge}>
                          <Text style={styles.levelBadgeText}>{skill.level}</Text>
                        </View>
                        {skill.certificateStatus === 'approved' && (
                          <View style={styles.featuredCertBadge}>
                            <BadgeCheck size={11} color="#34D399" />
                            <Text style={styles.featuredCertBadgeText}>Certified</Text>
                          </View>
                        )}
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
                        <Image
                          source={{ uri: resolveImageUrl(skill.user.avatarUrl, DEFAULT_AVATAR) }}
                          style={styles.featuredAvatar}
                        />
                        <View style={styles.featuredUserInfo}>
                          <Text style={styles.featuredUserName} numberOfLines={1}>
                            {skill.user.username ? (skill.user.username.startsWith('@') ? skill.user.username : `@${skill.user.username}`) : `@${skill.user.name.toLowerCase().replace(/\s+/g, '')}`}
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
              {['All', ...MAIN_CATEGORIES].map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryChip,
                    selectedCategory === category && styles.categoryChipActive,
                  ]}
                  onPress={() => {
                    setSelectedCategory(category);
                    setSelectedSubcategory('All');
                  }}
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

            {selectedCategory !== 'All' && getSubcategoriesForCategory(selectedCategory).length > 0 && (
              <View style={styles.subcategoriesContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.subcategoriesScroll}
                >
                  <TouchableOpacity
                    style={[
                      styles.subcategoryChip,
                      selectedSubcategory === 'All' && styles.subcategoryChipActive,
                    ]}
                    onPress={() => setSelectedSubcategory('All')}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.subcategoryText,
                        selectedSubcategory === 'All' && styles.subcategoryTextActive,
                      ]}
                    >
                      All {selectedCategory}
                    </Text>
                  </TouchableOpacity>
                  {getSubcategoriesForCategory(selectedCategory).map((sub) => (
                    <TouchableOpacity
                      key={sub}
                      style={[
                        styles.subcategoryChip,
                        selectedSubcategory === sub && styles.subcategoryChipActive,
                      ]}
                      onPress={() => setSelectedSubcategory(sub)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.subcategoryText,
                          selectedSubcategory === sub && styles.subcategoryTextActive,
                        ]}
                      >
                        {sub}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.skillsSectionHeader}>
              <Text style={styles.sectionTitleWithoutPadding}>
                {selectedCategory === 'All'
                  ? 'All Skills'
                  : selectedSubcategory !== 'All'
                    ? `${selectedCategory} • ${selectedSubcategory}`
                    : selectedCategory}
              </Text>
              <View style={styles.skillsCountBadge}>
                <Text style={styles.skillsCountText}>
                  {filteredSkills.length} {filteredSkills.length === 1 ? 'skill' : 'skills'}
                </Text>
              </View>
            </View>
            <View style={[
              styles.skillsGrid,
              numSkillColumns > 1 && {
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 16,
              }
            ]}>
              {filteredSkills.map((skill) => (
                <TouchableOpacity
                  key={skill.id}
                  style={[
                    styles.skillCard,
                    numSkillColumns > 1 && {
                      width: skillCardWidth,
                    },
                  ]}
                  onPress={() => router.push(`/skill/${skill.id}` as any)}
                  activeOpacity={0.85}
                >
                  <Image
                    source={{ uri: resolveImageUrl(skill.imageUrl, getCategoryImageUrl(skill.category || skill.title)) }}
                    style={[
                      styles.skillImage,
                      numSkillColumns >= 4 ? { height: 145 } : numSkillColumns >= 3 ? { height: 160 } : numSkillColumns >= 2 ? { height: 180 } : { height: 200 }
                    ]}
                    defaultSource={{ uri: DEFAULT_SKILL_IMAGE }}
                  />
                  <View style={styles.skillContent}>
                    <View style={styles.skillHeader}>
                      <Text style={styles.categoryLabel}>{skill.category}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {skill.certificateStatus === 'approved' && (
                          <View style={styles.skillCertifiedBadge}>
                            <BadgeCheck size={11} color="#10B981" />
                            <Text style={styles.skillCertifiedBadgeText}>Certified</Text>
                          </View>
                        )}
                        <View style={styles.skillLevelBadge}>
                          <Text style={styles.skillLevelText}>{skill.level}</Text>
                        </View>
                      </View>
                    </View>
                    <Text style={styles.skillTitle} numberOfLines={2}>
                      {skill.title}
                    </Text>
                    <View style={styles.skillFooter}>
                      <View style={styles.userInfo}>
                        <Image
                          source={{ uri: resolveImageUrl(skill.user?.avatarUrl, DEFAULT_AVATAR) }}
                          style={styles.userAvatar}
                        />
                        <Text style={styles.userName} numberOfLines={1}>
                          {skill.user?.username ? (skill.user.username.startsWith('@') ? skill.user.username : `@${skill.user.username}`) : `@${(skill.user?.name || 'user').toLowerCase().replace(/\s+/g, '')}`}
                        </Text>
                      </View>
                      <View style={styles.ratingContainer}>
                        <Star size={12} fill={Colors.light.accent} color={Colors.light.accent} />
                        <Text style={styles.ratingText}>{skill.user?.rating ?? 5.0}</Text>
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

      <TouchableOpacity
        style={styles.aiFab}
        onPress={() => router.push('/assistant' as any)}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['#6366F1', '#818CF8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.aiFabGradient}
        >
          <Bot size={22} color="#FFF" />
          <Text style={styles.aiFabText}>AI</Text>
        </LinearGradient>
      </TouchableOpacity>
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
  bellButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  bellBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: '#FFFFFF',
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
  // Promoted teachers
  promotedSection: {
    marginTop: 20,
    paddingBottom: 12,
  },
  promotedTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.light.text,
  },
  promotedScroll: {
    paddingLeft: 20,
    paddingRight: 12,
  },
  promotedCard: {
    width: 280,
    height: 340,
    marginRight: 16,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: Colors.light.card,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
  },
  promotedImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  promotedGradient: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  promotedBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 6,
  },
  promotedBadgesGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flexShrink: 1,
  },
  promotedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  promotedBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  promotedCertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  promotedCertBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  promotedPriceBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  promotedPriceText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  promotedContent: {
    gap: 6,
  },
  promotedSkillTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  promotedTagline: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 18,
  },
  promotedTeacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  promotedAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  promotedTeacherName: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    flex: 1,
  },
  promotedRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  promotedRatingText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.light.text,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitleWithoutPadding: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  carouselNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  carouselNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  carouselNavBtnDisabled: {
    opacity: 0.35,
    backgroundColor: '#F9FAFB',
    borderColor: '#EFEFEF',
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
  subcategoriesContainer: {
    marginTop: 10,
  },
  subcategoriesScroll: {
    paddingLeft: 20,
    paddingRight: 10,
  },
  subcategoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  subcategoryChipActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  subcategoryText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#4F46E5',
  },
  subcategoryTextActive: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
  },
  skillsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  skillsCountBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  skillsCountText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#6366F1',
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
  skillCertifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  skillCertifiedBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#059669',
  },
  featuredCertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.45)',
  },
  featuredCertBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#34D399',
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
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBox: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  aiFab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    borderRadius: 28,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  aiFabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
  },
  aiFabText: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  fullScreenLoaderContainer: {
    flex: 1,
  },
  fullScreenLoaderGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loaderCenterBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderIconHalo: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  loaderIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    marginTop: 18,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  loaderSubtitle: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#94A3B8',
    marginTop: 6,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
});

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
import { useSafeTopInset } from '@/lib/safeArea';
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
  const isSmallScreen = windowWidth < 600;
  const safeTopInset = useSafeTopInset(isSmallScreen ? 14 : 24);
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
    return 2; // In mobile devices, always show 2 cards in a row
  }, [windowWidth]);

  const skillGridPadding = isSmallScreen ? (windowWidth < 360 ? 12 : 16) : 20;
  const skillGridGap = isSmallScreen ? (windowWidth < 360 ? 8 : 12) : 16;

  const skillCardWidth = useMemo(() => {
    const totalPadding = skillGridPadding * 2;
    const totalGap = (numSkillColumns - 1) * skillGridGap;
    const availableWidth = windowWidth - totalPadding - totalGap;
    return Math.floor(availableWidth / numSkillColumns);
  }, [windowWidth, numSkillColumns, skillGridPadding, skillGridGap]);

  // Horizontal carousel metrics for mobile (2 visible cards in a row with horizontal scroll)
  const horizontalScrollPadding = isSmallScreen ? (windowWidth < 360 ? 12 : 16) : 20;
  const horizontalCardGap = isSmallScreen ? (windowWidth < 360 ? 8 : 10) : 16;
  const horizontalCardWidth = useMemo(() => {
    if (!isSmallScreen) return 280;
    // Exactly 2 cards visible in the row on mobile screens
    const totalPadding = horizontalScrollPadding * 2;
    const availableWidth = windowWidth - totalPadding - horizontalCardGap;
    return Math.floor(availableWidth / 2);
  }, [isSmallScreen, windowWidth, horizontalScrollPadding, horizontalCardGap]);

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
          style={[styles.header, isSmallScreen && styles.headerSmall, { paddingTop: safeTopInset }]}
        >
          <View style={styles.headerContent}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.greeting, isSmallScreen && styles.greetingSmall]}>Hi, {userDisplayName}</Text>
              <Text style={[styles.subtitle, isSmallScreen && styles.subtitleSmall]}>Curated exchanges to accelerate your growth</Text>
            </View>
            <TouchableOpacity
              style={[styles.bellButton, isSmallScreen && styles.bellButtonSmall]}
              onPress={() => router.push('/(tabs)/notifications' as any)}
              activeOpacity={0.8}
              testID="home-alerts-bell-button"
            >
              <Bell size={isSmallScreen ? 18 : 22} color="#FFFFFF" />
              {unreadCount > 0 && (
                <View style={[styles.bellBadge, isSmallScreen && styles.bellBadgeSmall]}>
                  <Text style={[styles.bellBadgeText, isSmallScreen && styles.bellBadgeTextSmall]}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={[styles.content, isSmallScreen && styles.contentSmall]}>
          {promotedSkills.length > 0 && (
            <View style={[styles.promotedSection, isSmallScreen && styles.promotedSectionSmall]} testID="promoted-teachers-section">
              <View style={[styles.matchesHeader, isSmallScreen && styles.matchesHeaderSmall]}>
                <View style={[styles.matchesTitleGroup, isSmallScreen && styles.matchesTitleGroupSmall]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: isSmallScreen ? 4 : 6 }}>
                    <Sparkles size={isSmallScreen ? 15 : 18} color="#F59E0B" />
                    <Text style={[styles.promotedTitle, isSmallScreen && styles.promotedTitleSmall]}>Promoted Teachers</Text>
                  </View>
                  <Text style={[styles.matchesSubtitle, isSmallScreen && styles.matchesSubtitleSmall]}>Featured classes with special offers</Text>
                </View>
                <View style={[styles.carouselNavRow, isSmallScreen && styles.carouselNavRowSmall]}>
                  <TouchableOpacity
                    style={[styles.carouselNavBtn, isSmallScreen && styles.carouselNavBtnSmall, !promotedNav.canLeft && styles.carouselNavBtnDisabled]}
                    onPress={() => handleScrollCarouselStep(promotedScrollRef, promotedPosRef, setPromotedNav, 'left', isSmallScreen ? (horizontalCardWidth + horizontalCardGap) : 300)}
                    activeOpacity={0.7}
                    disabled={!promotedNav.canLeft}
                  >
                    <ChevronLeft size={isSmallScreen ? 14 : 16} color={!promotedNav.canLeft ? '#CCC' : '#333'} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.carouselNavBtn, isSmallScreen && styles.carouselNavBtnSmall, !promotedNav.canRight && styles.carouselNavBtnDisabled]}
                    onPress={() => handleScrollCarouselStep(promotedScrollRef, promotedPosRef, setPromotedNav, 'right', isSmallScreen ? (horizontalCardWidth + horizontalCardGap) : 300)}
                    activeOpacity={0.7}
                    disabled={!promotedNav.canRight}
                  >
                    <ChevronRight size={isSmallScreen ? 14 : 16} color={!promotedNav.canRight ? '#CCC' : '#333'} />
                  </TouchableOpacity>
                </View>
              </View>
              <ScrollView
                ref={promotedScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.promotedScroll, isSmallScreen && { paddingLeft: horizontalScrollPadding, paddingRight: horizontalScrollPadding }]}
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
                    style={[
                      styles.promotedCard,
                      isSmallScreen && styles.promotedCardSmall,
                      isSmallScreen && { width: horizontalCardWidth, marginRight: horizontalCardGap },
                    ]}
                    onPress={() => router.push(`/skill/${skill.id}` as any)}
                    activeOpacity={0.85}
                  >
                    <Image source={{ uri: resolveImageUrl(skill.imageUrl, DEFAULT_SKILL_IMAGE) }} style={styles.promotedImage} defaultSource={{ uri: DEFAULT_SKILL_IMAGE }} />
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.8)']}
                      style={[styles.promotedGradient, isSmallScreen && styles.promotedGradientSmall]}
                    >
                      <View style={styles.promotedBadgeRow}>
                        <View style={styles.promotedBadgesGroup}>
                          <View style={[styles.promotedBadge, isSmallScreen && styles.promotedBadgeSmall]}>
                            <Sparkles size={isSmallScreen ? 8 : 10} color="#FFFFFF" />
                            <Text style={[styles.promotedBadgeText, isSmallScreen && styles.promotedBadgeTextSmall]}>PROMOTED</Text>
                          </View>
                          {skill.certificateStatus === 'approved' && (
                            <View style={[styles.promotedCertBadge, isSmallScreen && styles.promotedCertBadgeSmall]}>
                              <BadgeCheck size={isSmallScreen ? 9 : 11} color="#FFFFFF" />
                              <Text style={[styles.promotedCertBadgeText, isSmallScreen && styles.promotedCertBadgeTextSmall]}>CERTIFIED</Text>
                            </View>
                          )}
                        </View>
                        {skill.pricingModel !== 'free' && (
                          <View style={[styles.promotedPriceBadge, isSmallScreen && styles.promotedPriceBadgeSmall]}>
                            <Text style={[styles.promotedPriceText, isSmallScreen && styles.promotedPriceTextSmall]}>
                              {skill.pricingModel === 'per_session'
                                ? `${formatPrice(skill.pricePerSession ?? 0)}/session`
                                : `${formatPrice(skill.monthlyPrice ?? 0)}/mo`}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={[styles.promotedContent, isSmallScreen && styles.promotedContentSmall]}>
                        <Text style={[styles.promotedSkillTitle, isSmallScreen && styles.promotedSkillTitleSmall]}>{skill.title}</Text>
                        <Text style={[styles.promotedTagline, isSmallScreen && styles.promotedTaglineSmall]}>{skill.promoTagline}</Text>
                        <View style={[styles.promotedTeacherRow, isSmallScreen && styles.promotedTeacherRowSmall]}>
                          <Image source={{ uri: resolveImageUrl(skill.user?.avatarUrl, DEFAULT_AVATAR) }} style={[styles.promotedAvatar, isSmallScreen && styles.promotedAvatarSmall]} defaultSource={{ uri: DEFAULT_AVATAR }} />
                          <Text style={[styles.promotedTeacherName, isSmallScreen && styles.promotedTeacherNameSmall]}>{skill.user?.name}</Text>
                          <View style={styles.promotedRating}>
                            <Star size={isSmallScreen ? 9 : 10} fill={Colors.light.accent} color={Colors.light.accent} />
                            <Text style={[styles.promotedRatingText, isSmallScreen && styles.promotedRatingTextSmall]}>{skill.user?.rating}</Text>
                          </View>
                        </View>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={[styles.matchesSection, isSmallScreen && styles.matchesSectionSmall]} testID="smart-matches-section">
            <View style={[styles.matchesHeader, isSmallScreen && styles.matchesHeaderSmall]}>
              <View style={[styles.matchesTitleGroup, isSmallScreen && styles.matchesTitleGroupSmall]}>
                <Text style={[styles.matchesTitle, isSmallScreen && styles.matchesTitleSmall]}>Smart Matches</Text>
                <Text style={[styles.matchesSubtitle, isSmallScreen && styles.matchesSubtitleSmall]}>{matchesSubtitle}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: isSmallScreen ? 6 : 8 }}>
                <TouchableOpacity
                  style={[styles.refreshButton, isSmallScreen && styles.refreshButtonSmall, isRefreshing && { opacity: 0.8 }]}
                  onPress={handleRefresh}
                  disabled={isRefreshing}
                  activeOpacity={0.85}
                  testID="refresh-matches"
                >
                  {isRefreshing ? (
                    <ActivityIndicator size="small" color={Colors.light.primary} style={{ marginRight: 4 }} />
                  ) : (
                    <RefreshCcw size={isSmallScreen ? 13 : 16} color={Colors.light.primary} />
                  )}
                  <Text style={[styles.refreshText, isSmallScreen && styles.refreshTextSmall]}>{isRefreshing ? 'Loading...' : 'Refresh'}</Text>
                </TouchableOpacity>

                {hasMatches && (
                  <View style={[styles.carouselNavRow, isSmallScreen && styles.carouselNavRowSmall]}>
                    <TouchableOpacity
                      style={[styles.carouselNavBtn, isSmallScreen && styles.carouselNavBtnSmall, !matchesNav.canLeft && styles.carouselNavBtnDisabled]}
                      onPress={() => handleScrollCarouselStep(matchesScrollRef, matchesPosRef, setMatchesNav, 'left', isSmallScreen ? (horizontalCardWidth + horizontalCardGap) : 300)}
                      activeOpacity={0.7}
                      disabled={!matchesNav.canLeft}
                    >
                      <ChevronLeft size={isSmallScreen ? 14 : 16} color={!matchesNav.canLeft ? '#CCC' : '#333'} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.carouselNavBtn, isSmallScreen && styles.carouselNavBtnSmall, !matchesNav.canRight && styles.carouselNavBtnDisabled]}
                      onPress={() => handleScrollCarouselStep(matchesScrollRef, matchesPosRef, setMatchesNav, 'right', isSmallScreen ? (horizontalCardWidth + horizontalCardGap) : 300)}
                      activeOpacity={0.7}
                      disabled={!matchesNav.canRight}
                    >
                      <ChevronRight size={isSmallScreen ? 14 : 16} color={!matchesNav.canRight ? '#CCC' : '#333'} />
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
                contentContainerStyle={[styles.matchesScroll, isSmallScreen && { paddingLeft: horizontalScrollPadding, paddingRight: horizontalScrollPadding }]}
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
                    cardWidth={isSmallScreen ? horizontalCardWidth : undefined}
                    cardMarginRight={isSmallScreen ? horizontalCardGap : undefined}
                  />
                ))}
              </ScrollView>
            ) : (
              <View style={[styles.emptyMatchesCard, isSmallScreen && styles.emptyMatchesCardSmall]}>
                <Users size={isSmallScreen ? 18 : 22} color={Colors.light.textSecondary} />
                <Text style={[styles.emptyMatchesTitle, isSmallScreen && styles.emptyMatchesTitleSmall]}>No matches yet</Text>
                <Text style={[styles.emptyMatchesSubtitle, isSmallScreen && styles.emptyMatchesSubtitleSmall]}>Share what you can teach to see instant connections.</Text>
              </View>
            )}
          </View>

          <View style={[styles.teachSection, isSmallScreen && styles.teachSectionSmall]} testID="teach-matches-section">
            <View style={[styles.matchesHeader, isSmallScreen && styles.matchesHeaderSmall]}>
              <View style={[styles.matchesTitleGroup, isSmallScreen && styles.matchesTitleGroupSmall]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: isSmallScreen ? 6 : 8 }}>
                  {secondarySection && <secondarySection.icon size={isSmallScreen ? 15 : 20} color={secondarySection.color} />}
                  <Text style={[styles.teachTitle, isSmallScreen && styles.teachTitleSmall]}>{secondarySection?.title ?? ''}</Text>
                </View>
                <Text style={[styles.matchesSubtitle, isSmallScreen && styles.matchesSubtitleSmall]}>{secondarySection?.subtitle ?? ''}</Text>
              </View>
            </View>
            {secondarySection?.items.map((match) => (
              <TouchableOpacity
                key={`sec-${match.user.id}`}
                style={[styles.teachCard, isSmallScreen && styles.teachCardSmall]}
                onPress={() => router.push(`/profile/${match.user.id}` as any)}
                activeOpacity={0.85}
                testID={`sec-card-${match.user.id}`}
              >
                {match.user.avatarUrl ? (
                  <Image source={{ uri: resolveImageUrl(match.user.avatarUrl, DEFAULT_AVATAR) }} style={[styles.teachAvatar, isSmallScreen && styles.teachAvatarSmall]} defaultSource={{ uri: DEFAULT_AVATAR }} />
                ) : (
                  <Image source={{ uri: DEFAULT_AVATAR }} style={[styles.teachAvatar, isSmallScreen && styles.teachAvatarSmall]} />
                )}
                <View style={[styles.teachInfo, isSmallScreen && styles.teachInfoSmall]}>
                  <Text style={[styles.teachName, isSmallScreen && styles.teachNameSmall]}>{match.user.username ? (match.user.username.startsWith('@') ? match.user.username : `@${match.user.username}`) : `@${match.user.name.toLowerCase().replace(/\s+/g, '')}`}</Text>
                  <View style={[styles.teachSkillsRow, isSmallScreen && styles.teachSkillsRowSmall]}>
                    {secondarySection.chips(match).map((skill, index) => {
                      const skillText = typeof skill === 'string' ? skill : (skill as any)?.title || String(skill);
                      return (
                        <View key={`${match.user.id}-${index}`} style={[styles.teachChip, isSmallScreen && styles.teachChipSmall]}>
                          <Text style={[styles.teachChipText, isSmallScreen && styles.teachChipTextSmall]}>{skillText}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
                <View style={styles.teachCompatibility}>
                  <Text style={[styles.teachCompatibilityValue, isSmallScreen && styles.teachCompatibilityValueSmall]}>{match.compatibility}</Text>
                  <Text style={[styles.teachCompatibilityLabel, isSmallScreen && styles.teachCompatibilityLabelSmall]}>match</Text>
                </View>
              </TouchableOpacity>
            ))}
            {secondarySection && secondarySection.items.length === 0 && (
              <View style={[styles.emptyTeachCard, isSmallScreen && styles.emptyTeachCardSmall]}>
                <Text style={[styles.emptyMatchesTitle, isSmallScreen && styles.emptyMatchesTitleSmall]}>No matches here yet — add more skills to your profile.</Text>
              </View>
            )}
          </View>
          <View style={[styles.section, isSmallScreen && styles.sectionSmall]}>
            <View style={[styles.sectionHeader, isSmallScreen && styles.sectionHeaderSmall]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: isSmallScreen ? 6 : 8, flex: 1 }}>
                <Text style={[styles.sectionTitleWithoutPadding, isSmallScreen && styles.sectionTitleWithoutPaddingSmall]}>Featured</Text>
                <Zap size={isSmallScreen ? 15 : 18} color={Colors.light.accent} fill={Colors.light.accent} />
              </View>
              <View style={[styles.carouselNavRow, isSmallScreen && styles.carouselNavRowSmall]}>
                <TouchableOpacity
                  style={[styles.carouselNavBtn, isSmallScreen && styles.carouselNavBtnSmall, !featuredNav.canLeft && styles.carouselNavBtnDisabled]}
                  onPress={() => handleScrollCarouselStep(featuredScrollRef, featuredPosRef, setFeaturedNav, 'left', isSmallScreen ? (horizontalCardWidth + horizontalCardGap) : 320)}
                  activeOpacity={0.7}
                  disabled={!featuredNav.canLeft}
                >
                  <ChevronLeft size={isSmallScreen ? 14 : 16} color={!featuredNav.canLeft ? '#CCC' : '#333'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.carouselNavBtn, isSmallScreen && styles.carouselNavBtnSmall, !featuredNav.canRight && styles.carouselNavBtnDisabled]}
                  onPress={() => handleScrollCarouselStep(featuredScrollRef, featuredPosRef, setFeaturedNav, 'right', isSmallScreen ? (horizontalCardWidth + horizontalCardGap) : 320)}
                  activeOpacity={0.7}
                  disabled={!featuredNav.canRight}
                >
                  <ChevronRight size={isSmallScreen ? 14 : 16} color={!featuredNav.canRight ? '#CCC' : '#333'} />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView
              ref={featuredScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.featuredScroll, isSmallScreen && { paddingLeft: horizontalScrollPadding, paddingRight: horizontalScrollPadding }]}
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
                  style={[
                    styles.featuredCard,
                    isSmallScreen && styles.featuredCardSmall,
                    isSmallScreen && { width: horizontalCardWidth, marginRight: horizontalCardGap },
                  ]}
                  onPress={() => router.push(`/skill/${skill.id}` as any)}
                >
                  <Image
                    source={{ uri: resolveImageUrl(skill.imageUrl, DEFAULT_SKILL_IMAGE) }}
                    style={styles.featuredImage}
                    defaultSource={{ uri: DEFAULT_SKILL_IMAGE }}
                  />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.85)']}
                    style={[styles.featuredOverlay, isSmallScreen && styles.featuredOverlaySmall]}
                  >
                    <View style={styles.featuredBadgeRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: isSmallScreen ? 4 : 6 }}>
                        <View style={[styles.levelBadge, isSmallScreen && styles.levelBadgeSmall]}>
                          <Text style={[styles.levelBadgeText, isSmallScreen && styles.levelBadgeTextSmall]}>{skill.level}</Text>
                        </View>
                        {skill.certificateStatus === 'approved' && (
                          <View style={[styles.featuredCertBadge, isSmallScreen && styles.featuredCertBadgeSmall]}>
                            <BadgeCheck size={isSmallScreen ? 9 : 11} color="#34D399" />
                            <Text style={[styles.featuredCertBadgeText, isSmallScreen && styles.featuredCertBadgeTextSmall]}>Certified</Text>
                          </View>
                        )}
                      </View>
                      <View style={[styles.trendingBadge, isSmallScreen && styles.trendingBadgeSmall]}>
                        <TrendingUp size={isSmallScreen ? 10 : 12} color="#FFFFFF" />
                      </View>
                    </View>
                    <View style={[styles.featuredContent, isSmallScreen && styles.featuredContentSmall]}>
                      <Text style={[styles.featuredCategory, isSmallScreen && styles.featuredCategorySmall]}>{skill.category}</Text>
                      <Text style={[styles.featuredTitle, isSmallScreen && styles.featuredTitleSmall]}>
                        {skill.title}
                      </Text>
                      <View style={[styles.featuredUser, isSmallScreen && styles.featuredUserSmall]}>
                        <Image
                          source={{ uri: resolveImageUrl(skill.user.avatarUrl, DEFAULT_AVATAR) }}
                          style={[styles.featuredAvatar, isSmallScreen && styles.featuredAvatarSmall]}
                        />
                        <View style={styles.featuredUserInfo}>
                          <Text style={[styles.featuredUserName, isSmallScreen && styles.featuredUserNameSmall]}>
                            {skill.user.username ? (skill.user.username.startsWith('@') ? skill.user.username : `@${skill.user.username}`) : `@${skill.user.name.toLowerCase().replace(/\s+/g, '')}`}
                          </Text>
                          <View style={styles.featuredRating}>
                            <Star size={isSmallScreen ? 9 : 10} fill={Colors.light.accent} color={Colors.light.accent} />
                            <Text style={[styles.featuredRatingText, isSmallScreen && styles.featuredRatingTextSmall]}>{skill.user.rating}</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={[styles.section, isSmallScreen && styles.sectionSmall]}>
            <Text style={[styles.sectionTitle, isSmallScreen && styles.sectionTitleSmall]}>Categories</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.categoriesScroll, isSmallScreen && styles.categoriesScrollSmall]}
            >
              {['All', ...MAIN_CATEGORIES].map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryChip,
                    isSmallScreen && styles.categoryChipSmall,
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
                      isSmallScreen && styles.categoryTextSmall,
                      selectedCategory === category && styles.categoryTextActive,
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {selectedCategory !== 'All' && getSubcategoriesForCategory(selectedCategory).length > 0 && (
              <View style={[styles.subcategoriesContainer, isSmallScreen && styles.subcategoriesContainerSmall]}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={[styles.subcategoriesScroll, isSmallScreen && styles.subcategoriesScrollSmall]}
                >
                  <TouchableOpacity
                    style={[
                      styles.subcategoryChip,
                      isSmallScreen && styles.subcategoryChipSmall,
                      selectedSubcategory === 'All' && styles.subcategoryChipActive,
                    ]}
                    onPress={() => setSelectedSubcategory('All')}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.subcategoryText,
                        isSmallScreen && styles.subcategoryTextSmall,
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
                        isSmallScreen && styles.subcategoryChipSmall,
                        selectedSubcategory === sub && styles.subcategoryChipActive,
                      ]}
                      onPress={() => setSelectedSubcategory(sub)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.subcategoryText,
                          isSmallScreen && styles.subcategoryTextSmall,
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

          <View style={[styles.section, isSmallScreen && styles.sectionSmall]}>
            <View style={[styles.skillsSectionHeader, isSmallScreen && styles.skillsSectionHeaderSmall, isSmallScreen && { paddingHorizontal: skillGridPadding }]}>
              <Text style={[styles.sectionTitleWithoutPadding, isSmallScreen && styles.sectionTitleWithoutPaddingSmall]}>
                {selectedCategory === 'All'
                  ? 'All Skills'
                  : selectedSubcategory !== 'All'
                    ? `${selectedCategory} • ${selectedSubcategory}`
                    : selectedCategory}
              </Text>
              <View style={[styles.skillsCountBadge, isSmallScreen && styles.skillsCountBadgeSmall]}>
                <Text style={[styles.skillsCountText, isSmallScreen && styles.skillsCountTextSmall]}>
                  {filteredSkills.length} {filteredSkills.length === 1 ? 'skill' : 'skills'}
                </Text>
              </View>
            </View>
            <View style={[
              styles.skillsGrid,
              {
                paddingHorizontal: skillGridPadding,
                gap: skillGridGap,
                flexDirection: 'row',
                flexWrap: 'wrap',
              }
            ]}>
              {filteredSkills.map((skill) => (
                <TouchableOpacity
                  key={skill.id}
                  style={[
                    styles.skillCard,
                    isSmallScreen && styles.skillCardMobile,
                    {
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
                      isSmallScreen
                        ? { height: 125 }
                        : numSkillColumns >= 4
                          ? { height: 145 }
                          : numSkillColumns >= 3
                            ? { height: 160 }
                            : { height: 180 }
                    ]}
                    defaultSource={{ uri: DEFAULT_SKILL_IMAGE }}
                  />
                  <View style={[styles.skillContent, isSmallScreen && styles.skillContentMobile]}>
                    <View style={[styles.skillHeader, isSmallScreen && styles.skillHeaderMobile]}>
                      <Text style={[styles.categoryLabel, isSmallScreen && styles.categoryLabelMobile]}>
                        {skill.category}
                      </Text>
                      <View style={[
                        { flexDirection: 'row', alignItems: 'center', gap: isSmallScreen ? 4 : 6, flexShrink: 0 },
                        isSmallScreen && { flexWrap: 'wrap', width: '100%', marginTop: 2 }
                      ]}>
                        {skill.certificateStatus === 'approved' && (
                          <View style={[styles.skillCertifiedBadge, isSmallScreen && styles.skillCertifiedBadgeMobile]}>
                            <BadgeCheck size={isSmallScreen ? 9.5 : 11} color="#10B981" />
                            <Text style={[styles.skillCertifiedBadgeText, isSmallScreen && styles.skillCertifiedBadgeTextMobile]}>Certified</Text>
                          </View>
                        )}
                        <View style={[styles.skillLevelBadge, isSmallScreen && styles.skillLevelBadgeMobile]}>
                          <Text style={[styles.skillLevelText, isSmallScreen && styles.skillLevelTextMobile]}>{skill.level}</Text>
                        </View>
                      </View>
                    </View>
                    <Text style={[styles.skillTitle, isSmallScreen && styles.skillTitleMobile]}>
                      {skill.title}
                    </Text>
                    <View style={[styles.skillFooter, isSmallScreen && styles.skillFooterMobile]}>
                      <View style={[styles.userInfo, isSmallScreen && styles.userInfoMobile]}>
                        <Image
                          source={{ uri: resolveImageUrl(skill.user?.avatarUrl, DEFAULT_AVATAR) }}
                          style={[styles.userAvatar, isSmallScreen && styles.userAvatarMobile]}
                        />
                        <Text style={[styles.userName, isSmallScreen && styles.userNameMobile]}>
                          {skill.user?.username ? (skill.user.username.startsWith('@') ? skill.user.username : `@${skill.user.username}`) : `@${(skill.user?.name || 'user').toLowerCase().replace(/\s+/g, '')}`}
                        </Text>
                      </View>
                      <View style={[styles.ratingContainer, isSmallScreen && styles.ratingContainerMobile]}>
                        <Star size={isSmallScreen ? 10 : 12} fill={Colors.light.accent} color={Colors.light.accent} />
                        <Text style={[styles.ratingText, isSmallScreen && styles.ratingTextMobile]}>{skill.user?.rating ?? 5.0}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[styles.bottomSpacer, isSmallScreen && styles.bottomSpacerSmall]} />
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[styles.aiFab, isSmallScreen && styles.aiFabMobile]}
        onPress={() => router.push('/assistant' as any)}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['#6366F1', '#818CF8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.aiFabGradient, isSmallScreen && styles.aiFabGradientMobile]}
        >
          <Bot size={isSmallScreen ? 16 : 22} color="#FFF" />
          <Text style={[styles.aiFabText, isSmallScreen && styles.aiFabTextMobile]}>AI</Text>
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
  headerSmall: {
    paddingHorizontal: 16,
    paddingBottom: 16,
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
  greetingSmall: {
    fontSize: 18,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
  },
  subtitleSmall: {
    fontSize: 12,
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
  bellButtonSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  bellBadgeSmall: {
    top: 2,
    right: 2,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  bellBadgeTextSmall: {
    fontSize: 9,
  },
  content: {
    marginTop: -16,
    backgroundColor: Colors.light.backgroundSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
  },
  contentSmall: {
    marginTop: -10,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 4,
  },
  matchesSection: {
    marginTop: 24,
    paddingBottom: 12,
  },
  matchesSectionSmall: {
    marginTop: 14,
    paddingBottom: 6,
  },
  // Promoted teachers
  promotedSection: {
    marginTop: 20,
    paddingBottom: 12,
  },
  promotedSectionSmall: {
    marginTop: 14,
    paddingBottom: 6,
  },
  promotedTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.light.text,
  },
  promotedTitleSmall: {
    fontSize: 15,
    fontWeight: '700' as const,
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
  matchesHeaderSmall: {
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  matchesTitleGroup: {
    flex: 1,
    gap: 6,
  },
  matchesTitleGroupSmall: {
    gap: 2,
  },
  matchesTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.light.text,
  },
  matchesTitleSmall: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  teachTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.light.text,
  },
  teachTitleSmall: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  matchesSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
  },
  matchesSubtitleSmall: {
    fontSize: 11,
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
  refreshButtonSmall: {
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  refreshText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.primary,
  },
  refreshTextSmall: {
    fontSize: 11,
    fontWeight: '600' as const,
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
  emptyMatchesCardSmall: {
    marginHorizontal: 16,
    paddingVertical: 20,
    gap: 8,
    borderRadius: 14,
  },
  emptyMatchesTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  emptyMatchesTitleSmall: {
    fontSize: 13,
  },
  emptyMatchesSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    paddingHorizontal: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyMatchesSubtitleSmall: {
    fontSize: 11,
    paddingHorizontal: 16,
    lineHeight: 16,
  },
  teachSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 12,
  },
  teachSectionSmall: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
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
  teachCardSmall: {
    borderRadius: 14,
    padding: 10,
    gap: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  teachAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  teachAvatarSmall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
  },
  teachInfo: {
    flex: 1,
    gap: 8,
  },
  teachInfoSmall: {
    gap: 4,
  },
  teachName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  teachNameSmall: {
    fontSize: 13,
  },
  teachSkillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  teachSkillsRowSmall: {
    gap: 6,
  },
  teachChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: Colors.light.backgroundTertiary,
  },
  teachChipSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  teachChipText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.primary,
  },
  teachChipTextSmall: {
    fontSize: 10.5,
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
  teachCompatibilityValueSmall: {
    fontSize: 15,
  },
  teachCompatibilityLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  teachCompatibilityLabelSmall: {
    fontSize: 9.5,
    letterSpacing: 0.5,
  },
  emptyTeachCard: {
    backgroundColor: Colors.light.backgroundTertiary,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  emptyTeachCardSmall: {
    borderRadius: 12,
    padding: 14,
  },
  section: {
    marginTop: 24,
  },
  sectionSmall: {
    marginTop: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  sectionHeaderSmall: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.light.text,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitleSmall: {
    fontSize: 15,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitleWithoutPadding: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  sectionTitleWithoutPaddingSmall: {
    fontSize: 15,
  },
  carouselNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  carouselNavRowSmall: {
    gap: 4,
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
  carouselNavBtnSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
  categoriesScrollSmall: {
    paddingLeft: 16,
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
  categoryChipSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginRight: 8,
    borderWidth: 1,
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
  categoryTextSmall: {
    fontSize: 12,
  },
  categoryTextActive: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
  },
  subcategoriesContainer: {
    marginTop: 10,
  },
  subcategoriesContainerSmall: {
    marginTop: 6,
  },
  subcategoriesScroll: {
    paddingLeft: 20,
    paddingRight: 10,
  },
  subcategoriesScrollSmall: {
    paddingLeft: 16,
    paddingRight: 8,
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
  subcategoryChipSmall: {
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 12,
    marginRight: 6,
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
  subcategoryTextSmall: {
    fontSize: 11,
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
  skillsSectionHeaderSmall: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  skillsCountBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  skillsCountBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  skillsCountText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#6366F1',
  },
  skillsCountTextSmall: {
    fontSize: 10.5,
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
  skillCardMobile: {
    borderRadius: 14,
  },
  skillContentMobile: {
    padding: 10,
    flex: 1,
    justifyContent: 'space-between',
  },
  skillHeaderMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    marginBottom: 6,
  },
  categoryLabelMobile: {
    fontSize: 9.5,
    letterSpacing: 0.4,
    flexWrap: 'wrap',
  },
  skillCertifiedBadgeMobile: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  skillCertifiedBadgeTextMobile: {
    fontSize: 8.5,
  },
  skillLevelBadgeMobile: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  skillLevelTextMobile: {
    fontSize: 9,
  },
  skillTitleMobile: {
    fontSize: 13,
    lineHeight: 17,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  skillFooterMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 'auto',
  },
  userInfoMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    marginRight: 0,
  },
  userAvatarMobile: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  userNameMobile: {
    fontSize: 11,
    flex: 1,
    flexWrap: 'wrap',
  },
  ratingContainerMobile: {
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    gap: 3,
    alignSelf: 'flex-start',
  },
  ratingTextMobile: {
    fontSize: 10.5,
  },
  bottomSpacer: {
    height: 40,
  },
  bottomSpacerSmall: {
    height: 16,
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
  aiFabMobile: {
    bottom: 16,
    right: 14,
    borderRadius: 20,
  },
  aiFabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
  },
  aiFabGradientMobile: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  aiFabText: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  aiFabTextMobile: {
    fontSize: 12,
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
  promotedCardSmall: {
    height: 260,
    borderRadius: 16,
  },
  promotedGradientSmall: {
    padding: 10,
  },
  promotedBadgeSmall: {
    paddingHorizontal: 5,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  promotedBadgeTextSmall: {
    fontSize: 8.5,
  },
  promotedCertBadgeSmall: {
    paddingHorizontal: 5,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  promotedCertBadgeTextSmall: {
    fontSize: 8.5,
  },
  promotedPriceBadgeSmall: {
    paddingHorizontal: 5,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  promotedPriceTextSmall: {
    fontSize: 9.5,
  },
  promotedContentSmall: {
    gap: 3,
  },
  promotedSkillTitleSmall: {
    fontSize: 13,
    lineHeight: 17,
  },
  promotedTaglineSmall: {
    fontSize: 10,
    lineHeight: 13,
  },
  promotedTeacherRowSmall: {
    gap: 5,
    marginTop: 2,
  },
  promotedAvatarSmall: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  promotedTeacherNameSmall: {
    fontSize: 10,
  },
  promotedRatingTextSmall: {
    fontSize: 10,
  },

  featuredCardSmall: {
    height: 270,
    borderRadius: 16,
  },
  featuredOverlaySmall: {
    padding: 10,
  },
  levelBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  levelBadgeTextSmall: {
    fontSize: 9.5,
  },
  featuredCertBadgeSmall: {
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 5,
  },
  featuredCertBadgeTextSmall: {
    fontSize: 8.5,
  },
  trendingBadgeSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  featuredContentSmall: {
    gap: 4,
  },
  featuredCategorySmall: {
    fontSize: 9.5,
    letterSpacing: 0.6,
  },
  featuredTitleSmall: {
    fontSize: 13,
    lineHeight: 17,
  },
  featuredUserSmall: {
    gap: 6,
    marginTop: 2,
  },
  featuredAvatarSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  featuredUserNameSmall: {
    fontSize: 10,
  },
  featuredRatingTextSmall: {
    fontSize: 10,
  },
});

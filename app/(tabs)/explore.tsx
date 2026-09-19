import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Animated,
  Easing,
  Pressable,
  FlatList,
  useWindowDimensions,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  ChevronDown,
  Search,
  SlidersHorizontal,
  Star,
  X,
  GraduationCap,
  BookOpen,
  ArrowLeftRight,
  MapPin,
  BadgeCheck,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { getSkillsWithUsers, mockUsers } from '@/mocks/data';
import {
  MAIN_CATEGORIES,
  getSubcategoriesForCategory,
  findCategoryForSubcategory,
} from '@/constants/categories';
import type { SkillLevel, SkillWithUser, User } from '@/types';
import { useCurrentUser } from '@/providers/current-user';
import { useSafety } from '@/providers/safety';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveImageUrl } from '@/lib/resolveImageUrl';

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
const DEFAULT_SKILL_IMAGE = 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800';

type SortBy = 'Relevance' | 'Rating' | 'Swaps' | 'Newest';
type RoleTab = 'teachers' | 'learners' | 'swappers';

interface FiltersState {
  level: SkillLevel | 'Any';
  minRating: 0 | 4 | 4.5 | 4.8 | 5;
  sortBy: SortBy;
}

const LEVEL_OPTIONS: (SkillLevel | 'Any')[] = ['Any', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];
const SORT_OPTIONS: SortBy[] = ['Relevance', 'Rating', 'Swaps', 'Newest'];
const RATING_OPTIONS: { label: string; value: 0 | 4 | 4.5 | 4.8 | 5 }[] = [
  { label: 'All', value: 0 },
  { label: '4.0+', value: 4 },
  { label: '4.5+', value: 4.5 },
  { label: '4.8+', value: 4.8 },
  { label: '5.0', value: 5 },
];

const ROLE_TABS: { key: RoleTab; label: string; icon: typeof GraduationCap }[] = [
  { key: 'teachers', label: 'Teachers', icon: GraduationCap },
  { key: 'learners', label: 'Learners', icon: BookOpen },
  { key: 'swappers', label: 'Swappers', icon: ArrowLeftRight },
];

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const numColumns = useMemo(() => {
    if (windowWidth >= 1024) return 4;
    if (windowWidth >= 768) return 3;
    if (windowWidth >= 540) return 2;
    return 1;
  }, [windowWidth]);

  const cardWidth = useMemo(() => {
    if (numColumns === 1) return '100%';
    const totalPadding = 40;
    const totalGap = (numColumns - 1) * 16;
    const availableWidth = windowWidth - totalPadding - totalGap;
    return Math.max(160, Math.floor(availableWidth / numColumns));
  }, [windowWidth, numColumns]);

  const [activeTab, setActiveTab] = useState<RoleTab>('teachers');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('All');
  const [filters, setFilters] = useState<FiltersState>({
    level: 'Any',
    minRating: 0,
    sortBy: 'Relevance',
  });
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [skillsWithUsers, setSkillsWithUsers] = useState<SkillWithUser[]>([]);

  const matchUserSearch = useCallback((user: User | undefined, query: string) => {
    if (!user) return false;
    const q = query.toLowerCase();
    const cleanQ = q.startsWith('@') ? q.slice(1) : q;
    const name = user.name?.toLowerCase() ?? '';
    const username = user.username?.toLowerCase() ?? '';
    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
    const derivedUsername = name.replace(/\s+/g, '');
    return (
      name.includes(cleanQ) ||
      username.includes(q) ||
      cleanUsername.includes(cleanQ) ||
      derivedUsername.includes(cleanQ)
    );
  }, []);

  const { currentUser, allUsers, loadUser } = useCurrentUser();
  const { isBlocked } = useSafety();
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchExploreData = useCallback(async () => {
    try {
      const [skills] = await Promise.all([
        getSkillsWithUsers(),
        loadUser ? loadUser(true) : Promise.resolve(),
      ]);
      if (Array.isArray(skills)) {
        setSkillsWithUsers(skills);
      }
    } catch (err) {
      console.warn('[Explore] fetchExploreData error:', err);
    }
  }, [loadUser]);

  useEffect(() => {
    fetchExploreData();
  }, [fetchExploreData]);

  useFocusEffect(
    useCallback(() => {
      fetchExploreData();
    }, [fetchExploreData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchExploreData();
    } finally {
      setRefreshing(false);
    }
  }, [fetchExploreData]);

  // Use backend users for learners/swappers, fall back to mockUsers if empty (excluding blocked users)
  const otherUsers = useMemo(() => {
    const backendUsers = allUsers.filter((u) => {
      if (u.id === currentUser?.id) return false;
      if (isBlocked(u.id, currentUser?.id)) return false;
      return true;
    });
    const base = backendUsers.length > 0 ? backendUsers : mockUsers.slice(1);
    return base.filter((u) => !isBlocked(u.id, currentUser?.id));
  }, [allUsers, currentUser?.id, isBlocked]);

  const toggleFilters = useCallback(() => {
    const next = !isFilterOpen;
    setIsFilterOpen(next);
    Animated.timing(slideAnim, {
      toValue: next ? 1 : 0,
      duration: 250,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [isFilterOpen, slideAnim]);

  const clearAll = useCallback(() => {
    setFilters({ level: 'Any', minRating: 0, sortBy: 'Relevance' });
    setSelectedCategory('All');
    setSelectedSubcategory('All');
    setSearchQuery('');
  }, []);

  // --- TEACHERS: skills offered ---
  const filteredSkills = useMemo<SkillWithUser[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    const subcategories = getSubcategoriesForCategory(selectedCategory);

    let list = skillsWithUsers.filter((skill) => {
      const teacherId = skill.userId || skill.user?.id;
      if (teacherId && isBlocked(teacherId, currentUser?.id)) return false;

      const titleMatches = skill.title?.toLowerCase().includes(q) ?? false;
      const descMatches = skill.description?.toLowerCase().includes(q) ?? false;
      const subCatMatches = (skill.subCategory?.toLowerCase().includes(q) || (skill as any).subcategory?.toLowerCase().includes(q)) ?? false;
      const userNameMatches = matchUserSearch(skill.user, q);

      const matchesSearch = q.length === 0 ? true : titleMatches || descMatches || subCatMatches || userNameMatches;

      let matchesCategory = true;
      if (selectedCategory !== 'All') {
        const skillCat = (skill.category || '').trim();
        const skillSubCat = (skill.subCategory || (skill as any).subcategory || '').trim();
        const skillTitle = (skill.title || '').trim().toLowerCase();
        const skillDesc = (skill.description || '').trim().toLowerCase();

        if (selectedSubcategory !== 'All') {
          const subQ = selectedSubcategory.toLowerCase();
          matchesCategory =
            skillSubCat.toLowerCase() === subQ ||
            skillCat.toLowerCase() === subQ ||
            skillTitle.includes(subQ) ||
            skillDesc.includes(subQ);
        } else {
          const isDirectCat = skillCat.toLowerCase() === selectedCategory.toLowerCase();
          const isParentCat = findCategoryForSubcategory(skillCat)?.toLowerCase() === selectedCategory.toLowerCase();
          const isParentSubCat = findCategoryForSubcategory(skillSubCat)?.toLowerCase() === selectedCategory.toLowerCase();
          const isSubInList = subcategories.some(
            (sub) => sub.toLowerCase() === skillSubCat.toLowerCase() || sub.toLowerCase() === skillCat.toLowerCase()
          );
          matchesCategory = isDirectCat || isParentCat || isParentSubCat || isSubInList;
        }
      }

      const matchesLevel = filters.level === 'Any' || skill.level === filters.level;
      const matchesRating = (skill.user?.rating ?? 0) >= filters.minRating;
      return matchesSearch && matchesCategory && matchesLevel && matchesRating;
    });

    switch (filters.sortBy) {
      case 'Rating':
        list = [...list].sort((a, b) => (b.user?.rating ?? 0) - (a.user?.rating ?? 0));
        break;
      case 'Swaps':
        list = [...list].sort((a, b) => (b.user?.totalSwaps ?? 0) - (a.user?.totalSwaps ?? 0));
        break;
      case 'Newest':
        list = [...list].sort((a, b) => new Date(b.user?.joinedDate || 0).getTime() - new Date(a.user?.joinedDate || 0).getTime());
        break;
      case 'Relevance':
      default:
        break;
    }
    return list;
  }, [filters.level, filters.minRating, filters.sortBy, searchQuery, selectedCategory, selectedSubcategory, skillsWithUsers, currentUser?.id, isBlocked, matchUserSearch]);

  // --- LEARNERS: users wanting skills ---
  const filteredLearners = useMemo<User[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    const cleanQ = q.startsWith('@') ? q.slice(1) : q;
    const subcategories = getSubcategoriesForCategory(selectedCategory);

    let list = (otherUsers || []).filter((u) => (u.skillsWanted || []).length > 0);
    if (q.length > 0) {
      list = list.filter((u) => {
        const userMatch = matchUserSearch(u, q);
        const skillMatch = (u.skillsWanted || []).some((s) => {
          const sText = (typeof s === 'string' ? s : (s as any)?.title || '').toLowerCase();
          return sText.includes(q) || sText.includes(cleanQ);
        });
        const locationMatch = u.location?.toLowerCase().includes(q) ?? false;
        return userMatch || skillMatch || locationMatch;
      });
    }

    if (selectedCategory !== 'All') {
      list = list.filter((u) =>
        (u.skillsWanted || []).some((s) => {
          const sText = (typeof s === 'string' ? s : (s as any)?.title || '').trim();
          if (selectedSubcategory !== 'All') {
            return sText.toLowerCase().includes(selectedSubcategory.toLowerCase());
          }
          const isDirectCat = sText.toLowerCase() === selectedCategory.toLowerCase();
          const isParent = findCategoryForSubcategory(sText)?.toLowerCase() === selectedCategory.toLowerCase();
          const isSub = subcategories.some((sub) => sub.toLowerCase() === sText.toLowerCase());
          return isDirectCat || isParent || isSub;
        })
      );
    }

    if (filters.minRating > 0) {
      list = list.filter((u) => (u.rating ?? 0) >= filters.minRating);
    }
    switch (filters.sortBy) {
      case 'Rating':
        list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        break;
      case 'Swaps':
        list = [...list].sort((a, b) => (b.totalSwaps ?? 0) - (a.totalSwaps ?? 0));
        break;
      case 'Newest':
        list = [...list].sort((a, b) => new Date(b.joinedDate || 0).getTime() - new Date(a.joinedDate || 0).getTime());
        break;
      default:
        break;
    }
    return list;
  }, [filters.minRating, filters.sortBy, otherUsers, searchQuery, selectedCategory, selectedSubcategory, matchUserSearch]);

  // --- SWAPPERS: users who both teach and learn ---
  const filteredSwappers = useMemo<User[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    const cleanQ = q.startsWith('@') ? q.slice(1) : q;
    const subcategories = getSubcategoriesForCategory(selectedCategory);

    let list = (otherUsers || []).filter((u) => (u.skillsOffered || []).length > 0 && (u.skillsWanted || []).length > 0);
    if (q.length > 0) {
      list = list.filter((u) => {
        const userMatch = matchUserSearch(u, q);
        const teachMatch = (u.skillsOffered || []).some((s) => {
          const sText = (typeof s === 'string' ? s : s.title || '').toLowerCase();
          return sText.includes(q) || sText.includes(cleanQ);
        });
        const wantMatch = (u.skillsWanted || []).some((s) => {
          const sText = (typeof s === 'string' ? s : (s as any)?.title || '').toLowerCase();
          return sText.includes(q) || sText.includes(cleanQ);
        });
        const locationMatch = u.location?.toLowerCase().includes(q) ?? false;
        return userMatch || teachMatch || wantMatch || locationMatch;
      });
    }

    if (selectedCategory !== 'All') {
      list = list.filter((u) => {
        const hasOffer = (u.skillsOffered || []).some((s) => {
          const sCat = (s.category || '').trim();
          const sSubCat = (s.subCategory || (s as any).subcategory || '').trim();
          const sTitle = (s.title || '').trim();
          if (selectedSubcategory !== 'All') {
            const subQ = selectedSubcategory.toLowerCase();
            return sSubCat.toLowerCase() === subQ || sCat.toLowerCase() === subQ || sTitle.toLowerCase().includes(subQ);
          }
          return (
            sCat.toLowerCase() === selectedCategory.toLowerCase() ||
            findCategoryForSubcategory(sCat)?.toLowerCase() === selectedCategory.toLowerCase() ||
            findCategoryForSubcategory(sSubCat)?.toLowerCase() === selectedCategory.toLowerCase() ||
            subcategories.some((sub) => sub.toLowerCase() === sSubCat.toLowerCase() || sub.toLowerCase() === sCat.toLowerCase())
          );
        });

        const hasWant = (u.skillsWanted || []).some((s) => {
          const sText = (typeof s === 'string' ? s : (s as any)?.title || '').trim();
          if (selectedSubcategory !== 'All') {
            return sText.toLowerCase().includes(selectedSubcategory.toLowerCase());
          }
          return (
            sText.toLowerCase() === selectedCategory.toLowerCase() ||
            findCategoryForSubcategory(sText)?.toLowerCase() === selectedCategory.toLowerCase() ||
            subcategories.some((sub) => sub.toLowerCase() === sText.toLowerCase())
          );
        });

        return hasOffer || hasWant;
      });
    }

    if (filters.minRating > 0) {
      list = list.filter((u) => (u.rating ?? 0) >= filters.minRating);
    }
    switch (filters.sortBy) {
      case 'Rating':
        list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        break;
      case 'Swaps':
        list = [...list].sort((a, b) => (b.totalSwaps ?? 0) - (a.totalSwaps ?? 0));
        break;
      case 'Newest':
        list = [...list].sort((a, b) => new Date(b.joinedDate).getTime() - new Date(a.joinedDate).getTime());
        break;
      default:
        break;
    }
    return list;
  }, [filters.minRating, filters.sortBy, otherUsers, searchQuery, selectedCategory, selectedSubcategory, matchUserSearch]);

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] });
  const backdropOpacity = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const resultsCount =
    activeTab === 'teachers' ? filteredSkills.length
    : activeTab === 'learners' ? filteredLearners.length
    : filteredSwappers.length;

  const isMultiCol = numColumns > 1;

  const renderSkillCard = useCallback(({ item }: { item: SkillWithUser }) => {
    const rawRating = item.user?.rating;
    const ratingVal = typeof rawRating === 'number' ? rawRating.toFixed(1) : (rawRating ? Number(rawRating).toFixed(1) : '5.0');
    const swapsVal = item.user?.totalSwaps ?? 0;
    const exchangesText = `${swapsVal} ${swapsVal === 1 ? 'exchange' : 'exchanges'}`;

    return (
      <TouchableOpacity
        style={[
          styles.skillCard,
          isMultiCol && { width: cardWidth },
        ]}
        onPress={() => router.push(`/skill/${item.id}` as any)}
        activeOpacity={0.85}
      >
        <Image
          source={{ uri: resolveImageUrl(item.imageUrl, DEFAULT_SKILL_IMAGE) }}
          style={[
            styles.skillImage,
            numColumns >= 4 ? { height: 135 } : numColumns >= 3 ? { height: 150 } : numColumns >= 2 ? { height: 170 } : { height: 200 }
          ]}
        />
        <View style={[styles.skillContent, isMultiCol && styles.skillContentCompact]}>
          <View style={styles.skillHeader}>
            <Text style={[styles.categoryLabel, isMultiCol && styles.categoryLabelCompact]} numberOfLines={1} ellipsizeMode="tail">
              {item.category}
            </Text>
            <View style={styles.skillBadges}>
              {item.certificateStatus === 'approved' && (
                <View style={[styles.certifiedBadge, isMultiCol && styles.certifiedBadgeCompact]}>
                  <BadgeCheck size={isMultiCol ? 10 : 11} color="#10B981" />
                  <Text style={[styles.certifiedBadgeText, isMultiCol && styles.certifiedBadgeTextCompact]}>Certified</Text>
                </View>
              )}
              <View style={[styles.levelBadge, isMultiCol && styles.levelBadgeCompact]}>
                <Text style={[styles.levelText, isMultiCol && styles.levelTextCompact]}>{item.level}</Text>
              </View>
            </View>
          </View>
          <Text style={[styles.skillTitle, isMultiCol && styles.skillTitleCompact]} numberOfLines={2}>{item.title}</Text>
          <Text style={[styles.skillDescription, isMultiCol && styles.skillDescriptionCompact]} numberOfLines={2}>{item.description}</Text>
          <View style={styles.skillFooter}>
            <View style={[styles.userInfo, isMultiCol && styles.userInfoCompact]}>
              <Image source={{ uri: resolveImageUrl(item.user.avatarUrl, DEFAULT_AVATAR) }} style={[styles.userAvatar, isMultiCol && styles.userAvatarCompact]} />
              <View style={styles.userDetails}>
                <Text style={[styles.userName, isMultiCol && styles.userNameCompact]} numberOfLines={1}>
                  {item.user.username ? (item.user.username.startsWith('@') ? item.user.username : `@${item.user.username}`) : `@${item.user.name.toLowerCase().replace(/\s+/g, '')}`}
                </Text>
                <View style={styles.ratingRow}>
                  <Star size={isMultiCol ? 11 : 12} fill={Colors.light.accent} color={Colors.light.accent} />
                  <Text style={[styles.ratingText, isMultiCol && styles.ratingTextCompact]}>{ratingVal}</Text>
                  <Text style={[styles.swapsText, isMultiCol && styles.swapsTextCompact]} numberOfLines={1}>• {exchangesText}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [router, numColumns, cardWidth, isMultiCol]);

  const renderLearnerCard = useCallback(({ item }: { item: User }) => {
    const rawRating = item.rating;
    const ratingVal = typeof rawRating === 'number' ? rawRating.toFixed(1) : (rawRating ? Number(rawRating).toFixed(1) : '5.0');
    const swapsVal = item.totalSwaps ?? 0;
    const exchangesText = `${swapsVal} ${swapsVal === 1 ? 'exchange' : 'exchanges'} completed`;
    const maxChips = isMultiCol ? 3 : 6;
    const wants = item.skillsWanted || [];

    return (
      <TouchableOpacity
        style={[
          styles.personCard,
          isMultiCol ? styles.personCardGrid : styles.personCardRow,
          isMultiCol && { width: cardWidth },
        ]}
        onPress={() => router.push(`/profile/${item.id}` as any)}
        activeOpacity={0.85}
      >
        {isMultiCol ? (
          <View style={styles.personCardGridInner}>
            <View style={styles.personHeaderGrid}>
              <Image source={{ uri: resolveImageUrl(item.avatarUrl, DEFAULT_AVATAR) }} style={styles.personAvatarCompact} />
              <View style={styles.personInfoCompact}>
                <Text style={styles.personNameCompact} numberOfLines={1}>
                  {item.username ? (item.username.startsWith('@') ? item.username : `@${item.username}`) : `@${item.name.toLowerCase().replace(/\s+/g, '')}`}
                </Text>
                <View style={styles.personLocationRowCompact}>
                  <MapPin size={10} color={Colors.light.textTertiary} />
                  <Text style={styles.personLocationCompact} numberOfLines={1}>{item.location}</Text>
                </View>
              </View>
              <View style={styles.ratingPillCompact}>
                <Star size={10} fill={Colors.light.accent} color={Colors.light.accent} />
                <Text style={styles.ratingPillTextCompact}>{ratingVal}</Text>
              </View>
            </View>
            <View style={styles.personGridBody}>
              <Text style={styles.wantsLabelCompact}>Wants to learn</Text>
              <View style={styles.chipRowCompact}>
                {wants.slice(0, maxChips).map((s) => (
                  <View key={s} style={styles.wantChipCompact}>
                    <Text style={styles.wantChipTextCompact} numberOfLines={1} ellipsizeMode="tail">{s}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.personSwapsCompact} numberOfLines={1}>{exchangesText}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.personCardRowInner}>
            <View style={styles.personHeaderRow}>
              <Image source={{ uri: resolveImageUrl(item.avatarUrl, DEFAULT_AVATAR) }} style={styles.personAvatar} />
              <View style={styles.personInfoRow}>
                <View style={styles.personNameRatingRow}>
                  <Text style={styles.personName} numberOfLines={1}>
                    {item.username ? (item.username.startsWith('@') ? item.username : `@${item.username}`) : `@${item.name.toLowerCase().replace(/\s+/g, '')}`}
                  </Text>
                  <View style={styles.ratingPill}>
                    <Star size={11} fill={Colors.light.accent} color={Colors.light.accent} />
                    <Text style={styles.ratingPillText}>{ratingVal}</Text>
                  </View>
                </View>
                <View style={styles.personLocationRow}>
                  <MapPin size={12} color={Colors.light.textTertiary} />
                  <Text style={styles.personLocation} numberOfLines={1}>{item.location}</Text>
                </View>
              </View>
            </View>

            <View style={styles.swapGroupFull}>
              <Text style={styles.swapLabel}>Wants to learn</Text>
              <View style={styles.chipRow}>
                {wants.slice(0, maxChips).map((s) => (
                  <View key={s} style={styles.wantChip}>
                    <Text style={styles.wantChipText} numberOfLines={1} ellipsizeMode="tail">{s}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Text style={styles.personSwaps}>{exchangesText}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [router, numColumns, cardWidth, isMultiCol]);

  const renderSwapperCard = useCallback(({ item }: { item: User }) => {
    const rawRating = item.rating;
    const ratingVal = typeof rawRating === 'number' ? rawRating.toFixed(1) : (rawRating ? Number(rawRating).toFixed(1) : '5.0');
    const swapsVal = item.totalSwaps ?? 0;
    const exchangesText = `${swapsVal} ${swapsVal === 1 ? 'exchange' : 'exchanges'} completed`;
    const offers = item.skillsOffered || [];
    const wants = item.skillsWanted || [];

    return (
      <TouchableOpacity
        style={[
          styles.personCard,
          isMultiCol ? styles.personCardGrid : styles.personCardRow,
          isMultiCol && { width: cardWidth },
        ]}
        onPress={() => router.push(`/profile/${item.id}` as any)}
        activeOpacity={0.85}
      >
        {isMultiCol ? (
          <View style={styles.personCardGridInner}>
            <View style={styles.personHeaderGrid}>
              <Image source={{ uri: resolveImageUrl(item.avatarUrl, DEFAULT_AVATAR) }} style={styles.personAvatarCompact} />
              <View style={styles.personInfoCompact}>
                <Text style={styles.personNameCompact} numberOfLines={1}>
                  {item.username ? (item.username.startsWith('@') ? item.username : `@${item.username}`) : `@${item.name.toLowerCase().replace(/\s+/g, '')}`}
                </Text>
                <View style={styles.personLocationRowCompact}>
                  <MapPin size={10} color={Colors.light.textTertiary} />
                  <Text style={styles.personLocationCompact} numberOfLines={1}>{item.location}</Text>
                </View>
              </View>
              <View style={styles.ratingPillCompact}>
                <Star size={10} fill={Colors.light.accent} color={Colors.light.accent} />
                <Text style={styles.ratingPillTextCompact}>{ratingVal}</Text>
              </View>
            </View>

            <View style={styles.personGridBody}>
              <View style={styles.swapSectionVertical}>
                <View style={styles.swapHalfVertical}>
                  <Text style={styles.swapHalfLabelCompact}>Teaches</Text>
                  <View style={styles.chipRowCompact}>
                    {offers.slice(0, 2).map((s, idx) => {
                      const title = typeof s === 'string' ? s : s.title || String(s);
                      const key = typeof s === 'string' ? s : (s.id || s._id || `teach-${idx}`);
                      return (
                        <View key={key} style={styles.teachChipCompact}>
                          <Text style={styles.teachChipTextCompact} numberOfLines={1} ellipsizeMode="tail">{title}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
                <View style={styles.swapHalfVertical}>
                  <Text style={styles.swapHalfLabelCompact}>Learns</Text>
                  <View style={styles.chipRowCompact}>
                    {wants.slice(0, 2).map((s, idx) => {
                      const text = typeof s === 'string' ? s : String(s);
                      return (
                        <View key={`want-${idx}-${text}`} style={styles.wantChipCompact}>
                          <Text style={styles.wantChipTextCompact} numberOfLines={1} ellipsizeMode="tail">{text}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>
              <Text style={styles.personSwapsCompact} numberOfLines={1}>{exchangesText}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.personCardRowInner}>
            <View style={styles.personHeaderRow}>
              <Image source={{ uri: resolveImageUrl(item.avatarUrl, DEFAULT_AVATAR) }} style={styles.personAvatar} />
              <View style={styles.personInfoRow}>
                <View style={styles.personNameRatingRow}>
                  <Text style={styles.personName} numberOfLines={1}>{item.username ? (item.username.startsWith('@') ? item.username : `@${item.username}`) : `@${item.name.toLowerCase().replace(/\s+/g, '')}`}</Text>
                  <View style={styles.ratingPill}>
                    <Star size={11} fill={Colors.light.accent} color={Colors.light.accent} />
                    <Text style={styles.ratingPillText}>{ratingVal}</Text>
                  </View>
                </View>
                <View style={styles.personLocationRow}>
                  <MapPin size={12} color={Colors.light.textTertiary} />
                  <Text style={styles.personLocation} numberOfLines={1}>{item.location}</Text>
                </View>
              </View>
            </View>

            <View style={styles.swapSectionFull}>
              <View style={styles.swapGroupFull}>
                <Text style={styles.swapLabel}>Teaches</Text>
                <View style={styles.chipRow}>
                  {offers.slice(0, 3).map((s, idx) => {
                    const title = typeof s === 'string' ? s : s.title || String(s);
                    const key = typeof s === 'string' ? s : (s.id || s._id || `teach-${idx}`);
                    return (
                      <View key={key} style={styles.teachChip}>
                        <Text style={styles.teachChipText} numberOfLines={1} ellipsizeMode="tail">{title}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              <View style={styles.swapGroupFull}>
                <Text style={styles.swapLabel}>Learns</Text>
                <View style={styles.chipRow}>
                  {wants.slice(0, 3).map((s, idx) => {
                    const text = typeof s === 'string' ? s : String(s);
                    return (
                      <View key={`want-${idx}-${text}`} style={styles.wantChip}>
                        <Text style={styles.wantChipText} numberOfLines={1} ellipsizeMode="tail">{text}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>

            <Text style={styles.personSwaps}>{exchangesText}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [router, numColumns, cardWidth, isMultiCol]);

  return (
    <View style={styles.container}>
      <View style={[styles.searchSection, { paddingTop: Math.max(insets.top + 16, 20) }]}>
        <View style={styles.searchBar} testID="search-bar">
          <Search size={20} color={Colors.light.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search skills or people..."
            placeholderTextColor={Colors.light.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            accessibilityLabel="Search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} accessibilityRole="button" testID="clear-search">
              <X size={18} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.filterButton} onPress={toggleFilters} accessibilityRole="button" testID="toggle-filters">
          <SlidersHorizontal size={20} color={Colors.light.text} />
        </TouchableOpacity>
      </View>

      {/* Role tabs */}
      <View style={styles.roleTabsRow}>
        {ROLE_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.roleTab, isActive && styles.roleTabActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Icon size={16} color={isActive ? '#FFFFFF' : Colors.light.textSecondary} />
              <Text style={[styles.roleTabText, isActive && styles.roleTabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Main Category Horizontal Bar */}
      <View style={styles.exploreCategoriesBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.exploreCategoriesScroll}
        >
          {['All', ...MAIN_CATEGORIES].map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.exploreCategoryChip,
                selectedCategory === category && styles.exploreCategoryChipActive,
              ]}
              onPress={() => {
                setSelectedCategory(category);
                setSelectedSubcategory('All');
              }}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.exploreCategoryText,
                  selectedCategory === category && styles.exploreCategoryTextActive,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {selectedCategory !== 'All' && getSubcategoriesForCategory(selectedCategory).length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.exploreSubcategoriesScroll}
          >
            <TouchableOpacity
              style={[
                styles.exploreSubcategoryChip,
                selectedSubcategory === 'All' && styles.exploreSubcategoryChipActive,
              ]}
              onPress={() => setSelectedSubcategory('All')}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.exploreSubcategoryText,
                  selectedSubcategory === 'All' && styles.exploreSubcategoryTextActive,
                ]}
              >
                All {selectedCategory}
              </Text>
            </TouchableOpacity>
            {getSubcategoriesForCategory(selectedCategory).map((sub) => (
              <TouchableOpacity
                key={sub}
                style={[
                  styles.exploreSubcategoryChip,
                  selectedSubcategory === sub && styles.exploreSubcategoryChipActive,
                ]}
                onPress={() => setSelectedSubcategory(sub)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.exploreSubcategoryText,
                    selectedSubcategory === sub && styles.exploreSubcategoryTextActive,
                  ]}
                >
                  {sub}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {isFilterOpen && (
        <Pressable style={styles.backdrop} onPress={toggleFilters} testID="filters-backdrop">
          <Animated.View style={[styles.filtersCard, { transform: [{ translateY }], opacity: backdropOpacity, marginTop: insets.top > 0 ? insets.top + 8 : 16 }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.filtersHeader}>
              <Text style={styles.filtersTitle}>Filters</Text>
              <TouchableOpacity onPress={toggleFilters} accessibilityRole="button" testID="close-filters">
                <X size={22} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.filtersScroll}
              contentContainerStyle={styles.filtersScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.filterGroup}>
                <Text style={styles.groupLabel}>Category</Text>
                <View style={styles.rowChips}>
                  {['All', ...MAIN_CATEGORIES].map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.pill, selectedCategory === cat && styles.pillActive]}
                      onPress={() => {
                        setSelectedCategory(cat);
                        setSelectedSubcategory('All');
                      }}
                      testID={`category-${cat}`}
                    >
                      <Text style={[styles.pillText, selectedCategory === cat && styles.pillTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {selectedCategory !== 'All' && getSubcategoriesForCategory(selectedCategory).length > 0 && (
                <View style={styles.filterGroup}>
                  <Text style={styles.groupLabel}>Subcategory ({selectedCategory})</Text>
                  <View style={styles.rowChips}>
                    <TouchableOpacity
                      style={[styles.pill, selectedSubcategory === 'All' && styles.pillActive]}
                      onPress={() => setSelectedSubcategory('All')}
                    >
                      <Text style={[styles.pillText, selectedSubcategory === 'All' && styles.pillTextActive]}>
                        All {selectedCategory}
                      </Text>
                    </TouchableOpacity>
                    {getSubcategoriesForCategory(selectedCategory).map((sub) => (
                      <TouchableOpacity
                        key={sub}
                        style={[styles.pill, selectedSubcategory === sub && styles.pillActive]}
                        onPress={() => setSelectedSubcategory(sub)}
                      >
                        <Text style={[styles.pillText, selectedSubcategory === sub && styles.pillTextActive]}>
                          {sub}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {activeTab === 'teachers' && (
                <View style={styles.filterGroup}>
                  <Text style={styles.groupLabel}>Level</Text>
                  <View style={styles.rowChips}>
                    {LEVEL_OPTIONS.map((lvl) => (
                      <TouchableOpacity
                        key={lvl}
                        style={[styles.pill, filters.level === lvl && styles.pillActive]}
                        onPress={() => setFilters((f) => ({ ...f, level: lvl }))}
                        testID={`level-${lvl}`}
                      >
                        <Text style={[styles.pillText, filters.level === lvl && styles.pillTextActive]}>{lvl}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.filterGroup}>
                <Text style={styles.groupLabel}>Minimum rating</Text>
                <View style={styles.rowChips}>
                  {RATING_OPTIONS.map((r) => (
                    <TouchableOpacity
                      key={String(r.value)}
                      style={[styles.pill, filters.minRating === r.value && styles.pillActive]}
                      onPress={() => setFilters((f) => ({ ...f, minRating: r.value }))}
                      testID={`rating-${r.value}`}
                    >
                      <Text style={[styles.pillText, filters.minRating === r.value && styles.pillTextActive]}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.groupLabel}>Sort by</Text>
                <View style={styles.rowChips}>
                  {SORT_OPTIONS.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.pill, filters.sortBy === s && styles.pillActive]}
                      onPress={() => setFilters((f) => ({ ...f, sortBy: s }))}
                      testID={`sort-${s}`}
                    >
                      <Text style={[styles.pillText, filters.sortBy === s && styles.pillTextActive]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.linkButton} onPress={clearAll} testID="clear-all">
                <Text style={styles.linkButtonText}>Reset All</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyButton} onPress={toggleFilters} testID="apply-filters">
                <Text style={styles.applyButtonText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Pressable>
      )}

      <View style={styles.resultsHeader}>
        <Text style={styles.resultsText} testID="results-count">
          {resultsCount} {resultsCount === 1 ? 'result' : 'results'}
        </Text>
      </View>

      {activeTab === 'teachers' && (
        <FlatList
          key={`explore-teachers-${numColumns}`}
          numColumns={numColumns}
          columnWrapperStyle={numColumns > 1 ? { gap: 16, marginBottom: 16 } : undefined}
          data={filteredSkills}
          keyExtractor={(item) => item.id}
          renderItem={renderSkillCard}
          ItemSeparatorComponent={numColumns === 1 ? () => <View style={{ height: 16 }} /> : undefined}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<EmptyState text="No teachers match your filters." />}
        />
      )}

      {activeTab === 'learners' && (
        <FlatList
          key={`explore-learners-${numColumns}`}
          numColumns={numColumns}
          columnWrapperStyle={numColumns > 1 ? { gap: 16, marginBottom: 16 } : undefined}
          data={filteredLearners}
          keyExtractor={(item) => item.id}
          renderItem={renderLearnerCard}
          ItemSeparatorComponent={numColumns === 1 ? () => <View style={{ height: 16 }} /> : undefined}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<EmptyState text="No learners match your filters." />}
        />
      )}

      {activeTab === 'swappers' && (
        <FlatList
          key={`explore-swappers-${numColumns}`}
          numColumns={numColumns}
          columnWrapperStyle={numColumns > 1 ? { gap: 16, marginBottom: 16 } : undefined}
          data={filteredSwappers}
          keyExtractor={(item) => item.id}
          renderItem={renderSwapperCard}
          ItemSeparatorComponent={numColumns === 1 ? () => <View style={{ height: 16 }} /> : undefined}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<EmptyState text="No swappers match your filters." />}
        />
      )}
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  searchSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundTertiary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
  },
  filterButton: {
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    borderRadius: 16,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  roleTabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
  },
  roleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: Colors.light.backgroundTertiary,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  roleTabActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  roleTabText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
  },
  roleTabTextActive: {
    color: '#FFFFFF',
  },
  exploreCategoriesBar: {
    backgroundColor: Colors.light.background,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
  },
  exploreCategoriesScroll: {
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  exploreCategoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: Colors.light.backgroundTertiary,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  exploreCategoryChipActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  exploreCategoryText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  exploreCategoryTextActive: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
  },
  exploreSubcategoriesScroll: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 2,
  },
  exploreSubcategoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  exploreSubcategoryChipActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  exploreSubcategoryText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#4F46E5',
  },
  exploreSubcategoryTextActive: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    zIndex: 10,
    justifyContent: 'flex-start',
  },
  filtersCard: {
    marginTop: 8,
    marginHorizontal: 16,
    maxHeight: '80%',
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    padding: 20,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  filtersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  filtersScroll: {
    flexShrink: 1,
  },
  filtersScrollContent: {
    paddingBottom: 8,
  },
  filtersTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  filterGroup: {
    marginBottom: 18,
  },
  groupLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginBottom: 10,
  },
  rowChips: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: Colors.light.backgroundTertiary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  pillActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  pillText: {
    fontSize: 13.5,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  actionsRow: {
    marginTop: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  linkButton: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  linkButtonText: {
    color: Colors.light.primary,
    fontWeight: '700' as const,
    fontSize: 15,
  },
  applyButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: Colors.light.primary,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
    fontSize: 16,
  },
  resultsHeader: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  resultsText: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    fontWeight: '600' as const,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  // Skill card (teachers)
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
  skillContentCompact: {
    padding: 12,
  },
  skillHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  categoryLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  categoryLabelCompact: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  skillBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  levelBadge: {
    backgroundColor: Colors.light.backgroundTertiary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  levelBadgeCompact: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  levelText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.primary,
  },
  levelTextCompact: {
    fontSize: 10,
  },
  certifiedBadge: {
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
  certifiedBadgeCompact: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    gap: 3,
  },
  certifiedBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#059669',
  },
  certifiedBadgeTextCompact: {
    fontSize: 9,
  },
  skillTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 6,
    lineHeight: 24,
  },
  skillTitleCompact: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
  },
  skillDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.light.textSecondary,
    marginBottom: 12,
  },
  skillDescriptionCompact: {
    fontSize: 12.5,
    lineHeight: 17,
    marginBottom: 8,
  },
  skillFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  userInfoCompact: {
    gap: 8,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  userAvatarCompact: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
  },
  userDetails: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  userNameCompact: {
    fontSize: 13,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap' as const,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  ratingTextCompact: {
    fontSize: 11.5,
  },
  swapsText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  swapsTextCompact: {
    fontSize: 11.5,
  },
  // Person card base & responsive containers (learners + swappers)
  personCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  personCardRow: {
    padding: 16,
  },
  personCardRowInner: {
    width: '100%',
    gap: 12,
  },
  personHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  personAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  personInfoRow: {
    flex: 1,
    gap: 4,
  },
  personNameRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  personName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
    flex: 1,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    flexShrink: 0,
  },
  ratingPillText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.light.accent,
  },
  personLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  personLocation: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    fontWeight: '500' as const,
    flex: 1,
  },
  swapSectionFull: {
    width: '100%',
    gap: 10,
  },
  swapGroupFull: {
    width: '100%',
    gap: 6,
  },
  swapLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  wantChip: {
    backgroundColor: 'rgba(99, 102, 241, 0.10)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.20)',
    maxWidth: '100%',
  },
  wantChipText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#6366F1',
    flexShrink: 1,
  },
  teachChip: {
    backgroundColor: 'rgba(16, 185, 129, 0.10)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.20)',
    maxWidth: '100%',
  },
  teachChipText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#10B981',
    flexShrink: 1,
  },
  personSwaps: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    fontWeight: '500' as const,
  },
  // Multi-column grid styles
  personCardGrid: {
    padding: 12,
  },
  personCardGridInner: {
    width: '100%',
    gap: 10,
  },
  personHeaderGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  personAvatarCompact: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
  },
  personInfoCompact: {
    flex: 1,
    gap: 2,
  },
  personNameCompact: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  personLocationRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  personLocationCompact: {
    fontSize: 11,
    color: Colors.light.textTertiary,
    fontWeight: '500' as const,
    flex: 1,
  },
  ratingPillCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    flexShrink: 0,
  },
  ratingPillTextCompact: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.accent,
  },
  personGridBody: {
    width: '100%',
    gap: 8,
  },
  wantsLabelCompact: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  chipRowCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 5,
  },
  wantChipCompact: {
    backgroundColor: 'rgba(99, 102, 241, 0.10)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.20)',
    maxWidth: '100%',
  },
  wantChipTextCompact: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#6366F1',
    flexShrink: 1,
  },
  teachChipCompact: {
    backgroundColor: 'rgba(16, 185, 129, 0.10)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.20)',
    maxWidth: '100%',
  },
  teachChipTextCompact: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#10B981',
    flexShrink: 1,
  },
  swapSectionVertical: {
    gap: 8,
  },
  swapHalfVertical: {
    width: '100%',
    gap: 4,
  },
  swapHalfLabelCompact: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  personSwapsCompact: {
    fontSize: 11,
    color: Colors.light.textTertiary,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  emptyWrap: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: Colors.light.textTertiary,
    fontWeight: '500' as const,
  },
});

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, Search, SlidersHorizontal, Star, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { getSkillsWithUsers, categories } from '@/mocks/data';
import type { SkillLevel, SkillWithUser } from '@/types';
import { resolveImageUrl } from '@/lib/resolveImageUrl';

type SortBy = 'Relevance' | 'Rating' | 'Swaps' | 'Newest';

interface FiltersState {
  level: SkillLevel | 'Any';
  minRating: 0 | 4 | 4.5 | 4.8 | 5;
  sortBy: SortBy;
}

const LEVEL_OPTIONS: (SkillLevel | 'Any')[] = ['Any', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];
const RATING_OPTIONS: FiltersState['minRating'][] = [0, 4, 4.5, 4.8, 5];
const SORT_OPTIONS: SortBy[] = ['Relevance', 'Rating', 'Swaps', 'Newest'];

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [filters, setFilters] = useState<FiltersState>({ level: 'Any', minRating: 0, sortBy: 'Relevance' });
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [skillsWithUsers, setSkillsWithUsers] = useState<SkillWithUser[]>([]);
  const [isSkillsLoading, setIsSkillsLoading] = useState(true);

  useEffect(() => {
    async function getskill() {
      try {
        setIsSkillsLoading(true);
        const any = await getSkillsWithUsers();
        setSkillsWithUsers(any);
      } catch (err) {
        console.error('[Explore] Failed to fetch skills:', err);
      } finally {
        setIsSkillsLoading(false);
      }
    }
    getskill()
  }, [])

  // const skillsWithUsers = getSkillsWithUsers();

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
    setSearchQuery('');
  }, []);

  const filteredSkills = useMemo<SkillWithUser[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = skillsWithUsers.filter((skill) => {
      const matchesSearch = q.length === 0
        ? true
        : skill.title.toLowerCase().includes(q) || skill.description.toLowerCase().includes(q) || skill.user.name.toLowerCase().includes(q);
      const matchesCategory = selectedCategory === 'All' || skill.category === (selectedCategory as any);
      const matchesLevel = filters.level === 'Any' || skill.level === filters.level;
      const matchesRating = (skill.user.rating ?? 0) >= filters.minRating;
      return matchesSearch && matchesCategory && matchesLevel && matchesRating;
    });

    switch (filters.sortBy) {
      case 'Rating':
        list = [...list].sort((a, b) => (b.user.rating ?? 0) - (a.user.rating ?? 0));
        break;
      case 'Swaps':
        list = [...list].sort((a, b) => (b.user.totalSwaps ?? 0) - (a.user.totalSwaps ?? 0));
        break;
      case 'Newest':
        list = [...list].sort((a, b) => new Date(b.user.joinedDate).getTime() - new Date(a.user.joinedDate).getTime());
        break;
      case 'Relevance':
      default:
        break;
    }

    return list;
  }, [filters.level, filters.minRating, filters.sortBy, searchQuery, selectedCategory, skillsWithUsers]);

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] });
  const backdropOpacity = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  if (isSkillsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.searchSection, { paddingTop: insets.top + 8 }]}>
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


      {isFilterOpen && (
        <Pressable style={styles.backdrop} onPress={toggleFilters} testID="filters-backdrop">
          <Animated.View style={[styles.filtersCard, { transform: [{ translateY }], opacity: backdropOpacity }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.filtersHeader}>
              <Text style={styles.filtersTitle}>Filters</Text>
              <TouchableOpacity onPress={toggleFilters} accessibilityRole="button" testID="close-filters">
                <X size={22} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.filterGroup}>
              <Text style={styles.groupLabel}>Category</Text>
              <View style={styles.rowChips}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.pill, selectedCategory === cat && styles.pillActive]}
                    onPress={() => setSelectedCategory(cat)}
                    testID={`category-${cat}`}
                  >
                    <Text style={[styles.pillText, selectedCategory === cat && styles.pillTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

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

            <View style={styles.filterGroup}>
              <Text style={styles.groupLabel}>Minimum rating</Text>
              <View style={styles.rowChips}>
                {RATING_OPTIONS.map((r) => (
                  <TouchableOpacity
                    key={String(r)}
                    style={[styles.pill, filters.minRating === r && styles.pillActive]}
                    onPress={() => setFilters((f) => ({ ...f, minRating: r }))}
                    testID={`rating-${r}`}
                  >
                    <Text style={[styles.pillText, filters.minRating === r && styles.pillTextActive]}>
                      {r === 0 ? 'Any' : `${r}+`}
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

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsText} testID="results-count">
            {filteredSkills.length} {filteredSkills.length === 1 ? 'skill' : 'skills'} found
          </Text>
        </View>

        <View style={styles.skillsList}>
          {filteredSkills.map((skill) => (
            <TouchableOpacity
              key={skill._id || skill.id}
              style={styles.skillCard}
              onPress={() => router.push(`/skill/${skill._id || skill.id}` as any)}
              testID={`skill-${skill._id || skill.id}`}
            >
              {skill.imageUrl ? (
                <Image source={{ uri: resolveImageUrl(skill.imageUrl) }} style={styles.skillImage} />
              ) : (
                <View style={[styles.skillImage, { backgroundColor: Colors.light.backgroundTertiary }]} />
              )}
              <View style={styles.skillContent}>
                <View style={styles.skillHeader}>
                  <Text style={styles.categoryLabel}>{skill.category}</Text>
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelText}>{skill.level}</Text>
                  </View>
                </View>
                <Text style={styles.skillTitle} numberOfLines={2}>
                  {skill.title}
                </Text>
                <Text style={styles.skillDescription} numberOfLines={2}>
                  {skill.description}
                </Text>
                <View style={styles.skillFooter}>
                  <View style={styles.userInfo}>
                    <Image source={{ uri: resolveImageUrl(skill.user.avatarUrl, 'https://i.pravatar.cc/150?img=5') }} style={styles.userAvatar} />
                    <View style={styles.userDetails}>
                      <Text style={styles.userName} numberOfLines={1}>
                        {skill.user.username ? `@${skill.user.username}` : skill.user.name}
                      </Text>
                      <View style={styles.ratingRow}>
                        <Star size={12} fill={Colors.light.accent} color={Colors.light.accent} />
                        <Text style={styles.ratingText}>{skill.user.rating}</Text>
                        <Text style={styles.swapsText}>• {skill.user.totalSwaps} swaps</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
    paddingBottom: 16,
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

  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    zIndex: 10,
    justifyContent: 'flex-start',
  },
  filtersCard: {
    marginTop: 8,
    marginHorizontal: 16,
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
    marginBottom: 20,
  },
  filtersTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  filterGroup: {
    marginBottom: 20,
  },
  groupLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginBottom: 12,
  },
  rowChips: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  actionsRow: {
    marginTop: 8,
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
  scrollView: {
    flex: 1,
  },
  resultsHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  resultsText: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    fontWeight: '600' as const,
  },
  skillsList: {
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
    marginBottom: 10,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  levelBadge: {
    backgroundColor: Colors.light.backgroundTertiary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  levelText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.primary,
  },
  skillTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 8,
    lineHeight: 24,
  },
  skillDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.light.textSecondary,
    marginBottom: 14,
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
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  userDetails: {
    flex: 1,
    gap: 4,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  swapsText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  bottomSpacer: {
    height: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundSecondary,
  },
});

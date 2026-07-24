import { useCallback, useMemo, useRef, useState } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
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
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { getSkillsWithUsers, mockUsers, categories } from '@/mocks/data';
import type { SkillLevel, SkillWithUser, User } from '@/types';

type SortBy = 'Relevance' | 'Rating' | 'Swaps' | 'Newest';
type RoleTab = 'teachers' | 'learners' | 'swappers';

interface FiltersState {
  level: SkillLevel | 'Any';
  minRating: 0 | 4 | 4.5 | 4.8 | 5;
  sortBy: SortBy;
}

const LEVEL_OPTIONS: (SkillLevel | 'Any')[] = ['Any', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];
const RATING_OPTIONS: FiltersState['minRating'][] = [0, 4, 4.5, 4.8, 5];
const SORT_OPTIONS: SortBy[] = ['Relevance', 'Rating', 'Swaps', 'Newest'];

const ROLE_TABS: { key: RoleTab; label: string; icon: typeof GraduationCap }[] = [
  { key: 'teachers', label: 'Teachers', icon: GraduationCap },
  { key: 'learners', label: 'Learners', icon: BookOpen },
  { key: 'swappers', label: 'Swappers', icon: ArrowLeftRight },
];

export default function ExploreScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<RoleTab>('teachers');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [filters, setFilters] = useState<FiltersState>({ level: 'Any', minRating: 0, sortBy: 'Relevance' });
  const slideAnim = useRef(new Animated.Value(0)).current;

  const skillsWithUsers = getSkillsWithUsers();
  const otherUsers = mockUsers.slice(1);

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

  // --- TEACHERS: skills offered ---
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

  // --- LEARNERS: users wanting skills ---
  const filteredLearners = useMemo<User[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = otherUsers.filter((u) => u.skillsWanted.length > 0);
    if (q.length > 0) {
      list = list.filter((u) =>
        u.name.toLowerCase().includes(q) ||
        u.skillsWanted.some((s) => s.toLowerCase().includes(q)) ||
        u.location.toLowerCase().includes(q)
      );
    }
    if (selectedCategory !== 'All') {
      list = list.filter((u) => u.skillsWanted.some((s) => s === selectedCategory));
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
  }, [filters.minRating, filters.sortBy, otherUsers, searchQuery, selectedCategory]);

  // --- SWAPPERS: users who both teach and learn ---
  const filteredSwappers = useMemo<User[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = otherUsers.filter((u) => u.skillsOffered.length > 0 && u.skillsWanted.length > 0);
    if (q.length > 0) {
      list = list.filter((u) =>
        u.name.toLowerCase().includes(q) ||
        u.skillsOffered.some((s) => s.title.toLowerCase().includes(q)) ||
        u.skillsWanted.some((s) => s.toLowerCase().includes(q)) ||
        u.location.toLowerCase().includes(q)
      );
    }
    if (selectedCategory !== 'All') {
      list = list.filter((u) =>
        u.skillsOffered.some((s) => s.category === selectedCategory) ||
        u.skillsWanted.some((s) => s === selectedCategory)
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
        list = [...list].sort((a, b) => new Date(b.joinedDate).getTime() - new Date(a.joinedDate).getTime());
        break;
      default:
        break;
    }
    return list;
  }, [filters.minRating, filters.sortBy, otherUsers, searchQuery, selectedCategory]);

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] });
  const backdropOpacity = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const resultsCount =
    activeTab === 'teachers' ? filteredSkills.length
    : activeTab === 'learners' ? filteredLearners.length
    : filteredSwappers.length;

  const renderSkillCard = useCallback(({ item }: { item: SkillWithUser }) => (
    <TouchableOpacity
      style={styles.skillCard}
      onPress={() => router.push(`/skill/${item.id}` as any)}
      activeOpacity={0.85}
    >
      <Image source={{ uri: item.imageUrl }} style={styles.skillImage} />
      <View style={styles.skillContent}>
        <View style={styles.skillHeader}>
          <Text style={styles.categoryLabel}>{item.category}</Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>{item.level}</Text>
          </View>
        </View>
        <Text style={styles.skillTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.skillDescription} numberOfLines={2}>{item.description}</Text>
        <View style={styles.skillFooter}>
          <View style={styles.userInfo}>
            <Image source={{ uri: item.user.avatarUrl }} style={styles.userAvatar} />
            <View style={styles.userDetails}>
              <Text style={styles.userName} numberOfLines={1}>{item.user.name}</Text>
              <View style={styles.ratingRow}>
                <Star size={12} fill={Colors.light.accent} color={Colors.light.accent} />
                <Text style={styles.ratingText}>{item.user.rating}</Text>
                <Text style={styles.swapsText}>• {item.user.totalSwaps} swaps</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  ), [router]);

  const renderLearnerCard = useCallback(({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.personCard}
      onPress={() => router.push(`/profile/${item.id}` as any)}
      activeOpacity={0.85}
    >
      <Image source={{ uri: item.avatarUrl }} style={styles.personAvatar} />
      <View style={styles.personContent}>
        <View style={styles.personHeader}>
          <Text style={styles.personName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.ratingPill}>
            <Star size={11} fill={Colors.light.accent} color={Colors.light.accent} />
            <Text style={styles.ratingPillText}>{item.rating}</Text>
          </View>
        </View>
        <View style={styles.personLocationRow}>
          <MapPin size={12} color={Colors.light.textTertiary} />
          <Text style={styles.personLocation} numberOfLines={1}>{item.location}</Text>
        </View>
        <Text style={styles.wantsLabel}>Wants to learn</Text>
        <View style={styles.chipRow}>
          {item.skillsWanted.slice(0, 4).map((s) => (
            <View key={s} style={styles.wantChip}>
              <Text style={styles.wantChipText}>{s}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.personSwaps}>{item.totalSwaps} swaps completed</Text>
      </View>
    </TouchableOpacity>
  ), [router]);

  const renderSwapperCard = useCallback(({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.personCard}
      onPress={() => router.push(`/profile/${item.id}` as any)}
      activeOpacity={0.85}
    >
      <Image source={{ uri: item.avatarUrl }} style={styles.personAvatar} />
      <View style={styles.personContent}>
        <View style={styles.personHeader}>
          <Text style={styles.personName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.ratingPill}>
            <Star size={11} fill={Colors.light.accent} color={Colors.light.accent} />
            <Text style={styles.ratingPillText}>{item.rating}</Text>
          </View>
        </View>
        <View style={styles.personLocationRow}>
          <MapPin size={12} color={Colors.light.textTertiary} />
          <Text style={styles.personLocation} numberOfLines={1}>{item.location}</Text>
        </View>
        <View style={styles.swapSection}>
          <View style={styles.swapHalf}>
            <Text style={styles.swapHalfLabel}>Teaches</Text>
            <View style={styles.chipRow}>
              {item.skillsOffered.slice(0, 2).map((s) => (
                <View key={s.id} style={styles.teachChip}>
                  <Text style={styles.teachChipText} numberOfLines={1}>{s.title}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.swapDivider} />
          <View style={styles.swapHalf}>
            <Text style={styles.swapHalfLabel}>Learns</Text>
            <View style={styles.chipRow}>
              {item.skillsWanted.slice(0, 2).map((s) => (
                <View key={s} style={styles.wantChip}>
                  <Text style={styles.wantChipText}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
        <Text style={styles.personSwaps}>{item.totalSwaps} swaps completed</Text>
      </View>
    </TouchableOpacity>
  ), [router]);

  return (
    <View style={styles.container}>
      <View style={styles.searchSection}>
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

      <View style={styles.resultsHeader}>
        <Text style={styles.resultsText} testID="results-count">
          {resultsCount} {resultsCount === 1 ? 'result' : 'results'}
        </Text>
      </View>

      {activeTab === 'teachers' && (
        <FlatList
          data={filteredSkills}
          keyExtractor={(item) => item.id}
          renderItem={renderSkillCard}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState text="No teachers match your filters." />}
        />
      )}

      {activeTab === 'learners' && (
        <FlatList
          data={filteredLearners}
          keyExtractor={(item) => item.id}
          renderItem={renderLearnerCard}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState text="No learners match your filters." />}
        />
      )}

      {activeTab === 'swappers' && (
        <FlatList
          data={filteredSwappers}
          keyExtractor={(item) => item.id}
          renderItem={renderSwapperCard}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
  backdrop: {
    ...StyleSheet.absoluteFillObject,
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
  // Person card (learners + swappers)
  personCard: {
    flexDirection: 'row',
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    padding: 16,
    gap: 14,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  personAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  personContent: {
    flex: 1,
  },
  personHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  personName: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.light.text,
    flex: 1,
    marginRight: 8,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
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
    marginBottom: 10,
  },
  personLocation: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    fontWeight: '500' as const,
  },
  wantsLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 6,
    marginBottom: 10,
  },
  wantChip: {
    backgroundColor: 'rgba(99, 102, 241, 0.10)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.20)',
  },
  wantChipText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#6366F1',
  },
  teachChip: {
    backgroundColor: 'rgba(16, 185, 129, 0.10)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.20)',
    maxWidth: 140,
  },
  teachChipText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#10B981',
  },
  swapSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  swapHalf: {
    flex: 1,
  },
  swapDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: Colors.light.borderLight,
  },
  swapHalfLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  personSwaps: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    fontWeight: '500' as const,
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

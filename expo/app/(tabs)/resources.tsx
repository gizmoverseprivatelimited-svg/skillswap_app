import { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  ImageBackground,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookmarkPlus, Check, ExternalLink, Flame, Layers, Plus, Sparkles, Tag, UploadCloud } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { categories } from '@/mocks/data';
import type { ResourceMeta, ResourceType, SkillCategory, SkillLevel } from '@/types';
import { useResources, type ResourceDraft } from '@/providers/resources';
import { useCurrentUser } from '@/providers/current-user';

const RESOURCE_TYPES: ResourceType[] = ['Article', 'Video', 'Document', 'Collection'];
const DIFFICULTY_OPTIONS: (SkillLevel | 'All Levels')[] = ['All Levels', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];
const resourceCategories = categories.filter((c) => c !== 'All');

const EMPTY_DRAFT: ResourceDraft = {
  title: '', description: '', url: '', type: 'Article', coverImageUrl: '',
  categories: [], difficulty: 'All Levels', durationMinutes: undefined, formatBadge: undefined, tags: [],
};

type ActiveTypeFilter = ResourceType | 'All';

interface ResourceCardProps {
  resource: ResourceMeta;
  isSaved: boolean;
  difficultyText: string;
  onOpen: () => void;
  onToggleSave: () => void;
  onEndorse: () => void;
}

const ResourceCardItem = memo(({ resource, isSaved, difficultyText, onOpen, onToggleSave, onEndorse }: ResourceCardProps) => {
  return (
    <View style={styles.resourceCard} testID={`resource-${resource.id}`}>
      <Pressable onPress={onOpen} testID={`resource-open-${resource.id}`}>
        <ImageBackground source={{ uri: resource.coverImageUrl }} style={styles.cardImage} imageStyle={styles.cardImageRadius}>
          <LinearGradient colors={['transparent', 'rgba(15, 23, 42, 0.75)']} style={styles.cardOverlay}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.badgePill}>
                <Layers size={14} color="#E0E7FF" />
                <Text style={styles.badgeText}>{resource.type}</Text>
              </View>
              {resource.formatBadge ? (
                <View style={styles.badgeAccent}>
                  <Text style={styles.badgeAccentText}>{resource.formatBadge}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle} numberOfLines={2}>{resource.title}</Text>
              <Text style={styles.cardSubtitle} numberOfLines={2}>{resource.description}</Text>
              <View style={styles.metaRow}>
                <View style={styles.metaLeft}>
                  <ImageBackground source={{ uri: resource.contributorAvatarUrl }} style={styles.avatar} imageStyle={styles.avatarImage} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.contributorName}>{resource.contributorName}</Text>
                    <Text style={styles.contributorSubtitle}>{difficultyText}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={onOpen} style={styles.openButton} activeOpacity={0.85}>
                  <ExternalLink size={16} color="#E0E7FF" />
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>
      </Pressable>
      <View style={styles.cardFooter}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagRow}>
          {resource.tags.map((tag) => (
            <View style={styles.tagPill} key={`${resource.id}-${tag}`}>
              <Tag size={12} color={Colors.light.primary} />
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.saveButton, isSaved && styles.saveButtonActive]} onPress={onToggleSave} activeOpacity={0.85}>
            <BookmarkPlus size={18} color={isSaved ? '#312E81' : Colors.light.primary} />
            <Text style={[styles.saveButtonText, isSaved && styles.saveButtonTextActive]}>{isSaved ? 'Saved' : 'Save'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.endorseButton} onPress={onEndorse} activeOpacity={0.85}>
            <Flame size={16} color="#FFFFFF" />
            <Text style={styles.endorseText}>{resource.endorsements}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});
ResourceCardItem.displayName = 'ResourceCardItem';

export default function ResourcesScreen() {
  const insets = useSafeAreaInsets();
  const { resources, featuredResources, recentResources, savedResourceIds, trendingTags, addResource, toggleSaved, endorseResource } = useResources();
  const { currentUser } = useCurrentUser();
  const [selectedType, setSelectedType] = useState<ActiveTypeFilter>('All');
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isComposerOpen, setIsComposerOpen] = useState<boolean>(false);
  const [composerDraft, setComposerDraft] = useState<ResourceDraft>(EMPTY_DRAFT);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [composerTagInput, setComposerTagInput] = useState<string>('');
  const composerAnim = useRef(new Animated.Value(0)).current;

  const filteredResources = useMemo<ResourceMeta[]>(() => {
    const query = searchQuery.trim().toLowerCase();
    return resources.filter((r) => {
      const matchesType = selectedType === 'All' || r.type === selectedType;
      const matchesCategory = selectedCategory === 'All' || r.categories.includes(selectedCategory);
      const matchesSearch = query.length === 0
        || r.title.toLowerCase().includes(query)
        || r.description.toLowerCase().includes(query)
        || r.tags.some((t) => t.toLowerCase().includes(query));
      return matchesType && matchesCategory && matchesSearch;
    });
  }, [resources, searchQuery, selectedType, selectedCategory]);

  const openComposer = useCallback(() => {
    setIsComposerOpen(true);
    Animated.timing(composerAnim, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [composerAnim]);

  const closeComposer = useCallback(() => {
    Animated.timing(composerAnim, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      if (finished) { setIsComposerOpen(false); setComposerDraft(EMPTY_DRAFT); setComposerError(null); }
    });
  }, [composerAnim]);

  const composerTranslate = composerAnim.interpolate({ inputRange: [0, 1], outputRange: [32, 0] });
  const composerOpacity = composerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const handleVisitResource = useCallback(async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
  }, []);

  const updateComposerField = useCallback(<K extends keyof ResourceDraft>(field: K, value: ResourceDraft[K]) => {
    setComposerDraft((prev) => ({ ...prev, [field]: value }));
  }, []);

  const toggleComposerCategory = useCallback((category: SkillCategory) => {
    setComposerDraft((prev) => {
      const has = prev.categories.includes(category);
      return { ...prev, categories: has ? prev.categories.filter((c) => c !== category) : [...prev.categories, category] };
    });
  }, []);

  const toggleComposerTag = useCallback((tag: string) => {
    const trimmed = tag.trim();
    if (trimmed.length === 0) return;
    setComposerDraft((prev) => prev.tags.includes(trimmed) ? prev : { ...prev, tags: [...prev.tags, trimmed] });
  }, []);

  const handleTagInputChange = useCallback((value: string) => {
    if (value.endsWith(' ') || value.endsWith(',') || value.endsWith('\n')) {
      const nextTag = value.slice(0, -1).trim();
      if (nextTag.length > 0) toggleComposerTag(nextTag);
      setComposerTagInput('');
      return;
    }
    setComposerTagInput(value);
  }, [toggleComposerTag]);

  const handleTagInputSubmit = useCallback(() => {
    const trimmed = composerTagInput.trim();
    if (trimmed.length === 0) return;
    toggleComposerTag(trimmed);
    setComposerTagInput('');
  }, [composerTagInput, toggleComposerTag]);

  const removeComposerTag = useCallback((tag: string) => {
    setComposerDraft((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  }, []);

  const handleSubmitComposer = useCallback(() => {
    const result = addResource(composerDraft, currentUser.id);
    if (!result) { setComposerError('Please complete all required fields.'); return; }
    setComposerError(null);
    closeComposer();
  }, [addResource, composerDraft, currentUser.id, closeComposer]);

  const difficultyLabel = useCallback((difficulty: SkillLevel | 'All Levels') => {
    return difficulty === 'All Levels' ? 'Open to everyone' : `${difficulty} friendly`;
  }, []);

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <LinearGradient colors={['#0F172A', '#1D1B4B', '#4F46E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 36 }]}>
          <View style={styles.heroHeader}>
            <View style={{ flex: 1, gap: 10 }}>
              <Text style={styles.heroEyebrow}>Resource Exchange</Text>
              <Text style={styles.heroTitle}>Share the playbook that helped you level up</Text>
              <Text style={styles.heroSubtitle}>Drop game-changing guides, playlists, decks, and tools for the community.</Text>
            </View>
            <TouchableOpacity style={styles.heroButton} onPress={openComposer} activeOpacity={0.9} testID="open-resource-composer">
              <Plus size={18} color="#0F172A" />
              <Text style={styles.heroButtonText}>Share</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.heroMetrics}>
            <View style={styles.metricCard}><Sparkles size={18} color="#A5B4FC" /><Text style={styles.metricValue}>{featuredResources.length}</Text><Text style={styles.metricLabel}>Featured</Text></View>
            <View style={styles.metricCard}><Flame size={18} color="#F97316" /><Text style={styles.metricValue}>{recentResources.length}</Text><Text style={styles.metricLabel}>Fresh</Text></View>
            <View style={styles.metricCard}><UploadCloud size={18} color="#C4B5FD" /><Text style={styles.metricValue}>{resources.length}</Text><Text style={styles.metricLabel}>Total</Text></View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          <View style={{ gap: 16 }}>
            <Text style={styles.sectionTitle}>Featured Collections</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingRight: 4 }}>
              {featuredResources.map((r) => (
                <Pressable key={`featured-${r.id}`} style={styles.featuredCard} onPress={() => handleVisitResource(r.url)}>
                  <ImageBackground source={{ uri: r.coverImageUrl }} style={{ flex: 1 }} imageStyle={{ borderRadius: 24 }}>
                    <LinearGradient colors={['transparent', 'rgba(15, 23, 42, 0.75)']} style={styles.featuredOverlay}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <View style={styles.badgePill}><Layers size={13} color="#E0E7FF" /><Text style={styles.badgeText}>{r.type}</Text></View>
                        <View style={styles.badgeAccent}><Text style={styles.badgeAccentText}>{r.difficulty}</Text></View>
                      </View>
                      <Text style={styles.featuredTitle} numberOfLines={3}>{r.title}</Text>
                      <Text style={styles.featuredCaption} numberOfLines={2}>{r.description}</Text>
                    </LinearGradient>
                  </ImageBackground>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={{ gap: 16 }}>
            <Text style={styles.sectionTitle}>Trending Tags</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
              {trendingTags.map((tag) => (
                <View style={styles.trendingPill} key={`tag-${tag}`}>
                  <Sparkles size={14} color={Colors.light.primary} />
                  <Text style={styles.trendingText}>#{tag}</Text>
                </View>
              ))}
              {trendingTags.length === 0 && <Text style={{ fontSize: 14, color: Colors.light.textSecondary }}>Tag activity will appear once members share resources.</Text>}
            </ScrollView>
          </View>

          <View style={styles.filtersCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TextInput placeholder="Search resources" placeholderTextColor="rgba(15, 23, 42, 0.4)" value={searchQuery} onChangeText={setSearchQuery} style={styles.searchInput} returnKeyType="search" testID="resources-search" />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton} testID="resources-clear-search">
                  <Text style={styles.clearButtonText}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              <TouchableOpacity style={[styles.filterChip, selectedType === 'All' && styles.filterChipActive]} onPress={() => setSelectedType('All')} testID="filter-type-all">
                <Text style={[styles.filterChipText, selectedType === 'All' && styles.filterChipTextActive]}>All Types</Text>
              </TouchableOpacity>
              {RESOURCE_TYPES.map((type) => (
                <TouchableOpacity key={type} style={[styles.filterChip, selectedType === type && styles.filterChipActive]} onPress={() => setSelectedType(type)} testID={`filter-type-${type}`}>
                  <Text style={[styles.filterChipText, selectedType === type && styles.filterChipTextActive]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              <TouchableOpacity style={[styles.filterChip, selectedCategory === 'All' && styles.filterChipActiveAlt]} onPress={() => setSelectedCategory('All')} testID="filter-category-all">
                <Text style={[styles.filterChipTextAlt, selectedCategory === 'All' && styles.filterChipTextActiveAlt]}>All Categories</Text>
              </TouchableOpacity>
              {resourceCategories.map((cat) => (
                <TouchableOpacity key={cat} style={[styles.filterChip, selectedCategory === cat && styles.filterChipActiveAlt]} onPress={() => setSelectedCategory(cat as SkillCategory)} testID={`filter-category-${cat}`}>
                  <Text style={[styles.filterChipTextAlt, selectedCategory === cat && styles.filterChipTextActiveAlt]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
            <Text style={styles.sectionTitle}>Community Library</Text>
            <Text style={{ fontSize: 14, fontWeight: '600' as const, color: Colors.light.textSecondary }}>{filteredResources.length} resources</Text>
          </View>

          <View style={{ gap: 20 }}>
            {filteredResources.map((r) => (
              <ResourceCardItem key={r.id} resource={r} isSaved={savedResourceIds.includes(r.id)} difficultyText={difficultyLabel(r.difficulty)} onOpen={() => handleVisitResource(r.url)} onToggleSave={() => toggleSaved(r.id)} onEndorse={() => endorseResource(r.id)} />
            ))}
            {filteredResources.length === 0 && (
              <View style={styles.emptyState} testID="resources-empty">
                <Text style={styles.emptyTitle}>Nothing yet</Text>
                <Text style={styles.emptySubtitle}>Try updating your filters or sharing a resource.</Text>
                <TouchableOpacity style={styles.emptyButton} onPress={openComposer} testID="empty-share-resource">
                  <Plus size={16} color="#0F172A" /><Text style={styles.emptyButtonText}>Share now</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {isComposerOpen && (
        <Animated.View style={[styles.composerOverlay, { opacity: composerOpacity }]} testID="resource-composer-overlay">
          <Pressable style={StyleSheet.absoluteFill} onPress={closeComposer} />
          <Animated.View style={[styles.composerCard, { transform: [{ translateY: composerTranslate }] }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Plus size={18} color={Colors.light.primary} />
                <Text style={{ fontSize: 18, fontWeight: '700' as const, color: Colors.light.text }}>Share a resource</Text>
              </View>
              <TouchableOpacity onPress={closeComposer} testID="close-resource-composer">
                <Text style={{ fontSize: 14, fontWeight: '600' as const, color: Colors.light.primary }}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 12 }}>
              <View style={{ gap: 8 }}>
                <Text style={styles.fieldLabel}>Title</Text>
                <TextInput value={composerDraft.title} onChangeText={(v) => updateComposerField('title', v)} style={styles.input} placeholder="Give it a standout name" placeholderTextColor="rgba(15,23,42,0.35)" testID="composer-title" />
              </View>
              <View style={{ gap: 8 }}>
                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput value={composerDraft.description} onChangeText={(v) => updateComposerField('description', v)} style={[styles.input, { height: 120 }]} placeholder="Why is this worth sharing?" placeholderTextColor="rgba(15,23,42,0.35)" multiline numberOfLines={4} textAlignVertical="top" testID="composer-description" />
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1, gap: 8 }}>
                  <Text style={styles.fieldLabel}>URL</Text>
                  <TextInput value={composerDraft.url} onChangeText={(v) => updateComposerField('url', v)} style={styles.input} placeholder="https://" placeholderTextColor="rgba(15,23,42,0.35)" autoCapitalize="none" autoCorrect={false} keyboardType={Platform.OS === 'web' ? 'default' : 'url'} testID="composer-url" />
                </View>
                <View style={{ flex: 1, gap: 8 }}>
                  <Text style={styles.fieldLabel}>Cover image</Text>
                  <TextInput value={composerDraft.coverImageUrl} onChangeText={(v) => updateComposerField('coverImageUrl', v)} style={styles.input} placeholder="Image URL" placeholderTextColor="rgba(15,23,42,0.35)" autoCapitalize="none" autoCorrect={false} testID="composer-cover" />
                </View>
              </View>
              <View style={{ gap: 8 }}>
                <Text style={styles.fieldLabel}>Resource type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                  {RESOURCE_TYPES.map((type) => (
                    <TouchableOpacity key={`ct-${type}`} style={[styles.filterChip, composerDraft.type === type && styles.filterChipActive]} onPress={() => updateComposerField('type', type)} testID={`composer-type-${type}`}>
                      <Text style={[styles.filterChipText, composerDraft.type === type && styles.filterChipTextActive]}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={{ gap: 8 }}>
                <Text style={styles.fieldLabel}>Difficulty</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                  {DIFFICULTY_OPTIONS.map((opt) => (
                    <TouchableOpacity key={`cd-${opt}`} style={[styles.filterChip, composerDraft.difficulty === opt && styles.filterChipActiveAlt]} onPress={() => updateComposerField('difficulty', opt)} testID={`composer-difficulty-${opt}`}>
                      <Text style={[styles.filterChipTextAlt, composerDraft.difficulty === opt && styles.filterChipTextActiveAlt]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={{ gap: 8 }}>
                <Text style={styles.fieldLabel}>Categories</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                  {resourceCategories.map((cat) => {
                    const sel = composerDraft.categories.includes(cat as SkillCategory);
                    return (
                      <TouchableOpacity key={`cc-${cat}`} style={[styles.filterChip, sel && styles.filterChipActiveAlt]} onPress={() => toggleComposerCategory(cat as SkillCategory)} testID={`composer-category-${cat}`}>
                        <Text style={[styles.filterChipTextAlt, sel && styles.filterChipTextActiveAlt]}>{cat}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
              <View style={{ gap: 8 }}>
                <Text style={styles.fieldLabel}>Tags</Text>
                <TextInput placeholder="Add a tag and press space" placeholderTextColor="rgba(15,23,42,0.35)" style={styles.input} value={composerTagInput} onChangeText={handleTagInputChange} onSubmitEditing={handleTagInputSubmit} blurOnSubmit={false} autoCapitalize="none" autoCorrect={false} testID="composer-tag-input" />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' as const, gap: 10 }}>
                  {composerDraft.tags.map((tag) => (
                    <TouchableOpacity key={`ctag-${tag}`} style={styles.selectedTag} onPress={() => removeComposerTag(tag)} testID={`composer-tag-${tag}`}>
                      <Text style={styles.selectedTagText}>#{tag}</Text>
                      <Check size={14} color="#0F172A" />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {composerError ? <Text style={{ fontSize: 13, color: Colors.light.error, fontWeight: '600' as const }} testID="composer-error">{composerError}</Text> : null}
              <TouchableOpacity style={styles.submitButton} onPress={handleSubmitComposer} activeOpacity={0.9} testID="composer-submit">
                <UploadCloud size={18} color="#0F172A" />
                <Text style={styles.submitButtonText}>Publish to library</Text>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.light.backgroundSecondary },
  hero: { paddingHorizontal: 20, paddingBottom: 36, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  heroHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  heroEyebrow: { fontSize: 13, fontWeight: '700' as const, letterSpacing: 1, textTransform: 'uppercase' as const, color: 'rgba(199, 210, 254, 0.9)' },
  heroTitle: { fontSize: 30, fontWeight: '800' as const, color: '#F8FAFC', lineHeight: 36 },
  heroSubtitle: { fontSize: 15, lineHeight: 22, color: 'rgba(226, 232, 240, 0.8)' },
  heroButton: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#C7D2FE', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16 },
  heroButtonText: { fontSize: 15, fontWeight: '700' as const, color: '#0F172A' },
  heroMetrics: { marginTop: 28, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  metricCard: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', paddingVertical: 16, borderRadius: 18, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(129, 140, 248, 0.35)' },
  metricValue: { fontSize: 20, fontWeight: '800' as const, color: '#E0E7FF' },
  metricLabel: { fontSize: 12, color: 'rgba(226, 232, 240, 0.7)' },
  content: { paddingHorizontal: 20, paddingTop: 28, gap: 32 },
  sectionTitle: { fontSize: 22, fontWeight: '700' as const, color: Colors.light.text },
  featuredCard: { width: 260, height: 320, borderRadius: 24, overflow: 'hidden', backgroundColor: Colors.light.card },
  featuredOverlay: { flex: 1, padding: 20, justifyContent: 'space-between' },
  featuredTitle: { fontSize: 24, fontWeight: '800' as const, color: '#F8FAFC', lineHeight: 30 },
  featuredCaption: { fontSize: 14, color: 'rgba(226, 232, 240, 0.75)', lineHeight: 20 },
  trendingPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.light.card, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: Colors.light.borderLight },
  trendingText: { fontSize: 14, fontWeight: '600' as const, color: Colors.light.primary },
  filtersCard: { backgroundColor: Colors.light.card, borderRadius: 20, padding: 16, gap: 16, borderWidth: 1, borderColor: Colors.light.borderLight },
  searchInput: { flex: 1, backgroundColor: Colors.light.backgroundTertiary, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: Colors.light.text, borderWidth: 1, borderColor: Colors.light.border },
  clearButton: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.light.backgroundTertiary },
  clearButtonText: { fontSize: 13, fontWeight: '700' as const, color: Colors.light.primary },
  filterRow: { flexDirection: 'row', gap: 10, paddingRight: 4 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, backgroundColor: Colors.light.backgroundTertiary, borderWidth: 1, borderColor: Colors.light.border },
  filterChipActive: { backgroundColor: Colors.light.primary, borderColor: Colors.light.primary },
  filterChipActiveAlt: { backgroundColor: '#C7F7E2', borderColor: Colors.light.secondary },
  filterChipText: { fontSize: 14, fontWeight: '600' as const, color: Colors.light.text },
  filterChipTextAlt: { fontSize: 14, fontWeight: '600' as const, color: Colors.light.textSecondary },
  filterChipTextActive: { color: '#FFFFFF' },
  filterChipTextActiveAlt: { color: Colors.light.secondary },
  resourceCard: { borderRadius: 24, backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.borderLight, shadowColor: Colors.light.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.07, shadowRadius: 18, elevation: 4 },
  cardImage: { height: 220 },
  cardImageRadius: { borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  cardOverlay: { flex: 1, padding: 20, justifyContent: 'space-between' },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badgePill: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: 'rgba(30, 64, 175, 0.55)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 },
  badgeText: { fontSize: 12, fontWeight: '600' as const, color: '#E0E7FF' },
  badgeAccent: { backgroundColor: 'rgba(236, 72, 153, 0.9)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 },
  badgeAccentText: { fontSize: 12, fontWeight: '700' as const, color: '#FFF7ED' },
  cardContent: { gap: 12 },
  cardTitle: { fontSize: 20, fontWeight: '800' as const, color: '#F8FAFC', lineHeight: 26 },
  cardSubtitle: { fontSize: 14, color: 'rgba(226, 232, 240, 0.9)', lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  avatarImage: { borderRadius: 22 },
  contributorName: { fontSize: 15, fontWeight: '700' as const, color: '#F8FAFC' },
  contributorSubtitle: { fontSize: 12, color: 'rgba(226, 232, 240, 0.75)' },
  openButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(30, 64, 175, 0.6)', alignItems: 'center', justifyContent: 'center' },
  cardFooter: { paddingHorizontal: 18, paddingVertical: 16, gap: 12 },
  tagRow: { flexDirection: 'row', gap: 10, paddingRight: 4 },
  tagPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: Colors.light.backgroundTertiary },
  tagText: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.primary },
  actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  saveButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: Colors.light.primary, backgroundColor: Colors.light.background },
  saveButtonActive: { backgroundColor: '#C7D2FE', borderColor: '#A5B4FC' },
  saveButtonText: { fontSize: 14, fontWeight: '700' as const, color: Colors.light.primary },
  saveButtonTextActive: { color: '#312E81' },
  endorseButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, backgroundColor: '#F97316' },
  endorseText: { fontSize: 14, fontWeight: '700' as const, color: '#FFFFFF' },
  emptyState: { alignItems: 'center', gap: 12, padding: 24, borderRadius: 20, backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.borderLight },
  emptyTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.light.text },
  emptySubtitle: { fontSize: 14, color: Colors.light.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.light.primary, borderRadius: 14 },
  emptyButtonText: { fontSize: 14, fontWeight: '700' as const, color: '#FFFFFF' },
  composerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.55)', justifyContent: 'center', paddingHorizontal: 16 },
  composerCard: { backgroundColor: Colors.light.card, borderRadius: 24, padding: 20, maxHeight: '85%' },
  fieldLabel: { fontSize: 14, fontWeight: '600' as const, color: Colors.light.textSecondary },
  input: { backgroundColor: Colors.light.backgroundSecondary, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: Colors.light.text, borderWidth: 1, borderColor: Colors.light.border },
  selectedTag: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: '#C7D2FE' },
  selectedTagText: { fontSize: 13, fontWeight: '600' as const, color: '#0F172A' },
  submitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, borderRadius: 16, backgroundColor: Colors.light.primary, marginTop: 8 },
  submitButtonText: { fontSize: 16, fontWeight: '700' as const, color: '#0F172A' },
});

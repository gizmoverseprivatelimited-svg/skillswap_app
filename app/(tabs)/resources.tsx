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
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookmarkPlus, Check, ExternalLink, Flame, Layers, Plus, Sparkles, Tag, UploadCloud } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { categories } from '@/mocks/data';
import type { ResourceMeta, ResourceType, SkillCategory, SkillLevel } from '@/types';
import { useResources, type ResourceDraft } from '@/providers/resources';
import { useCurrentUser } from '@/providers/current-user';
import { useAlert } from '@/providers/alert';
import { useRouter } from 'expo-router';
import url from '@/constants/backurl';
import { resolveImageUrl } from '@/lib/resolveImageUrl';

const MOCK_RESOURCE_COVER = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800';
const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';

const RESOURCE_TYPES: ResourceType[] = ['Article', 'Video', 'Document', 'Collection'];
const DIFFICULTY_OPTIONS: (SkillLevel | 'All Levels')[] = ['All Levels', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const resourceCategories = categories.filter((category) => category !== 'All');

const heroGradient = ['#0F172A', '#1D1B4B', '#4F46E5'] as const;

const overlayGradient = ['transparent', 'rgba(15, 23, 42, 0.75)'] as const;

type ActiveTypeFilter = ResourceType | 'All';

type ComposerField = keyof ResourceDraft;

const EMPTY_DRAFT: ResourceDraft = {
  title: '',
  description: '',
  url: '',
  type: 'Article',
  coverImageUrl: '',
  categories: [],
  difficulty: 'All Levels',
  durationMinutes: undefined,
  formatBadge: undefined,
  tags: [],
};

interface ResourceCardProps {
  resource: ResourceMeta;
  isSaved: boolean;
  difficultyText: string;
  onOpen: () => void;
  onToggleSave: () => void;
  onEndorse: () => void;
}

const ResourceCardItem = memo(({ resource, isSaved, difficultyText, onOpen, onToggleSave, onEndorse }: ResourceCardProps) => {
  const scale = useRef(new Animated.Value(1)).current;
  const coverErrorRef = useRef(false);
  const avatarErrorRef = useRef(false);
  const [coverError, setCoverError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const handleCoverError = useCallback(() => {
    if (!coverErrorRef.current) {
      coverErrorRef.current = true;
      setCoverError(true);
    }
  }, []);

  const handleAvatarError = useCallback(() => {
    if (!avatarErrorRef.current) {
      avatarErrorRef.current = true;
      setAvatarError(true);
    }
  }, []);

  const coverUri = useMemo(() => {
    if (coverError) return MOCK_RESOURCE_COVER;
    return resolveImageUrl(resource.coverImageUrl, MOCK_RESOURCE_COVER);
  }, [resource.coverImageUrl, coverError]);

  const avatarUri = useMemo(() => {
    if (avatarError) return DEFAULT_AVATAR;
    const raw = resource.contributorAvatarUrl;
    const full = raw ? (raw.startsWith('/uploads') ? `${url}${raw}` : raw) : '';
    return resolveImageUrl(full, DEFAULT_AVATAR);
  }, [resource.contributorAvatarUrl, avatarError]);

  const animate = useCallback((value: number) => {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: value,
        useNativeDriver: true,
        speed: 24,
        bounciness: 8,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 16,
        bounciness: 8,
      }),
    ]).start();
  }, [scale]);

  const handleSave = useCallback(() => {
    animate(0.92);
    onToggleSave();
  }, [animate, onToggleSave]);

  const handleEndorse = useCallback(() => {
    animate(1.08);
    onEndorse();
  }, [animate, onEndorse]);

  return (
    <Animated.View style={[styles.resourceCard, { transform: [{ scale }] }]} testID={`resource-${resource._id}`}>
      <Pressable onPress={onOpen} testID={`resource-open-${resource._id}`}>
        <ImageBackground
          source={{ uri: coverUri }}
          style={styles.cardImage}
          imageStyle={styles.cardImageRadius}
          onError={coverError ? undefined : handleCoverError}
        >
          <LinearGradient colors={overlayGradient} style={styles.cardOverlay}>
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
                  <ImageBackground
                    source={{ uri: avatarUri }}
                    style={styles.avatar}
                    imageStyle={styles.avatarImage}
                    onError={avatarError ? undefined : handleAvatarError}
                  />
                  <View style={styles.metaTextBlock}>
                    <Text style={styles.contributorName}>{resource.contributorName}</Text>
                    <Text style={styles.contributorSubtitle}>{difficultyText}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={onOpen} style={styles.openButton} activeOpacity={0.85} testID={`resource-link-${resource._id}`}>
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
            <View style={styles.tagPill} key={`${resource._id}-${tag}`}>
              <Tag size={12} color={Colors.light.primary} />
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={styles.actionsRow}>
          <AnimatedTouchable style={[styles.saveButton, isSaved && styles.saveButtonActive]} onPress={handleSave} activeOpacity={0.85} testID={`resource-save-${resource._id}`}>
            <BookmarkPlus size={18} color={isSaved ? '#312E81' : Colors.light.primary} />
            <Text style={[styles.saveButtonText, isSaved && styles.saveButtonTextActive]}>{isSaved ? 'Saved' : 'Save'}</Text>
          </AnimatedTouchable>
          <TouchableOpacity style={styles.endorseButton} onPress={handleEndorse} activeOpacity={0.85} testID={`resource-endorse-${resource._id}`}>
            <Flame size={16} color="#FFFFFF" />
            <Text style={styles.endorseText}>{resource.endorsements}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
});
ResourceCardItem.displayName = 'ResourceCardItem';

const FeaturedResourceCard = memo(({ resource, onOpen }: { resource: ResourceMeta; onOpen: () => void }) => {
  const coverErrorRef = useRef(false);
  const [coverError, setCoverError] = useState(false);

  const handleCoverError = useCallback(() => {
    if (!coverErrorRef.current) {
      coverErrorRef.current = true;
      setCoverError(true);
    }
  }, []);

  const coverUri = useMemo(() => {
    if (coverError) return MOCK_RESOURCE_COVER;
    return resolveImageUrl(resource.coverImageUrl, MOCK_RESOURCE_COVER);
  }, [resource.coverImageUrl, coverError]);

  return (
    <Pressable style={styles.featuredCard} onPress={onOpen} testID={`featured-${resource._id}`}>
      <ImageBackground
        source={{ uri: coverUri }}
        style={styles.featuredImage}
        imageStyle={styles.featuredImageRadius}
        onError={coverError ? undefined : handleCoverError}
      >
        <LinearGradient colors={overlayGradient} style={styles.featuredOverlay}>
          <View style={styles.featuredBadgeRow}>
            <View style={styles.badgePill}>
              <Layers size={13} color="#E0E7FF" />
              <Text style={styles.badgeText}>{resource.type}</Text>
            </View>
            <View style={styles.badgeAccent}>
              <Text style={styles.badgeAccentText}>{resource.difficulty}</Text>
            </View>
          </View>
          <Text style={styles.featuredTitle} numberOfLines={3}>{resource.title}</Text>
          <Text style={styles.featuredCaption} numberOfLines={2}>{resource.description}</Text>
        </LinearGradient>
      </ImageBackground>
    </Pressable>
  );
});
FeaturedResourceCard.displayName = 'FeaturedResourceCard';

export default function ResourcesScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const { resources, featuredResources, recentResources, savedResourceIds, trendingTags, addResource, toggleSaved, endorseResource, isLoading } = useResources();
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
    return resources.filter((resource) => {
      const matchesType = selectedType === 'All' ? true : resource.type === selectedType;
      const matchesCategory = selectedCategory === 'All' ? true : resource.categories.includes(selectedCategory);
      const matchesSearch = query.length === 0
        ? true
        : resource.title.toLowerCase().includes(query)
        || resource.description.toLowerCase().includes(query)
        || resource.tags.some((tag) => tag.toLowerCase().includes(query));
      return matchesType && matchesCategory && matchesSearch;
    });
  }, [resources, searchQuery, selectedType, selectedCategory]);

  const openComposer = useCallback(() => {
    if (!currentUser || currentUser.id === '1' || (currentUser as any)?.isDemo) {
      showAlert(
        'Login Required 🔒',
        'Please log in or create an account to share resources.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/login' as any) },
        ]
      );
      return;
    }
    setIsComposerOpen(true);
    Animated.timing(composerAnim, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [composerAnim, currentUser, router, showAlert]);

  const closeComposer = useCallback(() => {
    Animated.timing(composerAnim, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsComposerOpen(false);
        setComposerDraft(EMPTY_DRAFT);
        setComposerError(null);
      }
    });
  }, [composerAnim]);

  const composerTranslate = composerAnim.interpolate({ inputRange: [0, 1], outputRange: [32, 0] });
  const composerOpacity = composerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const handleToggleSave = useCallback((resourceId: string) => {
    toggleSaved(resourceId);
  }, [toggleSaved]);

  const handleEndorse = useCallback((resourceId: string) => {
    endorseResource(resourceId);
  }, [endorseResource]);

  const handleVisitResource = useCallback(async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      console.warn('[Resources] Unsupported URL', { url });
    }
  }, []);

  const updateComposerField = useCallback(<K extends ComposerField>(field: K, value: ResourceDraft[K]) => {
    setComposerDraft((prev) => ({ ...prev, [field]: value }));
  }, []);

  const toggleComposerCategory = useCallback((category: SkillCategory) => {
    setComposerDraft((prev) => {
      const hasCategory = prev.categories.includes(category);
      const categoriesNext = hasCategory
        ? prev.categories.filter((item) => item !== category)
        : [...prev.categories, category];
      return { ...prev, categories: categoriesNext };
    });
  }, []);

  const toggleComposerTag = useCallback((tag: string) => {
    const trimmed = tag.trim();
    if (trimmed.length === 0) {
      return;
    }
    setComposerDraft((prev) => {
      if (prev.tags.includes(trimmed)) {
        return prev;
      }
      return { ...prev, tags: [...prev.tags, trimmed] };
    });
  }, []);


  const handleTagInputChange = useCallback((value: string) => {
    if (value.endsWith(' ') || value.endsWith(',') || value.endsWith('\n')) {
      const nextTag = value.slice(0, -1).trim();
      if (nextTag.length > 0) {
        toggleComposerTag(nextTag);
      }
      setComposerTagInput('');
      return;
    }
    setComposerTagInput(value);
  }, [toggleComposerTag]);

  const handleTagInputSubmit = useCallback(() => {
    const trimmed = composerTagInput.trim();
    if (trimmed.length === 0) {
      return;
    }
    toggleComposerTag(trimmed);
    setComposerTagInput('');
  }, [composerTagInput, toggleComposerTag]);

  const removeComposerTag = useCallback((tag: string) => {
    setComposerDraft((prev: any) => ({ ...prev, tags: prev.tags.filter((item: any) => item !== tag) }));
  }, []);

  const handleSubmitComposer = useCallback(() => {
    if (!currentUser || currentUser.id === '1' || (currentUser as any)?.isDemo) {
      showAlert(
        'Login Required 🔒',
        'Please log in or create an account to share resources.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/login' as any) },
        ]
      );
      return;
    }
    const result = addResource(composerDraft, currentUser?.id || "");
    if (!result) {
      setComposerError('Please complete all required fields before sharing.');
      return;
    }
    setComposerError(null);
    closeComposer();
  }, [addResource, composerDraft, currentUser, router, showAlert, closeComposer]);

  const difficultyLabel = useCallback((difficulty: SkillLevel | 'All Levels') => {
    if (difficulty === 'All Levels') {
      return 'Open to everyone';
    }
    return `${difficulty} friendly`;
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 36 }]}>
          <View style={styles.heroHeader}>
            <View style={styles.heroTextBlock}>
              <Text style={styles.heroEyebrow}>Resource Exchange</Text>
              <Text style={styles.heroTitle}>Share the playbook that helped you level up</Text>
              <Text style={styles.heroSubtitle}>Drop game-changing guides, playlists, decks, and tools for the community.</Text>
            </View>
            <TouchableOpacity style={styles.heroButton} onPress={openComposer} activeOpacity={0.9} testID="open-resource-composer">
              <Plus size={18} color="#0F172A" />
              <Text style={styles.heroButtonText}>Share Resource</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.heroMetrics}>
            <View style={styles.metricCard}>
              <Sparkles size={18} color="#A5B4FC" />
              <Text style={styles.metricValue}>{featuredResources.length}</Text>
              <Text style={styles.metricLabel}>Featured drops</Text>
            </View>
            <View style={styles.metricCard}>
              <Flame size={18} color="#F97316" />
              <Text style={styles.metricValue}>{recentResources.length}</Text>
              <Text style={styles.metricLabel}>Fresh this week</Text>
            </View>
            <View style={styles.metricCard}>
              <UploadCloud size={18} color="#C4B5FD" />
              <Text style={styles.metricValue}>{resources.length}</Text>
              <Text style={styles.metricLabel}>Total uploads</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Featured Collections</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredScroll}>
              {featuredResources.map((resource, i) => (
                <FeaturedResourceCard
                  key={`featured-${i}`}
                  resource={resource}
                  onOpen={() => handleVisitResource(resource.url)}
                />
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trending Tags</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendingRow}>
              {trendingTags.map((tag, i) => (
                <View style={styles.trendingPill} key={`tag-${i}`}>
                  <Sparkles size={14} color={Colors.light.primary} />
                  <Text style={styles.trendingText}>#{tag}</Text>
                </View>
              ))}
              {trendingTags.length === 0 && (
                <Text style={styles.emptyTrending}>Tag activity will appear once members share resources.</Text>
              )}
            </ScrollView>
          </View>

          <View style={styles.filtersCard}>
            <View style={styles.searchRow}>
              <TextInput
                placeholder="Search resources, topics, or mentors"
                placeholderTextColor="rgba(15, 23, 42, 0.4)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={styles.searchInput}
                returnKeyType="search"
                testID="resources-search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton} testID="resources-clear-search">
                  <Text style={styles.clearButtonText}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterChip, selectedType === 'All' && styles.filterChipActive]}
                onPress={() => setSelectedType('All')}
                testID="filter-type-all"
              >
                <Text style={[styles.filterChipText, selectedType === 'All' && styles.filterChipTextActive]}>All Types</Text>
              </TouchableOpacity>
              {RESOURCE_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.filterChip, selectedType === type && styles.filterChipActive]}
                  onPress={() => setSelectedType(type)}
                  testID={`filter-type-${type}`}
                >
                  <Text style={[styles.filterChipText, selectedType === type && styles.filterChipTextActive]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterChip, selectedCategory === 'All' && styles.filterChipActiveSecondary]}
                onPress={() => setSelectedCategory('All')}
                testID="filter-category-all"
              >
                <Text style={[styles.filterChipTextSecondary, selectedCategory === 'All' && styles.filterChipTextActiveSecondary]}>All Categories</Text>
              </TouchableOpacity>
              {resourceCategories.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[styles.filterChip, selectedCategory === category && styles.filterChipActiveSecondary]}
                  onPress={() => setSelectedCategory(category as SkillCategory)}
                  testID={`filter-category-${category}`}
                >
                  <Text style={[styles.filterChipTextSecondary, selectedCategory === category && styles.filterChipTextActiveSecondary]}>{category}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Community Library</Text>
            <Text style={styles.sectionCount}>{filteredResources.length} resources</Text>
          </View>

          <View style={styles.resourceList}>
            {filteredResources.map((resource, i) => (
              <ResourceCardItem
                key={i}
                resource={resource}
                isSaved={savedResourceIds.includes(resource._id || "")}
                difficultyText={difficultyLabel(resource.difficulty)}
                onOpen={() => handleVisitResource(resource.url)}
                onToggleSave={() => handleToggleSave(resource._id || "")}
                onEndorse={() => handleEndorse(resource._id || "")}
              />
            ))}
            {filteredResources.length === 0 && (
              <View style={styles.emptyState} testID="resources-empty">
                <Text style={styles.emptyTitle}>Nothing yet</Text>
                <Text style={styles.emptySubtitle}>Try updating your filters or sharing a resource to kick things off.</Text>
                <TouchableOpacity style={styles.emptyButton} onPress={openComposer} testID="empty-share-resource">
                  <Plus size={16} color="#0F172A" />
                  <Text style={styles.emptyButtonText}>Share now</Text>
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
            <View style={styles.composerHeader}>
              <View style={styles.composerTitleWrap}>
                <Plus size={18} color={Colors.light.primary} />
                <Text style={styles.composerTitle}>Share a resource</Text>
              </View>
              <TouchableOpacity onPress={closeComposer} testID="close-resource-composer">
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.composerContent}>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Title</Text>
                <TextInput
                  value={composerDraft.title}
                  onChangeText={(value) => updateComposerField('title', value)}
                  style={styles.input}
                  placeholder="Give it a standout name"
                  placeholderTextColor="rgba(15,23,42,0.35)"
                  testID="composer-title"
                />
              </View>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput
                  value={composerDraft.description}
                  onChangeText={(value) => updateComposerField('description', value)}
                  style={[styles.input, styles.inputMultiline]}
                  placeholder="Summarize why this resource is worth sharing"
                  placeholderTextColor="rgba(15,23,42,0.35)"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  testID="composer-description"
                />
              </View>
              <View style={styles.fieldRow}>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>URL</Text>
                  <TextInput
                    value={composerDraft.url}
                    onChangeText={(value) => updateComposerField('url', value)}
                    style={styles.input}
                    placeholder="https://"
                    placeholderTextColor="rgba(15,23,42,0.35)"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType={Platform.OS === 'web' ? 'default' : 'url'}
                    testID="composer-url"
                  />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Cover image</Text>
                  <TextInput
                    value={composerDraft.coverImageUrl}
                    onChangeText={(value) => updateComposerField('coverImageUrl', value)}
                    style={styles.input}
                    placeholder="Image URL"
                    placeholderTextColor="rgba(15,23,42,0.35)"
                    autoCapitalize="none"
                    autoCorrect={false}
                    testID="composer-cover"
                  />
                </View>
              </View>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Resource type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                  {RESOURCE_TYPES.map((type) => (
                    <TouchableOpacity
                      key={`composer-type-${type}`}
                      style={[styles.filterChip, composerDraft.type === type && styles.filterChipActive]}
                      onPress={() => updateComposerField('type', type)}
                      testID={`composer-type-${type}`}
                    >
                      <Text style={[styles.filterChipText, composerDraft.type === type && styles.filterChipTextActive]}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Difficulty</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                  {DIFFICULTY_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={`composer-difficulty-${option}`}
                      style={[styles.filterChip, composerDraft.difficulty === option && styles.filterChipActiveSecondary]}
                      onPress={() => updateComposerField('difficulty', option)}
                      testID={`composer-difficulty-${option}`}
                    >
                      <Text style={[styles.filterChipTextSecondary, composerDraft.difficulty === option && styles.filterChipTextActiveSecondary]}>{option}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Categories</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                  {resourceCategories.map((category, i) => {
                    const isSelected = composerDraft.categories.includes(category as SkillCategory);
                    return (
                      <TouchableOpacity
                        key={`composer-category-${i}`}
                        style={[styles.filterChip, isSelected && styles.filterChipActiveSecondary]}
                        onPress={() => toggleComposerCategory(category as SkillCategory)}
                        testID={`composer-category-${category}`}
                      >
                        <Text style={[styles.filterChipTextSecondary, isSelected && styles.filterChipTextActiveSecondary]}>{category}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
              <View style={styles.fieldRow}>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Duration (minutes)</Text>
                  <TextInput
                    value={composerDraft.durationMinutes ? String(composerDraft.durationMinutes) : ''}
                    onChangeText={(value) => updateComposerField('durationMinutes', value ? Number(value) : undefined)}
                    style={styles.input}
                    placeholder="Optional"
                    placeholderTextColor="rgba(15,23,42,0.35)"
                    keyboardType="number-pad"
                    testID="composer-duration"
                  />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Format badge</Text>
                  <TextInput
                    value={composerDraft.formatBadge ?? ''}
                    onChangeText={(value) => updateComposerField('formatBadge', value.length === 0 ? undefined : value)}
                    style={styles.input}
                    placeholder="Optional label"
                    placeholderTextColor="rgba(15,23,42,0.35)"
                    testID="composer-format"
                  />
                </View>
              </View>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Tags</Text>
                <View style={styles.tagInputRow}>
                  <TextInput
                    placeholder="Add a tag and press space"
                    placeholderTextColor="rgba(15,23,42,0.35)"
                    style={[styles.input, styles.tagInput]}
                    value={composerTagInput}
                    onChangeText={handleTagInputChange}
                    onSubmitEditing={handleTagInputSubmit}
                    blurOnSubmit={false}
                    autoCapitalize="none"
                    autoCorrect={false}
                    testID="composer-tag-input"
                  />
                </View>
                <View style={styles.selectedTagsRow}>
                  {composerDraft.tags.map((tag, i) => (
                    <TouchableOpacity key={`composer-tag-${i}`} style={styles.selectedTag} onPress={() => removeComposerTag(tag)} testID={`composer-tag-${tag}`}>
                      <Text style={styles.selectedTagText}>#{tag}</Text>
                      <Check size={14} color="#0F172A" />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {composerError ? (
                <Text style={styles.errorText} testID="composer-error">{composerError}</Text>
              ) : null}
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
  screen: {
    flex: 1,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  heroTextBlock: {
    flex: 1,
    gap: 10,
  },
  heroEyebrow: {
    fontSize: 13,
    fontWeight: '700' as const,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: 'rgba(199, 210, 254, 0.9)',
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '800' as const,
    color: '#F8FAFC',
    lineHeight: 36,
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(226, 232, 240, 0.8)',
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#C7D2FE',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: '#312E81',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  heroButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#0F172A',
  },
  heroMetrics: {
    marginTop: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.35)',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#E0E7FF',
  },
  metricLabel: {
    fontSize: 12,
    color: 'rgba(226, 232, 240, 0.7)',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    gap: 32,
  },
  section: {
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  featuredScroll: {
    gap: 16,
    paddingRight: 4,
  },
  featuredCard: {
    width: 260,
    height: 320,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: Colors.light.card,
    marginRight: 16,
  },
  featuredImage: {
    flex: 1,
  },
  featuredImageRadius: {
    borderRadius: 24,
  },
  featuredOverlay: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  featuredBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featuredTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#F8FAFC',
    lineHeight: 30,
  },
  featuredCaption: {
    fontSize: 14,
    color: 'rgba(226, 232, 240, 0.75)',
    lineHeight: 20,
  },
  trendingRow: {
    gap: 12,
    paddingRight: 4,
  },
  trendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.light.card,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  trendingText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.primary,
  },
  emptyTrending: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  filtersCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    padding: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.light.backgroundTertiary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  clearButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.light.backgroundTertiary,
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.primary,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: 4,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: Colors.light.backgroundTertiary,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  filterChipActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  filterChipActiveSecondary: {
    backgroundColor: '#C7F7E2',
    borderColor: Colors.light.secondary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  filterChipTextSecondary: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  filterChipTextActiveSecondary: {
    color: Colors.light.secondary,
  },
  resourceList: {
    gap: 20,
  },
  resourceCard: {
    borderRadius: 24,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 4,
  },
  cardImage: {
    height: 220,
  },
  cardImageRadius: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  cardOverlay: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgePill: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(30, 64, 175, 0.55)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#E0E7FF',
  },
  badgeAccent: {
    backgroundColor: 'rgba(236, 72, 153, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  badgeAccentText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFF7ED',
  },
  cardContent: {
    gap: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#F8FAFC',
    lineHeight: 26,
  },
  cardSubtitle: {
    fontSize: 14,
    color: 'rgba(226, 232, 240, 0.9)',
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  avatarImage: {
    borderRadius: 22,
  },
  metaTextBlock: {
    flex: 1,
    gap: 4,
  },
  contributorName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#F8FAFC',
  },
  contributorSubtitle: {
    fontSize: 12,
    color: 'rgba(226, 232, 240, 0.75)',
  },
  openButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(30, 64, 175, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFooter: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: 4,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: Colors.light.backgroundTertiary,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.primary,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.background,
  },
  saveButtonActive: {
    backgroundColor: '#C7D2FE',
    borderColor: '#A5B4FC',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.primary,
  },
  saveButtonTextActive: {
    color: '#312E81',
  },
  endorseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F97316',
  },
  endorseText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    gap: 12,
    padding: 24,
    borderRadius: 20,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.light.primary,
    borderRadius: 14,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  composerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  composerCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 24,
    padding: 20,
    maxHeight: '85%',
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 28,
    elevation: 12,
  },
  composerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  composerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  composerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  closeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.primary,
  },
  composerContent: {
    gap: 16,
    paddingBottom: 12,
  },
  fieldBlock: {
    gap: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  input: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  inputMultiline: {
    height: 120,
  },
  tagInputRow: {
    flexDirection: 'row',
  },
  tagInput: {
    flex: 1,
  },
  selectedTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 10,
  },
  selectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#C7D2FE',
  },
  selectedTagText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#0F172A',
  },
  errorText: {
    fontSize: 13,
    color: Colors.light.error,
    fontWeight: '600' as const,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: Colors.light.primary,
    marginTop: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
  },
});

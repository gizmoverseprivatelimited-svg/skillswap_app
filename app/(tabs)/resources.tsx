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
  useWindowDimensions,
  DimensionValue,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeTopInset } from '@/lib/safeArea';
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
import { logEvent } from '@/lib/analytics';

const MOCK_RESOURCE_COVER = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800';
const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';

const RESOURCE_TYPES: ResourceType[] = ['Article', 'Video', 'Document', 'Collection'];
const DIFFICULTY_OPTIONS: (SkillLevel | 'All Levels')[] = ['All Levels', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const resourceCategories = categories.filter((category) => category !== 'All');

const heroGradient = ['#0F172A', '#1D1B4B', '#4F46E5'] as const;

const overlayGradient = ['transparent', 'rgba(15, 23, 42, 0.75)'] as const;

const DEMO_URL_MAP: Record<string, string> = {
  'https://fstoppers.com/lighting/ultimate-guide-portrait-lighting-2024-654321': 'https://photographylife.com/portrait-photography-lighting',
  'https://www.youtube.com/watch?v=OxFcbx6QyBc': 'https://react.dev/reference/react/hooks',
  'https://drive.google.com/file/d/spanish-deck': 'https://www.fluentu.com/blog/spanish/spanish-conversation-practice/',
  'https://notion.so/mobility-primer': 'https://www.healthline.com/health/fitness-exercise/morning-stretches',
  'https://www.figma.com/community/file/123456789': 'https://ui.shadcn.com/',
  'https://www.figma.com/community/file/1179782559585642674': 'https://ui.shadcn.com/',
  'https://stackshare.io/fullstack-cheats': 'https://roadmap.sh/full-stack',
};

const resolveWorkingUrl = (rawUrl?: string, title?: string): string => {
  if (!rawUrl) return 'https://roadmap.sh';
  const trimmed = rawUrl.trim();
  if (DEMO_URL_MAP[trimmed]) return DEMO_URL_MAP[trimmed];

  const lower = trimmed.toLowerCase();
  const lowerTitle = (title || '').toLowerCase();

  if (lower.includes('portrait-lighting') || lower.includes('654321') || lowerTitle.includes('portrait lighting')) {
    return 'https://photographylife.com/portrait-photography-lighting';
  }
  if (lower.includes('oxfcbx6qybc') || lowerTitle.includes('react hooks')) {
    return 'https://react.dev/reference/react/hooks';
  }
  if (lower.includes('spanish-deck') || lowerTitle.includes('spanish')) {
    return 'https://www.fluentu.com/blog/spanish/spanish-conversation-practice/';
  }
  if (lower.includes('mobility-primer') || lowerTitle.includes('mobility')) {
    return 'https://www.healthline.com/health/fitness-exercise/morning-stretches';
  }
  if (lower.includes('123456789') || lowerTitle.includes('figma components') || lowerTitle.includes('starter vault') || lower.includes('figma.com')) {
    return 'https://ui.shadcn.com/';
  }
  if (lower.includes('fullstack-cheats') || lowerTitle.includes('full-stack')) {
    return 'https://roadmap.sh/full-stack';
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
};

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
  cardWidth?: DimensionValue;
  isSmallScreen?: boolean;
}

const ResourceCardItem = memo(({ resource, isSaved, difficultyText, onOpen, onToggleSave, onEndorse, cardWidth, isSmallScreen }: ResourceCardProps) => {
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
    <Animated.View style={[styles.resourceCard, isSmallScreen && styles.resourceCardMobile, cardWidth ? { width: cardWidth } : null, { transform: [{ scale }] }]} testID={`resource-${resource._id}`}>
      <Pressable onPress={onOpen} testID={`resource-open-${resource._id}`}>
        <ImageBackground
          source={{ uri: coverUri }}
          style={[styles.cardImage, isSmallScreen && styles.cardImageMobile]}
          imageStyle={[styles.cardImageRadius, isSmallScreen && styles.cardImageRadiusMobile]}
          onError={coverError ? undefined : handleCoverError}
        >
          <LinearGradient colors={overlayGradient} style={[styles.cardOverlay, isSmallScreen && styles.cardOverlayMobile]}>
            <View style={[styles.cardHeaderRow, isSmallScreen && styles.cardHeaderRowMobile]}>
              <View style={[styles.badgePill, isSmallScreen && styles.badgePillMobile]}>
                <Layers size={isSmallScreen ? 11 : 14} color="#E0E7FF" />
                <Text style={[styles.badgeText, isSmallScreen && styles.badgeTextMobile]}>{resource.type}</Text>
              </View>
              {resource.formatBadge ? (
                <View style={[styles.badgeAccent, isSmallScreen && styles.badgeAccentMobile]}>
                  <Text style={[styles.badgeAccentText, isSmallScreen && styles.badgeAccentTextMobile]}>{resource.formatBadge}</Text>
                </View>
              ) : null}
            </View>
            <View style={[styles.cardContent, isSmallScreen && styles.cardContentMobile]}>
              <Text style={[styles.cardTitle, isSmallScreen && styles.cardTitleMobile]}>{resource.title}</Text>
              <Text style={[styles.cardSubtitle, isSmallScreen && styles.cardSubtitleMobile]}>{resource.description}</Text>
              <View style={styles.metaRow}>
                <View style={[styles.metaLeft, isSmallScreen && styles.metaLeftMobile]}>
                  <ImageBackground
                    source={{ uri: avatarUri }}
                    style={[styles.avatar, isSmallScreen && styles.avatarMobile]}
                    imageStyle={[styles.avatarImage, isSmallScreen && styles.avatarImageMobile]}
                    onError={avatarError ? undefined : handleAvatarError}
                  />
                  <View style={[styles.metaTextBlock, isSmallScreen && styles.metaTextBlockMobile]}>
                    <Text style={[styles.contributorName, isSmallScreen && styles.contributorNameMobile]}>{resource.contributorName}</Text>
                    <Text style={[styles.contributorSubtitle, isSmallScreen && styles.contributorSubtitleMobile]}>{difficultyText}</Text>
                  </View>
                </View>
                {!isSmallScreen && (
                  <TouchableOpacity onPress={onOpen} style={styles.openButton} activeOpacity={0.85} testID={`resource-link-${resource._id}`}>
                    <ExternalLink size={16} color="#E0E7FF" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>
      </Pressable>
      <View style={[styles.cardFooter, isSmallScreen && styles.cardFooterMobile]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tagRow, isSmallScreen && styles.tagRowMobile]}>
          {resource.tags.slice(0, isSmallScreen ? 2 : undefined).map((tag) => (
            <View style={[styles.tagPill, isSmallScreen && styles.tagPillMobile]} key={`${resource._id}-${tag}`}>
              <Tag size={isSmallScreen ? 10 : 12} color={Colors.light.primary} />
              <Text style={[styles.tagText, isSmallScreen && styles.tagTextMobile]}>{tag}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={[styles.actionsRow, isSmallScreen && styles.actionsRowMobile]}>
          <AnimatedTouchable style={[styles.saveButton, isSmallScreen && styles.saveButtonMobile, isSaved && styles.saveButtonActive]} onPress={handleSave} activeOpacity={0.85} testID={`resource-save-${resource._id}`}>
            <BookmarkPlus size={isSmallScreen ? 14 : 18} color={isSaved ? '#312E81' : Colors.light.primary} />
            <Text style={[styles.saveButtonText, isSmallScreen && styles.saveButtonTextMobile, isSaved && styles.saveButtonTextActive]}>{isSaved ? 'Saved' : 'Save'}</Text>
          </AnimatedTouchable>
          <TouchableOpacity style={[styles.endorseButton, isSmallScreen && styles.endorseButtonMobile]} onPress={handleEndorse} activeOpacity={0.85} testID={`resource-endorse-${resource._id}`}>
            <Flame size={isSmallScreen ? 13 : 16} color="#FFFFFF" />
            <Text style={[styles.endorseText, isSmallScreen && styles.endorseTextMobile]}>{resource.endorsements}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
});
ResourceCardItem.displayName = 'ResourceCardItem';

interface FeaturedResourceCardProps {
  resource: ResourceMeta;
  onOpen: () => void;
  cardWidth?: number;
  cardMarginRight?: number;
}

const FeaturedResourceCard = memo(({ resource, onOpen, cardWidth, cardMarginRight }: FeaturedResourceCardProps) => {
  const coverErrorRef = useRef(false);
  const [coverError, setCoverError] = useState(false);
  const { width: windowWidth } = useWindowDimensions();
  const isSmall = windowWidth < 600;

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
    <Pressable
      style={[
        styles.featuredCard,
        isSmall && styles.featuredCardSmall,
        cardWidth ? { width: cardWidth } : null,
        cardMarginRight !== undefined ? { marginRight: cardMarginRight } : null,
      ]}
      onPress={onOpen}
      testID={`featured-${resource._id}`}
    >
      <ImageBackground
        source={{ uri: coverUri }}
        style={styles.featuredImage}
        imageStyle={[styles.featuredImageRadius, isSmall && styles.featuredImageRadiusSmall]}
        onError={coverError ? undefined : handleCoverError}
      >
        <LinearGradient colors={overlayGradient} style={[styles.featuredOverlay, isSmall && styles.featuredOverlaySmall]}>
          <View style={[styles.featuredBadgeRow, isSmall && { flexWrap: 'wrap', gap: 4 }]}>
            <View style={[styles.badgePill, isSmall && styles.badgePillSmall]}>
              <Layers size={isSmall ? 10 : 13} color="#E0E7FF" />
              <Text style={[styles.badgeText, isSmall && styles.badgeTextSmall]}>{resource.type}</Text>
            </View>
            <View style={[styles.badgeAccent, isSmall && styles.badgeAccentSmall]}>
              <Text style={[styles.badgeAccentText, isSmall && styles.badgeAccentTextSmall]}>{resource.difficulty}</Text>
            </View>
          </View>
          <Text style={[styles.featuredTitle, isSmall && styles.featuredTitleSmall]}>{resource.title}</Text>
          <Text style={[styles.featuredCaption, isSmall && styles.featuredCaptionSmall]}>{resource.description}</Text>
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
  const { width: windowWidth } = useWindowDimensions();
  const isSmallScreen = windowWidth < 600;
  const safeTopInset = useSafeTopInset(isSmallScreen ? 14 : 32);

  const numResourceColumns = useMemo(() => {
    if (windowWidth >= 1150) return 4;
    if (windowWidth >= 820) return 3;
    return 2; // Always 2 cards in a row on mobile devices
  }, [windowWidth]);

  const resourceGridPadding = isSmallScreen ? (windowWidth < 360 ? 12 : 16) : 20;
  const resourceGridGap = isSmallScreen ? (windowWidth < 360 ? 8 : 12) : 16;

  const resourceCardWidth = useMemo(() => {
    const totalPadding = resourceGridPadding * 2;
    const totalGap = (numResourceColumns - 1) * resourceGridGap;
    const availableWidth = Math.min(windowWidth, 1280) - totalPadding - totalGap;
    return Math.floor(availableWidth / numResourceColumns);
  }, [windowWidth, numResourceColumns, resourceGridPadding, resourceGridGap]);

  // Featured Collections sizing on mobile (exactly 2 cards visible in the row with horizontal scroll)
  const featuredCardGap = isSmallScreen ? (windowWidth < 360 ? 8 : 10) : 16;
  const featuredCardWidth = useMemo(() => {
    if (!isSmallScreen) return 260;
    const totalPadding = resourceGridPadding * 2;
    const availableWidth = windowWidth - totalPadding - featuredCardGap;
    return Math.floor(availableWidth / 2);
  }, [isSmallScreen, windowWidth, resourceGridPadding, featuredCardGap]);
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

  const handleVisitResource = useCallback(async (rawUrl: string, title?: string) => {
    const targetUrl = resolveWorkingUrl(rawUrl, title);
    logEvent('resource_open', { url: targetUrl, title: title || '' });
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      const supported = await Linking.canOpenURL(targetUrl);
      if (supported) {
        await Linking.openURL(targetUrl);
      } else {
        await Linking.openURL(targetUrl);
      }
    } catch (err) {
      console.warn('[Resources] Failed to open URL', { targetUrl, err });
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
        <LinearGradient
          colors={heroGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.hero,
            isSmallScreen && styles.heroMobile,
            { paddingTop: safeTopInset }
          ]}
        >
          <View style={styles.heroInner}>
            <View style={[styles.heroHeader, isSmallScreen && styles.heroHeaderMobile]}>
              <View style={[styles.heroTextBlock, isSmallScreen && styles.heroTextBlockMobile]}>
                <Text style={[styles.heroEyebrow, isSmallScreen && styles.heroEyebrowMobile]}>Resource Exchange</Text>
                <Text style={[styles.heroTitle, isSmallScreen && styles.heroTitleMobile]}>
                  Share the playbook that helped you level up
                </Text>
                <Text style={[styles.heroSubtitle, isSmallScreen && styles.heroSubtitleMobile]}>
                  Drop game-changing guides, playlists, decks, and tools for the community.
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.heroButton, isSmallScreen && styles.heroButtonMobile]}
                onPress={openComposer}
                activeOpacity={0.9}
                testID="open-resource-composer"
              >
                <Plus size={isSmallScreen ? 15 : 18} color="#0F172A" />
                <Text style={[styles.heroButtonText, isSmallScreen && styles.heroButtonTextMobile]}>
                  {isSmallScreen ? 'Share' : 'Share Resource'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.heroMetrics, isSmallScreen && styles.heroMetricsMobile]}>
              <View style={[styles.metricCard, isSmallScreen && styles.metricCardMobile]}>
                <Sparkles size={isSmallScreen ? 14 : 18} color="#A5B4FC" />
                <Text style={[styles.metricValue, isSmallScreen && styles.metricValueMobile]}>{featuredResources.length}</Text>
                <Text style={[styles.metricLabel, isSmallScreen && styles.metricLabelMobile]}>Featured drops</Text>
              </View>
              <View style={[styles.metricCard, isSmallScreen && styles.metricCardMobile]}>
                <Flame size={isSmallScreen ? 14 : 18} color="#F97316" />
                <Text style={[styles.metricValue, isSmallScreen && styles.metricValueMobile]}>{recentResources.length}</Text>
                <Text style={[styles.metricLabel, isSmallScreen && styles.metricLabelMobile]}>Fresh this week</Text>
              </View>
              <View style={[styles.metricCard, isSmallScreen && styles.metricCardMobile]}>
                <UploadCloud size={isSmallScreen ? 14 : 18} color="#C4B5FD" />
                <Text style={[styles.metricValue, isSmallScreen && styles.metricValueMobile]}>{resources.length}</Text>
                <Text style={[styles.metricLabel, isSmallScreen && styles.metricLabelMobile]}>Total uploads</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={[styles.content, isSmallScreen && styles.contentMobile, isSmallScreen && { paddingHorizontal: resourceGridPadding }]}>
          <View style={[styles.section, isSmallScreen && styles.sectionMobile]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isSmallScreen && styles.sectionTitleMobile]}>Featured Collections</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.featuredScroll, isSmallScreen && { gap: 0 }]}
            >
              {featuredResources.map((resource, i) => (
                <FeaturedResourceCard
                  key={`featured-${i}`}
                  resource={resource}
                  onOpen={() => handleVisitResource(resource.url, resource.title)}
                  cardWidth={isSmallScreen ? featuredCardWidth : undefined}
                  cardMarginRight={isSmallScreen ? featuredCardGap : undefined}
                />
              ))}
            </ScrollView>
          </View>

          <View style={[styles.section, isSmallScreen && styles.sectionMobile]}>
            <Text style={[styles.sectionTitle, isSmallScreen && styles.sectionTitleMobile]}>Trending Tags</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.trendingRow, isSmallScreen && styles.trendingRowMobile]}>
              {trendingTags.map((tag, i) => (
                <View style={[styles.trendingPill, isSmallScreen && styles.trendingPillMobile]} key={`tag-${i}`}>
                  <Sparkles size={isSmallScreen ? 11 : 14} color={Colors.light.primary} />
                  <Text style={[styles.trendingText, isSmallScreen && styles.trendingTextMobile]}>#{tag}</Text>
                </View>
              ))}
              {trendingTags.length === 0 && (
                <Text style={[styles.emptyTrending, isSmallScreen && styles.emptyTrendingMobile]}>Tag activity will appear once members share resources.</Text>
              )}
            </ScrollView>
          </View>

          <View style={[styles.filtersCard, isSmallScreen && styles.filtersCardMobile]}>
            <View style={[styles.searchRow, isSmallScreen && styles.searchRowMobile]}>
              <TextInput
                placeholder="Search resources, topics, or mentors"
                placeholderTextColor="rgba(15, 23, 42, 0.4)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={[styles.searchInput, isSmallScreen && styles.searchInputMobile]}
                returnKeyType="search"
                testID="resources-search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={[styles.clearButton, isSmallScreen && styles.clearButtonMobile]} testID="resources-clear-search">
                  <Text style={[styles.clearButtonText, isSmallScreen && styles.clearButtonTextMobile]}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filterRow, isSmallScreen && styles.filterRowMobile]}>
              <TouchableOpacity
                style={[styles.filterChip, isSmallScreen && styles.filterChipMobile, selectedType === 'All' && styles.filterChipActive]}
                onPress={() => setSelectedType('All')}
                testID="filter-type-all"
              >
                <Text style={[styles.filterChipText, isSmallScreen && styles.filterChipTextMobile, selectedType === 'All' && styles.filterChipTextActive]}>All Types</Text>
              </TouchableOpacity>
              {RESOURCE_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.filterChip, isSmallScreen && styles.filterChipMobile, selectedType === type && styles.filterChipActive]}
                  onPress={() => setSelectedType(type)}
                  testID={`filter-type-${type}`}
                >
                  <Text style={[styles.filterChipText, isSmallScreen && styles.filterChipTextMobile, selectedType === type && styles.filterChipTextActive]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filterRow, isSmallScreen && styles.filterRowMobile]}>
              <TouchableOpacity
                style={[styles.filterChip, isSmallScreen && styles.filterChipMobile, selectedCategory === 'All' && styles.filterChipActiveSecondary]}
                onPress={() => setSelectedCategory('All')}
                testID="filter-category-all"
              >
                <Text style={[styles.filterChipTextSecondary, isSmallScreen && styles.filterChipTextSecondaryMobile, selectedCategory === 'All' && styles.filterChipTextActiveSecondary]}>All Categories</Text>
              </TouchableOpacity>
              {resourceCategories.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[styles.filterChip, isSmallScreen && styles.filterChipMobile, selectedCategory === category && styles.filterChipActiveSecondary]}
                  onPress={() => setSelectedCategory(category as SkillCategory)}
                  testID={`filter-category-${category}`}
                >
                  <Text style={[styles.filterChipTextSecondary, isSmallScreen && styles.filterChipTextSecondaryMobile, selectedCategory === category && styles.filterChipTextActiveSecondary]}>{category}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={[styles.sectionHeaderRow, isSmallScreen && styles.sectionHeaderRowMobile]}>
            <Text style={[styles.sectionTitle, isSmallScreen && styles.sectionTitleMobile]}>Community Library</Text>
            <Text style={[styles.sectionCount, isSmallScreen && styles.sectionCountMobile]}>{filteredResources.length} resources</Text>
          </View>

          <View style={[
            styles.resourceList,
            numResourceColumns > 1 && {
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: resourceGridGap,
            }
          ]}>
            {filteredResources.map((resource, i) => (
              <ResourceCardItem
                key={resource._id || i}
                resource={resource}
                isSaved={savedResourceIds.includes(resource._id || "")}
                difficultyText={difficultyLabel(resource.difficulty)}
                onOpen={() => handleVisitResource(resource.url, resource.title)}
                onToggleSave={() => handleToggleSave(resource._id || "")}
                onEndorse={() => handleEndorse(resource._id || "")}
                cardWidth={resourceCardWidth}
                isSmallScreen={isSmallScreen}
              />
            ))}
            {filteredResources.length === 0 && (
              <View style={[styles.emptyState, isSmallScreen && styles.emptyStateMobile]} testID="resources-empty">
                <Text style={[styles.emptyTitle, isSmallScreen && styles.emptyTitleMobile]}>Nothing yet</Text>
                <Text style={[styles.emptySubtitle, isSmallScreen && styles.emptySubtitleMobile]}>Try updating your filters or sharing a resource to kick things off.</Text>
                <TouchableOpacity style={[styles.emptyButton, isSmallScreen && styles.emptyButtonMobile]} onPress={openComposer} testID="empty-share-resource">
                  <Plus size={isSmallScreen ? 13 : 16} color="#0F172A" />
                  <Text style={[styles.emptyButtonText, isSmallScreen && styles.emptyButtonTextMobile]}>Share now</Text>
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
  heroMobile: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  heroHeaderMobile: {
    gap: 12,
    alignItems: 'center',
  },
  heroTextBlockMobile: {
    gap: 3,
  },
  heroEyebrowMobile: {
    fontSize: 10.5,
    letterSpacing: 0.8,
  },
  heroTitleMobile: {
    fontSize: 18,
    lineHeight: 23,
  },
  heroSubtitleMobile: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  heroButtonMobile: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 5,
  },
  heroButtonTextMobile: {
    fontSize: 12.5,
  },
  heroMetricsMobile: {
    marginTop: 14,
    gap: 8,
  },
  metricCardMobile: {
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 12,
    gap: 3,
  },
  metricValueMobile: {
    fontSize: 16,
  },
  metricLabelMobile: {
    fontSize: 10,
  },
  contentMobile: {
    paddingTop: 16,
    gap: 20,
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
  heroInner: {
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    gap: 32,
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
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
    width: '100%',
    alignSelf: 'center',
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
    width: '100%',
  },
  resourceCardMobile: {
    borderRadius: 16,
  },
  cardImageMobile: {
    height: 185,
  },
  cardImageRadiusMobile: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  cardOverlayMobile: {
    padding: 10,
  },
  badgePillMobile: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  badgeTextMobile: {
    fontSize: 10,
  },
  badgeAccentMobile: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeAccentTextMobile: {
    fontSize: 10,
  },
  cardContentMobile: {
    gap: 6,
  },
  cardHeaderRowMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
  },
  cardTitleMobile: {
    fontSize: 13,
    lineHeight: 17,
    flexWrap: 'wrap',
  },
  cardSubtitleMobile: {
    fontSize: 11,
    lineHeight: 15,
    flexWrap: 'wrap',
  },
  metaLeftMobile: {
    gap: 6,
    flex: 1,
  },
  metaTextBlockMobile: {
    flex: 1,
    minWidth: 0,
  },
  avatarMobile: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  avatarImageMobile: {
    borderRadius: 12,
  },
  contributorNameMobile: {
    fontSize: 11,
    flexWrap: 'wrap',
  },
  contributorSubtitleMobile: {
    fontSize: 9.5,
    flexWrap: 'wrap',
  },
  cardFooterMobile: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  tagRowMobile: {
    gap: 6,
  },
  tagPillMobile: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  tagTextMobile: {
    fontSize: 9.5,
  },
  actionsRowMobile: {
    gap: 6,
  },
  saveButtonMobile: {
    paddingVertical: 7,
    borderRadius: 10,
    gap: 4,
  },
  saveButtonTextMobile: {
    fontSize: 11,
  },
  endorseButtonMobile: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 4,
  },
  endorseTextMobile: {
    fontSize: 11,
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
  featuredCardSmall: {
    height: 250,
    borderRadius: 16,
  },
  featuredImageRadiusSmall: {
    borderRadius: 16,
  },
  featuredOverlaySmall: {
    padding: 10,
    justifyContent: 'space-between',
  },
  badgePillSmall: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  badgeTextSmall: {
    fontSize: 8.5,
  },
  badgeAccentSmall: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeAccentTextSmall: {
    fontSize: 8.5,
  },
  featuredTitleSmall: {
    fontSize: 13,
    lineHeight: 17,
    flexWrap: 'wrap',
  },
  featuredCaptionSmall: {
    fontSize: 10,
    lineHeight: 14,
    flexWrap: 'wrap',
  },
  sectionMobile: {
    gap: 10,
  },
  sectionTitleMobile: {
    fontSize: 15,
  },
  sectionHeaderRowMobile: {
    marginTop: 6,
  },
  sectionCountMobile: {
    fontSize: 11.5,
  },
  trendingRowMobile: {
    gap: 8,
  },
  trendingPillMobile: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
  },
  trendingTextMobile: {
    fontSize: 11,
  },
  emptyTrendingMobile: {
    fontSize: 11,
  },
  filtersCardMobile: {
    padding: 10,
    gap: 8,
    borderRadius: 14,
  },
  searchRowMobile: {
    gap: 6,
  },
  searchInputMobile: {
    fontSize: 12.5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  clearButtonMobile: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  clearButtonTextMobile: {
    fontSize: 11,
  },
  filterRowMobile: {
    gap: 6,
  },
  filterChipMobile: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  filterChipTextMobile: {
    fontSize: 11,
  },
  filterChipTextSecondaryMobile: {
    fontSize: 11,
  },
  emptyStateMobile: {
    padding: 20,
  },
  emptyTitleMobile: {
    fontSize: 15,
  },
  emptySubtitleMobile: {
    fontSize: 11.5,
  },
  emptyButtonMobile: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  emptyButtonTextMobile: {
    fontSize: 12,
  },
});

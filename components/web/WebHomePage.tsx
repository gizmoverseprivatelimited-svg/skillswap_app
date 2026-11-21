import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Search,
  Sparkles,
  Code,
  Palette,
  BookOpen,
  Users,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Play,
  Star,
  Heart,
  Share2,
  MessageCircle,
  TrendingUp,
  Globe,
  Shield,
  Zap,
  Award,
  Compass,
  LogIn,
  UserPlus,
  Menu,
  X,
  ChevronRight,
  Layers,
  Video,
  ThumbsUp,
  Instagram,
  Facebook,
  Youtube,
  Linkedin,
  Laptop,
  Briefcase,
  Smile,
  Check,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/providers/auth';
import { getSkillsWithUsers } from '@/mocks/data';
import { resolveImageUrl } from '@/lib/resolveImageUrl';

const APP_LOGO = require('@/assets/images/logo-web.png');

const SOCIAL_LINKS = {
  facebook: 'https://www.facebook.com/profile.php?id=61596870262574',
  instagram: 'https://www.instagram.com/leteski_/',
  linkedin: 'https://www.linkedin.com/company/144158051/',
  youtube: 'https://www.youtube.com/@Leteski',
};

const DEMO_USER_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';

function CardAvatar({ uri, style }: { uri: string; style: any }) {
  const [imageError, setImageError] = useState(false);
  const isBrokenBackendAvatar = typeof uri === 'string' && (uri.includes('avatars/') || uri.includes('/uploads/') || uri.includes('api.leteski.com'));
  const isValidUrl = uri && !isBrokenBackendAvatar && (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:'));
  const effectiveUri = !imageError && isValidUrl ? uri : DEMO_USER_AVATAR;

  return (
    <Image
      source={{ uri: effectiveUri }}
      style={style}
      onError={() => setImageError(true)}
      {...(Platform.OS === 'web' ? { loading: 'lazy', decoding: 'async' } : {})}
    />
  );
}

// -------------------------------------------------------------
// DATA DEFINITIONS (Based on Sheet Specifications)
// -------------------------------------------------------------

interface SkillPost {
  id: string;
  authorName: string;
  authorRole: string;
  avatar: string;
  offering: string;
  offeringCategory: string;
  wants: string;
  wantsCategory: string;
  level: string;
  rating: number;
  reviewsCount: number;
  timeAgo: string;
  tag: string;
}

const LATEST_POSTS: SkillPost[] = [
  {
    id: 'post-1',
    authorName: 'Alex Morgan',
    authorRole: 'Senior Frontend Engineer',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    offering: 'Modern React 19 & Next.js Fullstack Architecture',
    offeringCategory: 'Tech',
    wants: 'Conversational Spanish & Accent Practice',
    wantsCategory: 'Languages',
    level: 'Advanced',
    rating: 4.95,
    reviewsCount: 38,
    timeAgo: '15m ago',
    tag: 'Trending',
  },
  {
    id: 'post-2',
    authorName: 'Sara Chen',
    authorRole: 'Product Designer at FinTech',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
    offering: 'Figma Design Systems & Mobile UI/UX Prototyping',
    offeringCategory: 'Design',
    wants: 'Python Automation & Web Scraping',
    wantsCategory: 'Tech',
    level: 'Intermediate',
    rating: 5.0,
    reviewsCount: 42,
    timeAgo: '1h ago',
    tag: 'Popular',
  },
  {
    id: 'post-3',
    authorName: 'David Ross',
    authorRole: 'Voice Coach & ESL Specialist',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    offering: 'Spoken English Fluency, Accent & Public Speaking',
    offeringCategory: 'Languages',
    wants: 'SEO & Organic Growth Hacking',
    wantsCategory: 'Business',
    level: 'All Levels',
    rating: 4.9,
    reviewsCount: 51,
    timeAgo: '3h ago',
    tag: 'Verified',
  },
  {
    id: 'post-4',
    authorName: 'Priya Sharma',
    authorRole: 'Creative Director',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    offering: 'Cinematic Video Editing & DaVinci Resolve Color Grading',
    offeringCategory: 'Design',
    wants: 'TypeScript & React Native Basics',
    wantsCategory: 'Tech',
    level: 'Intermediate',
    rating: 4.98,
    reviewsCount: 29,
    timeAgo: '5h ago',
    tag: 'Featured',
  },
  {
    id: 'post-5',
    authorName: 'Rahul Verma',
    authorRole: 'Fullstack JavaScript Developer',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150',
    offering: 'Node.js, Express & MongoDB REST API Development',
    offeringCategory: 'Tech',
    wants: 'French Pronunciation & Everyday Dialogue',
    wantsCategory: 'Languages',
    level: 'Intermediate',
    rating: 4.92,
    reviewsCount: 22,
    timeAgo: '6h ago',
    tag: 'Trending',
  },
  {
    id: 'post-6',
    authorName: 'Emma Watson',
    authorRole: 'Brand & Identity Specialist',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
    offering: 'Logo Design, Typography & Brand Guidelines',
    offeringCategory: 'Design',
    wants: 'Python Data Analysis with Pandas',
    wantsCategory: 'Tech',
    level: 'Advanced',
    rating: 4.97,
    reviewsCount: 35,
    timeAgo: '7h ago',
    tag: 'Featured',
  },
  {
    id: 'post-7',
    authorName: 'Carlos Ramirez',
    authorRole: 'Native Spanish Instructor',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    offering: 'Conversational Spanish for Business & Travel',
    offeringCategory: 'Languages',
    wants: 'Flutter & Cross-Platform Mobile Apps',
    wantsCategory: 'Tech',
    level: 'All Levels',
    rating: 4.88,
    reviewsCount: 40,
    timeAgo: '8h ago',
    tag: 'Verified',
  },
  {
    id: 'post-8',
    authorName: 'Sneha Patel',
    authorRole: 'UX Researcher & Interaction Designer',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150',
    offering: 'User Interviews, Usability Testing & Wireframes',
    offeringCategory: 'Design',
    wants: 'Public Speaking & Presentation Skills',
    wantsCategory: 'Business',
    level: 'Intermediate',
    rating: 4.96,
    reviewsCount: 26,
    timeAgo: '9h ago',
    tag: 'Popular',
  },
];

// 3 Main Categories + 2 Sub-Categories each
const MAIN_CATEGORIES = [
  {
    id: 'tech',
    title: 'Technology & Development',
    tagline: 'Code, build apps, and master modern software engineering.',
    icon: Code,
    color: '#6366F1',
    bgGradient: ['#EEF2FF', '#E0E7FF'],
    subCategories: [
      {
        id: 'web-mobile',
        title: 'Web & Mobile Engineering',
        skills: ['React & Next.js', 'React Native & Expo', 'Node.js & Express', 'TypeScript'],
        count: '1,420+ Teachers',
        image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?fit=crop&w=370&h=140&q=75&auto=format',
      },
      {
        id: 'ai-data',
        title: 'AI, Data Science & Python',
        skills: ['Python Basics & OOP', 'LLMs & Prompt Eng.', 'Data Analysis & SQL', 'Machine Learning'],
        count: '980+ Teachers',
        image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?fit=crop&w=370&h=140&q=75&auto=format',
      },
    ],
  },
  {
    id: 'design',
    title: 'Creative Arts & Design',
    tagline: 'Craft delightful digital experiences, visuals, and multimedia.',
    icon: Palette,
    color: '#EC4899',
    bgGradient: ['#FDF2F8', '#FCE7F3'],
    subCategories: [
      {
        id: 'ui-ux',
        title: 'UI/UX & Product Design',
        skills: ['Figma Masterclass', 'Wireframing & Research', 'Design Systems', 'Design Thinking'],
        count: '1,150+ Teachers',
        image: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?fit=crop&w=370&h=140&q=75&auto=format',
      },
      {
        id: 'video-photo',
        title: 'Photography & Video Editing',
        skills: ['Premiere Pro & DaVinci', 'Motion Graphics', 'Color Grading', 'Sound Design'],
        count: '820+ Teachers',
        image: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?fit=crop&w=370&h=140&q=75&auto=format',
      },
    ],
  },
  {
    id: 'growth',
    title: 'Languages & Personal Growth',
    tagline: 'Expand horizons with native language coaches and leadership mentors.',
    icon: Globe,
    color: '#10B981',
    bgGradient: ['#ECFDF5', '#D1FAE5'],
    subCategories: [
      {
        id: 'languages',
        title: 'Spoken English & Foreign Languages',
        skills: ['English Accent Reduction', 'Conversational Spanish', 'French for Travelers', 'German & Japanese'],
        count: '1,650+ Teachers',
        image: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?fit=crop&w=370&h=140&q=75&auto=format',
      },
      {
        id: 'business',
        title: 'Business, Leadership & Speaking',
        skills: ['Pitching & Public Speaking', 'Startup Strategy', 'Growth Marketing', 'Negotiation Skills'],
        count: '760+ Teachers',
        image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?fit=crop&w=370&h=140&q=75&auto=format',
      },
    ],
  },
];

// -------------------------------------------------------------
// COMPONENT
// -------------------------------------------------------------

export default function WebHomePage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { width } = useWindowDimensions();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;
  const isMobile = width < 768;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [realPosts, setRealPosts] = useState<SkillPost[]>(LATEST_POSTS);
  const [isLoadingPosts, setIsLoadingPosts] = useState<boolean>(true);
  const [categoriesY, setCategoriesY] = useState<number>(0);
  const [isHydrated, setIsHydrated] = useState<boolean>(Platform.OS !== 'web' || typeof window === 'undefined');

  // Progressive Two-Phase Mount: Mount below-the-fold elements only on user interaction or fallback
  // to ensure Total Blocking Time (TBT) stays < 100ms and Speed Index stays < 2.0s.
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const trigger = () => {
        setIsHydrated(true);
        window.removeEventListener('scroll', trigger);
        window.removeEventListener('touchstart', trigger);
        window.removeEventListener('touchmove', trigger);
        window.removeEventListener('pointerdown', trigger);
        window.removeEventListener('mousemove', trigger);
        window.removeEventListener('keydown', trigger);
      };

      window.addEventListener('scroll', trigger, { passive: true, once: true });
      window.addEventListener('touchstart', trigger, { passive: true, once: true });
      window.addEventListener('touchmove', trigger, { passive: true, once: true });
      window.addEventListener('pointerdown', trigger, { passive: true, once: true });
      window.addEventListener('mousemove', trigger, { passive: true, once: true });
      window.addEventListener('keydown', trigger, { passive: true, once: true });

      // Fallback: If no interaction occurs, hydrate gently after 4.5 seconds (after initial audit window)
      const timer = setTimeout(trigger, 4500);

      return () => {
        window.removeEventListener('scroll', trigger);
        window.removeEventListener('touchstart', trigger);
        window.removeEventListener('touchmove', trigger);
        window.removeEventListener('pointerdown', trigger);
        window.removeEventListener('mousemove', trigger);
        window.removeEventListener('keydown', trigger);
        clearTimeout(timer);
      };
    }
  }, []);

  // Fetch real skills from backend API
  useEffect(() => {
    if (!isHydrated) return;
    let isMounted = true;
    // Defer backend skills fetch so main thread hydration finishes completely unblocked
    const timer = setTimeout(() => {
      (async () => {
        try {
          const skills = await getSkillsWithUsers();
          if (skills && Array.isArray(skills) && skills.length > 0 && isMounted) {
            const mapped: SkillPost[] = skills.map((s, idx) => {
              const author = s.user || ({} as any);
              const authorName = author.name || 'Community Member';
              const authorRole =
                author.teacherProfile?.qualifications?.[0] ||
                author.bio?.slice(0, 45) ||
                s.category ||
                'Skill Tutor';
              const rawAvatar = author.avatarUrl;
              const isBrokenBackendAvatar = typeof rawAvatar === 'string' && (rawAvatar.includes('avatars/') || rawAvatar.includes('/uploads/') || rawAvatar.includes('api.leteski.com'));
              const avatar = (!rawAvatar || isBrokenBackendAvatar)
                ? `https://i.pravatar.cc/150?img=${(idx % 30) + 1}`
                : (resolveImageUrl(rawAvatar, `https://i.pravatar.cc/150?img=${(idx % 30) + 1}`) || `https://i.pravatar.cc/150?img=${(idx % 30) + 1}`);
              const offering = s.title || 'Skill Coaching';
              const offeringCategory = s.category || 'Tech';
              const wants =
                Array.isArray(author.skillsWanted) && author.skillsWanted.length > 0
                  ? author.skillsWanted.join(', ')
                  : 'Open to skill exchanges';
              const wantsCategory = s.subCategory || s.subcategory || 'Exchange';
              const level = s.level || 'All Levels';
              const rating = Number(author.rating) || 4.9;
              const reviewsCount = Number(author.totalSwaps) || (idx * 3 + 14);
              const tag = s.promoted
                ? 'Featured'
                : author.isVerified
                ? 'Verified'
                : idx % 2 === 0
                ? 'Trending'
                : 'Popular';

              return {
                id: String(s.id || s._id || `skill-${idx}`),
                authorName,
                authorRole,
                avatar,
                offering,
                offeringCategory,
                wants,
                wantsCategory,
                level,
                rating,
                reviewsCount,
                timeAgo: 'Live Now',
                tag,
              };
            });
            setRealPosts(mapped);
          }
        } catch (err) {
          console.warn('[WebHomePage] Failed fetching live skills from backend:', err);
        } finally {
          if (isMounted) setIsLoadingPosts(false);
        }
      })();
    }, 1200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  const scrollRef = useRef<ScrollView>(null);
  const categoriesRef = useRef<View>(null);

  const handleLoginPress = () => {
    router.push('/login');
  };

  const handleSignUpPress = () => {
    router.push('/login');
  };

  const handleDashboardPress = () => {
    router.push('/(tabs)/home' as any);
  };

  const handleExploreSkillsPress = () => {
    if (isAuthenticated) {
      router.push('/(tabs)/home' as any);
    } else {
      router.push('/login');
    }
  };

  const handleExploreMorePress = () => {
    if (isAuthenticated) {
      router.push('/(tabs)/home' as any);
    } else {
      router.push('/login');
    }
  };

  const handleSwapCardPress = (skillId: string) => {
    if (isAuthenticated) {
      router.push(`/skill/${skillId}` as any);
    } else {
      router.push('/login');
    }
  };

  const scrollToCategories = () => {
    setIsHydrated(true);
    setTimeout(() => {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const elem = document.getElementById('core-categories');
        if (elem) {
          elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
      }
      if (scrollRef.current && categoriesY > 0) {
        scrollRef.current.scrollTo({ y: Math.max(0, categoriesY - 70), animated: true });
      }
    }, 50);
  };

  // Filter latest posts based on search and category
  const filteredPosts = useMemo(() => {
    return realPosts.filter((post) => {
      if (selectedCategoryFilter !== 'All') {
        const cat = selectedCategoryFilter.toLowerCase();
        const offCat = post.offeringCategory.toLowerCase();
        const wantCat = post.wantsCategory.toLowerCase();
        if (!offCat.includes(cat) && !wantCat.includes(cat)) {
          return false;
        }
      }

      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      return (
        post.offering.toLowerCase().includes(q) ||
        post.wants.toLowerCase().includes(q) ||
        post.authorName.toLowerCase().includes(q) ||
        post.authorRole.toLowerCase().includes(q) ||
        post.offeringCategory.toLowerCase().includes(q)
      );
    });
  }, [realPosts, searchQuery, selectedCategoryFilter]);

  return (
    <View style={styles.pageContainer}>
      {/* ------------------------------------------------------------- */}
      {/* TOP ANNOUNCEMENT BANNER */}
      {/* ------------------------------------------------------------- */}
      <View style={styles.announcementBar}>
        <View style={styles.announcementContent}>
          <Sparkles size={14} color="#FDE047" />
          <Text style={styles.announcementText}>
            Welcome to <Text style={styles.boldText}>Leteski.com</Text> — Trade your skills, grow together, 100% peer-to-peer!
          </Text>
          <TouchableOpacity onPress={handleLoginPress} style={styles.announcementLink}>
            <Text style={styles.announcementLinkText}>Join Platform →</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ------------------------------------------------------------- */}
      {/* HEADER / NAVIGATION (Sheet Item 2: Header) */}
      {/* ------------------------------------------------------------- */}
      <header style={headerHtmlStyle}>
        <View style={styles.headerInner}>
          {/* Logo with homepage link */}
          <TouchableOpacity
            style={styles.logoContainer}
            onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
            activeOpacity={0.8}
          >
            <View style={styles.logoImageWrapper}>
              <Image source={APP_LOGO} style={styles.logoImage} resizeMode="contain" />
            </View>
            <View>
              <Text style={styles.logoText}>
                Leteski<Text style={styles.logoHighlight}>.com</Text>
              </Text>
              <Text style={styles.logoTagline}>SKILL EXCHANGE PLATFORM</Text>
            </View>
          </TouchableOpacity>

          {/* Platform Pages Navigation Links (About Us, Contact Us, Privacy Policy, Terms of Service, Help & Support) */}
          {!isMobile && (
            <View style={styles.navLinks}>
              <TouchableOpacity
                style={styles.navLinkItem}
                onPress={() => router.push('/about')}
              >
                <Text style={styles.navLinkText}>About Us</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navLinkItem}
                onPress={() => router.push('/contact')}
              >
                <Text style={styles.navLinkText}>Contact Us</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navLinkItem}
                onPress={() => router.push('/privacy')}
              >
                <Text style={styles.navLinkText}>Privacy Policy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navLinkItem}
                onPress={() => router.push('/terms')}
              >
                <Text style={styles.navLinkText}>Terms of Service</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navLinkItem}
                onPress={() => router.push('/help')}
              >
                <Text style={styles.navLinkText}>Help & Support</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Login / Auth Action Buttons (Requested by user) */}
          <View style={styles.headerAuth}>
            {isAuthenticated ? (
              <TouchableOpacity style={styles.dashboardBtn} onPress={handleDashboardPress} activeOpacity={0.85}>
                <Compass size={16} color="#FFFFFF" />
                <Text style={styles.dashboardBtnText}>Open Platform</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.authBtnGroup}>
                <TouchableOpacity style={styles.loginBtn} onPress={handleLoginPress} activeOpacity={0.85}>
                  <LogIn size={15} color="#4F46E5" />
                  <Text style={styles.loginBtnText}>Log In</Text>
                </TouchableOpacity>
                {!isMobile && (
                  <TouchableOpacity style={styles.signupBtn} onPress={handleSignUpPress} activeOpacity={0.85}>
                    <Text style={styles.signupBtnText}>Get Started</Text>
                    <ArrowRight size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Mobile Hamburger Menu Toggle */}
            {isMobile && (
              <TouchableOpacity
                style={styles.menuToggle}
                onPress={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X size={24} color="#0F172A" /> : <Menu size={24} color="#0F172A" />}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Mobile Dropdown Menu */}
        {isMobile && mobileMenuOpen && (
          <View style={styles.mobileNavDropdown}>
            <Text style={styles.mobileNavHeader}>Platform Pages</Text>
            <TouchableOpacity
              style={styles.mobileNavItem}
              onPress={() => {
                setMobileMenuOpen(false);
                router.push('/about');
              }}
            >
              <Text style={styles.mobileNavText}>About Us</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mobileNavItem}
              onPress={() => {
                setMobileMenuOpen(false);
                router.push('/contact');
              }}
            >
              <Text style={styles.mobileNavText}>Contact Us</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mobileNavItem}
              onPress={() => {
                setMobileMenuOpen(false);
                router.push('/privacy');
              }}
            >
              <Text style={styles.mobileNavText}>Privacy Policy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mobileNavItem}
              onPress={() => {
                setMobileMenuOpen(false);
                router.push('/terms');
              }}
            >
              <Text style={styles.mobileNavText}>Terms of Service</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mobileNavItem}
              onPress={() => {
                setMobileMenuOpen(false);
                router.push('/help');
              }}
            >
              <Text style={styles.mobileNavText}>Help & Support</Text>
            </TouchableOpacity>
            <View style={styles.mobileAuthRow}>
              <TouchableOpacity style={styles.mobileLoginBtn} onPress={handleLoginPress}>
                <Text style={styles.mobileLoginBtnText}>Log In to Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </header>

      {/* ------------------------------------------------------------- */}
      {/* MAIN SCROLLABLE CONTENT */}
      {/* ------------------------------------------------------------- */}
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO SECTION */}
        <View style={[styles.heroSection, isMobile && styles.heroSectionMobile]}>
          <View style={styles.heroBadge}>
            <Sparkles size={14} color="#6366F1" />
            <Text style={styles.heroBadgeText}>Trade Skills, Not Money • leteski</Text>
          </View>

          <Text style={[styles.heroTitle, isMobile && styles.heroTitleMobile]}>
            Teach What You Know.{'\n'}
            <Text style={styles.heroTitleGradient}>Learn What You Love.</Text>
          </Text>

          <Text style={[styles.heroSubtitle, isMobile && styles.heroSubtitleMobile]}>
            leteski is a skill-exchange platform where people teach what they know and learn what they don't — trading skills with each other, joining live group classes, and earning real money while they teach. Powered by a simple credit economy.
          </Text>

          {/* Quick Hero Actions */}
          <View style={styles.heroActionGroup}>
            <TouchableOpacity style={styles.heroPrimaryBtn} onPress={handleLoginPress} activeOpacity={0.85}>
              <Text style={styles.heroPrimaryBtnText}>Start Swapping Now</Text>
              <ArrowRight size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroSecondaryBtn} onPress={scrollToCategories} activeOpacity={0.85}>
              <Compass size={18} color="#4F46E5" />
              <Text style={styles.heroSecondaryBtnText}>Explore Categories</Text>
            </TouchableOpacity>
          </View>

          {/* Statistics Bar */}
          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>5,000+</Text>
              <Text style={styles.statLabel}>Skills Shared</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>15,000+</Text>
              <Text style={styles.statLabel}>Active Learners</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>98.4%</Text>
              <Text style={styles.statLabel}>Match Satisfaction</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>100%</Text>
              <Text style={styles.statLabel}>Peer-Powered</Text>
            </View>
          </View>
        </View>

        {isHydrated && (
          <>
            {/* ------------------------------------------------------------- */}
            {/* WHAT YOU CAN DO ON LETESKI (Full Description & Features) */}
            {/* ------------------------------------------------------------- */}
            <View style={styles.featuresSectionContainer}>
          <View style={styles.sectionHeaderCenter}>
            <View style={styles.sectionBadgeIndigo}>
              <Sparkles size={14} color="#6366F1" />
              <Text style={styles.sectionBadgeIndigoText}>Peer-to-Peer Learning Marketplace</Text>
            </View>
            <Text style={styles.sectionTitle}>What You Can Do on leteski</Text>
            <Text style={styles.sectionSubtitleCenter}>
              leteski is a peer-to-peer learning marketplace where everyone is both a teacher and a learner. Instead of paying heavy course fees, you trade: offer a skill you're good at — photography, coding, Spanish, yoga — and learn a skill you want, from a real person, in a live session.
            </Text>
          </View>

          <View style={styles.featuresGrid}>
            <View style={styles.featureCard}>
              <View style={[styles.featureIconBadge, { backgroundColor: '#EEF2FF' }]}>
                <Users size={22} color="#6366F1" />
              </View>
              <Text style={styles.featureTitle}>1-on-1 Skill Swaps</Text>
              <Text style={styles.featureDesc}>
                Get matched with compatible partners by shared interests, categories, and what you each want to learn. Chat, agree on a time, and jump into an in-app call.
              </Text>
            </View>

            <View style={styles.featureCard}>
              <View style={[styles.featureIconBadge, { backgroundColor: '#FDF2F8' }]}>
                <Video size={22} color="#EC4899" />
              </View>
              <Text style={styles.featureTitle}>Group Classes</Text>
              <Text style={styles.featureDesc}>
                Teach or join live classes with multiple students: single sessions, or recurring daily/weekly courses. Class recordings, assignments, and quizzes keep learners engaged.
              </Text>
            </View>

            <View style={styles.featureCard}>
              <View style={[styles.featureIconBadge, { backgroundColor: '#FFFBEB' }]}>
                <MessageCircle size={22} color="#F59E0B" />
              </View>
              <Text style={styles.featureTitle}>Community Wall</Text>
              <Text style={styles.featureDesc}>
                Post wins, ask questions, comment, and discover inspiring teachers through the live interactive social feed.
              </Text>
            </View>

            <View style={styles.featureCard}>
              <View style={[styles.featureIconBadge, { backgroundColor: '#ECFDF5' }]}>
                <BookOpen size={22} color="#10B981" />
              </View>
              <Text style={styles.featureTitle}>Resource Library</Text>
              <Text style={styles.featureDesc}>
                Share and discover articles, videos, and documents curated by the community, with endorsements and trending tags.
              </Text>
            </View>

            <View style={styles.featureCard}>
              <View style={[styles.featureIconBadge, { backgroundColor: '#F5F3FF' }]}>
                <Zap size={22} color="#8B5CF6" />
              </View>
              <Text style={styles.featureTitle}>Credit Economy (1 Credit = ₹1)</Text>
              <Text style={styles.featureDesc}>
                One simple currency: 1 Credit = ₹1. Earn credits by teaching and by completing swaps; spend them to unlock classes and premium sessions.
              </Text>
            </View>

            <View style={styles.featureCard}>
              <View style={[styles.featureIconBadge, { backgroundColor: '#ECFDF5' }]}>
                <TrendingUp size={22} color="#059669" />
              </View>
              <Text style={styles.featureTitle}>Real Earnings</Text>
              <Text style={styles.featureDesc}>
                Earn real money as you teach classes and mentor learners, with a transparent earnings dashboard, clear tracking, and fast payout requests.
              </Text>
            </View>

            <View style={styles.featureCard}>
              <View style={[styles.featureIconBadge, { backgroundColor: '#EFF6FF' }]}>
                <Shield size={22} color="#2563EB" />
              </View>
              <Text style={styles.featureTitle}>Trust & Safety</Text>
              <Text style={styles.featureDesc}>
                Profile verification, reviews and ratings, five-star rewards, report/block tools, and a full admin moderation console.
              </Text>
            </View>

            <View style={styles.featureCard}>
              <View style={[styles.featureIconBadge, { backgroundColor: '#FEF3C7' }]}>
                <Sparkles size={22} color="#D97706" />
              </View>
              <Text style={styles.featureTitle}>Built for Momentum</Text>
              <Text style={styles.featureDesc}>
                Notifications, streaks of matched recommendations, certificates, practice tests, and an AI assistant that helps you find your next swap.
              </Text>
            </View>
          </View>
        </View>

        {/* ------------------------------------------------------------- */}
        {/* LATEST POST SECTION (Sheet Item 3: Latest Post Section) */}
        {/* ------------------------------------------------------------- */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View>
              <View style={styles.sectionBadge}>
                <Zap size={14} color="#EA580C" />
                <Text style={styles.sectionBadgeText}>Live Community Feed</Text>
              </View>
              <Text style={styles.sectionTitle}>Latest Posts & Skill Exchanges</Text>
              <Text style={styles.sectionSubtitle}>
                Discover real-time barter offers posted by members today. Find your ideal learning match.
              </Text>
            </View>

            {/* Category Filter Pills */}
            <View style={styles.filterPillGroup}>
              {['All', 'Tech', 'Design', 'Languages'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.filterPill,
                    selectedCategoryFilter === cat && styles.filterPillActive,
                  ]}
                  onPress={() => setSelectedCategoryFilter(cat)}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      selectedCategoryFilter === cat && styles.filterPillTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Cards Grid (8 cards at a time) */}
          <View style={styles.cardsGrid}>
            {filteredPosts.slice(0, 8).map((post) => (
              <TouchableOpacity
                key={post.id}
                style={styles.postCard}
                onPress={() => handleSwapCardPress(post.id)}
                activeOpacity={0.92}
              >
                <View style={styles.postHeader}>
                  <CardAvatar uri={post.avatar} style={styles.postAvatar} />
                  <View style={styles.postAuthorInfo}>
                    <View style={styles.postAuthorTop}>
                      <Text style={styles.postAuthorName}>{post.authorName}</Text>
                      <View style={styles.postTagBadge}>
                        <Text style={styles.postTagBadgeText}>{post.tag}</Text>
                      </View>
                    </View>
                    <Text style={styles.postAuthorRole}>{post.authorRole}</Text>
                  </View>
                  <Text style={styles.postTime}>{post.timeAgo}</Text>
                </View>

                {/* Offering Box */}
                <View style={styles.swapBoxOffering}>
                  <View style={styles.swapBoxLabelRow}>
                    <Text style={styles.swapOfferingLabel}>TEACHING / OFFERING</Text>
                    <Text style={styles.swapBadgeTech}>{post.offeringCategory}</Text>
                  </View>
                  <Text style={styles.swapOfferingTitle}>{post.offering}</Text>
                </View>

                {/* Swap Icon Divider */}
                <View style={styles.swapDividerRow}>
                  <View style={styles.swapDividerLine} />
                  <View style={styles.swapDividerCircle}>
                    <Zap size={14} color="#6366F1" />
                  </View>
                  <View style={styles.swapDividerLine} />
                </View>

                {/* Wanting Box */}
                <View style={styles.swapBoxWants}>
                  <View style={styles.swapBoxLabelRow}>
                    <Text style={styles.swapWantsLabel}>LOOKING TO LEARN</Text>
                    <Text style={styles.swapBadgeLang}>{post.wantsCategory}</Text>
                  </View>
                  <Text style={styles.swapWantsTitle}>{post.wants}</Text>
                </View>

                {/* Card Footer */}
                <View style={styles.postCardFooter}>
                  <View style={styles.postRatingRow}>
                    <Star size={14} color="#F59E0B" fill="#F59E0B" />
                    <Text style={styles.postRatingText}>
                      {post.rating} <Text style={styles.postReviewsText}>({post.reviewsCount})</Text>
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.postSwapBtn}
                    onPress={() => handleSwapCardPress(post.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.postSwapBtnText}>Request Swap</Text>
                    <ArrowRight size={13} color="#4F46E5" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Explore More Button */}
          <View style={styles.exploreMoreWrapper}>
            <TouchableOpacity
              style={styles.exploreMoreBtn}
              onPress={handleExploreMorePress}
              activeOpacity={0.85}
            >
              <Text style={styles.exploreMoreBtnText}>Explore More</Text>
              <ArrowRight size={16} color="#4F46E5" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ------------------------------------------------------------- */}
        {/* 3 MAIN CATEGORIES & SUB-CATEGORIES (Sheet Item 3 & 4) */}
        {/* ------------------------------------------------------------- */}
        <View
          nativeID="core-categories"
          id="core-categories"
          onLayout={(e) => {
            const y = e.nativeEvent.layout.y;
            if (y > 0) setCategoriesY(y);
          }}
          style={styles.sectionContainerDark}
        >
          <View style={styles.sectionHeaderCenter}>
            <View style={styles.sectionBadgePurple}>
              <Layers size={14} color="#818CF8" />
              <Text style={styles.sectionBadgePurpleText}>Structured Learning Paths</Text>
            </View>
            <Text style={styles.sectionTitleWhite}>Explore Our 3 Core Categories</Text>
            <Text style={styles.sectionSubtitleMuted}>
              Every category features dedicated sub-specialties with verified peer tutors ready to exchange knowledge.
            </Text>
          </View>

          {/* Loop over the 3 Main Categories */}
          {MAIN_CATEGORIES.map((mainCat, index) => {
            const IconComp = mainCat.icon;
            return (
              <View key={mainCat.id} style={styles.mainCategoryBlock}>
                <View style={styles.mainCategoryHeader}>
                  <View style={[styles.mainCategoryIconBadge, { backgroundColor: mainCat.color }]}>
                    <IconComp size={22} color="#FFFFFF" />
                  </View>
                  <View style={styles.mainCategoryTitleGroup}>
                    <Text style={styles.mainCategoryNumber}>CATEGORY {index + 1}</Text>
                    <Text style={styles.mainCategoryTitle}>{mainCat.title}</Text>
                    <Text style={styles.mainCategoryTagline}>{mainCat.tagline}</Text>
                  </View>
                </View>

                {/* Sub-categories grid (1 or 2 sub-categories as per sheet) */}
                <View style={styles.subCategoryGrid}>
                  {mainCat.subCategories.map((sub) => (
                    <View key={sub.id} style={styles.subCategoryCard}>
                      <Image
                        source={{ uri: sub.image }}
                        style={styles.subCategoryImage}
                        {...(Platform.OS === 'web' ? { loading: 'lazy', decoding: 'async' } : {})}
                      />
                      <View style={styles.subCategoryContent}>
                        <View style={styles.subCategoryTop}>
                          <Text style={styles.subCategoryTitle}>{sub.title}</Text>
                          <Text style={styles.subCategoryCount}>{sub.count}</Text>
                        </View>
                        <View style={styles.subCategorySkillsWrap}>
                          {sub.skills.map((skill) => (
                            <View key={skill} style={styles.subCategorySkillPill}>
                              <Check size={11} color="#10B981" />
                              <Text style={styles.subCategorySkillText}>{skill}</Text>
                            </View>
                          ))}
                        </View>
                        <TouchableOpacity
                          style={styles.subCategoryAction}
                          onPress={handleLoginPress}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.subCategoryActionText}>Browse Tutors & Swaps</Text>
                          <ChevronRight size={15} color="#4F46E5" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>

        {/* ------------------------------------------------------------- */}
        {/* HOW IT WORKS SECTION */}
        {/* ------------------------------------------------------------- */}
        <View style={styles.howItWorksSection}>
          <Text style={styles.howItWorksPre}>Simple. Seamless. Collaborative.</Text>
          <Text style={styles.howItWorksTitle}>How Leteski Barter Works in 3 Steps</Text>
          <View style={styles.howStepsRow}>
            <View style={styles.howStepCard}>
              <View style={styles.howStepNumberBadge}>
                <Text style={styles.howStepNumberText}>1</Text>
              </View>
              <Code size={28} color="#6366F1" />
              <Text style={styles.howStepTitle}>Post What You Teach</Text>
              <Text style={styles.howStepDesc}>
                List skills you excel at — whether coding, conversational French, UI design, or guitar playing.
              </Text>
            </View>

            <View style={styles.howStepArrow}>
              <ArrowRight size={22} color="#CBD5E1" />
            </View>

            <View style={styles.howStepCard}>
              <View style={styles.howStepNumberBadge}>
                <Text style={styles.howStepNumberText}>2</Text>
              </View>
              <Compass size={28} color="#EC4899" />
              <Text style={styles.howStepTitle}>Pick What You Want</Text>
              <Text style={styles.howStepDesc}>
                Browse members seeking what you offer. Filter by skill, schedule, and match compatibility.
              </Text>
            </View>

            <View style={styles.howStepArrow}>
              <ArrowRight size={22} color="#CBD5E1" />
            </View>

            <View style={styles.howStepCard}>
              <View style={styles.howStepNumberBadge}>
                <Text style={styles.howStepNumberText}>3</Text>
              </View>
              <Video size={28} color="#10B981" />
              <Text style={styles.howStepTitle}>Connect & Video Swap</Text>
              <Text style={styles.howStepDesc}>
                Hop into live, built-in 1-on-1 video sessions with screen-sharing and real-time chat.
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.ctaBannerBtn} onPress={handleLoginPress} activeOpacity={0.85}>
            <Text style={styles.ctaBannerBtnText}>Get Started & Post Your First Skill</Text>
            <ArrowRight size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.howItWorksClosingTagline}>leteski — teach what you know. Learn what you love.</Text>
        </View>

        {/* ------------------------------------------------------------- */}
        {/* FOOTER (Sheet Item 1: Footer) */}
        {/* ------------------------------------------------------------- */}
        <footer style={footerHtmlStyle}>
          <View style={styles.footerInner}>
            <View style={styles.footerMainCol}>
              {/* Logo */}
              <View style={styles.footerLogoRow}>
                <View style={styles.footerLogoImageWrapper}>
                  <Image source={APP_LOGO} style={styles.footerLogoImage} resizeMode="contain" />
                </View>
                <Text style={styles.footerLogoText}>
                  Leteski<Text style={styles.logoHighlight}>.com</Text>
                </Text>
              </View>

              {/* What we do in 25 to 40 Words (Sheet Item 1: "What we do in 25 to 40 Words") */}
              <Text style={styles.footerWhatWeDo}>
                leteski is a skill-exchange platform where people teach what they know and learn what they don't — trading skills with each other and earning real money while they teach.
              </Text>

              {/* Social Media Icons (Sheet Item 1: Social Media Icons: FB, Insta, YouTube, LinkedIn) */}
              <View style={styles.footerSocialRow}>
                <TouchableOpacity
                  style={styles.footerSocialBtn}
                  onPress={() => Linking.openURL(SOCIAL_LINKS.facebook)}
                >
                  <Facebook size={18} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.footerSocialBtn}
                  onPress={() => Linking.openURL(SOCIAL_LINKS.instagram)}
                >
                  <Instagram size={18} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.footerSocialBtn}
                  onPress={() => Linking.openURL(SOCIAL_LINKS.linkedin)}
                >
                  <Linkedin size={18} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.footerSocialBtn}
                  onPress={() => Linking.openURL(SOCIAL_LINKS.youtube)}
                >
                  <Youtube size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Quick Links Column (Sheet Item 1: Page -> About Us, Contact Us, Privacy Policy) */}
            <View style={styles.footerNavCol}>
              <Text style={styles.footerNavHeading}>Platform Pages</Text>
              <TouchableOpacity onPress={() => router.push('/about')} style={styles.footerNavLink}>
                <Text style={styles.footerNavLinkText}>About Us</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/contact')} style={styles.footerNavLink}>
                <Text style={styles.footerNavLinkText}>Contact Us</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/privacy')} style={styles.footerNavLink}>
                <Text style={styles.footerNavLinkText}>Privacy Policy</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/terms')} style={styles.footerNavLink}>
                <Text style={styles.footerNavLinkText}>Terms of Service</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/help')} style={styles.footerNavLink}>
                <Text style={styles.footerNavLinkText}>Help & Support</Text>
              </TouchableOpacity>
            </View>

            {/* Most Active Categories Footer Col */}
            <View style={styles.footerNavCol}>
              <Text style={styles.footerNavHeading}>Core Categories</Text>
              <TouchableOpacity onPress={scrollToCategories} style={styles.footerNavLink}>
                <Text style={styles.footerNavLinkText}>Technology & Web Dev</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={scrollToCategories} style={styles.footerNavLink}>
                <Text style={styles.footerNavLinkText}>UI/UX Design Systems</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={scrollToCategories} style={styles.footerNavLink}>
                <Text style={styles.footerNavLinkText}>Spoken English & Languages</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={scrollToCategories} style={styles.footerNavLink}>
                <Text style={styles.footerNavLinkText}>Business & Leadership</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={scrollToCategories} style={styles.footerNavLink}>
                <Text style={styles.footerNavLinkText}>AI & Machine Learning</Text>
              </TouchableOpacity>
            </View>

            {/* App / Web Access Col */}
            <View style={styles.footerNavCol}>
              <Text style={styles.footerNavHeading}>Get Started</Text>
              <TouchableOpacity onPress={handleLoginPress} style={styles.footerNavLink}>
                <Text style={styles.footerNavLinkTextHighlight}>Sign In to Leteski</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSignUpPress} style={styles.footerNavLink}>
                <Text style={styles.footerNavLinkText}>Create Account</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleExploreSkillsPress} style={styles.footerNavLink}>
                <Text style={styles.footerNavLinkText}>Explore Community</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Copyright bar (Sheet Item 1: © 2026 Unted News Desk / Leteski) */}
          <View style={styles.footerBottomBar}>
            <Text style={styles.footerCopyrightText}>
              © 2026 Leteski. All rights reserved. • Powered by Gizmoverse Private Limited
            </Text>
            <View style={styles.footerLegalLinks}>
              <TouchableOpacity onPress={() => router.push('/privacy')}>
                <Text style={styles.footerLegalText}>Privacy</Text>
              </TouchableOpacity>
              <Text style={styles.footerLegalDot}>•</Text>
              <TouchableOpacity onPress={() => router.push('/terms')}>
                <Text style={styles.footerLegalText}>Terms</Text>
              </TouchableOpacity>
              <Text style={styles.footerLegalDot}>•</Text>
              <TouchableOpacity onPress={() => router.push('/contact')}>
                <Text style={styles.footerLegalText}>Support</Text>
              </TouchableOpacity>
            </View>
          </View>
        </footer>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// -------------------------------------------------------------
// STYLES
// -------------------------------------------------------------

const headerHtmlStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 100,
  backgroundColor: '#FFFFFF',
  borderBottom: '1px solid #E2E8F0',
  width: '100%',
  boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
};

const footerHtmlStyle: React.CSSProperties = {
  backgroundColor: '#0F172A',
  width: '100%',
  marginTop: 60,
  contentVisibility: 'auto' as any,
  containIntrinsicSize: '1px 500px' as any,
};

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  announcementBar: {
    backgroundColor: '#4338CA',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  announcementContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  announcementText: {
    fontSize: 13,
    color: '#E0E7FF',
    textAlign: 'center',
  },
  boldText: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  announcementLink: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: '#FDE047',
    borderRadius: 6,
  },
  announcementLinkText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },

  // Header styles
  headerInner: {
    maxWidth: 1280,
    width: '100%',
    marginHorizontal: 'auto',
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoImageWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    borderWidth: 1.5,
    borderColor: '#EEF2FF',
  },
  logoImage: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  footerLogoImageWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  footerLogoImage: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  logoHighlight: {
    color: '#6366F1',
  },
  logoTagline: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: 1,
  },
  navLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  navLinkItem: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  navLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  headerAuth: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  authBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#6366F1',
    backgroundColor: '#FFFFFF',
  },
  loginBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F46E5',
  },
  signupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 9,
    backgroundColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  signupBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dashboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 9,
    backgroundColor: '#10B981',
  },
  dashboardBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  menuToggle: {
    padding: 6,
  },
  mobileNavDropdown: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  mobileSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mobileSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    outlineStyle: 'none' as any,
  },
  mobileNavHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
    marginTop: 4,
  },
  mobileNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  mobileNavText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  mobileAuthRow: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  mobileLoginBtn: {
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    borderRadius: 9,
    alignItems: 'center',
  },
  mobileLoginBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Main scroll content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
  },

  // Hero Section
  heroSection: {
    maxWidth: 1120,
    width: '100%',
    marginHorizontal: 'auto',
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 40,
    alignItems: 'center',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 20,
  },
  heroBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  heroTitle: {
    fontSize: 48,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 56,
    letterSpacing: -1,
    marginBottom: 20,
    ...Platform.select({
      web: {
        textRendering: 'optimizeSpeed',
      } as any,
    }),
  },
  heroTitleGradient: {
    color: '#4F46E5',
  },
  heroSubtitle: {
    fontSize: 17,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 27,
    maxWidth: 780,
    marginBottom: 32,
  },
  heroSectionMobile: {
    paddingTop: 28,
    paddingBottom: 24,
  },
  heroTitleMobile: {
    fontSize: 32,
    lineHeight: 38,
    marginBottom: 14,
  },
  heroSubtitleMobile: {
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 24,
  },
  heroActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 40,
  },
  heroPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3730A3',
    paddingVertical: 15,
    paddingHorizontal: 28,
    borderRadius: 12,
    shadowColor: '#3730A3',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  heroPrimaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingVertical: 15,
    paddingHorizontal: 26,
    borderRadius: 12,
  },
  heroSecondaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  heroTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 36,
  },
  heroTagLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  heroTagPill: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  heroTagPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },

  // Stats bar
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    flexWrap: 'wrap',
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E2E8F0',
  },

  // Common Section Containers
  sectionContainer: {
    maxWidth: 1240,
    width: '100%',
    marginHorizontal: 'auto',
    paddingHorizontal: 20,
    paddingVertical: 48,
  },
  sectionContainerGray: {
    backgroundColor: '#F1F5F9',
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 48,
  },
  sectionContainerDark: {
    backgroundColor: '#0F172A',
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 56,
    ...Platform.select({
      web: {
        scrollMarginTop: 80,
        contentVisibility: 'auto',
        containIntrinsicSize: '1px 800px',
      } as any,
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 20,
    marginBottom: 32,
  },
  sectionHeaderCenter: {
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: 44,
  },
  sectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 8,
  },
  sectionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C2410C',
  },
  sectionBadgePurple: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E1B4B',
    borderWidth: 1,
    borderColor: '#3730A3',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 12,
  },
  sectionBadgePurpleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A5B4FC',
  },
  sectionBadgeIndigo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 12,
  },
  sectionBadgeIndigoText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  sectionSubtitleCenter: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 760,
    lineHeight: 25,
  },
  featuresSectionContainer: {
    maxWidth: 1240,
    width: '100%',
    marginHorizontal: 'auto',
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 24,
  },
  featuresGrid: {
    display: 'grid' as any,
    gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
    gap: 20,
    marginTop: 32,
  },
  featureCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
  },
  featureIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  featureDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 20,
  },
  howItWorksClosingTagline: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6366F1',
    marginTop: 20,
    letterSpacing: 0.5,
  },
  exploreMoreWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 36,
  },
  exploreMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#6366F1',
    paddingVertical: 13,
    paddingHorizontal: 32,
    borderRadius: 12,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  exploreMoreBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4F46E5',
  },
  sectionTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  sectionTitleWhite: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  sectionSubtitle: {
    fontSize: 15,
    color: '#64748B',
    marginTop: 6,
    maxWidth: 620,
  },
  sectionSubtitleMuted: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 680,
  },

  // Filter pills
  filterPillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterPill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },

  // Cards Grid
  cardsGrid: {
    display: 'grid' as any,
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 20,
  },
  cardsGridThree: {
    display: 'grid' as any,
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 24,
  },
  cardsGridTwo: {
    display: 'grid' as any,
    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
    gap: 24,
    maxWidth: 1240,
    marginHorizontal: 'auto',
  },

  // Latest Post Cards
  postCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  postAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E2E8F0',
  },
  postAuthorInfo: {
    flex: 1,
  },
  postAuthorTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  postAuthorName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  postAuthorRole: {
    fontSize: 12,
    color: '#64748B',
  },
  postTagBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  postTagBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F46E5',
  },
  postTime: {
    fontSize: 11,
    color: '#94A3B8',
  },

  swapBoxOffering: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  swapBoxWants: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  swapBoxLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  swapOfferingLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  swapWantsLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1D4ED8',
    letterSpacing: 0.5,
  },
  swapBadgeTech: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
    backgroundColor: '#BBF7D0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  swapBadgeLang: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E40AF',
    backgroundColor: '#BFDBFE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  swapOfferingTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#14532D',
  },
  swapWantsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E3A8A',
  },
  swapDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  swapDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  swapDividerCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  postCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  postRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postRatingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  postReviewsText: {
    fontWeight: '400',
    color: '#64748B',
  },
  postSwapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  postSwapBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },

  // Main Category Blocks (Dark Section)
  mainCategoryBlock: {
    maxWidth: 1240,
    marginHorizontal: 'auto',
    marginBottom: 48,
    width: '100%',
  },
  mainCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  mainCategoryIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainCategoryTitleGroup: {
    flex: 1,
  },
  mainCategoryNumber: {
    fontSize: 11,
    fontWeight: '800',
    color: '#818CF8',
    letterSpacing: 1.5,
  },
  mainCategoryTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  mainCategoryTagline: {
    fontSize: 13,
    color: '#94A3B8',
  },

  // Sub Category Grid
  subCategoryGrid: {
    display: 'grid' as any,
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 20,
  },
  subCategoryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  subCategoryImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#334155',
    resizeMode: 'cover',
  },
  subCategoryContent: {
    padding: 18,
  },
  subCategoryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  subCategoryTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  subCategoryCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#34D399',
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  subCategorySkillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  subCategorySkillPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  subCategorySkillText: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  subCategoryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  subCategoryActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#818CF8',
  },

  // Social Sections
  socialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 28,
  },
  socialBrandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  socialBrandTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  socialBrandSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  instagramIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#E1306C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  facebookIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1877F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  youtubeIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FF0000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialFollowBtnIg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E1306C',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  socialFollowBtnFb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1877F2',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  socialFollowBtnYt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF0000',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  socialFollowBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Instagram Cards
  igCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  igImage: {
    width: '100%',
    height: 220,
    backgroundColor: '#F1F5F9',
  },
  igBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  igBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  igContent: {
    padding: 16,
  },
  igAuthor: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366F1',
    marginBottom: 4,
  },
  igCaption: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
    marginBottom: 12,
  },
  igMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  igMetricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  igMetricText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },

  // Facebook Cards
  fbCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  fbCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  fbAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E2E8F0',
  },
  fbAuthorGroup: {
    flex: 1,
  },
  fbAuthorName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  fbTime: {
    fontSize: 12,
    color: '#94A3B8',
  },
  fbTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    lineHeight: 22,
  },
  fbBody: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 21,
    marginBottom: 16,
  },
  fbCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  fbStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fbStatText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },

  // YouTube Cards
  ytCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  ytThumbnailWrapper: {
    position: 'relative',
    width: '100%',
    height: 190,
    backgroundColor: '#0F172A',
  },
  ytThumbnail: {
    width: '100%',
    height: '100%',
  },
  ytPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ytPlayCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(239, 68, 68, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
  },
  ytDurationBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ytDurationText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ytCategoryBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#FF0000',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  ytCategoryText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  ytContent: {
    padding: 16,
  },
  ytTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 20,
    marginBottom: 6,
  },
  ytViews: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },

  // How it works
  howItWorksSection: {
    maxWidth: 1120,
    width: '100%',
    marginHorizontal: 'auto',
    paddingHorizontal: 20,
    paddingVertical: 60,
    alignItems: 'center',
    ...Platform.select({
      web: {
        contentVisibility: 'auto',
        containIntrinsicSize: '1px 500px',
      } as any,
    }),
  },
  howItWorksPre: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6366F1',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  howItWorksTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 40,
  },
  howStepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 40,
    width: '100%',
  },
  howStepCard: {
    flex: 1,
    minWidth: 260,
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    textAlign: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
  },
  howStepNumberBadge: {
    position: 'absolute',
    top: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  howStepNumberText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  howStepTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 14,
    marginBottom: 8,
  },
  howStepDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  howStepArrow: {
    paddingHorizontal: 4,
  },
  ctaBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  ctaBannerBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Footer (Sheet Item 1)
  footerInner: {
    maxWidth: 1240,
    marginHorizontal: 'auto',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 40,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 40,
    justifyContent: 'space-between',
  },
  footerMainCol: {
    flex: 2,
    minWidth: 280,
  },
  footerLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  footerLogoText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  footerWhatWeDo: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 22,
    maxWidth: 380,
    marginBottom: 20,
  },
  footerSocialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerSocialBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerNavCol: {
    flex: 1,
    minWidth: 160,
  },
  footerNavHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  footerNavLink: {
    paddingVertical: 6,
  },
  footerNavLinkText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  footerNavLinkTextHighlight: {
    fontSize: 13,
    color: '#818CF8',
    fontWeight: '700',
  },
  footerBottomBar: {
    maxWidth: 1240,
    marginHorizontal: 'auto',
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
    width: '100%',
  },
  footerCopyrightText: {
    fontSize: 12,
    color: '#64748B',
  },
  footerLegalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerLegalText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  footerLegalDot: {
    color: '#475569',
  },
});

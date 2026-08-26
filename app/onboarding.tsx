import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import {
  Sparkles,
  GraduationCap,
  Target,
  Calendar,
  MapPin,
  MessageCircle,
  CheckCircle2,
  ArrowLeftRight,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Palette,
  Code,
  Dumbbell,
  Globe,
  Music,
  Utensils,
  Briefcase,
  Camera,
  HeartPulse,
  Award,
  Megaphone,
  DollarSign,
  PenTool,
  Trophy,
  Hammer,
  UserCheck,
  Layers,
  Languages,
  Upload,
  Plus,
  FileCheck2,
  BadgeCheck,
  IndianRupee,
  Bot,
  Check,
  Tag,
} from 'lucide-react-native';
import {
  useOnboarding,
  OnboardingRole,
  TeacherCertification,
  CareerEntry,
  TeacherProfileData,
  OnboardingSkillOfferDetail,
} from '@/providers/onboarding';
import { useCurrentUser } from '@/providers/current-user';
import {
  CATEGORY_STRUCTURE,
  MAIN_CATEGORIES,
  getSubcategoriesForCategory,
  findCategoryForSubcategory,
} from '@/constants/categories';
import { generateSkillDescription } from '@/lib/ai';
import { formatPrice } from '@/constants/locale';
import url from '@/constants/backurl';

const ONBOARDING_CATEGORY_ICONS: Record<string, typeof Sparkles> = {
  'Arts & Crafts': Palette,
  Technology: Code,
  'Fitness & Wellness': Dumbbell,
  Languages: Globe,
  Music: Music,
  Cooking: Utensils,
  Business: Briefcase,
  'Photography & Video': Camera,
  'Health & Life': HeartPulse,
  'Professional Skills': Award,
  'Education & Teaching': GraduationCap,
  'Marketing & Sales': Megaphone,
  'Finance & Accounting': DollarSign,
  'Design & Creative': Palette,
  'Writing & Communication': PenTool,
  'Personal Development': Sparkles,
  'Sports & Games': Trophy,
  'DIY & Home Skills': Hammer,
  'Career & Jobs': UserCheck,
  'Other / Miscellaneous': Layers,
};

type SkillLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';

const skillLevels: SkillLevel[] = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

const ONBOARDING_PRICING_MODELS = [
  { key: 'free' as const, label: 'Free', desc: 'No charge — pure skill exchange' },
  { key: 'per_session' as const, label: 'Per Session', desc: 'Charge for each class' },
  { key: 'monthly' as const, label: 'Monthly', desc: 'Recurring monthly subscription' },
];
const availabilityOptions = ['Weekday Mornings', 'Weekday Afternoons', 'Weekday Evenings', 'Weekends', 'Flexible'];
const communicationOptions = ['Video Call', 'In Person', 'Chat', 'Mix of All'];

const languageOptions = [
  'English', 'Hindi', 'Bengali', 'Tamil', 'Telugu', 'Marathi',
  'Kannada', 'Malayalam', 'Gujarati', 'Punjabi', 'Urdu', 'Odia',
];
const qualificationOptions = [
  "High School", "Bachelor's Degree", "Master's Degree", 'PhD / Doctorate',
  'B.Ed / D.El.Ed', 'Diploma', 'Professional Certification',
  'Industry Expert', 'Self-taught Expert',
];
const experienceOptions = ['None yet', '1–3 years', '3–5 years', '5–10 years', '10+ years'];

const genId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type StepKey =
  | 'welcome'
  | 'role'
  | 'teach'
  | 'experience'
  | 'languages'
  | 'credentials'
  | 'career'
  | 'learn'
  | 'availability'
  | 'summary';

const ROLE_OPTIONS: {
  key: OnboardingRole;
  label: string;
  desc: string;
  icon: typeof GraduationCap;
  color: string;
  bg: string;
}[] = [
    { key: 'teacher', label: 'I want to Teach', desc: 'Share my skills with others', icon: GraduationCap, color: '#10B981', bg: '#ECFDF5' },
    { key: 'learner', label: 'I want to Learn', desc: 'Find someone to teach me', icon: BookOpen, color: '#6366F1', bg: '#EEF2FF' },
    { key: 'swap', label: 'Skill Swap', desc: 'Teach & learn together', icon: ArrowLeftRight, color: '#F59E0B', bg: '#FFFBEB' },
  ];

export default function OnboardingScreen() {
  const router = useRouter();
  const { updateOnboardingData, completeOnboarding } = useOnboarding();
  const { applyOnboardingData } = useCurrentUser();

  const [role, setRole] = useState<OnboardingRole | null>(null);
  const [stepIndex, setStepIndex] = useState<number>(0);

  const [selectedTeachSkills, setSelectedTeachSkills] = useState<string[]>([]);
  const [selectedLearnSkills, setSelectedLearnSkills] = useState<string[]>([]);
  const [customTeachCategory, setCustomTeachCategory] = useState<string>('');
  const [customLearnCategory, setCustomLearnCategory] = useState<string>('');
  const [isCompleting, setIsCompleting] = useState<boolean>(false);
  const [experienceLevels, setExperienceLevels] = useState<Record<string, SkillLevel>>({});
  const [teachSkillDetails, setTeachSkillDetails] = useState<
    Record<
      string,
      {
        level: SkillLevel;
        pricingModel: 'free' | 'per_session' | 'monthly';
        pricePerSession: string;
        monthlyPrice: string;
        description: string;
        promoted: boolean;
        promoTagline: string;
      }
    >
  >({});
  const [generatingDescSkill, setGeneratingDescSkill] = useState<string | null>(null);
  const [learningGoals, setLearningGoals] = useState<string[]>([]);
  const [availability, setAvailability] = useState<string[]>([]);
  const [communication, setCommunication] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [isFetchingLocation, setIsFetchingLocation] = useState<boolean>(false);
  const [virtualEnabled, setVirtualEnabled] = useState<boolean>(true);
  const [inPersonEnabled, setInPersonEnabled] = useState<boolean>(false);

  // Teacher credentials
  const [languages, setLanguages] = useState<string[]>([]);
  const [customLanguage, setCustomLanguage] = useState<string>('');
  const [qualifications, setQualifications] = useState<string[]>([]);
  const [isCertified, setIsCertified] = useState<boolean>(false);
  const [certTitle, setCertTitle] = useState<string>('');
  const [certifications, setCertifications] = useState<TeacherCertification[]>([]);
  const [yearsTeaching, setYearsTeaching] = useState<string>('');
  const [careerRole, setCareerRole] = useState<string>('');
  const [careerOrg, setCareerOrg] = useState<string>('');
  const [careerYears, setCareerYears] = useState<string>('');
  const [careerHistory, setCareerHistory] = useState<CareerEntry[]>([]);
  const [privateTuition, setPrivateTuition] = useState<boolean>(false);

  const steps = useMemo<StepKey[]>(() => {
    const list: StepKey[] = ['welcome', 'role'];
    if (role === 'teacher' || role === 'swap') {
      list.push('teach', 'experience');
    }
    if (role === 'teacher') {
      list.push('languages', 'credentials', 'career');
    }
    if (role === 'learner' || role === 'swap') {
      list.push('learn');
    }
    list.push('availability', 'summary');
    return list;
  }, [role]);

  const currentStep = steps[stepIndex] ?? 'welcome';
  const totalSteps = steps.length;

  const getFinalTeachSkills = () => selectedTeachSkills.map(s => s === 'Other' && customTeachCategory.trim() ? customTeachCategory.trim() : s);
  const getFinalLearnSkills = () => selectedLearnSkills.map(s => s === 'Other' && customLearnCategory.trim() ? customLearnCategory.trim() : s);
  const getFinalExperienceLevels = () => {
    const finalExperienceLevels: Record<string, SkillLevel> = {};
    Object.entries(experienceLevels).forEach(([skill, level]) => {
      if (skill === 'Other' && customTeachCategory.trim()) {
        finalExperienceLevels[customTeachCategory.trim()] = level;
      } else {
        finalExperienceLevels[skill] = level;
      }
    });
    return finalExperienceLevels;
  };

  const getFinalTeachSkillDetails = () => {
    const map: Record<string, OnboardingSkillOfferDetail> = {};
    selectedTeachSkills.forEach(skill => {
      const finalName = skill === 'Other' && customTeachCategory.trim() ? customTeachCategory.trim() : skill;
      const detail = teachSkillDetails[skill] || teachSkillDetails[finalName];
      const category = findCategoryForSubcategory(finalName) || 'Other / Miscellaneous';
      const lvl = detail?.level || experienceLevels[skill] || experienceLevels[finalName] || 'Intermediate';
      const pm = detail?.pricingModel || 'free';
      map[finalName] = {
        title: finalName,
        category,
        subCategory: finalName,
        level: lvl,
        pricingModel: pm,
        pricePerSession: pm === 'per_session' ? (Number(detail?.pricePerSession) || 500) : undefined,
        monthlyPrice: pm === 'monthly' ? (Number(detail?.monthlyPrice) || 2000) : undefined,
        description: detail?.description?.trim() || `I can teach and share knowledge in ${finalName}.`,
        promoted: Boolean(detail?.promoted),
        promoTagline: detail?.promoTagline?.trim() || undefined,
      };
    });
    return map;
  };

  const updateSkillDetail = (
    skill: string,
    field: 'level' | 'pricingModel' | 'pricePerSession' | 'monthlyPrice' | 'description' | 'promoted' | 'promoTagline',
    value: any
  ) => {
    setTeachSkillDetails(prev => {
      const existing = prev[skill] || {
        level: experienceLevels[skill] || 'Intermediate',
        pricingModel: 'free' as const,
        pricePerSession: '500',
        monthlyPrice: '2000',
        description: '',
        promoted: false,
        promoTagline: '',
      };
      return {
        ...prev,
        [skill]: {
          ...existing,
          [field]: value,
        },
      };
    });
    if (field === 'level') {
      setSkillLevel(skill, value as SkillLevel);
    }
  };

  const handleAiGenerateSkillDesc = async (skill: string) => {
    setGeneratingDescSkill(skill);
    try {
      const category = findCategoryForSubcategory(skill) || 'General';
      const detail = teachSkillDetails[skill];
      const level = detail?.level || experienceLevels[skill] || 'Intermediate';
      const desc = await generateSkillDescription(skill, category, level);
      if (desc) {
        updateSkillDetail(skill, 'description', desc.slice(0, 300));
      }
    } catch (err) {
      console.error('[Onboarding] AI Generate error:', err);
    } finally {
      setGeneratingDescSkill(null);
    }
  };

  const goToNextStep = () => {
    // Persist data when leaving relevant steps
    if (currentStep === 'role' && role) {
      updateOnboardingData({ role });
    } else if (currentStep === 'teach') {
      updateOnboardingData({
        skillsToTeach: getFinalTeachSkills(),
        teachSkillDetails: getFinalTeachSkillDetails(),
      });
    } else if (currentStep === 'experience') {
      updateOnboardingData({
        skillsToTeach: getFinalTeachSkills(),
        experienceLevels: getFinalExperienceLevels(),
        teachSkillDetails: getFinalTeachSkillDetails(),
      });
    } else if (currentStep === 'career') {
      updateOnboardingData({
        teacherProfile: {
          languages,
          qualifications,
          isCertified,
          certifications,
          yearsTeaching,
          careerHistory,
          privateTuition,
        },
      });
    } else if (currentStep === 'learn') {
      updateOnboardingData({ skillsToLearn: getFinalLearnSkills(), learningGoals });
    } else if (currentStep === 'availability') {
      updateOnboardingData({ availability });
    }

    if (stepIndex < totalSteps - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      handleComplete();
    }
  };

  const goToPreviousStep = () => {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  };

  const handleComplete = async () => {
    setIsCompleting(true);

    const fullData = {
      role: role ?? 'swap',
      skillsToTeach: getFinalTeachSkills(),
      skillsToLearn: getFinalLearnSkills(),
      experienceLevels: getFinalExperienceLevels(),
      teachSkillDetails: getFinalTeachSkillDetails(),
      learningGoals,
      availability,
      communicationPreference: communication,
      teacherProfile: role === 'teacher' ? {
        languages,
        qualifications,
        isCertified,
        certifications,
        yearsTeaching,
        careerHistory,
        privateTuition,
      } : undefined,
      matchingPreferences: { location, virtual: virtualEnabled, inPerson: inPersonEnabled },
    };

    // Apply the collected onboarding data to the current user so Smart Matches
    // and the home screen immediately reflect the user's chosen role and skills.
    applyOnboardingData(fullData);

    try {
      // Pass data directly to avoid React state batching issues
      await completeOnboarding(fullData);
    } catch (error) {
      console.warn('[Onboarding] completeOnboarding threw, navigating anyway:', error);
    }

    setIsCompleting(false);
    router.replace('/(tabs)/home' as any);
  };

  const canContinue = (): boolean => {
    switch (currentStep) {
      case 'welcome':
        return true;
      case 'role':
        return role !== null;
      case 'teach':
        return selectedTeachSkills.length > 0 && (!selectedTeachSkills.includes('Other') || customTeachCategory.trim().length > 0);
      case 'experience':
        return selectedTeachSkills.length > 0;
      case 'languages':
        return languages.length > 0;
      case 'credentials':
        return !isCertified || certifications.length > 0;
      case 'career':
        return true;
      case 'learn':
        return selectedLearnSkills.length > 0 && (!selectedLearnSkills.includes('Other') || customLearnCategory.trim().length > 0);
      case 'availability':
        return availability.length > 0;
      case 'summary':
        return true;
      default:
        return true;
    }
  };

  // ---- Teacher credentials handlers ----
  const toggleLanguage = (lang: string) => {
    if (languages.includes(lang)) {
      setLanguages(languages.filter(l => l !== lang));
    } else {
      setLanguages([...languages, lang]);
    }
  };

  const addCustomLanguage = () => {
    const trimmed = customLanguage.trim();
    if (trimmed.length === 0) return;
    if (!languages.some(l => l.toLowerCase() === trimmed.toLowerCase())) {
      setLanguages([...languages, trimmed]);
    }
    setCustomLanguage('');
  };

  const toggleQualification = (q: string) => {
    if (qualifications.includes(q)) {
      setQualifications(qualifications.filter(item => item !== q));
    } else {
      setQualifications([...qualifications, q]);
    }
  };

  const addCertification = () => {
    const trimmed = certTitle.trim();
    if (trimmed.length === 0) return;
    setCertifications(prev => [...prev, { id: genId('cert'), title: trimmed }]);
    setCertTitle('');
  };

  const removeCertification = (id: string) => {
    setCertifications(prev => prev.filter(c => c.id !== id));
  };

  const pickCertificate = async (certId: string) => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please allow access to your photos to upload a certificate document.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
        base64: true,
      });
      const asset = result.assets?.[0];
      if (!result.canceled && asset) {
        let uri = asset.uri;
        try {
          const formData = new FormData();
          if (Platform.OS === 'web') {
            const resp = await fetch(asset.uri);
            const blob = await resp.blob();
            formData.append('certificate', blob, 'certificate.jpg');
          } else {
            const filename = asset.uri.split('/').pop() || 'certificate.jpg';
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : `image/jpeg`;
            // @ts-ignore
            formData.append('certificate', { uri: asset.uri, name: filename, type });
          }
          const uploadRes = await fetch(`${url}/skills/upload-certificate`, {
            method: 'POST',
            body: formData,
          });
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            if (uploadData.certificateUri) {
              uri = uploadData.certificateUri.startsWith('http') ? uploadData.certificateUri : `${url}${uploadData.certificateUri}`;
            }
          }
        } catch (upErr) {
          console.warn('[Onboarding] Certificate server upload fallback:', upErr);
        }

        if (asset.base64 && !uri.startsWith('http')) {
          const mime = asset.mimeType || (asset.uri?.endsWith('.png') ? 'image/png' : 'image/jpeg');
          uri = `data:${mime};base64,${asset.base64}`;
        } else if (Platform.OS === 'web' && asset.uri && asset.uri.startsWith('blob:') && !uri.startsWith('http')) {
          try {
            const resp = await fetch(asset.uri);
            const blob = await resp.blob();
            uri = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } catch (e) {
            console.warn('[Onboarding] Failed to convert blob to data URI:', e);
          }
        }
        setCertifications(prev => prev.map(c => (c.id === certId ? { ...c, documentUri: uri, status: 'pending' as const } : c)));
      }
    } catch (error) {
      console.warn('[Onboarding] Document pick failed:', error);
    }
  };

  const addCareerEntry = () => {
    const roleName = careerRole.trim();
    if (roleName.length === 0) return;
    setCareerHistory(prev => [...prev, {
      id: genId('career'),
      role: roleName,
      organization: careerOrg.trim(),
      years: careerYears.trim(),
    }]);
    setCareerRole('');
    setCareerOrg('');
    setCareerYears('');
  };

  const removeCareerEntry = (id: string) => {
    setCareerHistory(prev => prev.filter(e => e.id !== id));
  };

  const toggleSkillSelection = (skill: string, isTeach: boolean) => {
    const setter = isTeach ? setSelectedTeachSkills : setSelectedLearnSkills;
    const selected = isTeach ? selectedTeachSkills : selectedLearnSkills;
    if (selected.includes(skill)) {
      setter(selected.filter(s => s !== skill));
      if (isTeach) {
        const next = { ...experienceLevels };
        delete next[skill];
        setExperienceLevels(next);

        const nextDetails = { ...teachSkillDetails };
        delete nextDetails[skill];
        setTeachSkillDetails(nextDetails);
      }
    } else {
      setter([...selected, skill]);
      if (isTeach) {
        if (!experienceLevels[skill]) {
          setExperienceLevels(prev => ({ ...prev, [skill]: 'Intermediate' }));
        }
        if (!teachSkillDetails[skill]) {
          setTeachSkillDetails(prev => ({
            ...prev,
            [skill]: {
              level: 'Intermediate',
              pricingModel: 'free',
              pricePerSession: '500',
              monthlyPrice: '2000',
              description: '',
              promoted: false,
              promoTagline: '',
            },
          }));
        }
      }
    }
  };

  const setSkillLevel = (skill: string, level: SkillLevel) => {
    setExperienceLevels(prev => ({ ...prev, [skill]: level }));
    setTeachSkillDetails(prev => {
      const existing = prev[skill] || {
        level,
        pricingModel: 'free' as const,
        pricePerSession: '500',
        monthlyPrice: '2000',
        description: '',
        promoted: false,
        promoTagline: '',
      };
      return { ...prev, [skill]: { ...existing, level } };
    });
  };

  const toggleGoal = (goal: string) => {
    if (learningGoals.includes(goal)) {
      setLearningGoals(learningGoals.filter(g => g !== goal));
    } else {
      setLearningGoals([...learningGoals, goal]);
    }
  };

  const toggleAvailability = (slot: string) => {
    if (availability.includes(slot)) {
      setAvailability(availability.filter(a => a !== slot));
    } else {
      setAvailability([...availability, slot]);
    }
  };

  const fetchLocation = async () => {
    setIsFetchingLocation(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setIsFetchingLocation(false);
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});

      if (Platform.OS === 'web') {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${loc.coords.latitude}&lon=${loc.coords.longitude}&zoom=10&addressdetails=1`);
        const data = await response.json();
        if (data && data.address) {
          const city = data.address.city || data.address.town || data.address.village || data.address.county;
          const state = data.address.state;
          if (city && state) {
            setLocation(`${city}, ${state}`);
          } else if (city) {
            setLocation(city);
          } else if (state) {
            setLocation(state);
          }
        }
      } else {
        let geocode = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude
        });
        if (geocode.length > 0) {
          const place = geocode[0];
          const city = place.city || place.subregion;
          const state = place.region;
          if (city && state) {
            setLocation(`${city}, ${state}`);
          } else if (city) {
            setLocation(city);
          } else if (state) {
            setLocation(state);
          }
        }
      }
    } catch (e) {
      console.warn("Error fetching location", e);
    }
    setIsFetchingLocation(false);
  };

  const renderWelcomeStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Sparkles size={64} color="#FF6B9D" strokeWidth={1.5} />
      </View>
      <Text style={styles.title}>Welcome to Leteski!</Text>
      <Text style={styles.subtitle}>
        Let&apos;s set up your profile so we can match you with the perfect skill exchange partners.
      </Text>
      <Text style={styles.description}>
        This will take about 2-3 minutes. You can always change these preferences later.
      </Text>
      <View style={styles.featureList}>
        {[
          { icon: GraduationCap, text: 'Share your expertise' },
          { icon: Target, text: 'Learn new skills' },
          { icon: MessageCircle, text: 'Connect with others' },
        ].map((feature, index) => (
          <View key={index} style={styles.featureItem}>
            <feature.icon size={20} color="#FF6B9D" />
            <Text style={styles.featureText}>{feature.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderRoleStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <ArrowLeftRight size={48} color="#FF6B9D" strokeWidth={1.5} />
      </View>
      <Text style={styles.title}>How will you use Leteski?</Text>
      <Text style={styles.subtitle}>
        Choose the option that best fits you. You can do both later!
      </Text>
      <View style={styles.roleList}>
        {ROLE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const selected = role === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.roleCard, selected && styles.roleCardSelected, selected && { borderColor: opt.color }]}
              onPress={() => setRole(opt.key)}
              activeOpacity={0.75}
            >
              <View style={[styles.roleIconWrap, { backgroundColor: opt.bg }]}>
                <Icon size={28} color={opt.color} />
              </View>
              <View style={styles.roleCardContent}>
                <Text style={styles.roleCardTitle}>{opt.label}</Text>
                <Text style={styles.roleCardSubtitle}>{opt.desc}</Text>
              </View>
              {selected && <CheckCircle2 size={22} color={opt.color} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const [teachSearchQuery, setTeachSearchQuery] = useState<string>('');
  const [expandedTeachCategories, setExpandedTeachCategories] = useState<Record<string, boolean>>({});

  const [learnSearchQuery, setLearnSearchQuery] = useState<string>('');
  const [expandedLearnCategories, setExpandedLearnCategories] = useState<Record<string, boolean>>({});

  const toggleTeachCategoryExpand = (cat: string) => {
    setExpandedTeachCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const toggleLearnCategoryExpand = (cat: string) => {
    setExpandedLearnCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const teachSearchResults = useMemo(() => {
    if (!teachSearchQuery.trim()) return null;
    const q = teachSearchQuery.toLowerCase().trim();
    const list: { category: string; subcategory: string }[] = [];
    MAIN_CATEGORIES.forEach(cat => {
      getSubcategoriesForCategory(cat).forEach(subcat => {
        if (subcat.toLowerCase().includes(q) || cat.toLowerCase().includes(q)) {
          list.push({ category: cat, subcategory: subcat });
        }
      });
    });
    return list;
  }, [teachSearchQuery]);

  const learnSearchResults = useMemo(() => {
    if (!learnSearchQuery.trim()) return null;
    const q = learnSearchQuery.toLowerCase().trim();
    const list: { category: string; subcategory: string }[] = [];
    MAIN_CATEGORIES.forEach(cat => {
      getSubcategoriesForCategory(cat).forEach(subcat => {
        if (subcat.toLowerCase().includes(q) || cat.toLowerCase().includes(q)) {
          list.push({ category: cat, subcategory: subcat });
        }
      });
    });
    return list;
  }, [learnSearchQuery]);

  const renderTeachSkillsStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <GraduationCap size={48} color="#10B981" strokeWidth={1.5} />
      </View>
      <Text style={styles.title}>What can you teach?</Text>
      <Text style={styles.subtitle}>
        Choose categories & select the specific skills you'd like to teach
      </Text>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Search size={18} color="#999" />
        <TextInput
          style={styles.searchBarInput}
          placeholder="Search 240+ skills..."
          placeholderTextColor="#999"
          value={teachSearchQuery}
          onChangeText={setTeachSearchQuery}
          autoCorrect={false}
        />
        {teachSearchQuery ? (
          <TouchableOpacity onPress={() => setTeachSearchQuery('')}>
            <X size={16} color="#999" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Selected Skills Chips */}
      {selectedTeachSkills.length > 0 && (
        <View style={styles.selectedSection}>
          <Text style={styles.selectedHeading}>
            Selected ({selectedTeachSkills.length})
          </Text>
          <View style={styles.selectedChipsRow}>
            {selectedTeachSkills.map((sk) => (
              <TouchableOpacity
                key={sk}
                style={styles.selectedPill}
                onPress={() => toggleSkillSelection(sk, true)}
                activeOpacity={0.7}
              >
                <Text style={styles.selectedPillText}>{sk}</Text>
                <X size={14} color="#FFFFFF" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Search Results or Category Accordions */}
      {teachSearchResults !== null ? (
        <View style={styles.searchResultsContainer}>
          <Text style={styles.resultsCountText}>
            {teachSearchResults.length} skill{teachSearchResults.length === 1 ? '' : 's'} found
          </Text>
          {teachSearchResults.map((item, idx) => {
            const isSelected = selectedTeachSkills.includes(item.subcategory);
            return (
              <TouchableOpacity
                key={`${item.category}-${item.subcategory}-${idx}`}
                style={[styles.searchResultRow, isSelected && styles.searchResultRowSelected]}
                onPress={() => toggleSkillSelection(item.subcategory, true)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.searchResultTitle, isSelected && styles.searchResultTitleSelected]}>
                    {item.subcategory}
                  </Text>
                  <Text style={styles.searchResultCategory}>in {item.category}</Text>
                </View>
                {isSelected ? (
                  <CheckCircle2 size={20} color="#10B981" />
                ) : (
                  <View style={styles.uncheckCircle} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <View style={styles.categoriesAccordionList}>
          {MAIN_CATEGORIES.map((cat) => {
            const IconComp = ONBOARDING_CATEGORY_ICONS[cat] || Sparkles;
            const isExpanded = Boolean(expandedTeachCategories[cat]);
            const subcats = getSubcategoriesForCategory(cat);
            const selectedInCat = subcats.filter(sc => selectedTeachSkills.includes(sc));

            return (
              <View key={cat} style={[styles.catAccordionCard, selectedInCat.length > 0 && styles.catAccordionCardActive]}>
                <TouchableOpacity
                  style={styles.catAccordionHeader}
                  onPress={() => toggleTeachCategoryExpand(cat)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.catIconBox, selectedInCat.length > 0 && styles.catIconBoxActive]}>
                    <IconComp size={20} color={selectedInCat.length > 0 ? '#10B981' : '#666'} />
                  </View>
                  <View style={styles.catHeaderInfo}>
                    <Text style={[styles.catHeaderTitle, selectedInCat.length > 0 && styles.catHeaderTitleActive]}>
                      {cat}
                    </Text>
                    <Text style={styles.catHeaderMeta}>
                      {subcats.length} subcategories
                    </Text>
                  </View>
                  {selectedInCat.length > 0 && (
                    <View style={styles.catBadge}>
                      <Text style={styles.catBadgeText}>{selectedInCat.length} selected</Text>
                    </View>
                  )}
                  {isExpanded ? (
                    <ChevronUp size={20} color="#666" />
                  ) : (
                    <ChevronDown size={20} color="#666" />
                  )}
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.subcatsBody}>
                    <View style={styles.subcatsGrid}>
                      {subcats.map((subcat) => {
                        const isSubSelected = selectedTeachSkills.includes(subcat);
                        return (
                          <TouchableOpacity
                            key={subcat}
                            style={[styles.subcatChip, isSubSelected && styles.subcatChipSelected]}
                            onPress={() => toggleSkillSelection(subcat, true)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.subcatChipText, isSubSelected && styles.subcatChipTextSelected]}>
                              {subcat}
                            </Text>
                            {isSubSelected && <CheckCircle2 size={15} color="#FFFFFF" />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );

  const renderExperienceLevelStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <GraduationCap size={48} color="#10B981" strokeWidth={1.5} />
      </View>
      <Text style={styles.title}>Set up your skills</Text>
      <Text style={styles.subtitle}>
        Customize your pricing, level, and description for what you will teach
      </Text>

      <View style={{ gap: 20 }}>
        {selectedTeachSkills.map((skill) => {
          const detail = teachSkillDetails[skill] || {
            level: experienceLevels[skill] || 'Intermediate',
            pricingModel: 'free' as const,
            pricePerSession: '500',
            monthlyPrice: '2000',
            description: '',
            promoted: false,
            promoTagline: '',
          };
          const currentLevel = detail.level || experienceLevels[skill] || 'Intermediate';
          const category = findCategoryForSubcategory(skill) || 'General';
          const isAiGenerating = generatingDescSkill === skill;

          return (
            <View key={skill} style={styles.skillConfigCard}>
              {/* Skill Card Header */}
              <View style={styles.skillConfigHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.skillConfigTitle}>{skill}</Text>
                  <Text style={styles.skillConfigCategory}>in {category}</Text>
                </View>
                <View style={styles.skillConfigBadge}>
                  <Text style={styles.skillConfigBadgeText}>
                    {detail.pricingModel === 'free'
                      ? 'Free'
                      : detail.pricingModel === 'per_session'
                        ? `${formatPrice(Number(detail.pricePerSession || 0))}/session`
                        : `${formatPrice(Number(detail.monthlyPrice || 0))}/mo`}
                  </Text>
                </View>
              </View>

              {/* 1. Proficiency Level */}
              <View style={styles.configFieldSection}>
                <Text style={styles.configFieldLabel}>Proficiency Level *</Text>
                <View style={styles.levelButtons}>
                  {skillLevels.map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[styles.levelButton, currentLevel === level && styles.levelButtonSelected]}
                      onPress={() => updateSkillDetail(skill, 'level', level)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.levelButtonText, currentLevel === level && styles.levelButtonTextSelected]}>
                        {level}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 2. Pricing Model */}
              <View style={styles.configFieldSection}>
                <View style={styles.configPricingHeader}>
                  <IndianRupee size={15} color="#10B981" />
                  <Text style={styles.configFieldLabel}>Class Pricing</Text>
                </View>
                <View style={styles.pricingModelGrid}>
                  {ONBOARDING_PRICING_MODELS.map((pm) => {
                    const isSelected = detail.pricingModel === pm.key;
                    return (
                      <TouchableOpacity
                        key={pm.key}
                        style={[styles.pricingChip, isSelected && styles.pricingChipSelected]}
                        onPress={() => updateSkillDetail(skill, 'pricingModel', pm.key)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.pricingChipLabel, isSelected && styles.pricingChipLabelSelected]}>
                          {pm.label}
                        </Text>
                        <Text style={[styles.pricingChipDesc, isSelected && styles.pricingChipDescSelected]}>
                          {pm.desc}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {detail.pricingModel === 'per_session' && (
                  <View style={styles.priceInputWrap}>
                    <Text style={styles.pricePrefix}>{formatPrice(0).replace('0', '')}</Text>
                    <TextInput
                      style={styles.priceInput}
                      value={detail.pricePerSession}
                      onChangeText={(val) => updateSkillDetail(skill, 'pricePerSession', val)}
                      placeholder="500"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                      maxLength={6}
                    />
                    <Text style={styles.priceSuffix}>per session</Text>
                  </View>
                )}

                {detail.pricingModel === 'monthly' && (
                  <View style={styles.priceInputWrap}>
                    <Text style={styles.pricePrefix}>{formatPrice(0).replace('0', '')}</Text>
                    <TextInput
                      style={styles.priceInput}
                      value={detail.monthlyPrice}
                      onChangeText={(val) => updateSkillDetail(skill, 'monthlyPrice', val)}
                      placeholder="2000"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                      maxLength={6}
                    />
                    <Text style={styles.priceSuffix}>per month</Text>
                  </View>
                )}
              </View>

              {/* 3. Description with AI Generate */}
              <View style={styles.configFieldSection}>
                <View style={styles.labelWithAiRow}>
                  <Text style={styles.configFieldLabel}>Description (Optional)</Text>
                  <TouchableOpacity
                    style={styles.aiGenBtn}
                    onPress={() => handleAiGenerateSkillDesc(skill)}
                    disabled={isAiGenerating}
                    activeOpacity={0.7}
                  >
                    {isAiGenerating ? (
                      <ActivityIndicator size={12} color="#6366F1" />
                    ) : (
                      <Bot size={13} color="#6366F1" />
                    )}
                    <Text style={styles.aiGenBtnText}>
                      {isAiGenerating ? 'Generating...' : 'AI Generate'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.configTextArea}
                  value={detail.description}
                  onChangeText={(val) => updateSkillDetail(skill, 'description', val)}
                  placeholder={`Describe what you can teach in ${skill}, hands-on exercises, or what students will achieve...`}
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  maxLength={300}
                />
                <Text style={styles.configCharCount}>{(detail.description || '').length}/300</Text>
              </View>

              {/* 4. Promotion (Optional) */}
              <View style={styles.configFieldSection}>
                <TouchableOpacity
                  style={styles.promoteToggleRow}
                  onPress={() => updateSkillDetail(skill, 'promoted', !detail.promoted)}
                  activeOpacity={0.7}
                >
                  <View style={styles.promoteToggleLeft}>
                    <Sparkles size={16} color="#F59E0B" />
                    <View>
                      <Text style={styles.promoteToggleTitle}>Promote this skill</Text>
                      <Text style={styles.promoteToggleSubtitle}>Get featured & boost discoverability</Text>
                    </View>
                  </View>
                  <View style={[styles.toggleSwitch, detail.promoted && styles.toggleSwitchOn]}>
                    <View style={[styles.toggleKnob, detail.promoted && styles.toggleKnobOn]} />
                  </View>
                </TouchableOpacity>

                {detail.promoted && (
                  <View style={styles.promoTaglineWrap}>
                    <TextInput
                      style={styles.promoInput}
                      value={detail.promoTagline}
                      onChangeText={(val) => updateSkillDetail(skill, 'promoTagline', val)}
                      placeholder="e.g. Free trial session / First 5 classes 20% off!"
                      placeholderTextColor="#999"
                      maxLength={80}
                    />
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );

  const renderLearnSkillsStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Target size={48} color="#6366F1" strokeWidth={1.5} />
      </View>
      <Text style={styles.title}>What do you want to learn?</Text>
      <Text style={styles.subtitle}>
        Choose categories & select skills you're interested in learning
      </Text>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Search size={18} color="#999" />
        <TextInput
          style={styles.searchBarInput}
          placeholder="Search 240+ skills..."
          placeholderTextColor="#999"
          value={learnSearchQuery}
          onChangeText={setLearnSearchQuery}
          autoCorrect={false}
        />
        {learnSearchQuery ? (
          <TouchableOpacity onPress={() => setLearnSearchQuery('')}>
            <X size={16} color="#999" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Selected Skills Chips */}
      {selectedLearnSkills.length > 0 && (
        <View style={styles.selectedSection}>
          <Text style={styles.selectedHeading}>
            Selected ({selectedLearnSkills.length})
          </Text>
          <View style={styles.selectedChipsRow}>
            {selectedLearnSkills.map((sk) => (
              <TouchableOpacity
                key={sk}
                style={[styles.selectedPill, { backgroundColor: '#6366F1' }]}
                onPress={() => toggleSkillSelection(sk, false)}
                activeOpacity={0.7}
              >
                <Text style={styles.selectedPillText}>{sk}</Text>
                <X size={14} color="#FFFFFF" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Search Results or Category Accordions */}
      {learnSearchResults !== null ? (
        <View style={styles.searchResultsContainer}>
          <Text style={styles.resultsCountText}>
            {learnSearchResults.length} skill{learnSearchResults.length === 1 ? '' : 's'} found
          </Text>
          {learnSearchResults.map((item, idx) => {
            const isSelected = selectedLearnSkills.includes(item.subcategory);
            return (
              <TouchableOpacity
                key={`${item.category}-${item.subcategory}-${idx}`}
                style={[styles.searchResultRow, isSelected && styles.searchResultRowLearnSelected]}
                onPress={() => toggleSkillSelection(item.subcategory, false)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.searchResultTitle, isSelected && { color: '#6366F1' }]}>
                    {item.subcategory}
                  </Text>
                  <Text style={styles.searchResultCategory}>in {item.category}</Text>
                </View>
                {isSelected ? (
                  <CheckCircle2 size={20} color="#6366F1" />
                ) : (
                  <View style={styles.uncheckCircle} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <View style={styles.categoriesAccordionList}>
          {MAIN_CATEGORIES.map((cat) => {
            const IconComp = ONBOARDING_CATEGORY_ICONS[cat] || Sparkles;
            const isExpanded = Boolean(expandedLearnCategories[cat]);
            const subcats = getSubcategoriesForCategory(cat);
            const selectedInCat = subcats.filter(sc => selectedLearnSkills.includes(sc));

            return (
              <View key={cat} style={[styles.catAccordionCard, selectedInCat.length > 0 && styles.catAccordionCardLearnActive]}>
                <TouchableOpacity
                  style={styles.catAccordionHeader}
                  onPress={() => toggleLearnCategoryExpand(cat)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.catIconBox, selectedInCat.length > 0 && styles.catIconBoxLearnActive]}>
                    <IconComp size={20} color={selectedInCat.length > 0 ? '#6366F1' : '#666'} />
                  </View>
                  <View style={styles.catHeaderInfo}>
                    <Text style={[styles.catHeaderTitle, selectedInCat.length > 0 && { color: '#6366F1' }]}>
                      {cat}
                    </Text>
                    <Text style={styles.catHeaderMeta}>
                      {subcats.length} subcategories
                    </Text>
                  </View>
                  {selectedInCat.length > 0 && (
                    <View style={[styles.catBadge, { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }]}>
                      <Text style={[styles.catBadgeText, { color: '#6366F1' }]}>{selectedInCat.length} selected</Text>
                    </View>
                  )}
                  {isExpanded ? (
                    <ChevronUp size={20} color="#666" />
                  ) : (
                    <ChevronDown size={20} color="#666" />
                  )}
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.subcatsBody}>
                    <View style={styles.subcatsGrid}>
                      {subcats.map((subcat) => {
                        const isSubSelected = selectedLearnSkills.includes(subcat);
                        return (
                          <TouchableOpacity
                            key={subcat}
                            style={[styles.subcatChip, isSubSelected && styles.subcatChipLearnSelected]}
                            onPress={() => toggleSkillSelection(subcat, false)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.subcatChipText, isSubSelected && styles.subcatChipTextSelected]}>
                              {subcat}
                            </Text>
                            {isSubSelected && <CheckCircle2 size={15} color="#FFFFFF" />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.goalsSection}>
        <Text style={styles.goalsTitle}>Your learning goals (optional)</Text>
        <View style={styles.goalsList}>
          {['Career Change', 'Hobby', 'Personal Growth', 'Side Project'].map((goal) => (
            <TouchableOpacity
              key={goal}
              style={[styles.goalChip, learningGoals.includes(goal) && styles.goalChipSelected]}
              onPress={() => toggleGoal(goal)}
            >
              <Text style={[styles.goalChipText, learningGoals.includes(goal) && styles.goalChipTextSelected]}>
                {goal}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderAvailabilityStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Calendar size={48} color="#FF6B9D" strokeWidth={1.5} />
      </View>
      <Text style={styles.title}>When are you available?</Text>
      <Text style={styles.subtitle}>Select your preferred times for skill exchanges</Text>
      <View style={styles.optionsList}>
        {availabilityOptions.map((slot) => (
          <TouchableOpacity
            key={slot}
            style={[styles.optionItem, availability.includes(slot) && styles.optionItemSelected]}
            onPress={() => toggleAvailability(slot)}
          >
            <Text style={[styles.optionText, availability.includes(slot) && styles.optionTextSelected]}>
              {slot}
            </Text>
            {availability.includes(slot) && <CheckCircle2 size={20} color="#fff" />}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderPreferencesStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <MessageCircle size={48} color="#FF6B9D" strokeWidth={1.5} />
      </View>
      <Text style={styles.title}>How do you prefer to connect?</Text>
      <Text style={styles.subtitle}>Choose your preferred method of skill exchange</Text>
      <View style={styles.optionsList}>
        {communicationOptions.map((option) => (
          <TouchableOpacity
            key={option}
            style={[styles.optionItem, communication === option && styles.optionItemSelected]}
            onPress={() => setCommunication(option)}
          >
            <Text style={[styles.optionText, communication === option && styles.optionTextSelected]}>
              {option}
            </Text>
            {communication === option && <CheckCircle2 size={20} color="#fff" />}
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.locationSection}>
        <View style={styles.locationHeader}>
          <MapPin size={20} color="#333" />
          <Text style={styles.locationTitle}>Location Preferences</Text>
        </View>
        <TextInput
          style={styles.locationInput}
          placeholder="Enter your city or region (optional)"
          placeholderTextColor="#999"
          value={location}
          onChangeText={setLocation}
        />
        <TouchableOpacity
          style={[styles.getLocationButton, isFetchingLocation && styles.getLocationButtonDisabled]}
          onPress={fetchLocation}
          disabled={isFetchingLocation}
        >
          <Text style={styles.getLocationButtonText}>
            {isFetchingLocation ? 'Fetching...' : 'Use Current Location'}
          </Text>
        </TouchableOpacity>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggle, virtualEnabled && styles.toggleActive]}
            onPress={() => setVirtualEnabled(!virtualEnabled)}
          >
            <Text style={[styles.toggleText, virtualEnabled && styles.toggleTextActive]}>Virtual Sessions</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggle, inPersonEnabled && styles.toggleActive]}
            onPress={() => setInPersonEnabled(!inPersonEnabled)}
          >
            <Text style={[styles.toggleText, inPersonEnabled && styles.toggleTextActive]}>In-Person Meetups</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderLanguagesStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Languages size={48} color="#10B981" strokeWidth={1.5} />
      </View>
      <Text style={styles.title}>Languages you speak</Text>
      <Text style={styles.subtitle}>
        Students love knowing which languages you can teach in. Select all that apply.
      </Text>
      <View style={styles.chipWrap}>
        {languageOptions.map((lang) => {
          const selected = languages.includes(lang);
          return (
            <TouchableOpacity
              key={lang}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => toggleLanguage(lang)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{lang}</Text>
            </TouchableOpacity>
          );
        })}
        {languages
          .filter((l) => !languageOptions.includes(l))
          .map((lang) => (
            <TouchableOpacity
              key={lang}
              style={[styles.chip, styles.chipSelected]}
              onPress={() => toggleLanguage(lang)}
            >
              <Text style={[styles.chipText, styles.chipTextSelected]}>{lang}</Text>
              <X size={14} color="#fff" />
            </TouchableOpacity>
          ))}
      </View>
      <View style={styles.addRow}>
        <TextInput
          style={styles.addRowInput}
          placeholder="Add another language"
          placeholderTextColor="#999"
          value={customLanguage}
          onChangeText={setCustomLanguage}
          onSubmitEditing={addCustomLanguage}
        />
        <TouchableOpacity style={styles.addRowButton} onPress={addCustomLanguage}>
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCredentialsStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Award size={48} color="#10B981" strokeWidth={1.5} />
      </View>
      <Text style={styles.title}>Qualifications & certifications</Text>
      <Text style={styles.subtitle}>
        Your formal background builds trust with students and helps your profile rank higher.
      </Text>
      <Text style={styles.sectionLabel}>Qualifications</Text>
      <View style={styles.chipWrap}>
        {qualificationOptions.map((q) => {
          const selected = qualifications.includes(q);
          return (
            <TouchableOpacity
              key={q}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => toggleQualification(q)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{q}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.certifiedToggle, isCertified && styles.certifiedToggleActive]}
        onPress={() => setIsCertified(!isCertified)}
        activeOpacity={0.75}
      >
        <View style={[styles.certifiedToggleIcon, isCertified && styles.certifiedToggleIconActive]}>
          <BadgeCheck size={22} color={isCertified ? '#fff' : '#10B981'} />
        </View>
        <View style={styles.certifiedToggleContent}>
          <Text style={[styles.certifiedToggleTitle, isCertified && styles.certifiedToggleTitleActive]}>
            I am certified or professionally qualified
          </Text>
          <Text style={styles.certifiedToggleSubtitle}>
            Add your certificates and upload the documents below
          </Text>
        </View>
      </TouchableOpacity>

      {isCertified && (
        <View style={styles.certSection}>
          {certifications.map((cert) => (
            <View key={cert.id} style={styles.certCard}>
              <View style={styles.certCardHeader}>
                <View style={styles.certCardTitleWrap}>
                  <Award size={16} color="#10B981" />
                  <Text style={styles.certCardTitle} numberOfLines={1}>{cert.title}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => removeCertification(cert.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={16} color="#999" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.uploadButton, cert.documentUri && styles.uploadButtonDone]}
                onPress={() => pickCertificate(cert.id)}
              >
                {cert.documentUri
                  ? <FileCheck2 size={16} color="#065F46" />
                  : <Upload size={16} color="#059669" />}
                <Text style={[styles.uploadButtonText, cert.documentUri && styles.uploadButtonTextDone]}>
                  {cert.documentUri ? 'Document uploaded ✓' : 'Upload certificate document'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
          <View style={styles.addRow}>
            <TextInput
              style={styles.addRowInput}
              placeholder="e.g. CTET, AWS Certified, Grade 8 Piano"
              placeholderTextColor="#999"
              value={certTitle}
              onChangeText={setCertTitle}
              onSubmitEditing={addCertification}
            />
            <TouchableOpacity style={styles.addRowButton} onPress={addCertification}>
              <Plus size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  const renderCareerStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Briefcase size={48} color="#10B981" strokeWidth={1.5} />
      </View>
      <Text style={styles.title}>Your teaching experience</Text>
      <Text style={styles.subtitle}>
        Past jobs, tuitions, and professional roles that make you a great teacher.
      </Text>

      <Text style={styles.sectionLabel}>Years of teaching experience</Text>
      <View style={styles.chipWrap}>
        {experienceOptions.map((opt) => {
          const selected = yearsTeaching === opt;
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => setYearsTeaching(opt)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.certifiedToggle, privateTuition && styles.certifiedToggleActive]}
        onPress={() => setPrivateTuition(!privateTuition)}
        activeOpacity={0.75}
      >
        <View style={[styles.certifiedToggleIcon, privateTuition && styles.certifiedToggleIconActive]}>
          <GraduationCap size={22} color={privateTuition ? '#fff' : '#10B981'} />
        </View>
        <View style={styles.certifiedToggleContent}>
          <Text style={[styles.certifiedToggleTitle, privateTuition && styles.certifiedToggleTitleActive]}>
            I have given private tuitions or coaching
          </Text>
          <Text style={styles.certifiedToggleSubtitle}>
            Home tuitions, coaching centres, or online 1-on-1 teaching
          </Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.sectionLabel}>Past career & jobs</Text>
      {careerHistory.map((entry) => (
        <View key={entry.id} style={styles.careerCard}>
          <View style={styles.careerIconWrap}>
            <Briefcase size={16} color="#10B981" />
          </View>
          <View style={styles.careerContent}>
            <Text style={styles.careerRole}>{entry.role}</Text>
            <Text style={styles.careerMeta}>
              {[entry.organization, entry.years].filter(Boolean).join(' · ') || '—'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => removeCareerEntry(entry.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={16} color="#999" />
          </TouchableOpacity>
        </View>
      ))}
      <View style={styles.careerForm}>
        <TextInput
          style={styles.careerInput}
          placeholder="Role (e.g. Software Engineer, School Teacher)"
          placeholderTextColor="#999"
          value={careerRole}
          onChangeText={setCareerRole}
        />
        <TextInput
          style={styles.careerInput}
          placeholder="Organization (e.g. TCS, Kendriya Vidyalaya)"
          placeholderTextColor="#999"
          value={careerOrg}
          onChangeText={setCareerOrg}
        />
        <TextInput
          style={styles.careerInput}
          placeholder="Years (e.g. 2018–2022 or 3 years)"
          placeholderTextColor="#999"
          value={careerYears}
          onChangeText={setCareerYears}
        />
        <TouchableOpacity style={styles.addCareerButton} onPress={addCareerEntry}>
          <Plus size={18} color="#fff" />
          <Text style={styles.addCareerButtonText}>Add experience</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFinalStep = () => {
    const roleLabel = role ? ROLE_OPTIONS.find(r => r.key === role)?.label : '';
    return (
      <View style={styles.stepContainer}>
        <View style={styles.iconContainer}>
          <CheckCircle2 size={64} color="#4CAF50" strokeWidth={1.5} />
        </View>
        <Text style={styles.title}>You&apos;re all set!</Text>
        <Text style={styles.subtitle}>Ready to start your skill exchange journey?</Text>
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryTitle}>Your Profile Summary:</Text>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Role:</Text>
            <Text style={styles.summaryValue}>{roleLabel}</Text>
          </View>
          {(role === 'teacher' || role === 'swap') && selectedTeachSkills.length > 0 && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Teaching:</Text>
              <Text style={styles.summaryValue}>{getFinalTeachSkills().join(', ')}</Text>
            </View>
          )}
          {role === 'teacher' && languages.length > 0 && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Languages:</Text>
              <Text style={styles.summaryValue}>{languages.join(', ')}</Text>
            </View>
          )}
          {role === 'teacher' && qualifications.length > 0 && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Qualifications:</Text>
              <Text style={styles.summaryValue}>{qualifications.join(', ')}</Text>
            </View>
          )}
          {role === 'teacher' && certifications.length > 0 && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Certifications:</Text>
              <Text style={styles.summaryValue}>
                {certifications.length} certificate{certifications.length === 1 ? '' : 's'}
                {certifications.some((c) => c.documentUri)
                  ? ` (${certifications.filter((c) => c.documentUri).length} document${certifications.filter((c) => c.documentUri).length === 1 ? '' : 's'} uploaded)`
                  : ''}
              </Text>
            </View>
          )}
          {role === 'teacher' && (careerHistory.length > 0 || yearsTeaching) && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Experience:</Text>
              <Text style={styles.summaryValue}>
                {yearsTeaching || '—'}
                {careerHistory.length > 0
                  ? ` · ${careerHistory.length} past role${careerHistory.length === 1 ? '' : 's'}`
                  : ''}
                {privateTuition ? ' · Private tuition experience' : ''}
              </Text>
            </View>
          )}
          {(role === 'learner' || role === 'swap') && selectedLearnSkills.length > 0 && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Learning:</Text>
              <Text style={styles.summaryValue}>{getFinalLearnSkills().join(', ')}</Text>
            </View>
          )}
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Availability:</Text>
            <Text style={styles.summaryValue}>{availability.join(', ')}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome': return renderWelcomeStep();
      case 'role': return renderRoleStep();
      case 'teach': return renderTeachSkillsStep();
      case 'experience': return renderExperienceLevelStep();
      case 'languages': return renderLanguagesStep();
      case 'credentials': return renderCredentialsStep();
      case 'career': return renderCareerStep();
      case 'learn': return renderLearnSkillsStep();
      case 'availability': return renderAvailabilityStep();
      case 'summary': return renderFinalStep();
      default: return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={['#FFF5F7', '#FFFFFF', '#F0F9FF']} style={styles.gradient}>
        <View style={styles.header}>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${((stepIndex + 1) / totalSteps) * 100}%` }]} />
            </View>
          </View>
          <Text style={styles.stepCounter}>Step {stepIndex + 1} of {totalSteps}</Text>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          {renderStep()}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.buttonRow}>
            {stepIndex > 0 && (
              <TouchableOpacity style={styles.backButton} onPress={goToPreviousStep}>
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.continueButton, !canContinue() && styles.continueButtonDisabled, stepIndex === 0 && styles.continueButtonFull]}
              onPress={goToNextStep}
              disabled={!canContinue()}
            >
              <Text style={styles.continueButtonText}>
                {stepIndex === totalSteps - 1 ? "Let's Go!" : 'Continue'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  gradient: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20 },
  progressBarContainer: { marginBottom: 8 },
  progressBarBackground: { height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#FF6B9D', borderRadius: 2 },
  stepCounter: { fontSize: 12, color: '#666', fontWeight: '600' as const, textAlign: 'center' },
  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 24, paddingBottom: 24 },
  stepContainer: { flex: 1 },
  iconContainer: { alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700' as const, color: '#1A1A1A', marginBottom: 12, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 24, textAlign: 'center', lineHeight: 24 },
  description: { fontSize: 14, color: '#888', marginBottom: 32, textAlign: 'center', lineHeight: 20 },
  featureList: { marginTop: 32 },
  featureItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingHorizontal: 16 },
  featureText: { fontSize: 16, color: '#333', marginLeft: 16, fontWeight: '500' as const },
  // Role selection
  roleList: { gap: 14, marginTop: 8 },
  roleCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 18, gap: 16,
    borderWidth: 2, borderColor: '#E0E0E0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  roleCardSelected: { borderWidth: 2, backgroundColor: '#FAFAFA' },
  roleIconWrap: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  roleCardContent: { flex: 1 },
  roleCardTitle: { fontSize: 17, fontWeight: '700' as const, color: '#1A1A1A', marginBottom: 3 },
  roleCardSubtitle: { fontSize: 13, color: '#666', fontWeight: '500' as const },
  // Options
  optionsList: { marginTop: 8 },
  optionItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff',
    padding: 18, borderRadius: 12, marginBottom: 12, borderWidth: 2, borderColor: '#E0E0E0',
  },
  optionItemSelected: { backgroundColor: '#FF6B9D', borderColor: '#FF6B9D' },
  optionText: { fontSize: 16, color: '#333', fontWeight: '500' as const },
  optionTextSelected: { color: '#fff', fontWeight: '600' as const },
  customInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 12,
    marginTop: -4,
  },
  // Skill levels
  skillLevelContainer: { marginBottom: 24 },
  skillLevelTitle: { fontSize: 16, fontWeight: '600' as const, color: '#333', marginBottom: 12 },
  levelButtons: { flexDirection: 'row', flexWrap: 'wrap' as const, gap: 8 },
  levelButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E0E0E0' },
  levelButtonSelected: { backgroundColor: '#FF6B9D', borderColor: '#FF6B9D' },
  levelButtonText: { fontSize: 14, color: '#666', fontWeight: '500' as const },
  levelButtonTextSelected: { color: '#fff', fontWeight: '600' as const },
  // Goals
  goalsSection: { marginTop: 24, paddingTop: 24, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  goalsTitle: { fontSize: 16, fontWeight: '600' as const, color: '#333', marginBottom: 12 },
  goalsList: { flexDirection: 'row', flexWrap: 'wrap' as const, gap: 8 },
  goalChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E0E0E0' },
  goalChipSelected: { backgroundColor: '#E3F2FD', borderColor: '#2196F3' },
  goalChipText: { fontSize: 14, color: '#666', fontWeight: '500' as const },
  goalChipTextSelected: { color: '#2196F3', fontWeight: '600' as const },
  // Location
  locationSection: { marginTop: 24, paddingTop: 24, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  locationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  locationTitle: { fontSize: 16, fontWeight: '600' as const, color: '#333', marginLeft: 8 },
  locationInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 16,
  },
  getLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0F4',
    borderWidth: 1,
    borderColor: '#FFD1DF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  getLocationButtonDisabled: {
    opacity: 0.6,
  },
  getLocationButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FF6B9D',
  },
  toggleRow: { flexDirection: 'row', gap: 12 },
  toggle: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E0E0E0', alignItems: 'center' },
  toggleActive: { backgroundColor: '#E3F2FD', borderColor: '#2196F3' },
  toggleText: { fontSize: 14, color: '#666', fontWeight: '500' as const },
  toggleTextActive: { color: '#2196F3', fontWeight: '600' as const },
  // Summary
  summaryContainer: { backgroundColor: '#F9F9F9', borderRadius: 16, padding: 20, marginTop: 24 },
  summaryTitle: { fontSize: 18, fontWeight: '700' as const, color: '#333', marginBottom: 16 },
  summaryItem: { marginBottom: 12 },
  summaryLabel: { fontSize: 14, color: '#666', marginBottom: 4, fontWeight: '600' as const },
  summaryValue: { fontSize: 15, color: '#333', lineHeight: 22 },
  // Footer
  footer: { paddingHorizontal: 24, paddingVertical: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  buttonRow: { flexDirection: 'row', gap: 12 },
  backButton: { flex: 1, paddingVertical: 16, borderRadius: 12, backgroundColor: '#F5F5F5', alignItems: 'center' },
  backButtonText: { fontSize: 16, color: '#666', fontWeight: '600' as const },
  continueButton: { flex: 2, paddingVertical: 16, borderRadius: 12, backgroundColor: '#FF6B9D', alignItems: 'center' },
  continueButtonFull: { flex: 1 },
  continueButtonDisabled: { backgroundColor: '#E0E0E0' },
  continueButtonText: { fontSize: 16, color: '#fff', fontWeight: '700' as const },

  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  searchBarInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
    padding: 0,
  },

  // Selected Skills Section
  selectedSection: {
    marginBottom: 16,
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  selectedHeading: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#666',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  selectedChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  selectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  selectedPillText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },

  // Search Results View
  searchResultsContainer: {
    gap: 8,
  },
  resultsCountText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#888',
    marginBottom: 4,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    marginBottom: 8,
  },
  searchResultRowSelected: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  searchResultRowLearnSelected: {
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
  },
  searchResultTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#1A1A1A',
    marginBottom: 2,
  },
  searchResultTitleSelected: {
    color: '#10B981',
  },
  searchResultCategory: {
    fontSize: 12,
    color: '#888',
  },
  uncheckCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CCC',
  },

  // Category Accordion
  categoriesAccordionList: {
    gap: 10,
  },
  catAccordionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  catAccordionCardActive: {
    borderColor: '#10B981',
  },
  catAccordionCardLearnActive: {
    borderColor: '#6366F1',
  },
  catAccordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  catIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catIconBoxActive: {
    backgroundColor: '#ECFDF5',
  },
  catIconBoxLearnActive: {
    backgroundColor: '#EEF2FF',
  },
  catHeaderInfo: {
    flex: 1,
  },
  catHeaderTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#1A1A1A',
  },
  catHeaderTitleActive: {
    color: '#10B981',
  },
  catHeaderMeta: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  catBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginRight: 4,
  },
  catBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#10B981',
  },
  subcatsBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FAFAFA',
  },
  subcatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 8,
    marginTop: 8,
  },
  subcatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  subcatChipSelected: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  subcatChipLearnSelected: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  subcatChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#333',
  },
  subcatChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
  },

  // Teacher onboarding — chips & inputs
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap' as const, gap: 8, marginBottom: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E0E0E0' },
  chipSelected: { backgroundColor: '#10B981', borderColor: '#10B981' },
  chipText: { fontSize: 14, color: '#666', fontWeight: '500' as const },
  chipTextSelected: { color: '#fff', fontWeight: '600' as const },
  sectionLabel: { fontSize: 15, fontWeight: '600' as const, color: '#333', marginBottom: 10, marginTop: 8 },
  addRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  addRowInput: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 12, padding: 14, fontSize: 15, color: '#333', borderWidth: 1, borderColor: '#E0E0E0' },
  addRowButton: { width: 50, borderRadius: 12, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },

  // Certified toggle
  certifiedToggle: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderWidth: 2, borderColor: '#E0E0E0', borderRadius: 16, padding: 16, marginTop: 8, marginBottom: 16 },
  certifiedToggleActive: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  certifiedToggleIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  certifiedToggleIconActive: { backgroundColor: '#10B981' },
  certifiedToggleContent: { flex: 1 },
  certifiedToggleTitle: { fontSize: 15, fontWeight: '600' as const, color: '#333', marginBottom: 2 },
  certifiedToggleTitleActive: { color: '#065F46' },
  certifiedToggleSubtitle: { fontSize: 12, color: '#888', lineHeight: 16 },

  // Certifications
  certSection: { gap: 10 },
  certCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 14 },
  certCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  certCardTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 },
  certCardTitle: { fontSize: 15, fontWeight: '600' as const, color: '#1A1A1A', flexShrink: 1 },
  uploadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 10, backgroundColor: '#ECFDF5', borderWidth: 1.5, borderColor: '#10B981', borderStyle: 'dashed' as const },
  uploadButtonDone: { backgroundColor: '#D1FAE5', borderColor: '#34D399', borderStyle: 'solid' as const },
  uploadButtonText: { fontSize: 13, fontWeight: '600' as const, color: '#059669' },
  uploadButtonTextDone: { color: '#065F46' },

  // Career history
  careerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 14, marginBottom: 10 },
  careerIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  careerContent: { flex: 1 },
  careerRole: { fontSize: 15, fontWeight: '600' as const, color: '#1A1A1A' },
  careerMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  careerForm: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 14, gap: 10, marginTop: 4 },
  careerInput: { backgroundColor: '#fff', borderRadius: 10, padding: 12, fontSize: 14, color: '#333', borderWidth: 1, borderColor: '#E5E7EB' },
  addCareerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: '#10B981' },
  addCareerButtonText: { fontSize: 14, color: '#fff', fontWeight: '600' as const },

  // Skill Offer Config Cards
  skillConfigCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E8ECF2',
    padding: 18,
    gap: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  skillConfigHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  skillConfigTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1A1A1A',
  },
  skillConfigCategory: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  skillConfigBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  skillConfigBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#059669',
  },
  configFieldSection: {
    gap: 8,
  },
  configFieldLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
  },
  configPricingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pricingModelGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  pricingChip: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  pricingChipSelected: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  pricingChipLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#4B5563',
    marginBottom: 3,
  },
  pricingChipLabelSelected: {
    color: '#065F46',
  },
  pricingChipDesc: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 13,
  },
  pricingChipDescSelected: {
    color: '#047857',
  },
  priceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginTop: 4,
  },
  pricePrefix: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#10B981',
    marginRight: 6,
  },
  priceInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1A1A1A',
    paddingVertical: 8,
  },
  priceSuffix: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500' as const,
    marginLeft: 6,
  },
  labelWithAiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiGenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  aiGenBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#6366F1',
  },
  configTextArea: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#1A1A1A',
    minHeight: 70,
  },
  configCharCount: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'right',
  },
  promoteToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 12,
  },
  promoteToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  promoteToggleTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#92400E',
  },
  promoteToggleSubtitle: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 1,
  },
  toggleSwitch: {
    width: 42,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#D1D5DB',
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchOn: {
    backgroundColor: '#F59E0B',
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
  },
  promoTaglineWrap: {
    marginTop: 6,
  },
  promoInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 10,
    fontSize: 13,
    color: '#1A1A1A',
  },
});

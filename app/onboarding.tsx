import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
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
} from 'lucide-react-native';
import { OnboardingRole } from '@/types';
import { useOnboarding } from '@/providers/onboarding';
import { useCurrentUser } from '@/providers/current-user';
import {
  CATEGORY_STRUCTURE,
  MAIN_CATEGORIES,
  getSubcategoriesForCategory,
} from '@/constants/categories';

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
const availabilityOptions = ['Weekday Mornings', 'Weekday Afternoons', 'Weekday Evenings', 'Weekends', 'Flexible'];
const communicationOptions = ['Video Call', 'In Person', 'Chat', 'Mix of All'];

type StepKey = 'welcome' | 'role' | 'teach' | 'experience' | 'learn' | 'availability' | 'summary';

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
  const [learningGoals, setLearningGoals] = useState<string[]>([]);
  const [availability, setAvailability] = useState<string[]>([]);
  const [communication, setCommunication] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [isFetchingLocation, setIsFetchingLocation] = useState<boolean>(false);
  const [virtualEnabled, setVirtualEnabled] = useState<boolean>(true);
  const [inPersonEnabled, setInPersonEnabled] = useState<boolean>(false);

  const steps = useMemo<StepKey[]>(() => {
    const list: StepKey[] = ['welcome', 'role'];
    if (role === 'teacher' || role === 'swap') {
      list.push('teach', 'experience');
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

  const goToNextStep = () => {
    // Persist data when leaving relevant steps
    if (currentStep === 'role' && role) {
      updateOnboardingData({ role });
    } else if (currentStep === 'teach') {
      updateOnboardingData({ skillsToTeach: getFinalTeachSkills() });
    } else if (currentStep === 'experience') {
      updateOnboardingData({ skillsToTeach: getFinalTeachSkills(), experienceLevels: getFinalExperienceLevels() });
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
      learningGoals,
      availability,
      communicationPreference: communication,
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
        return selectedTeachSkills.every(skill => experienceLevels[skill]);
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

  const toggleSkillSelection = (skill: string, isTeach: boolean) => {
    const setter = isTeach ? setSelectedTeachSkills : setSelectedLearnSkills;
    const selected = isTeach ? selectedTeachSkills : selectedLearnSkills;
    if (selected.includes(skill)) {
      setter(selected.filter(s => s !== skill));
      if (isTeach) {
        const next = { ...experienceLevels };
        delete next[skill];
        setExperienceLevels(next);
      }
    } else {
      setter([...selected, skill]);
    }
  };

  const setSkillLevel = (skill: string, level: SkillLevel) => {
    setExperienceLevels(prev => ({ ...prev, [skill]: level }));
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
      <Text style={styles.title}>Welcome to LearnSwap!</Text>
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
      <Text style={styles.title}>How will you use LearnSwap?</Text>
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
      <Text style={styles.title}>Rate your expertise</Text>
      <Text style={styles.subtitle}>How would you rate your proficiency in each skill?</Text>
      <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
        {selectedTeachSkills.map((skill) => {
          const currentLevel = experienceLevels[skill] || 'Intermediate';
          return (
            <View key={skill} style={styles.skillLevelContainer}>
              <Text style={styles.skillLevelTitle}>{skill}</Text>
              <View style={styles.levelButtons}>
                {skillLevels.map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[styles.levelButton, currentLevel === level && styles.levelButtonSelected]}
                    onPress={() => setSkillLevel(skill, level)}
                  >
                    <Text style={[styles.levelButtonText, currentLevel === level && styles.levelButtonTextSelected]}>
                      {level}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
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
});

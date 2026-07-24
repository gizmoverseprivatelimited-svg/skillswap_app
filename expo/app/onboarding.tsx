import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
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
} from 'lucide-react-native';
import { useOnboarding, OnboardingRole } from '@/providers/onboarding';
import { useCurrentUser } from '@/providers/current-user';
import { categories } from '@/mocks/data';

type SkillLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';

const skillLevels: SkillLevel[] = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
const availabilityOptions = ['Weekday Mornings', 'Weekday Afternoons', 'Weekday Evenings', 'Weekends', 'Flexible'];
const communicationOptions = ['Video Call', 'In Person', 'Chat', 'Mix of All'];

type StepKey = 'welcome' | 'role' | 'teach' | 'experience' | 'learn' | 'availability' | 'preferences' | 'summary';

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
  const [experienceLevels, setExperienceLevels] = useState<Record<string, SkillLevel>>({});
  const [learningGoals, setLearningGoals] = useState<string[]>([]);
  const [availability, setAvailability] = useState<string[]>([]);
  const [communication, setCommunication] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [virtualEnabled, setVirtualEnabled] = useState<boolean>(true);
  const [inPersonEnabled, setInPersonEnabled] = useState<boolean>(false);

  const skillCategories = categories.filter(c => c !== 'All');

  const steps = useMemo<StepKey[]>(() => {
    const list: StepKey[] = ['welcome', 'role'];
    if (role === 'teacher' || role === 'swap') {
      list.push('teach', 'experience');
    }
    if (role === 'learner' || role === 'swap') {
      list.push('learn');
    }
    list.push('availability', 'preferences', 'summary');
    return list;
  }, [role]);

  const currentStep = steps[stepIndex] ?? 'welcome';
  const totalSteps = steps.length;

  const goToNextStep = () => {
    // Persist data when leaving relevant steps
    if (currentStep === 'role' && role) {
      updateOnboardingData({ role });
    } else if (currentStep === 'teach') {
      updateOnboardingData({ skillsToTeach: selectedTeachSkills });
    } else if (currentStep === 'experience') {
      updateOnboardingData({ skillsToTeach: selectedTeachSkills, experienceLevels });
    } else if (currentStep === 'learn') {
      updateOnboardingData({ skillsToLearn: selectedLearnSkills, learningGoals });
    } else if (currentStep === 'availability') {
      updateOnboardingData({ availability });
    } else if (currentStep === 'preferences') {
      updateOnboardingData({
        communicationPreference: communication,
        matchingPreferences: { location, virtual: virtualEnabled, inPerson: inPersonEnabled },
      });
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
    // Apply the collected onboarding data to the current user so Smart Matches
    // and the home screen immediately reflect the user's chosen role and skills.
    applyOnboardingData({
      role: role ?? 'swap',
      skillsToTeach: selectedTeachSkills,
      skillsToLearn: selectedLearnSkills,
      experienceLevels,
      learningGoals,
      availability,
      communicationPreference: communication,
      matchingPreferences: { location, virtual: virtualEnabled, inPerson: inPersonEnabled },
    });
    try {
      await completeOnboarding();
    } catch (error) {
      console.warn('[Onboarding] completeOnboarding threw, navigating anyway:', error);
    }
    router.replace('/(tabs)/home' as any);
  };

  const canContinue = (): boolean => {
    switch (currentStep) {
      case 'welcome':
        return true;
      case 'role':
        return role !== null;
      case 'teach':
        return selectedTeachSkills.length > 0;
      case 'experience':
        return selectedTeachSkills.every(skill => experienceLevels[skill]);
      case 'learn':
        return selectedLearnSkills.length > 0;
      case 'availability':
        return availability.length > 0;
      case 'preferences':
        return communication.length > 0 && (virtualEnabled || inPersonEnabled);
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

  const renderTeachSkillsStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <GraduationCap size={48} color="#10B981" strokeWidth={1.5} />
      </View>
      <Text style={styles.title}>What can you teach?</Text>
      <Text style={styles.subtitle}>
        Select the skills you&apos;d like to share with others
      </Text>
      <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
        {skillCategories.map((skill) => (
          <TouchableOpacity
            key={skill}
            style={[styles.optionItem, selectedTeachSkills.includes(skill) && styles.optionItemSelected]}
            onPress={() => toggleSkillSelection(skill, true)}
          >
            <Text style={[styles.optionText, selectedTeachSkills.includes(skill) && styles.optionTextSelected]}>
              {skill}
            </Text>
            {selectedTeachSkills.includes(skill) && <CheckCircle2 size={20} color="#fff" />}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderExperienceLevelStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Rate your expertise</Text>
      <Text style={styles.subtitle}>How would you rate your level in these skills?</Text>
      <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
        {selectedTeachSkills.map((skill) => (
          <View key={skill} style={styles.skillLevelContainer}>
            <Text style={styles.skillLevelTitle}>{skill}</Text>
            <View style={styles.levelButtons}>
              {skillLevels.map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[styles.levelButton, experienceLevels[skill] === level && styles.levelButtonSelected]}
                  onPress={() => setSkillLevel(skill, level)}
                >
                  <Text style={[styles.levelButtonText, experienceLevels[skill] === level && styles.levelButtonTextSelected]}>
                    {level}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  const renderLearnSkillsStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Target size={48} color="#6366F1" strokeWidth={1.5} />
      </View>
      <Text style={styles.title}>What do you want to learn?</Text>
      <Text style={styles.subtitle}>Select skills you&apos;re interested in learning</Text>
      <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
        {skillCategories.map((skill) => (
          <TouchableOpacity
            key={skill}
            style={[styles.optionItem, selectedLearnSkills.includes(skill) && styles.optionItemSelected]}
            onPress={() => toggleSkillSelection(skill, false)}
          >
            <Text style={[styles.optionText, selectedLearnSkills.includes(skill) && styles.optionTextSelected]}>
              {skill}
            </Text>
            {selectedLearnSkills.includes(skill) && <CheckCircle2 size={20} color="#fff" />}
          </TouchableOpacity>
        ))}
      </ScrollView>

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
              <Text style={styles.summaryValue}>{selectedTeachSkills.join(', ')}</Text>
            </View>
          )}
          {(role === 'learner' || role === 'swap') && selectedLearnSkills.length > 0 && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Learning:</Text>
              <Text style={styles.summaryValue}>{selectedLearnSkills.join(', ')}</Text>
            </View>
          )}
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Availability:</Text>
            <Text style={styles.summaryValue}>{availability.join(', ')}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Preference:</Text>
            <Text style={styles.summaryValue}>{communication}</Text>
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
      case 'preferences': return renderPreferencesStep();
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
  locationInput: { backgroundColor: '#F5F5F5', borderRadius: 12, padding: 16, fontSize: 16, color: '#333', borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 16 },
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
});

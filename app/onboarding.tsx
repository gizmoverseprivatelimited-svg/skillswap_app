import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, GraduationCap, Target, Calendar, MapPin, MessageCircle, CheckCircle2 } from 'lucide-react-native';
import { useOnboarding } from '@/providers/onboarding';
import { categories } from '@/mocks/data';
import { useAlert } from '@/providers/alert';
import { useCurrentUser } from '@/providers/current-user';
import * as Location from 'expo-location';

type SkillLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';

const skillLevels: SkillLevel[] = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
const availabilityOptions = ['Weekday Mornings', 'Weekday Afternoons', 'Weekday Evenings', 'Weekends', 'Flexible'];
const communicationOptions = ['Video Call', 'In Person', 'Chat', 'Mix of All'];

export default function OnboardingScreen() {
  const router = useRouter();
  const { 
    currentStep, 
    setCurrentStep, 
    totalSteps, 
    onboardingData, 
    updateOnboardingData,
    completeOnboarding,
  } = useOnboarding();
  const { loadUser } = useCurrentUser();
  const { showAlert } = useAlert();

  const [isCompleting, setIsCompleting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const handleGetLocation = async () => {
    setIsLocating(true);
    try {
      console.log('[Location] Requesting location permission...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert(
          'Permission Denied',
          'Permission to access location was denied. Please enter your location manually.'
        );
        return;
      }

      console.log('[Location] Fetching current position...');
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      console.log('[Location] Reverse geocoding position...');
      let formattedLocation = '';

      if (Platform.OS === 'web') {
        // Fallback for Web using OpenStreetMap Nominatim reverse geocoder
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${currentLocation.coords.latitude}&lon=${currentLocation.coords.longitude}`,
          {
            headers: {
              'User-Agent': 'SkillSwapCommunityApp',
            },
          }
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data.address) {
            const addr = data.address;
            const city = addr.city || addr.town || addr.village || addr.suburb || addr.municipality || '';
            const state = addr.state || '';
            const country = addr.country || '';
            const parts = [city, state, country].filter((p) => p.trim() !== '');
            formattedLocation = parts.join(', ');
          }
        }
      } else {
        const geocoded = await Location.reverseGeocodeAsync({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });

        if (geocoded && geocoded.length > 0) {
          const address = geocoded[0];
          console.log('[Location] Geocode address result:', address);
          
          // Extract city, state, country
          const city = address.city || address.subregion || address.district || '';
          const state = address.region || '';
          const country = address.country || '';

          const parts = [city, state, country].filter((p) => p.trim() !== '');
          formattedLocation = parts.join(', ');
        }
      }

      if (formattedLocation) {
        setLocation(formattedLocation);
      } else {
        showAlert('Location Error', 'Could not resolve city/state from current location.');
      }
    } catch (error: any) {
      console.error('[Location] Error getting location:', error);
      showAlert(
        'Location Error',
        error.message || 'An error occurred while fetching your location. Please type manually.'
      );
    } finally {
      setIsLocating(false);
    }
  };

  const [selectedTeachSkills, setSelectedTeachSkills] = useState<string[]>(onboardingData.skillsToTeach || []);
  const [selectedLearnSkills, setSelectedLearnSkills] = useState<string[]>(onboardingData.skillsToLearn || []);
  const [experienceLevels, setExperienceLevels] = useState<Record<string, SkillLevel>>((onboardingData.experienceLevels || {}) as Record<string, SkillLevel>);
  const [learningGoals, setLearningGoals] = useState<string[]>(onboardingData.learningGoals || []);
  const [availability, setAvailability] = useState<string[]>(onboardingData.availability || []);
  const [communication, setCommunication] = useState<string>(onboardingData.communicationPreference || '');
  const [location, setLocation] = useState<string>(onboardingData.matchingPreferences?.location || '');
  const [virtualEnabled, setVirtualEnabled] = useState<boolean>(onboardingData.matchingPreferences?.virtual ?? true);
  const [inPersonEnabled, setInPersonEnabled] = useState<boolean>(onboardingData.matchingPreferences?.inPerson ?? false);

  const skillCategories = categories.filter(c => c !== 'All');

  const goToNextStep = () => {
    if (currentStep === 1) {
      updateOnboardingData({ skillsToTeach: selectedTeachSkills });
    } else if (currentStep === 2) {
      updateOnboardingData({ skillsToTeach: selectedTeachSkills, experienceLevels });
    } else if (currentStep === 3) {
      updateOnboardingData({ skillsToLearn: selectedLearnSkills, learningGoals });
    } else if (currentStep === 4) {
      updateOnboardingData({ availability });
    } else if (currentStep === 5) {
      updateOnboardingData({ 
        communicationPreference: communication,
        matchingPreferences: { location, virtual: virtualEnabled, inPerson: inPersonEnabled }
      });
    }

    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    if (isCompleting) return;
    setIsCompleting(true);
    console.log('[Onboarding] Completing with final data');
    try {
      await completeOnboarding();
      await loadUser();
      router.replace('/(tabs)/home');
    } catch (error: any) {
      console.error('[Onboarding] Failed to complete:', error);
      showAlert('Onboarding Failed', error.message || 'Failed to complete onboarding. Please try again.');
    } finally {
      setIsCompleting(false);
    }
  };

  const canContinue = () => {
    if (currentStep === 0) return true;
    if (currentStep === 1) return selectedTeachSkills.length > 0;
    if (currentStep === 2) return selectedTeachSkills.every(skill => experienceLevels[skill]);
    if (currentStep === 3) return selectedLearnSkills.length > 0;
    if (currentStep === 4) return availability.length > 0;
    if (currentStep === 5) return communication.length > 0 && (virtualEnabled || inPersonEnabled);
    return true;
  };

  const toggleSkillSelection = (skill: string, isTeach: boolean) => {
    const setter = isTeach ? setSelectedTeachSkills : setSelectedLearnSkills;
    const selected = isTeach ? selectedTeachSkills : selectedLearnSkills;
    
    if (selected.includes(skill)) {
      setter(selected.filter(s => s !== skill));
      if (isTeach) {
        const newLevels = { ...experienceLevels };
        delete newLevels[skill];
        setExperienceLevels(newLevels);
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
      <Text style={styles.title}>Welcome to SkillSwap!</Text>
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

  const renderTeachSkillsStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <GraduationCap size={48} color="#FF6B9D" strokeWidth={1.5} />
      </View>
      <Text style={styles.title}>What can you teach?</Text>
      <Text style={styles.subtitle}>
        Select the skills you&apos;d like to share with others
      </Text>
      <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
        {skillCategories.map((skill) => (
          <TouchableOpacity
            key={skill}
            style={[
              styles.optionItem,
              selectedTeachSkills.includes(skill) && styles.optionItemSelected,
            ]}
            onPress={() => toggleSkillSelection(skill, true)}
          >
            <Text
              style={[
                styles.optionText,
                selectedTeachSkills.includes(skill) && styles.optionTextSelected,
              ]}
            >
              {skill}
            </Text>
            {selectedTeachSkills.includes(skill) && (
              <CheckCircle2 size={20} color="#fff" />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderExperienceLevelStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Rate your expertise</Text>
      <Text style={styles.subtitle}>
        How would you rate your level in these skills?
      </Text>
      <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
        {selectedTeachSkills.map((skill) => (
          <View key={skill} style={styles.skillLevelContainer}>
            <Text style={styles.skillLevelTitle}>{skill}</Text>
            <View style={styles.levelButtons}>
              {skillLevels.map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.levelButton,
                    experienceLevels[skill] === level && styles.levelButtonSelected,
                  ]}
                  onPress={() => setSkillLevel(skill, level)}
                >
                  <Text
                    style={[
                      styles.levelButtonText,
                      experienceLevels[skill] === level && styles.levelButtonTextSelected,
                    ]}
                  >
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
        <Target size={48} color="#FF6B9D" strokeWidth={1.5} />
      </View>
      <Text style={styles.title}>What do you want to learn?</Text>
      <Text style={styles.subtitle}>
        Select skills you&apos;re interested in learning
      </Text>
      <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
        {skillCategories.map((skill) => (
          <TouchableOpacity
            key={skill}
            style={[
              styles.optionItem,
              selectedLearnSkills.includes(skill) && styles.optionItemSelected,
            ]}
            onPress={() => toggleSkillSelection(skill, false)}
          >
            <Text
              style={[
                styles.optionText,
                selectedLearnSkills.includes(skill) && styles.optionTextSelected,
              ]}
            >
              {skill}
            </Text>
            {selectedLearnSkills.includes(skill) && (
              <CheckCircle2 size={20} color="#fff" />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
      
      <View style={styles.goalsSection}>
        <Text style={styles.goalsTitle}>Your learning goals (optional)</Text>
        <View style={styles.goalsList}>
          {['Career Change', 'Hobby', 'Personal Growth', 'Side Project'].map((goal) => (
            <TouchableOpacity
              key={goal}
              style={[
                styles.goalChip,
                learningGoals.includes(goal) && styles.goalChipSelected,
              ]}
              onPress={() => toggleGoal(goal)}
            >
              <Text
                style={[
                  styles.goalChipText,
                  learningGoals.includes(goal) && styles.goalChipTextSelected,
                ]}
              >
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
      <Text style={styles.subtitle}>
        Select your preferred times for skill exchanges
      </Text>
      <View style={styles.optionsList}>
        {availabilityOptions.map((slot) => (
          <TouchableOpacity
            key={slot}
            style={[
              styles.optionItem,
              availability.includes(slot) && styles.optionItemSelected,
            ]}
            onPress={() => toggleAvailability(slot)}
          >
            <Text
              style={[
                styles.optionText,
                availability.includes(slot) && styles.optionTextSelected,
              ]}
            >
              {slot}
            </Text>
            {availability.includes(slot) && (
              <CheckCircle2 size={20} color="#fff" />
            )}
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
      <Text style={styles.subtitle}>
        Choose your preferred method of skill exchange
      </Text>
      
      <View style={styles.optionsList}>
        {communicationOptions.map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.optionItem,
              communication === option && styles.optionItemSelected,
            ]}
            onPress={() => setCommunication(option)}
          >
            <Text
              style={[
                styles.optionText,
                communication === option && styles.optionTextSelected,
              ]}
            >
              {option}
            </Text>
            {communication === option && (
              <CheckCircle2 size={20} color="#fff" />
            )}
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
          style={[styles.getLocationButton, isLocating && styles.getLocationButtonDisabled]}
          onPress={handleGetLocation}
          disabled={isLocating}
        >
          {isLocating ? (
            <ActivityIndicator size="small" color="#FF6B9D" />
          ) : (
            <>
              <MapPin size={16} color="#FF6B9D" style={{ marginRight: 6 }} />
              <Text style={styles.getLocationButtonText}>Use Current Location</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggle, virtualEnabled && styles.toggleActive]}
            onPress={() => setVirtualEnabled(!virtualEnabled)}
          >
            <Text style={[styles.toggleText, virtualEnabled && styles.toggleTextActive]}>
              Virtual Sessions
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggle, inPersonEnabled && styles.toggleActive]}
            onPress={() => setInPersonEnabled(!inPersonEnabled)}
          >
            <Text style={[styles.toggleText, inPersonEnabled && styles.toggleTextActive]}>
              In-Person Meetups
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderFinalStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <CheckCircle2 size={64} color="#4CAF50" strokeWidth={1.5} />
      </View>
      <Text style={styles.title}>You&apos;re all set!</Text>
      <Text style={styles.subtitle}>
        Ready to start your skill exchange journey?
      </Text>
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>Your Profile Summary:</Text>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Teaching:</Text>
          <Text style={styles.summaryValue}>{selectedTeachSkills.join(', ')}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Learning:</Text>
          <Text style={styles.summaryValue}>{selectedLearnSkills.join(', ')}</Text>
        </View>
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

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return renderWelcomeStep();
      case 1:
        return renderTeachSkillsStep();
      case 2:
        return renderExperienceLevelStep();
      case 3:
        return renderLearnSkillsStep();
      case 4:
        return renderAvailabilityStep();
      case 5:
        return renderPreferencesStep();
      case 6:
        return renderFinalStep();
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={['#FFF5F7', '#FFFFFF', '#F0F9FF']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${((currentStep + 1) / totalSteps) * 100}%` },
                ]}
              />
            </View>
          </View>
          <Text style={styles.stepCounter}>
            Step {currentStep + 1} of {totalSteps}
          </Text>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {renderStep()}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.buttonRow}>
            {currentStep > 0 && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={goToPreviousStep}
              >
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.continueButton,
                (!canContinue() || isCompleting) && styles.continueButtonDisabled,
                currentStep === 0 && styles.continueButtonFull,
              ]}
              onPress={goToNextStep}
              disabled={!canContinue() || isCompleting}
            >
              <Text style={styles.continueButtonText}>
                {isCompleting ? 'Loading...' : (currentStep === totalSteps - 1 ? "Let's Go!" : 'Continue')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  gradient: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
  },
  progressBarContainer: {
    marginBottom: 8,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FF6B9D',
    borderRadius: 2,
  },
  stepCounter: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  stepContainer: {
    flex: 1,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 24,
  },
  description: {
    fontSize: 14,
    color: '#888',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 20,
  },
  featureList: {
    marginTop: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  featureText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 16,
    fontWeight: '500' as const,
  },
  optionsList: {
    marginTop: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  optionItemSelected: {
    backgroundColor: '#FF6B9D',
    borderColor: '#FF6B9D',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500' as const,
  },
  optionTextSelected: {
    color: '#fff',
    fontWeight: '600' as const,
  },
  skillLevelContainer: {
    marginBottom: 24,
  },
  skillLevelTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#333',
    marginBottom: 12,
  },
  levelButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  levelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  levelButtonSelected: {
    backgroundColor: '#FF6B9D',
    borderColor: '#FF6B9D',
  },
  levelButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500' as const,
  },
  levelButtonTextSelected: {
    color: '#fff',
    fontWeight: '600' as const,
  },
  goalsSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  goalsTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#333',
    marginBottom: 12,
  },
  goalsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  goalChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  goalChipSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  goalChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500' as const,
  },
  goalChipTextSelected: {
    color: '#2196F3',
    fontWeight: '600' as const,
  },
  locationSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#333',
    marginLeft: 8,
  },
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
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  toggle: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  toggleText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500' as const,
  },
  toggleTextActive: {
    color: '#2196F3',
    fontWeight: '600' as const,
  },
  summaryContainer: {
    backgroundColor: '#F9F9F9',
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#333',
    marginBottom: 16,
  },
  summaryItem: {
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    fontWeight: '600' as const,
  },
  summaryValue: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600' as const,
  },
  continueButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#FF6B9D',
    alignItems: 'center',
  },
  continueButtonFull: {
    flex: 1,
  },
  continueButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  continueButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '700' as const,
  },
});

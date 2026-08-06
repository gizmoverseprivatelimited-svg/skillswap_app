import { useCallback, useEffect, useMemo, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './auth';
import { trpc } from '@/lib/trpc';

const ONBOARDING_KEY = '@skillswap/onboarding_complete';

export type OnboardingRole = 'teacher' | 'learner' | 'swap';

export interface OnboardingData {
  role?: OnboardingRole;
  skillsToTeach: string[];
  skillsToLearn: string[];
  experienceLevels: Record<string, string>;
  learningGoals: string[];
  availability: string[];
  communicationPreference: string;
  matchingPreferences: {
    location: string;
    virtual: boolean;
    inPerson: boolean;
  };
}

interface OnboardingContextValue {
  hasCompletedOnboarding: boolean;
  isChecking: boolean;
  currentStep: number;
  totalSteps: number;
  onboardingData: Partial<OnboardingData>;
  updateOnboardingData: (data: Partial<OnboardingData>) => void;
  setCurrentStep: (step: number) => void;
  completeOnboarding: () => Promise<void>;
  skipOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
}

export const [OnboardingProvider, useOnboarding] = createContextHook<OnboardingContextValue>(() => {
  const { isAuthenticated, user } = useAuth();
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [onboardingData, setOnboardingData] = useState<Partial<OnboardingData>>({});
  
  const totalSteps = 7;

  useEffect(() => {
    checkOnboardingStatus();
  }, [isAuthenticated, user]);

  const checkOnboardingStatus = useCallback(async () => {
    console.log('[Onboarding] Checking onboarding status');
    setIsChecking(true);
    try {
      if (!isAuthenticated || !user) {
        setHasCompletedOnboarding(false);
        setIsChecking(false);
        return;
      }

      const key = `${ONBOARDING_KEY}_${user.id}`;
      const completed = await AsyncStorage.getItem(key);
      const hasCompleted = completed === 'true';
      
      console.log('[Onboarding] Status:', { hasCompleted, userId: user.id });
      setHasCompletedOnboarding(hasCompleted);
    } catch (error) {
      console.error('[Onboarding] Failed to check status:', error);
      setHasCompletedOnboarding(false);
    } finally {
      setIsChecking(false);
    }
  }, [isAuthenticated, user]);

  const updateOnboardingData = useCallback((data: Partial<OnboardingData>) => {
    console.log('[Onboarding] Updating data:', data);
    setOnboardingData(prev => ({ ...prev, ...data }));
  }, []);

  const completeOnboardingMutation = trpc.onboarding.complete.useMutation();

  const completeOnboarding = useCallback(async () => {
    console.log('[Onboarding] Completing onboarding with data:', onboardingData);

    // Use a per-user key when authenticated, otherwise a guest key so onboarding
    // can still complete for unauthenticated sessions.
    const userKey = user ? `${ONBOARDING_KEY}_${user.id}` : `${ONBOARDING_KEY}_guest`;
    const dataKey = user ? `${ONBOARDING_KEY}_${user.id}_data` : `${ONBOARDING_KEY}_guest_data`;

    try {
      // Persist to backend only when we have an authenticated user.
      if (user) {
        try {
          await completeOnboardingMutation.mutateAsync({
            role: onboardingData.role || 'swap',
            skillsToTeach: onboardingData.skillsToTeach || [],
            skillsToLearn: onboardingData.skillsToLearn || [],
            experienceLevels: onboardingData.experienceLevels || {},
            learningGoals: onboardingData.learningGoals || [],
            availability: onboardingData.availability || [],
            communicationPreference: onboardingData.communicationPreference || '',
            matchingPreferences: onboardingData.matchingPreferences || {
              location: '',
              virtual: true,
              inPerson: false,
            },
          });
        } catch (backendError) {
          console.warn('[Onboarding] Backend save failed, continuing with local persistence:', backendError);
        }
      }

      await AsyncStorage.setItem(userKey, 'true');
      await AsyncStorage.setItem(dataKey, JSON.stringify(onboardingData));
      
      setHasCompletedOnboarding(true);
      setCurrentStep(0);
      setOnboardingData({});
      
      console.log('[Onboarding] Completed successfully', { hasUser: !!user });
    } catch (error) {
      console.error('[Onboarding] Failed to complete:', error);
      throw error;
    }
  }, [user, onboardingData, completeOnboardingMutation]);

  const skipOnboarding = useCallback(async () => {
    console.log('[Onboarding] Skipping onboarding');
    if (!user) return;

    try {
      const key = `${ONBOARDING_KEY}_${user.id}`;
      await AsyncStorage.setItem(key, 'true');
      setHasCompletedOnboarding(true);
      setCurrentStep(0);
      console.log('[Onboarding] Skipped successfully');
    } catch (error) {
      console.error('[Onboarding] Failed to skip:', error);
      throw error;
    }
  }, [user]);

  const resetOnboarding = useCallback(async () => {
    console.log('[Onboarding] Resetting onboarding');
    if (!user) return;

    try {
      const key = `${ONBOARDING_KEY}_${user.id}`;
      const dataKey = `${ONBOARDING_KEY}_${user.id}_data`;
      await AsyncStorage.removeItem(key);
      await AsyncStorage.removeItem(dataKey);
      setHasCompletedOnboarding(false);
      setCurrentStep(0);
      setOnboardingData({});
      console.log('[Onboarding] Reset successfully');
    } catch (error) {
      console.error('[Onboarding] Failed to reset:', error);
      throw error;
    }
  }, [user]);

  const value = useMemo<OnboardingContextValue>(() => ({
    hasCompletedOnboarding,
    isChecking,
    currentStep,
    totalSteps,
    onboardingData,
    updateOnboardingData,
    setCurrentStep,
    completeOnboarding,
    skipOnboarding,
    resetOnboarding,
  }), [
    hasCompletedOnboarding,
    isChecking,
    currentStep,
    totalSteps,
    onboardingData,
    updateOnboardingData,
    completeOnboarding,
    skipOnboarding,
    resetOnboarding,
  ]);

  return value;
});

import { useCallback, useEffect, useMemo, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './auth';
import url from '@/constants/backurl';
import type { Skill, OnboardingRole } from '../types';

const ONBOARDING_KEY = '@skillswap/onboarding_complete';

export interface OnboardingData {
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
  role?: OnboardingRole;
}

interface OnboardingContextValue {
  hasCompletedOnboarding: boolean;
  isChecking: boolean;
  currentStep: number;
  totalSteps: number;
  onboardingData: Partial<OnboardingData>;
  updateOnboardingData: (data: Partial<OnboardingData>) => void;
  setCurrentStep: (step: number) => void;
  completeOnboarding: (dataOverride?: Partial<OnboardingData>) => Promise<void>;
  skipOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
}

export const [OnboardingProvider, useOnboarding] = createContextHook<OnboardingContextValue>(() => {
  const { isAuthenticated, user, updateUser } = useAuth();
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [onboardingData, setOnboardingData] = useState<Partial<OnboardingData>>({});
  
  const totalSteps = 7;

  useEffect(() => {
    checkOnboardingStatus();
  }, [isAuthenticated, user?.id]);

  const checkOnboardingStatus = useCallback(async () => {
    console.log('[Onboarding] Checking onboarding status');
    setIsChecking(true);
    try {
      if (!isAuthenticated || !user) {
        setHasCompletedOnboarding(false);
        setIsChecking(false);
        return;
      }

      const u = user as any;
      const isAccountCompleted = Boolean(
        u?.hasCompletedOnboarding ||
        (Array.isArray(u?.skillsToTeach) && u.skillsToTeach.length > 0) ||
        (Array.isArray(u?.skillsToLearn) && u.skillsToLearn.length > 0) ||
        (Array.isArray(u?.skillsOffered) && u.skillsOffered.length > 0) ||
        (Array.isArray(u?.skillsWanted) && u.skillsWanted.length > 0)
      );

      const key = `${ONBOARDING_KEY}_${user.id}`;
      const completedStorage = await AsyncStorage.getItem(key);
      const hasCompleted = isAccountCompleted || completedStorage === 'true';

      if (isAccountCompleted && completedStorage !== 'true') {
        await AsyncStorage.setItem(key, 'true').catch(() => {});
      }
      
      console.log('[Onboarding] Status:', { hasCompleted, userId: user.id });
      setHasCompletedOnboarding(hasCompleted);
    } catch (error) {
      console.error('[Onboarding] Failed to check status:', error);
    } finally {
      setIsChecking(false);
    }
  }, [isAuthenticated, user]);

  const updateOnboardingData = useCallback((data: Partial<OnboardingData>) => {
    console.log('[Onboarding] Updating data:', data);
    setOnboardingData(prev => ({ ...prev, ...data }));
  }, []);

  const completeOnboarding = useCallback(async (dataOverride?: Partial<OnboardingData>) => {
    const finalData = dataOverride ? { ...onboardingData, ...dataOverride } : onboardingData;
    console.log('[Onboarding] Completing onboarding with data:', finalData);
    if (!user) {
      console.error('[Onboarding] Cannot complete without user');
      return;
    }

    try {
      // For guest users, complete onboarding purely locally
      if (user.id === '1') {
        const key = `${ONBOARDING_KEY}_${user.id}`;
        await AsyncStorage.setItem(key, 'true');
        
        const dataKey = `${ONBOARDING_KEY}_${user.id}_data`;
        await AsyncStorage.setItem(dataKey, JSON.stringify(finalData));

        if (Array.isArray(finalData.skillsToTeach)) {
          const guestSkills: Skill[] = finalData.skillsToTeach.map((skill, index) => {
            const STOCK_IMAGES: Record<string, string> = {
              'Arts & Crafts': 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800',
              'Technology': 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
              'Fitness & Wellness': 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800',
              'Languages': 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800',
              'Music': 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800',
              'Cooking': 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800',
              'Business': 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800',
              'Photography': 'https://images.unsplash.com/photo-1554048612-b6a482bc67e5?w=800',
              'Classical Arts': 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800',
              'Competitive Exams': 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800',
            };
            return {
              id: `guest_skill_${index}_${Date.now()}`,
              _id: `guest_skill_${index}_${Date.now()}`,
              title: skill,
              category: skill as any,
              description: `I can teach ${skill}`,
              level: (finalData.experienceLevels && finalData.experienceLevels[skill]) as any || 'Beginner',
              userId: user.id,
              imageUrl: STOCK_IMAGES[skill] || 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
            };
          });
          await AsyncStorage.setItem('@skillswap/guest_skills_offered', JSON.stringify(guestSkills));
        }
        
        setHasCompletedOnboarding(true);
        setCurrentStep(0);
        setOnboardingData({});
        console.log('[Onboarding] Completed locally for guest user');
        return;
      }

      const response = await fetch(`${url}/users/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          skillsToTeach: finalData.skillsToTeach || [],
          skillsToLearn: finalData.skillsToLearn || [],
          experienceLevels: finalData.experienceLevels || {},
          learningGoals: finalData.learningGoals || [],
          availability: finalData.availability || [],
          communicationPreference: finalData.communicationPreference || '',
          matchingPreferences: finalData.matchingPreferences || {
            location: '',
            virtual: true,
            inPerson: false,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Onboarding save failed');
      }

      const result = await response.json();

      // Save onboarding flag to AsyncStorage BEFORE updateUser to prevent
      // race condition: updateUser changes user ref → triggers checkOnboardingStatus
      // → which must find the flag already written.
      const key = `${ONBOARDING_KEY}_${user.id}`;
      await AsyncStorage.setItem(key, 'true');
      
      const dataKey = `${ONBOARDING_KEY}_${user.id}_data`;
      await AsyncStorage.setItem(dataKey, JSON.stringify(finalData));
      
      setHasCompletedOnboarding(true);

      if (result.success && result.user) {
        await updateUser(result.user);
      }
      setCurrentStep(0);
      setOnboardingData({});
      
      console.log('[Onboarding] Completed successfully');
    } catch (error) {
      console.error('[Onboarding] Failed to complete:', error);
      throw error;
    }
  }, [user, onboardingData, updateUser]);

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

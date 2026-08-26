import { useCallback, useEffect, useMemo, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './auth';
import url from '@/constants/backurl';
import type { Skill, OnboardingRole, SkillCategory, SkillLevel, TeacherProfileData, TeacherCertification, CareerEntry } from '../types';
import { findCategoryForSubcategory, getCategoryImageUrl } from '@/constants/categories';

export type { OnboardingRole, TeacherCertification, CareerEntry, TeacherProfileData };

const ONBOARDING_KEY = '@skillswap/onboarding_complete';

export interface OnboardingSkillOfferDetail {
  title: string;
  category?: string;
  subCategory?: string;
  level: SkillLevel;
  pricingModel: 'free' | 'per_session' | 'monthly';
  pricePerSession?: number;
  monthlyPrice?: number;
  description: string;
  promoted?: boolean;
  promoTagline?: string;
  certificateUri?: string;
  certificateStatus?: 'pending' | 'approved' | 'rejected';
}

export interface OnboardingData {
  skillsToTeach: string[];
  skillsToLearn: string[];
  experienceLevels: Record<string, string>;
  teachSkillDetails?: Record<string, OnboardingSkillOfferDetail>;
  learningGoals: string[];
  availability: string[];
  communicationPreference: string;
  teacherProfile?: TeacherProfileData;
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
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [onboardingData, setOnboardingData] = useState<Partial<OnboardingData>>({});
  
  const totalSteps = 7;

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      checkOnboardingStatus();
    } else {
      setHasCompletedOnboarding(false);
      setIsChecking(false);
    }
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
    try {
      // Save pending onboarding data so it can be synced upon login/signup
      await AsyncStorage.setItem('@skillswap/onboarding_pending_data', JSON.stringify(finalData));
      await AsyncStorage.setItem('@skillswap/onboarding_complete_guest_data', JSON.stringify(finalData));
      await AsyncStorage.setItem(`${ONBOARDING_KEY}_guest`, 'true');

      // For logged out or guest users, complete onboarding locally
      if (!user || user.id === '1' || (user as any).isDemo) {
        const userId = user?.id || '1';
        const key = `${ONBOARDING_KEY}_${userId}`;
        await AsyncStorage.setItem(key, 'true');
        
        const dataKey = `${ONBOARDING_KEY}_${userId}_data`;
        await AsyncStorage.setItem(dataKey, JSON.stringify(finalData));

        if (Array.isArray(finalData.skillsToTeach)) {
          const guestSkills: Skill[] = finalData.skillsToTeach.map((skill, index) => {
            const detail = finalData.teachSkillDetails?.[skill];
            const mainCat = (findCategoryForSubcategory(skill) || 'Other / Miscellaneous') as SkillCategory;
            const catImage = getCategoryImageUrl(mainCat);
            const generatedId = `guest_skill_${index}_${Date.now()}`;
            return {
              id: generatedId,
              _id: generatedId,
              title: skill,
              category: mainCat,
              subCategory: skill,
              description: detail?.description?.trim() || `I can teach and share knowledge in ${skill}.`,
              level: (detail?.level || (finalData.experienceLevels && finalData.experienceLevels[skill]) || 'Intermediate') as SkillLevel,
              pricingModel: detail?.pricingModel || 'free',
              pricePerSession: detail?.pricingModel === 'per_session' ? (detail.pricePerSession || 50) : undefined,
              monthlyPrice: detail?.pricingModel === 'monthly' ? (detail.monthlyPrice || 200) : undefined,
              promoted: Boolean(detail?.promoted),
              promoTagline: detail?.promoTagline || undefined,
              userId: userId,
              imageUrl: catImage,
            };
          });
          await AsyncStorage.setItem('@skillswap/guest_skills_offered', JSON.stringify(guestSkills));
        }
        
        setHasCompletedOnboarding(true);
        setCurrentStep(0);
        setOnboardingData({});
        console.log('[Onboarding] Completed locally for guest / logged out user');
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
          teachSkillDetails: finalData.teachSkillDetails || {},
          learningGoals: finalData.learningGoals || [],
          availability: finalData.availability || [],
          communicationPreference: finalData.communicationPreference || '',
          matchingPreferences: finalData.matchingPreferences || {
            location: '',
            virtual: true,
            inPerson: false,
          },
          teacherProfile: finalData.teacherProfile,
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

import { useCallback, useEffect, useMemo, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mockUsers } from '../mocks/data';
import type { MatchRecommendation, OnboardingRole, Skill, SkillCategory, SkillLevel, User } from '../types';
import { computeMatchRecommendations, getUserRole } from '../lib/matching';
import type { OnboardingData } from './onboarding';
import { creditsToRupees } from '../lib/payments';

const ONBOARDING_KEY = '@skillswap/onboarding_complete';

interface CurrentUserContextValue {
  currentUser: User;
  allUsers: User[];
  recommendations: MatchRecommendation[];
  topRecommendations: MatchRecommendation[];
  teachMatches: MatchRecommendation[];
  learnMatches: MatchRecommendation[];
  swapMatches: MatchRecommendation[];
  userRole: OnboardingRole;
  applyOnboardingData: (data: Partial<OnboardingData>) => void;
  addSkill: (skill: Skill) => void;
  removeSkill: (skillId: string) => void;
  addLearnSkill: (title: string) => void;
  removeLearnSkill: (title: string) => void;
  spendCredits: (amount: number) => boolean;
  earnCredits: (amount: number) => void;
  refreshRecommendations: () => void;
}

export const [CurrentUserProvider, useCurrentUser] = createContextHook<CurrentUserContextValue>(() => {
  const [currentUser, setCurrentUser] = useState<User>(() => ({ ...mockUsers[0] }));
  const [refreshCounter, setRefreshCounter] = useState<number>(0);

  const applyOnboardingData = useCallback((data: Partial<OnboardingData>) => {
    setCurrentUser(prev => {
      const updated = { ...prev };
      if (data.role) {
        updated.role = data.role;
      }
      if (data.skillsToTeach && data.skillsToTeach.length > 0) {
        const existingTitles = new Set(prev.skillsOffered.map(s => s.title.toLowerCase()));
        const newSkills: Skill[] = data.skillsToTeach
          .filter(title => !existingTitles.has(title.toLowerCase()))
          .map((title, idx) => ({
            id: `onboard-${prev.id}-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
            title,
            category: title as SkillCategory,
            description: `Teaching ${title}`,
            level: (data.experienceLevels?.[title] as SkillLevel) || 'Intermediate',
            userId: prev.id,
            imageUrl: '',
          }));
        if (newSkills.length > 0) {
          updated.skillsOffered = [...prev.skillsOffered, ...newSkills];
        }
      }
      if (data.skillsToLearn && data.skillsToLearn.length > 0) {
        const existing = new Set(prev.skillsWanted.map(s => s.toLowerCase()));
        const additions = data.skillsToLearn.filter(t => !existing.has(t.toLowerCase()));
        if (additions.length > 0) {
          updated.skillsWanted = [...prev.skillsWanted, ...additions];
        }
      }
      console.log('[CurrentUser] Applied onboarding data', {
        role: updated.role,
        skillsOffered: updated.skillsOffered.length,
        skillsWanted: updated.skillsWanted.length,
      });
      return updated;
    });
  }, []);

  const addSkill = useCallback((skill: Skill) => {
    setCurrentUser(prev => ({
      ...prev,
      skillsOffered: [...prev.skillsOffered, skill],
    }));
  }, []);

  const removeSkill = useCallback((skillId: string) => {
    setCurrentUser(prev => ({
      ...prev,
      skillsOffered: prev.skillsOffered.filter(s => s.id !== skillId),
    }));
  }, []);

  const addLearnSkill = useCallback((title: string) => {
    setCurrentUser(prev => {
      if (prev.skillsWanted.includes(title)) return prev;
      return { ...prev, skillsWanted: [...prev.skillsWanted, title] };
    });
  }, []);

  const removeLearnSkill = useCallback((title: string) => {
    setCurrentUser(prev => ({
      ...prev,
      skillsWanted: prev.skillsWanted.filter(s => s !== title),
    }));
  }, []);

  const spendCredits = useCallback((amount: number) => {
    let success = false;
    setCurrentUser(prev => {
      if (prev.credits < amount) return prev;
      success = true;
      return { ...prev, credits: prev.credits - amount };
    });
    return success;
  }, []);

  const earnCredits = useCallback((amount: number) => {
    if (amount <= 0) return;
    setCurrentUser(prev => ({ ...prev, credits: prev.credits + amount }));
  }, []);

  // On mount, load any previously-saved onboarding data from AsyncStorage so the
  // user's role and skills persist across app restarts.
  useEffect(() => {
    const loadSaved = async () => {
      for (const key of [`${ONBOARDING_KEY}_${mockUsers[0].id}_data`, `${ONBOARDING_KEY}_guest_data`]) {
        try {
          const raw = await AsyncStorage.getItem(key);
          if (raw) {
            const data = JSON.parse(raw) as Partial<OnboardingData>;
            console.log('[CurrentUser] Found saved onboarding data:', key);
            applyOnboardingData(data);
            return;
          }
        } catch (e) {
          // ignore parse errors
        }
      }
    };
    loadSaved();
  }, [applyOnboardingData]);

  const otherUsers = useMemo<User[]>(() => {
    console.log('[Matching] Computing other users list', { refreshCounter });
    return mockUsers.filter((user) => user.id !== currentUser.id);
  }, [currentUser.id, refreshCounter]);

  const recommendations = useMemo<MatchRecommendation[]>(() => {
    console.log('[Matching] Recomputing recommendations', { refreshCounter });
    return computeMatchRecommendations(currentUser, otherUsers);
  }, [currentUser, otherUsers, refreshCounter]);

  const userRole = useMemo<OnboardingRole>(() => getUserRole(currentUser), [currentUser]);

  const teachMatches = useMemo<MatchRecommendation[]>(() => {
    return recommendations.filter((recommendation) => recommendation.theyCanLearn.length > 0);
  }, [recommendations]);

  const learnMatches = useMemo<MatchRecommendation[]>(() => {
    return recommendations.filter((recommendation) => recommendation.youCanLearn.length > 0);
  }, [recommendations]);

  const swapMatches = useMemo<MatchRecommendation[]>(() => {
    return recommendations.filter(
      (recommendation) => recommendation.youCanLearn.length > 0 && recommendation.theyCanLearn.length > 0,
    );
  }, [recommendations]);

  const topRecommendations = useMemo<MatchRecommendation[]>(() => {
    // Role-aware: prioritize the match list that matters most for the user's role.
    if (userRole === 'teacher') return teachMatches.slice(0, 6);
    if (userRole === 'learner') return learnMatches.slice(0, 6);
    return swapMatches.slice(0, 6);
  }, [userRole, teachMatches, learnMatches, swapMatches]);

  const refreshRecommendations = useCallback(() => {
    console.log('[Matching] Refresh triggered');
    setRefreshCounter((value) => value + 1);
  }, []);

  const value = useMemo<CurrentUserContextValue>(() => {
    return {
      currentUser,
      allUsers: mockUsers,
      recommendations,
      topRecommendations,
      teachMatches,
      learnMatches,
      swapMatches,
      userRole,
      applyOnboardingData,
      addSkill,
      removeSkill,
      addLearnSkill,
      removeLearnSkill,
      spendCredits,
      earnCredits,
      refreshRecommendations,
    };
  }, [currentUser, recommendations, topRecommendations, teachMatches, learnMatches, swapMatches, userRole, applyOnboardingData, addSkill, removeSkill, addLearnSkill, removeLearnSkill, spendCredits, earnCredits, refreshRecommendations]);

  return value;
});

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { mockUsers, getUsers } from '../mocks/data';
import type { MatchRecommendation, User, Skill, OnboardingRole, SkillCategory, SkillLevel } from '../types';
import { computeMatchRecommendations, getUserRole } from '../lib/matching';
import type { OnboardingData } from './onboarding';
import { useAuth } from './auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import url from '@/constants/backurl';

interface CurrentUserContextValue {
  loadUser: any
  currentUser: User | null;
  allUsers: User[];
  recommendations: MatchRecommendation[];
  topRecommendations: MatchRecommendation[];
  teachMatches: MatchRecommendation[];
  learnMatches: MatchRecommendation[];
  swapMatches: MatchRecommendation[];
  userRole: OnboardingRole;
  applyOnboardingData: (data: Partial<OnboardingData>) => void;
  refreshRecommendations: () => void;
  earnCredits: (amount: number) => void;
  spendCredits: (amount: number) => void;
  removeSkill: (skillId: string) => void;
  isLoading: boolean;
}

export const [CurrentUserProvider, useCurrentUser] = createContextHook<CurrentUserContextValue>(() => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [refreshCounter, setRefreshCounter] = useState<number>(0);
  const [users, setUsers] = useState<User[]>(mockUsers)
  const [isLoading, setIsLoading] = useState<boolean>(true);
  let { user } = useAuth()

  const applyOnboardingData = useCallback((data: Partial<OnboardingData>) => {
    setCurrentUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev };
      if (data.role) {
        updated.role = data.role;
      }
      if (data.skillsToTeach && data.skillsToTeach.length > 0) {
        const existingTitles = new Set(prev.skillsOffered.map(s => s.title.toLowerCase()));
        const newSkills: Skill[] = data.skillsToTeach
          .filter(title => !existingTitles.has(title.toLowerCase()))
          .map((title, idx) => ({
            id: `onboard-${prev.id}-${idx}`,
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
      return updated;
    });
  }, []);

  // Keep a ref to the latest user object to prevent loadUser from recreating and causing re-render loops
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const loadUser = useCallback(async (silent = false) => {
    let activeUser = userRef.current;
    if (!activeUser) {
      try {
        const stored = await AsyncStorage.getItem('@skillswap/user');
        if (stored) activeUser = JSON.parse(stored);
      } catch (e) {}
    }
    const currentId = activeUser?.id;
    if (!silent) {
      setIsLoading(true);
    }
    if (currentId === '1') {
      let guestProfile: any = {};
      let guestSkills: Skill[] = [];
      try {
        const storedGuest = await AsyncStorage.getItem('@skillswap/guest_user_profile');
        if (storedGuest) {
          guestProfile = JSON.parse(storedGuest);
        }
        const storedSkills = await AsyncStorage.getItem('@skillswap/guest_skills_offered');
        if (storedSkills) {
          guestSkills = JSON.parse(storedSkills);
        }
      } catch (e) {
        console.error('[CurrentUser] Failed to read guest data:', e);
      }

      const demoUser: User = {
        id: '1',
        name: guestProfile.name || activeUser?.name || 'Guest User',
        username: activeUser?.username || 'user_demo',
        avatarUrl: guestProfile.avatarUrl || activeUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        bio: guestProfile.bio || 'Demo account. Explore all functionalities of SkillSwap!',
        location: guestProfile.location || 'New Delhi, India',
        skillsOffered: guestSkills,
        skillsWanted: guestProfile.skillsWanted !== undefined ? guestProfile.skillsWanted : (activeUser?.skillsToLearn || ['Cooking', 'Hindi', 'Guitar']),
        rating: 4.8,
        totalSwaps: 5,
        joinedDate: '2026-01-01',
        credits: activeUser?.credits ?? 10,
        premiumTier: activeUser?.premiumTier ?? 'free',
      };
      setCurrentUser(demoUser);
    }

    try {
      let data = await getUsers();
      if (Array.isArray(data)) {
        setUsers(data);
        if (!currentId) {
          setCurrentUser(null);
          return;
        }

        if (currentId !== '1') {
          let authUser = data.find((u: any) => String(u.id || u._id) === String(currentId));
          setCurrentUser(authUser || null);
        }
      }
    } catch (err) {
      console.error('[CurrentUser] Failed to load users:', err);
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadUser();

    if (!user?.id) {
      setCurrentUser(null);
    }
  }, [user?.id, loadUser]);

  const otherUsers = useMemo<User[]>(() => {
    if (!currentUser?.id) return users;
    const currentId = String(currentUser.id || (currentUser as any)._id || '');
    return users.filter((user) => {
      const uId = String(user.id || (user as any)._id || '');
      return uId !== currentId;
    });
  }, [currentUser, refreshCounter, users]);

  const recommendations = useMemo<MatchRecommendation[]>(() => {
    if (!currentUser) {
      return []
    }
    return computeMatchRecommendations(currentUser, otherUsers);
  }, [currentUser, otherUsers, refreshCounter]);

  const userRole = useMemo<OnboardingRole>(() => currentUser ? getUserRole(currentUser) : 'swap', [currentUser]);

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
    let list: MatchRecommendation[] = [];
    if (userRole === 'teacher') list = teachMatches;
    else if (userRole === 'learner') list = learnMatches;
    else list = swapMatches;

    if (list.length === 0) {
      list = recommendations;
    }

    return list.slice(0, 6);
  }, [userRole, teachMatches, learnMatches, swapMatches, recommendations]);

  const refreshRecommendations = useCallback(async () => {
    await loadUser(true);
    setRefreshCounter((value) => value + 1);
  }, [loadUser]);

  const earnCredits = useCallback((amount: number) => {
    setCurrentUser((prev) => {
      if (!prev) return prev;
      const updatedCredits = (prev.credits || 0) + amount;
      if (prev.id === '1') {
        AsyncStorage.getItem('@skillswap/user').then((stored) => {
          const parsed = stored ? JSON.parse(stored) : {};
          parsed.credits = updatedCredits;
          AsyncStorage.setItem('@skillswap/user', JSON.stringify(parsed)).catch(() => {});
        }).catch(() => {});
      }
      return { ...prev, credits: updatedCredits };
    });
  }, []);

  const spendCredits = useCallback((amount: number) => {
    setCurrentUser((prev) => {
      if (!prev) return prev;
      const updatedCredits = Math.max(0, (prev.credits || 0) - amount);
      if (prev.id === '1') {
        AsyncStorage.getItem('@skillswap/user').then((stored) => {
          const parsed = stored ? JSON.parse(stored) : {};
          parsed.credits = updatedCredits;
          AsyncStorage.setItem('@skillswap/user', JSON.stringify(parsed)).catch(() => {});
        }).catch(() => {});
      }
      return { ...prev, credits: updatedCredits };
    });
  }, []);

  const removeSkill = useCallback(async (skillId: string) => {
    setCurrentUser((prev) => {
      if (!prev) return prev;
      const updatedOffered = (prev.skillsOffered || []).filter(
        (s) => String(s.id) !== String(skillId) && String(s._id) !== String(skillId),
      );
      return { ...prev, skillsOffered: updatedOffered };
    });

    if (currentUser?.id === '1') {
      try {
        const storedGuestSkills = await AsyncStorage.getItem('@skillswap/guest_skills_offered');
        if (storedGuestSkills) {
          const parsed: Skill[] = JSON.parse(storedGuestSkills);
          const filtered = parsed.filter((s) => String(s.id) !== String(skillId) && String((s as any)._id) !== String(skillId));
          await AsyncStorage.setItem('@skillswap/guest_skills_offered', JSON.stringify(filtered));
        }
      } catch (err) {
        console.error('[CurrentUserProvider] Delete guest skill error:', err);
      }
    } else if (skillId) {
      try {
        const res = await fetch(`${url}/skills/${skillId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) {
          console.warn('[CurrentUserProvider] DELETE /skills/:id responded with status', res.status);
        }
        if (loadUser) {
          await loadUser(true);
        }
      } catch (err) {
        console.error('[CurrentUserProvider] Delete skill backend error:', err);
      }
    }
  }, [currentUser?.id, loadUser]);

  const value = useMemo<CurrentUserContextValue>(() => {
    return {
      loadUser,
      currentUser,
      allUsers: users,
      recommendations,
      topRecommendations,
      teachMatches,
      learnMatches,
      swapMatches,
      userRole,
      applyOnboardingData,
      refreshRecommendations,
      earnCredits,
      spendCredits,
      removeSkill,
      isLoading,
    };
  }, [recommendations, loadUser, users, currentUser, topRecommendations, teachMatches, learnMatches, swapMatches, userRole, applyOnboardingData, refreshRecommendations, earnCredits, spendCredits, removeSkill, isLoading]);

  return value;
});

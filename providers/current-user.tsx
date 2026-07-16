import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { mockUsers, getUsers } from '../mocks/data';
import type { MatchRecommendation, User, Skill } from '../types';
import { computeMatchRecommendations } from '../lib/matching';
import { useAuth } from './auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CurrentUserContextValue {
  loadUser: any
  currentUser: User | null;
  allUsers: User[];
  recommendations: MatchRecommendation[];
  topRecommendations: MatchRecommendation[];
  teachMatches: MatchRecommendation[];
  refreshRecommendations: () => void;
  isLoading: boolean;
}

export const [CurrentUserProvider, useCurrentUser] = createContextHook<CurrentUserContextValue>(() => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [refreshCounter, setRefreshCounter] = useState<number>(0);
  const [users, setUsers] = useState<User[]>(mockUsers)
  const [isLoading, setIsLoading] = useState<boolean>(true);
  let { user } = useAuth()

  // Keep a ref to the latest user object to prevent loadUser from recreating and causing re-render loops
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const loadUser = useCallback(async (silent = false) => {
    const activeUser = userRef.current;
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
        skillsWanted: guestProfile.skillsWanted || ['Cooking', 'Hindi', 'Guitar'],
        rating: 4.8,
        totalSwaps: 5,
        joinedDate: '2026-01-01',
        credits: activeUser?.credits ?? 10,
        premiumTier: activeUser?.premiumTier ?? 'free',
      };
      setCurrentUser(demoUser);
    }

    try {
      let data = await getUsers()
      if (data) {
        setUsers(data)
        if (!currentId) {
          setCurrentUser(null);
          return;
        }
        if (currentId !== '1') {
          let authUser = data.find((u) => u.id == currentId)
          console.log("authUser", authUser);
          setCurrentUser(authUser || null)
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
    console.log("[CurrentUser] Loading users...");
    loadUser();

    if (!user?.id) {
      setCurrentUser(null);
    }

    // Poll users list every 10 seconds to detect new users and update matches, start after 2s if logged in
    let intervalId: any;
    let timeoutId: any;
    if (user?.id) {
      timeoutId = setTimeout(() => {
        intervalId = setInterval(() => {
          console.log('[CurrentUser] Polling users silently...');
          loadUser(true);
        }, 10000);
      }, 2000);
    }

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [user?.id, loadUser]);

  const otherUsers = useMemo<User[]>(() => {
    console.log('[Matching] Computing other users list', { refreshCounter });
    return users.filter((user) => user.id !== currentUser?.id);
  }, [currentUser?.id, refreshCounter, users]);

  const recommendations = useMemo<MatchRecommendation[]>(() => {
    if (!currentUser) {
      return []
    }
    console.log('[Matching] Recomputing recommendations', { refreshCounter });
    return computeMatchRecommendations(currentUser, otherUsers);
  }, [currentUser, otherUsers, refreshCounter]);

  const topRecommendations = useMemo<MatchRecommendation[]>(() => {
    return recommendations.slice(0, 6);
  }, [recommendations]);

  const teachMatches = useMemo<MatchRecommendation[]>(() => {
    return recommendations.filter((recommendation) => recommendation.theyCanLearn.length > 0);
  }, [recommendations]);

  const refreshRecommendations = useCallback(() => {
    console.log('[Matching] Refresh triggered');
    setRefreshCounter((value) => value + 1);
  }, []);

  const value = useMemo<CurrentUserContextValue>(() => {
    return {
      loadUser,
      currentUser,
      allUsers: users,
      recommendations,
      topRecommendations,
      teachMatches,
      refreshRecommendations,
      isLoading,
    };
  }, [recommendations, loadUser, users, currentUser, topRecommendations, teachMatches, refreshRecommendations, isLoading]);

  return value;
});

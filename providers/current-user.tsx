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
}

export const [CurrentUserProvider, useCurrentUser] = createContextHook<CurrentUserContextValue>(() => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [refreshCounter, setRefreshCounter] = useState<number>(0);
  const [users, setUsers] = useState<User[]>(mockUsers)
  let { user } = useAuth()

  // Keep a ref to the latest user?.id so the polling interval always reads the current value
  const userIdRef = useRef(user?.id);
  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  const loadUser = useCallback(async () => {
    const currentId = userIdRef.current;
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
        name: guestProfile.name || user?.name || 'Guest User',
        username: user?.username || 'user_demo',
        avatarUrl: guestProfile.avatarUrl || user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        bio: guestProfile.bio || 'Demo account. Explore all functionalities of SkillSwap!',
        location: guestProfile.location || 'New Delhi, India',
        skillsOffered: guestSkills,
        skillsWanted: guestProfile.skillsWanted || ['Cooking', 'Hindi', 'Guitar'],
        rating: 4.8,
        totalSwaps: 5,
        joinedDate: '2026-01-01',
        credits: user?.credits ?? 10,
        premiumTier: user?.premiumTier ?? 'free',
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
    }
  }, [user]);

  useEffect(() => {
    if (!user?.id) {
      setCurrentUser(null);
      return;
    }
    console.log("Working");
    loadUser();

    // Poll users list every 10 seconds to detect new users and update matches
    const intervalId = setInterval(() => {
      console.log('[CurrentUser] Polling users silently...');
      loadUser();
    }, 10000);

    return () => {
      clearInterval(intervalId);
    };
  }, [user?.id, loadUser]);

  const otherUsers = useMemo<User[]>(() => {
    console.log('[Matching] Computing other users list', { refreshCounter });
    return users.filter((user) => user.id !== currentUser?.id);
  }, [currentUser?.id, refreshCounter]);

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
    };
  }, [recommendations, loadUser, users, currentUser, topRecommendations, teachMatches, refreshRecommendations]);

  return value;
});

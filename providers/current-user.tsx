import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { mockUsers, getUsers } from '../mocks/data';
import type { MatchRecommendation, User } from '../types';
import { computeMatchRecommendations } from '../lib/matching';
import { useAuth } from './auth';

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
  const [currentUser, setCurrentUser] = useState<User>(mockUsers[0]);
  const [refreshCounter, setRefreshCounter] = useState<number>(0);
  const [users, setUsers] = useState<User[]>(mockUsers)
  let { user } = useAuth()

  // Keep a ref to the latest user?.id so the polling interval always reads the current value
  const userIdRef = useRef(user?.id);
  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  const loadUser = useCallback(async () => {
    try {
      let data = await getUsers()
      if (data) {
        setUsers(data)
        const currentId = userIdRef.current;
        let authUser = data.find((u) => u.id == currentId)
        console.log("authUser", authUser);
        setCurrentUser(authUser ? authUser || data[0] : data[0])
      }
    } catch (err) {
      console.error('[CurrentUser] Failed to load users:', err);
    }
  }, []);

  useEffect(() => {
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

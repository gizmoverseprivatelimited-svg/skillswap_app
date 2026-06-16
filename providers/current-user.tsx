import { useCallback, useEffect, useMemo, useState } from 'react';
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

  async function loadUser() {
    let data = await getUsers()
    // console.log(data);
    setUsers(data)
    if (users) {
      let authUser = data.find((u) => u.id == user?._id)
      console.log("authUser", authUser);
      setCurrentUser(authUser ? authUser || data[0] : data[0])
    }
  }
  useEffect(() => {
    console.log("Working");
    loadUser()
  }, [user?._id])

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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { mockUsers, getUsers } from '../mocks/data';
import type { MatchRecommendation, User, Skill, OnboardingRole, SkillCategory, SkillLevel } from '../types';
import { computeMatchRecommendations, getUserRole } from '../lib/matching';
import type { OnboardingData } from './onboarding';
import { useAuth } from './auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafety } from './safety';
import { useSocket } from './socket';
import url from '@/constants/backurl';

import { findCategoryForSubcategory, getCategoryImageUrl } from '@/constants/categories';

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
  attachSkillCertificate: (skillId: string, documentUri: string) => void;
  removeSkillCertificate: (skillId: string) => void;
  isLoading: boolean;
}

export const [CurrentUserProvider, useCurrentUser] = createContextHook<CurrentUserContextValue>(() => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [refreshCounter, setRefreshCounter] = useState<number>(0);
  const [users, setUsers] = useState<User[]>(mockUsers)
  const [isLoading, setIsLoading] = useState<boolean>(true);
  let { user } = useAuth()
  const { socket } = useSocket();

  const applyOnboardingData = useCallback((data: Partial<OnboardingData>) => {
    setCurrentUser(prev => {
      if (!prev) return prev;
      const updated: User = { ...prev };
      if (data.skillsToTeach && data.skillsToTeach.length > 0) {
        const existingTitles = new Set((prev.skillsOffered || []).map(s => s.title.toLowerCase()));
        const matchingCert = data.teacherProfile?.certifications?.find(c => c.documentUri);
        const newSkills: Skill[] = data.skillsToTeach
          .filter(title => !existingTitles.has(title.toLowerCase()))
          .map((title, idx) => {
            const detail = data.teachSkillDetails?.[title];
            const mainCategory = (detail?.category || findCategoryForSubcategory(title) || 'Other / Miscellaneous') as SkillCategory;
            const catImage = getCategoryImageUrl(mainCategory);
            const generatedId = `onboard-${prev.id}-${idx}-${Date.now()}`;
            return {
              id: generatedId,
              _id: generatedId,
              title,
              category: mainCategory,
              subCategory: detail?.subCategory || title,
              description: detail?.description?.trim() || `I can teach and share knowledge in ${title}.`,
              level: (detail?.level || (data.experienceLevels?.[title] as SkillLevel)) || 'Intermediate',
              pricingModel: detail?.pricingModel || 'free',
              pricePerSession: detail?.pricingModel === 'per_session' ? (detail.pricePerSession || 50) : undefined,
              monthlyPrice: detail?.pricingModel === 'monthly' ? (detail.monthlyPrice || 200) : undefined,
              promoted: Boolean(detail?.promoted),
              promoTagline: detail?.promoTagline || undefined,
              certificateUri: matchingCert?.documentUri || detail?.certificateUri || undefined,
              certificateStatus: (matchingCert?.documentUri || detail?.certificateUri) ? (matchingCert?.status || 'pending') : undefined,
              userId: prev.id,
              imageUrl: catImage,
            };
          });
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
      if (data.teacherProfile) {
        updated.teacherProfile = {
          ...data.teacherProfile,
          certifications: (data.teacherProfile.certifications || []).map(c => ({
            ...c,
            status: c.status || 'pending',
          })),
        };
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
      const demoUser: User = {
        id: '1',
        name: activeUser?.name || 'Demo User',
        username: activeUser?.username || 'user_demo',
        avatarUrl: activeUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        bio: 'Demo account (read-only mode). Browse and explore leteski!',
        location: 'New Delhi, India',
        skillsOffered: [],
        skillsWanted: [],
        rating: 5.0,
        totalSwaps: 0,
        joinedDate: '2026-01-01',
        credits: typeof activeUser?.credits === 'number' ? activeUser.credits : 0,
        premiumTier: activeUser?.premiumTier || 'free',
        premiumExpiresAt: activeUser?.premiumExpiresAt ? String(activeUser.premiumExpiresAt) : undefined,
        isDemo: true,
      };
      setCurrentUser(demoUser);
    }

    try {
      const userPromise = (currentId && currentId !== '1')
        ? fetch(`${url}/users/${currentId}`).then(r => (r.ok ? r.json() : null)).catch(() => null)
        : Promise.resolve(null);
      const allUsersPromise = getUsers();

      const [directUser, data] = await Promise.all([userPromise, allUsersPromise]);

      if (Array.isArray(data)) {
        setUsers(data);
      }
      if (!currentId) {
        setCurrentUser(null);
        return;
      }

      if (currentId !== '1') {
        let loadedUser: any = (directUser && (directUser.id || directUser._id)) ? directUser : null;

        if (!loadedUser && Array.isArray(data)) {
          let authUser = data.find((u: any) => String(u.id || u._id) === String(currentId));
          if (authUser) {
            loadedUser = authUser;
          }
        }

        if (loadedUser) {
          // If teacherProfile is not populated on DB user, check AsyncStorage
          if (!loadedUser.teacherProfile) {
            try {
              const storedOnboarding = await AsyncStorage.getItem(`@skillswap/onboarding_complete_${currentId}_data`)
                || await AsyncStorage.getItem('@skillswap/onboarding_complete_guest_data')
                || await AsyncStorage.getItem('@skillswap/onboarding_complete_1_data')
                || await AsyncStorage.getItem('@skillswap/onboarding_pending_data');
              if (storedOnboarding) {
                const parsed = JSON.parse(storedOnboarding);
                if (parsed?.teacherProfile) {
                  loadedUser = { ...loadedUser, teacherProfile: parsed.teacherProfile };
                }
              }
            } catch (storageErr) {
              console.warn('[CurrentUser] Failed reading stored onboarding data:', storageErr);
            }
          }

          setCurrentUser(loadedUser);
        }
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, []);

  // Listen for real-time admin actions and user updates from Admin panel
  useEffect(() => {
    if (!socket) return;

    const myId = currentUser ? String(currentUser.id || (currentUser as any)._id) : '';

    if (myId) {
      socket.emit('join_room', myId);
    }

    const handleCertUpdated = (event: any) => {
      if (myId && String(event.userId) === myId) {
        setCurrentUser(prev => {
          if (!prev) return prev;
          const updatedTeacherProfile = prev.teacherProfile ? {
            ...prev.teacherProfile,
            certifications: (prev.teacherProfile.certifications || []).map((c: any) =>
              (String(c.id) === String(event.certId) || String(c._id) === String(event.certId))
                ? { ...c, status: event.status, reviewNote: event.reviewNote, reviewedAt: event.reviewedAt }
                : c
            ),
          } : undefined;

          const updatedSkills = (prev.skillsOffered || []).map(s => {
            return {
              ...s,
              certificateStatus: event.status,
              certificateReviewNote: event.reviewNote,
              certificateReviewedAt: event.reviewedAt,
            };
          });

          return {
            ...prev,
            teacherProfile: updatedTeacherProfile,
            skillsOffered: updatedSkills,
          };
        });
      }
    };

    const handleUserUpdated = (updatedUser: any) => {
      if (!updatedUser) return;
      const targetId = String(updatedUser._id || updatedUser.id || '');
      if (myId && targetId === myId) {
        console.log('[Socket.IO CurrentUser] Received real-time user_updated:', updatedUser);
        setCurrentUser(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            ...updatedUser,
            id: targetId,
            credits: typeof updatedUser.credits === 'number' ? updatedUser.credits : prev.credits,
            isVerified: updatedUser.isVerified !== undefined ? updatedUser.isVerified : prev.isVerified,
            banStatus: updatedUser.banStatus || prev.banStatus,
            teacherProfile: updatedUser.teacherProfile || prev.teacherProfile,
          };
        });
      }
    };

    const handleCreditsUpdated = (data: any) => {
      if (!data) return;
      const targetId = String(data.userId || data._id || data.id || '');
      if (myId && (targetId === myId || !targetId)) {
        console.log('[Socket.IO CurrentUser] Received real-time credits_updated:', data);
        if (typeof data.credits === 'number' || typeof data.newBalance === 'number') {
          const newCredits = typeof data.credits === 'number' ? data.credits : data.newBalance;
          setCurrentUser(prev => prev ? { ...prev, credits: newCredits } : prev);
        } else {
          loadUser(true);
        }
      }
    };

    const handleUserBanned = (data: any) => {
      const targetUserId = String(data?.userId || (data?.user && (data.user._id || data.user.id)) || '');
      if (myId && targetUserId === myId) {
        console.log('[Socket.IO CurrentUser] Received real-time user_banned:', data);
        setCurrentUser(prev => prev ? {
          ...prev,
          banStatus: 'banned',
          banReason: data.reason || data.banReason,
          bannedAt: data.bannedAt || new Date().toISOString(),
          suspendedUntil: undefined,
          daysSuspended: undefined,
        } : prev);
      }
    };

    const handleUserSuspended = (data: any) => {
      const targetUserId = String(data?.userId || (data?.user && (data.user._id || data.user.id)) || '');
      if (myId && targetUserId === myId) {
        console.log('[Socket.IO CurrentUser] Received real-time user_suspended:', data);
        setCurrentUser(prev => prev ? {
          ...prev,
          banStatus: 'suspended',
          banReason: data.reason || data.banReason,
          bannedAt: data.bannedAt || new Date().toISOString(),
          suspendedUntil: data.suspendedUntil ? new Date(data.suspendedUntil).toISOString() : undefined,
          daysSuspended: data.daysSuspended,
        } : prev);
      }
    };

    const handleUserUnbanned = (data: any) => {
      const targetUserId = String(data?.userId || (data?.user && (data.user._id || data.user.id)) || '');
      if (myId && targetUserId === myId) {
        console.log('[Socket.IO CurrentUser] Received real-time user_unbanned:', data);
        setCurrentUser(prev => prev ? {
          ...prev,
          banStatus: 'active',
          banReason: undefined,
          bannedAt: undefined,
          suspendedUntil: undefined,
          daysSuspended: undefined,
        } : prev);
      }
    };

    const handleUserVerified = (data: any) => {
      const targetUserId = String(data?.userId || (data?.user && (data.user._id || data.user.id)) || '');
      if (myId && targetUserId === myId) {
        console.log('[Socket.IO CurrentUser] Received real-time user_verified');
        setCurrentUser(prev => prev ? { ...prev, isVerified: true } : prev);
      }
    };

    socket.on('certification_updated', handleCertUpdated);
    socket.on('user_updated', handleUserUpdated);
    socket.on('credits_updated', handleCreditsUpdated);
    socket.on('user_banned', handleUserBanned);
    socket.on('user_suspended', handleUserSuspended);
    socket.on('user_unbanned', handleUserUnbanned);
    socket.on('user_verified', handleUserVerified);
    socket.on('verification_approved', handleUserVerified);

    return () => {
      socket.off('certification_updated', handleCertUpdated);
      socket.off('user_updated', handleUserUpdated);
      socket.off('credits_updated', handleCreditsUpdated);
      socket.off('user_banned', handleUserBanned);
      socket.off('user_suspended', handleUserSuspended);
      socket.off('user_unbanned', handleUserUnbanned);
      socket.off('user_verified', handleUserVerified);
      socket.off('verification_approved', handleUserVerified);
    };
  }, [socket, currentUser, loadUser]);

  useEffect(() => {
    loadUser();

    if (!user?.id) {
      setCurrentUser(null);
    }
  }, [user?.id, loadUser]);

  const { isBlocked } = useSafety();

  const otherUsers = useMemo<User[]>(() => {
    if (!currentUser?.id) return users;
    const currentId = String(currentUser.id || (currentUser as any)._id || '');
    return users.filter((user) => {
      const uId = String(user.id || (user as any)._id || '');
      if (uId === currentId) return false;
      if (isBlocked(uId, currentId)) return false;
      return true;
    });
  }, [currentUser, refreshCounter, users, isBlocked]);

  const recommendations = useMemo<MatchRecommendation[]>(() => {
    if (!currentUser) {
      return [];
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

  const attachSkillCertificate = useCallback(async (skillId: string, documentUri: string) => {
    setCurrentUser(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        skillsOffered: (prev.skillsOffered || []).map(s =>
          String(s.id || (s as any)._id) === String(skillId) ? { ...s, certificateUri: documentUri, certificateStatus: 'pending' } : s
        ),
      };
    });

    if (skillId && !skillId.startsWith('onboard-')) {
      try {
        await fetch(`${url}/skills/${skillId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            certificateUri: documentUri,
            certificateStatus: 'pending',
          }),
        });
      } catch (err) {
        console.warn('[CurrentUserProvider] attachSkillCertificate backend sync error:', err);
      }
    }
  }, []);

  const removeSkillCertificate = useCallback(async (skillId: string) => {
    setCurrentUser(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        skillsOffered: (prev.skillsOffered || []).map(s =>
          String(s.id || (s as any)._id) === String(skillId) ? { ...s, certificateUri: undefined, certificateStatus: undefined } : s
        ),
      };
    });

    if (skillId && !skillId.startsWith('onboard-')) {
      try {
        await fetch(`${url}/skills/${skillId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            certificateUri: '',
            certificateStatus: undefined,
          }),
        });
      } catch (err) {
        console.warn('[CurrentUserProvider] removeSkillCertificate backend sync error:', err);
      }
    }
  }, []);

  const allUsersMerged = useMemo(() => {
    if (!currentUser) return users;
    const currentId = String(currentUser.id || (currentUser as any)._id || '');
    const existingIndex = users.findIndex((u) => String(u.id || (u as any)._id || '') === currentId);
    if (existingIndex >= 0) {
      const copy = [...users];
      copy[existingIndex] = { ...copy[existingIndex], ...currentUser };
      return copy;
    }
    return [currentUser, ...users];
  }, [users, currentUser]);

  const value = useMemo<CurrentUserContextValue>(() => {
    return {
      loadUser,
      currentUser,
      allUsers: allUsersMerged,
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
      attachSkillCertificate,
      removeSkillCertificate,
      isLoading,
    };
  }, [recommendations, loadUser, allUsersMerged, currentUser, topRecommendations, teachMatches, learnMatches, swapMatches, userRole, applyOnboardingData, refreshRecommendations, earnCredits, spendCredits, removeSkill, attachSkillCertificate, removeSkillCertificate, isLoading]);

  return value;
});

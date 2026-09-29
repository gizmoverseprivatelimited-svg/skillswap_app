import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import url from '@/constants/backurl';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
// @ts-ignore: React Native Firebase exports a default in Metro, but TS sometimes misses it depending on tsconfig
import firebaseAuth from '@react-native-firebase/auth';

import { useSocket } from '@/providers/socket';

const TOKEN_KEY = '@skillswap/auth_token';
const USER_KEY = '@skillswap/auth_user';

export type PremiumTier = 'free' | 'basic' | 'premium' | 'elite';

interface AuthUser {
  id: string;
  _id?: string;
  email: string;
  name: string;
  username?: string;
  avatar?: string;
  bio?: string;
  location?: string;
  skillsToLearn: string[];
  skillsToTeach: string[];
  credits: number;
  premiumTier: PremiumTier;
  premiumExpiresAt?: number;
  hasCompletedOnboarding?: boolean;
  isDemo?: boolean;
  banStatus?: 'active' | 'banned' | 'suspended';
  banReason?: string;
  bannedAt?: string;
  suspendedUntil?: string;
  daysSuspended?: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, username: string) => Promise<void>;
  signInWithOtp: (identifier: string, code: string) => Promise<void>;
  signInWithOAuth: (provider: 'google' | 'apple', data: {
    providerId: string;
    email: string;
    name?: string;
    avatar?: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  skipLogin: () => Promise<void>;
  updateUser: (newUser: AuthUser) => Promise<void>;
}

const sendDebugLog = (msg: string, data: any) => {
  fetch(`${url}/debug-log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: msg, data }),
  }).catch(() => { });
};

export const [AuthProvider, useAuth] = createContextHook<AuthContextValue>(() => {
  const { socket } = useSocket();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  let URL = `${url}/api/auth`

  // Configure Google Sign-In once at provider level so it's ready before the login screen mounts
  useEffect(() => {
    if (Platform.OS !== 'web') {
      try {
        GoogleSignin.configure({
          webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_ID,
          iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_ID,
          offlineAccess: false,
        });
        console.log('[Auth] GoogleSignin configured successfully');
      } catch (e) {
        console.warn('[Auth] GoogleSignin configure error:', e);
      }
    }
  }, []);

  const normalizeUser = (u: any): AuthUser | null => {
    if (!u) return null;
    return {
      ...u,
      id: u.id || u._id || '',
    };
  };

  const saveToken = useCallback(async (newToken: string, newUser?: AuthUser) => {
    sendDebugLog('[Auth] saveToken', { newToken, newUser });
    await AsyncStorage.setItem(TOKEN_KEY, newToken);
    let normalizedUser: AuthUser | null = null;
    if (newUser) {
      normalizedUser = normalizeUser(newUser);
      try {
        const guestDataStr = await AsyncStorage.getItem('@skillswap/onboarding_complete_guest_data')
          || await AsyncStorage.getItem('@skillswap/onboarding_complete_1_data')
          || await AsyncStorage.getItem('@skillswap/onboarding_pending_data');
        if (guestDataStr && normalizedUser?.id) {
          const guestData = JSON.parse(guestDataStr);
          if (guestData && (guestData.skillsToTeach?.length > 0 || guestData.skillsToLearn?.length > 0 || guestData.teacherProfile)) {
            fetch(`${url}/users/onboarding`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: normalizedUser.id,
                skillsToTeach: guestData.skillsToTeach || [],
                skillsToLearn: guestData.skillsToLearn || [],
                experienceLevels: guestData.experienceLevels || {},
                learningGoals: guestData.learningGoals || [],
                availability: guestData.availability || [],
                communicationPreference: guestData.communicationPreference || '',
                matchingPreferences: guestData.matchingPreferences || { location: '', virtual: true, inPerson: false },
                teacherProfile: guestData.teacherProfile,
              }),
            }).catch((err) => console.warn('[Auth] Pending onboarding sync error:', err));
            if (guestData.teacherProfile && !(normalizedUser as any).teacherProfile) {
              (normalizedUser as any).teacherProfile = guestData.teacherProfile;
            }
          }
        }
      } catch (err) {
        console.warn('[Auth] Guest onboarding check error:', err);
      }
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
    }
    setToken(newToken);
    if (normalizedUser) {
      setUser(normalizedUser);
    }
  }, []);

  const clearToken = useCallback(async () => {
    sendDebugLog('[Auth] clearToken', {});
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
    await AsyncStorage.removeItem('@skillswap/guest_user_profile');
    await AsyncStorage.removeItem('@skillswap/guest_skills_offered');
    setToken(null);
    setUser(null);
  }, []);

  const refreshAuth = useCallback(async () => {
    sendDebugLog('[Auth] refreshAuth start', {});
    try {
      const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
      const storedUser = await AsyncStorage.getItem(USER_KEY);
      sendDebugLog('[Auth] refreshAuth results', { storedToken, storedUser });
      if (storedToken) {
        setToken(storedToken);
      }
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('[Auth] Failed to refresh auth:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${URL}/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.message || 'Signin failed');
    console.log(result);

    await saveToken(result.token, result.user);
  }, [saveToken]);


  const signUp = useCallback(async (email: string, password: string, name: string, username: string) => {
    const res = await fetch(`${URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, username }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || 'Signup failed');
    }

    const result = await res.json();
    console.log(result);

    await saveToken(result.token, result.user);
  }, [saveToken]);


  const signInWithOtp = useCallback(
    async (identifier: string, code: string) => {
      console.log('[Auth] Signing in with OTP');

      const res = await fetch(`${URL}/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifier, code }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'OTP sign in failed');
      }

      const result = await res.json();
      console.log(result);


      await saveToken(result.token, result.user);

      console.log('[Auth] OTP sign in successful');
    },
    [saveToken]
  );


  const signInWithOAuth = useCallback(async (provider: any, data: any) => {
    const res = await fetch(`${URL}/oauth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, ...data }),
    });

    const result = await res.json();
    if (!res.ok) {
      console.error('[Auth] OAuth backend error:', result);
      throw new Error(result.message || 'OAuth failed');
    }

    await saveToken(result.token, result.user);
  }, [saveToken]);


  const signOut = useCallback(async () => {
    console.log('[Auth] Signing out');

    // Sign out from Firebase Auth
    try {
      const currentFirebaseUser = firebaseAuth().currentUser;
      if (currentFirebaseUser) {
        await firebaseAuth().signOut();
        console.log('[Auth] Firebase Auth signed out');
      }
    } catch (e) {
      console.warn('[Auth] Firebase sign-out error (non-fatal):', e);
    }

    // Sign out from Google Sign-In (clears cached account so the picker shows next time)
    if (Platform.OS !== 'web') {
      try {
        await GoogleSignin.signOut();
        console.log('[Auth] Google Sign-In signed out');
      } catch (e) {
        console.warn('[Auth] Google sign-out error (non-fatal):', e);
      }
    }

    await clearToken();
  }, [clearToken]);

  const skipLogin = useCallback(async () => {
    console.log('[Auth] Skipping login');
    const guestUser: AuthUser = {
      id: '1',
      email: 'guest@skillswap.com',
      name: 'Demo User',
      username: 'user_demo',
      skillsToLearn: [],
      skillsToTeach: [],
      credits: 0,
      premiumTier: 'free',
      isDemo: true,
    };
    await saveToken('guest_token', guestUser);
    await AsyncStorage.setItem('@skillswap/onboarding_complete_1', 'true');
    setUser(guestUser);
  }, [saveToken]);

  const updateUser = useCallback(async (newUser: AuthUser) => {
    console.log('[Auth] Updating user data');
    const normalized = normalizeUser(newUser);
    if (normalized) {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(normalized));
      setUser(normalized);
    }
  }, []);

  // Real-time socket listener for user account status updates
  useEffect(() => {
    if (!socket || !user?.id) return;
    const myId = String(user.id || (user as any)._id);

    // Join personal socket room immediately
    socket.emit('join_room', myId);
    console.log('[Socket.IO Auth] Joined room:', myId);

    const handleUserBanned = (data: any) => {
      const targetUserId = String(data?.userId || (data?.user && (data.user._id || data.user.id)) || '');
      if (targetUserId === myId) {
        console.log('[Socket.IO Auth] Current user banned in real-time:', data);
        setUser(prev => {
          if (!prev) return prev;
          const next = {
            ...prev,
            banStatus: 'banned' as const,
            banReason: data.reason || data.banReason,
            bannedAt: data.bannedAt || new Date().toISOString(),
            suspendedUntil: undefined,
            daysSuspended: undefined,
          };
          AsyncStorage.setItem(USER_KEY, JSON.stringify(next)).catch(() => {});
          return next;
        });
      }
    };

    const handleUserSuspended = (data: any) => {
      const targetUserId = String(data?.userId || (data?.user && (data.user._id || data.user.id)) || '');
      if (targetUserId === myId) {
        console.log('[Socket.IO Auth] Current user suspended in real-time:', data);
        setUser(prev => {
          if (!prev) return prev;
          const next = {
            ...prev,
            banStatus: 'suspended' as const,
            banReason: data.reason || data.banReason,
            bannedAt: data.bannedAt || new Date().toISOString(),
            suspendedUntil: data.suspendedUntil ? new Date(data.suspendedUntil).toISOString() : undefined,
            daysSuspended: data.daysSuspended,
          };
          AsyncStorage.setItem(USER_KEY, JSON.stringify(next)).catch(() => {});
          return next;
        });
      }
    };

    const handleUserUnbanned = (data: any) => {
      const targetUserId = String(data?.userId || (data?.user && (data.user._id || data.user.id)) || '');
      if (targetUserId === myId) {
        console.log('[Socket.IO Auth] Current user unbanned in real-time:', data);
        setUser(prev => {
          if (!prev) return prev;
          const next = {
            ...prev,
            banStatus: 'active' as const,
            banReason: undefined,
            bannedAt: undefined,
            suspendedUntil: undefined,
            daysSuspended: undefined,
          };
          AsyncStorage.setItem(USER_KEY, JSON.stringify(next)).catch(() => {});
          return next;
        });
      }
    };

    const handleUserUpdated = (updated: any) => {
      const targetId = String(updated?._id || updated?.id || '');
      if (targetId === myId) {
        console.log('[Socket.IO Auth] Current user profile updated in real-time:', updated);
        setUser(prev => {
          if (!prev) return prev;
          const next = {
            ...prev,
            ...updated,
            id: myId,
            banStatus: updated.banStatus || prev.banStatus,
            banReason: updated.banReason !== undefined ? updated.banReason : prev.banReason,
            suspendedUntil: updated.suspendedUntil || prev.suspendedUntil,
            daysSuspended: updated.daysSuspended || prev.daysSuspended,
          };
          AsyncStorage.setItem(USER_KEY, JSON.stringify(next)).catch(() => {});
          return next;
        });
      }
    };

    socket.on('user_banned', handleUserBanned);
    socket.on('user_suspended', handleUserSuspended);
    socket.on('user_unbanned', handleUserUnbanned);
    socket.on('user_updated', handleUserUpdated);

    return () => {
      socket.off('user_banned', handleUserBanned);
      socket.off('user_suspended', handleUserSuspended);
      socket.off('user_unbanned', handleUserUnbanned);
      socket.off('user_updated', handleUserUpdated);
    };
  }, [socket, user?.id]);

  const isAuthenticated = useMemo(() => {
    return !!token && !!user;
  }, [token, user]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    token,
    isLoading,
    isAuthenticated,
    signIn,
    signUp,
    signInWithOtp,
    signInWithOAuth,
    signOut,
    refreshAuth,
    skipLogin,
    updateUser,
  }), [user, token, isLoading, isAuthenticated, signIn, signUp, signInWithOtp, signInWithOAuth, signOut, refreshAuth, skipLogin, updateUser]);

  return value;
});

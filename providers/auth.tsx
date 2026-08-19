import { useCallback, useEffect, useMemo, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import url from '@/constants/backurl';

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
  }).catch(() => {});
};

export const [AuthProvider, useAuth] = createContextHook<AuthContextValue>(() => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  let URL = `${url}/api/auth`

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

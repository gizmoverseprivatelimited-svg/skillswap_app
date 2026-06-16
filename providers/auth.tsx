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
  avatar?: string;
  bio?: string;
  location?: string;
  skillsToLearn: string[];
  skillsToTeach: string[];
  credits: number;
  premiumTier: PremiumTier;
  premiumExpiresAt?: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signInWithOtp: (identifier: string, code: string) => Promise<void>;
  signInWithOAuth: (provider: 'google' | 'apple', data: {
    providerId: string;
    email: string;
    name?: string;
    avatar?: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

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
    console.log('[Auth] Saving token');
    await AsyncStorage.setItem(TOKEN_KEY, newToken);
    if (newUser) {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(normalizeUser(newUser)));
    }
    setToken(newToken);
  }, []);

  const clearToken = useCallback(async () => {
    console.log('[Auth] Clearing token');
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const refreshAuth = useCallback(async () => {
    console.log('[Auth] Refreshing auth state');
    try {
      const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
      const storedUser = await AsyncStorage.getItem(USER_KEY);
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

    if (!res.ok) throw new Error('Signin failed');

    const result = await res.json();
    console.log(result);

    await saveToken(result.token, result.user);
    setUser(normalizeUser(result.user));
  }, [saveToken]);


  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const res = await fetch(`${URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });

    if (!res.ok) throw new Error('Signup failed');

    const result = await res.json();
    console.log(result);

    await saveToken(result.token, result.user);
    setUser(normalizeUser(result.user));
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
      setUser(normalizeUser(result.user));

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

    if (!res.ok) throw new Error('OAuth failed');

    const result = await res.json();
    await saveToken(result.token, result.user);
    setUser(normalizeUser(result.user));
  }, [saveToken]);


  const signOut = useCallback(async () => {
    console.log('[Auth] Signing out');
    await clearToken();
  }, [clearToken]);

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
  }), [user, token, isLoading, isAuthenticated, signIn, signUp, signInWithOtp, signInWithOAuth, signOut, refreshAuth]);

  return value;
});

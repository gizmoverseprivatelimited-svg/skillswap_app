import { useCallback, useEffect, useMemo, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trpc } from '../lib/trpc';

const TOKEN_KEY = '@skillswap/auth_token';

export type PremiumTier = 'free' | 'basic' | 'premium' | 'elite';

interface AuthUser {
  id: string;
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

  const saveToken = useCallback(async (newToken: string) => {
    console.log('[Auth] Saving token');
    await AsyncStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
  }, []);

  const clearToken = useCallback(async () => {
    console.log('[Auth] Clearing token');
    await AsyncStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const refreshAuth = useCallback(async () => {
    console.log('[Auth] Refreshing auth state');
    try {
      const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
      if (storedToken) {
        setToken(storedToken);
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

  const signInMutation = trpc.auth.signIn.useMutation();
  const signUpMutation = trpc.auth.signUp.useMutation();
  const verifyOtpMutation = trpc.auth.verifyOtp.useMutation();
  const oauthSignInMutation = trpc.auth.oauthSignIn.useMutation();

  const signIn = useCallback(async (email: string, password: string) => {
    console.log('[Auth] Signing in with email/password');
    try {
      const result = await signInMutation.mutateAsync({ email, password });
      await saveToken(result.token);
      setUser({
        ...result.user,
        credits: (result.user as any).credits ?? 0,
        premiumTier: (result.user as any).premiumTier ?? 'free',
      });
      console.log('[Auth] Sign in successful');
    } catch (error) {
      console.error('[Auth] Sign in failed:', error);
      throw error;
    }
  }, [signInMutation, saveToken]);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    console.log('[Auth] Signing up with email/password');
    try {
      const result = await signUpMutation.mutateAsync({ email, password, name });
      await saveToken(result.token);
      setUser({
        ...result.user,
        credits: (result.user as any).credits ?? 0,
        premiumTier: (result.user as any).premiumTier ?? 'free',
      });
      console.log('[Auth] Sign up successful');
    } catch (error) {
      console.error('[Auth] Sign up failed:', error);
      throw error;
    }
  }, [signUpMutation, saveToken]);

  const signInWithOtp = useCallback(async (identifier: string, code: string) => {
    console.log('[Auth] Signing in with OTP');
    try {
      const result = await verifyOtpMutation.mutateAsync({ identifier, code });
      await saveToken(result.token);
      setUser({
        ...result.user,
        credits: (result.user as any).credits ?? 0,
        premiumTier: (result.user as any).premiumTier ?? 'free',
      });
      console.log('[Auth] OTP sign in successful');
    } catch (error) {
      console.error('[Auth] OTP sign in failed:', error);
      throw error;
    }
  }, [verifyOtpMutation, saveToken]);

  const signInWithOAuth = useCallback(async (
    provider: 'google' | 'apple',
    data: {
      providerId: string;
      email: string;
      name?: string;
      avatar?: string;
    }
  ) => {
    console.log('[Auth] Signing in with OAuth:', provider);
    try {
      const result = await oauthSignInMutation.mutateAsync({
        provider,
        ...data,
      });
      await saveToken(result.token);
      setUser({
        ...result.user,
        credits: (result.user as any).credits ?? 0,
        premiumTier: (result.user as any).premiumTier ?? 'free',
      });
      console.log('[Auth] OAuth sign in successful');
    } catch (error) {
      console.error('[Auth] OAuth sign in failed:', error);
      throw error;
    }
  }, [oauthSignInMutation, saveToken]);

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

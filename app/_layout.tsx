import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments, useRootNavigationState, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useMemo } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet, ActivityIndicator, View, Platform } from "react-native";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "../providers/auth";
import { CurrentUserProvider, useCurrentUser } from "../providers/current-user";
import { SkillSwapsProvider } from "../providers/skill-swaps";
import { SafetyProvider } from "../providers/safety";
import { ClassesProvider } from "../providers/classes";
import { NotificationsProvider } from "../providers/notifications";
import { ResourcesProvider } from "../providers/resources";
import { OnboardingProvider, useOnboarding } from "../providers/onboarding";
import { InAppNotificationBanner } from "../components/InAppNotificationBanner";
import { AdminProvider } from "@/providers/admin";
import url from '@/constants/backurl';

if (Platform.OS !== 'web') {
  try {
    SplashScreen.preventAutoHideAsync().catch(() => {});
  } catch (e) {}
}

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { user: authUser, isAuthenticated, isLoading: authLoading } = useAuth();
  const { currentUser } = useCurrentUser();
  const { hasCompletedOnboarding, isChecking } = useOnboarding();
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const pathname = usePathname();

  const user = currentUser || authUser;
  const isRestricted = useMemo(() => {
    if (!user) return false;
    if (user.banStatus === 'banned') return true;
    if (user.banStatus === 'suspended') {
      if (user.suspendedUntil) {
        const hasExpired = new Date(user.suspendedUntil).getTime() <= Date.now();
        return !hasExpired;
      }
      return true;
    }
    return false;
  }, [user]);

  useEffect(() => {
    if (authLoading || isChecking) return;

    let segment0: any = segments[0] || '';
    const currentPath = pathname || (typeof window !== 'undefined' ? window.location.pathname : '') || '';
    const isAdminRoute = segment0 === 'admin' || (typeof segment0 === 'string' && segment0.startsWith('admin/')) || currentPath.startsWith('/admin') || currentPath.startsWith('admin');

    if (isAdminRoute) return;

    const isBannedRoute = segment0 === 'banned' || currentPath === '/banned' || currentPath.startsWith('/banned');
    const isLogin = segment0 === 'login' || currentPath === '/login' || currentPath.startsWith('/login');
    const isOnboarding = segment0 === 'onboarding' || currentPath === '/onboarding' || currentPath.startsWith('/onboarding');
    const publicRoutes = ['login', 'terms', 'privacy', 'about', 'contact', 'help', 'admin', 'banned'];
    const isPublic = publicRoutes.includes(segment0) || isLogin || currentPath.startsWith('/admin');

    if (!isAuthenticated) {
      if (!isPublic) {
        router.replace('/login' as any);
      }
    } else if (isRestricted) {
      // User is banned or suspended: they can only access /banned, /login, and support/policy routes
      const allowedForRestricted = ['banned', 'login', 'help', 'contact', 'terms', 'privacy'];
      if (!allowedForRestricted.includes(segment0) && !isBannedRoute) {
        router.replace('/banned' as any);
      }
    } else if (!hasCompletedOnboarding) {
      if (!isOnboarding) {
        router.replace('/onboarding' as any);
      }
    } else if (isLogin || isOnboarding || isBannedRoute) {
      router.replace('/(tabs)/home' as any);
    }
  }, [isAuthenticated, isRestricted, authLoading, isChecking, hasCompletedOnboarding, segments, rootNavigationState?.key, pathname, router]);

  if (authLoading && !isAuthenticated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="banned" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="skill/[id]"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="class/[id]"
        options={{
          headerShown: true,
          title: 'Class Details',
        }}
      />
      <Stack.Screen
        name="class/create"
        options={{
          headerShown: true,
          title: 'Create Class',
        }}
      />
      <Stack.Screen
        name="class/my"
        options={{
          headerShown: true,
          title: 'My Classes',
        }}
      />
      <Stack.Screen
        name="class/call/[classId]"
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
        }}
      />
      <Stack.Screen
        name="admin/reports"
        options={{
          headerShown: true,
          title: 'User Reports',
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#F8FAFC',
        }}
      />
      <Stack.Screen
        name="admin/classes"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="profile/[id]"
        options={{
          headerShown: false,
          title: 'Profile',
        }}
      />
      <Stack.Screen
        name="swaps/index"
        options={{
          headerShown: true,
          title: 'Skill Exchanges',
        }}
      />
      <Stack.Screen
        name="swaps/[id]"
        options={{
          headerShown: false,
          title: 'Exchange Detail',
        }}
      />
      <Stack.Screen
        name="call/[swapId]"
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
        }}
      />
      <Stack.Screen
        name="edit-profile"
        options={{
          headerShown: true,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="certificate/[id]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="feature-audit"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="store"
        options={{
          headerShown: true,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="add-skill"
        options={{
          headerShown: true,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="verification"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="admin/login"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="admin/index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="admin/users"
        options={{
          headerShown: false,
          title: 'User Management',
        }}
      />
      <Stack.Screen
        name="admin/reviews"
        options={{
          headerShown: false,
          title: 'Review Moderation',
        }}
      />
      <Stack.Screen
        name="admin/swaps"
        options={{
          headerShown: false,
          title: 'Exchange Oversight',
        }}
      />
      <Stack.Screen
        name="admin/verifications"
        options={{
          headerShown: false,
          title: 'Verifications',
        }}
      />
      <Stack.Screen
        name="earnings/index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="earnings/history"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="payout"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="admin/payouts"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="blocked-users"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="assistant"
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="help"
        options={{
          headerShown: true,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="terms"
        options={{
          headerShown: true,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="privacy"
        options={{
          headerShown: true,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="contact"
        options={{
          headerShown: true,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="about"
        options={{
          headerShown: true,
          presentation: 'card',
        }}
      />
    </Stack>
  );
}

import { EarningsProvider } from "../providers/earnings";
import { AlertProvider } from "../providers/alert";
import { SocketProvider } from "../providers/socket";

export default function RootLayout() {
  useEffect(() => {
    try {
      SplashScreen.hideAsync().catch(() => {});
    } catch (e) {}
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AlertProvider>
        <SocketProvider>
          <AuthProvider>
            <OnboardingProvider>
              <SafetyProvider>
                <CurrentUserProvider>
                  <EarningsProvider>
                    <SkillSwapsProvider>
                      <AdminProvider>
                        <NotificationsProvider>
                          <ClassesProvider>
                            <ResourcesProvider>
                              <ErrorBoundary>
                                <GestureHandlerRootView style={styles.container}>
                                  <RootLayoutNav />
                                  <InAppNotificationBanner />
                                </GestureHandlerRootView>
                              </ErrorBoundary>
                            </ResourcesProvider>
                          </ClassesProvider>
                        </NotificationsProvider>
                      </AdminProvider>
                    </SkillSwapsProvider>
                  </EarningsProvider>
                </CurrentUserProvider>
              </SafetyProvider>
            </OnboardingProvider>
          </AuthProvider>
        </SocketProvider>
      </AlertProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});

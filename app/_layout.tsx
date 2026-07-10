import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments, useRootNavigationState } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet, ActivityIndicator, View, Platform } from "react-native";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "../providers/auth";
import { CurrentUserProvider } from "../providers/current-user";
import { SkillSwapsProvider } from "../providers/skill-swaps";
import { NotificationsProvider } from "../providers/notifications";
import { ResourcesProvider } from "../providers/resources";
import { OnboardingProvider, useOnboarding } from "../providers/onboarding";
import { InAppNotificationBanner } from "../components/InAppNotificationBanner";
import { AdminProvider } from "@/providers/admin";
import url from '@/constants/backurl';

const sendDebugLog = (msg: string, data: any) => {
  fetch(`${url}/debug-log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: msg, data }),
  }).catch(() => {});
};

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { hasCompletedOnboarding, isChecking } = useOnboarding();
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    if (authLoading || isChecking || !rootNavigationState?.key) return;

    // Resolve the active route segment, taking browser URL into account on web initial load
    let segment0: any = segments[0] || '';
    let isAdminRoute = segment0 === 'admin' || segment0.startsWith('admin/');

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
      let path = window.location.pathname;
      if (window.location.hash && window.location.hash.startsWith('#/')) {
        path = window.location.hash.substring(1);
      }
      const pathParts = path.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        segment0 = pathParts[0];
      }
      if (path.startsWith('/admin') || path.startsWith('/admin/')) {
        isAdminRoute = true;
      }
    }

    // Sync the router state with the browser URL on web if they get out of sync on mount
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
      let currentPath = window.location.pathname;
      if (window.location.hash && window.location.hash.startsWith('#/')) {
        currentPath = window.location.hash.substring(1);
      }
      const isWebAdmin = currentPath.startsWith('/admin') || currentPath.startsWith('/admin/');
      const isRouterAdmin = segments[0] === 'admin' || (typeof segments[0] === 'string' && segments[0].startsWith('admin/'));
      if (isWebAdmin && !isRouterAdmin) {
        console.log('[DEBUG Layout] Syncing router path with web path:', currentPath);
        router.replace(currentPath as any);
        return;
      }
    }

    sendDebugLog('[DEBUG Layout] State check', {
      segment0,
      segments,
      isAuthenticated,
      hasCompletedOnboarding,
      isAdminRoute,
      authLoading,
      isChecking,
    });

    // Bypass all redirect logic for admin routes
    if (isAdminRoute) {
      console.log('[DEBUG Layout] Bypassing redirects because we are on admin route:', segment0);
      return;
    }

    const inAuthGroup = segment0 === 'login';

    if (!isAuthenticated) {
      // Redirect to login if not authenticated and not already on a public route
      const publicRoutes: string[] = ['login', 'terms', 'privacy', 'about', 'contact', 'help', 'admin'];
      const isPublic = publicRoutes.includes(segment0) || segment0.startsWith('admin/');
      if (!isPublic) {
        sendDebugLog('[DEBUG Layout] Redirecting to /login (not public)', { segment0, segments, isAuthenticated });
        router.replace('/login' as any);
      }
    } else if (!hasCompletedOnboarding) {
      // Redirect to onboarding if authenticated but onboarding not completed
      if (segment0 !== 'onboarding') {
        sendDebugLog('[DEBUG Layout] Redirecting to /onboarding', { segment0, segments });
        router.replace('/onboarding' as any);
      }
    } else if (inAuthGroup || segment0 === 'onboarding') {
      sendDebugLog('[DEBUG Layout] Redirecting to /home', { segment0, segments });
      router.replace('/(tabs)/home' as any);
    }
  }, [isAuthenticated, authLoading, isChecking, hasCompletedOnboarding, segments, rootNavigationState]);

  if (authLoading || isChecking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
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
          title: 'Skill Swaps',
        }}
      />
      <Stack.Screen
        name="swaps/[id]"
        options={{
          headerShown: false,
          title: 'Swap Detail',
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
          title: 'Swap Oversight',
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

import { AlertProvider } from "../providers/alert";

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AlertProvider>
        <AuthProvider>
          <OnboardingProvider>
            <CurrentUserProvider>
              <SkillSwapsProvider>
                <AdminProvider>
                  <NotificationsProvider>
                    <ResourcesProvider>
                      <ErrorBoundary>
                        <GestureHandlerRootView style={styles.container}>
                          <RootLayoutNav />
                          <InAppNotificationBanner />
                        </GestureHandlerRootView>
                      </ErrorBoundary>
                    </ResourcesProvider>
                  </NotificationsProvider>
                </AdminProvider>
              </SkillSwapsProvider>
            </CurrentUserProvider>
          </OnboardingProvider>
        </AuthProvider>
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

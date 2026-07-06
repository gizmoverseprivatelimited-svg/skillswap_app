import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet, ActivityIndicator, View } from "react-native";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "../providers/auth";
import { CurrentUserProvider } from "../providers/current-user";
import { SkillSwapsProvider } from "../providers/skill-swaps";
import { NotificationsProvider } from "../providers/notifications";
import { ResourcesProvider } from "../providers/resources";
import { OnboardingProvider, useOnboarding } from "../providers/onboarding";
import { AdminProvider } from "@/providers/admin";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { hasCompletedOnboarding, isChecking } = useOnboarding();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || isChecking) return;

    // Bypass all redirect logic for admin routes
    if (segments[0] === 'admin') return;

    const inAuthGroup = segments[0] === 'login';

    if (!isAuthenticated) {
      // Redirect to login if not authenticated and not already on a public route
      const publicRoutes = ['login', 'terms', 'privacy', 'about', 'contact', 'help', 'admin'];
      const isPublic = publicRoutes.includes(segments[0] || '');
      if (!isPublic) {
        router.replace('/login');
      }
    } else if (!hasCompletedOnboarding) {
      // Redirect to onboarding if authenticated but onboarding not completed
      if (segments[0] !== 'onboarding') {
        router.replace('/onboarding');
      }
    } else if (inAuthGroup || segments[0] === 'onboarding') {
      // Redirect to home if authenticated, completed onboarding, and trying to access login/onboarding
      router.replace('/(tabs)/home');
    }
  }, [isAuthenticated, authLoading, isChecking, hasCompletedOnboarding, segments]);

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
          headerShown: true,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="profile/[id]"
        options={{
          headerShown: true,
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
          headerShown: true,
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
        name="admin/index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="admin/users"
        options={{
          headerShown: true,
          title: 'User Management',
        }}
      />
      <Stack.Screen
        name="admin/reviews"
        options={{
          headerShown: true,
          title: 'Review Moderation',
        }}
      />
      <Stack.Screen
        name="admin/swaps"
        options={{
          headerShown: true,
          title: 'Swap Oversight',
        }}
      />
      <Stack.Screen
        name="admin/verifications"
        options={{
          headerShown: true,
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

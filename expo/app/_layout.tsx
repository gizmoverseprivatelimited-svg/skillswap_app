import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet } from "react-native";
import ErrorBoundary from "@/components/ErrorBoundary";
import { trpc, trpcClient } from "../lib/trpc";
import { AuthProvider } from "../providers/auth";
import { CurrentUserProvider } from "../providers/current-user";
import { SkillSwapsProvider } from "../providers/skill-swaps";
import { NotificationsProvider } from "../providers/notifications";
import { ResourcesProvider } from "../providers/resources";
import { OnboardingProvider } from "../providers/onboarding";
import { AdminProvider } from "../providers/admin";
import { EarningsProvider } from "../providers/earnings";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
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
        name="add-skill"
        options={{
          headerShown: true,
          presentation: 'card',
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
        name="admin/payouts"
        options={{
          headerShown: false,
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

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <AuthProvider>
          <OnboardingProvider>
            <CurrentUserProvider>
              <EarningsProvider>
                <SkillSwapsProvider>
                  <NotificationsProvider>
                    <ResourcesProvider>
                      <AdminProvider>
                        <ErrorBoundary>
                        <GestureHandlerRootView style={styles.container}>
                          <RootLayoutNav />
                        </GestureHandlerRootView>
                        </ErrorBoundary>
                      </AdminProvider>
                    </ResourcesProvider>
                  </NotificationsProvider>
                </SkillSwapsProvider>
              </EarningsProvider>
            </CurrentUserProvider>
          </OnboardingProvider>
        </AuthProvider>
      </trpc.Provider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

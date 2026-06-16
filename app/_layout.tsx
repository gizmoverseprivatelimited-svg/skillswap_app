import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet } from "react-native";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AuthProvider } from "../providers/auth";
import { CurrentUserProvider } from "../providers/current-user";
import { SkillSwapsProvider } from "../providers/skill-swaps";
import { NotificationsProvider } from "../providers/notifications";
import { ResourcesProvider } from "../providers/resources";
import { OnboardingProvider } from "../providers/onboarding";
import { AdminProvider } from "@/providers/admin";

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
        name="verification"
        options={{
          headerShown: false,
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
});

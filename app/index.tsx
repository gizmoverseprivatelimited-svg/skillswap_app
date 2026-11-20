import { Redirect, useSegments, usePathname } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { useOnboarding } from '@/providers/onboarding';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import WebHomePage from '@/components/web/WebHomePage';

export default function Index() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { hasCompletedOnboarding, isChecking } = useOnboarding();
  const pathname = usePathname();

  const isLoading = authLoading || isChecking;

  // -------------------------------------------------------------
  // MOBILE APP BEHAVIOR (Android & iOS)
  // This page is strictly NOT shown on the mobile app. The app flow remains identical.
  // -------------------------------------------------------------
  if (Platform.OS !== 'web') {
    if (isLoading) {
      return (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      );
    }

    if (!isAuthenticated) {
      return <Redirect href="/login" />;
    }

    if (!hasCompletedOnboarding) {
      return <Redirect href="/onboarding" />;
    }

    return <Redirect href="/(tabs)/home" />;
  }

  // -------------------------------------------------------------
  // WEBSITE BEHAVIOR (leteski.com / root '/' on web)
  // Renders the dedicated homepage for web visitors
  // -------------------------------------------------------------
  if (typeof window !== 'undefined' && window.location) {
    let webPath = window.location.pathname;
    if (window.location.hash && window.location.hash.startsWith('#/')) {
      webPath = window.location.hash.substring(1);
    }
    if (webPath !== '/' && webPath !== '/index' && webPath !== '') {
      return null;
    }
  }

  if (pathname !== '/' && pathname !== '/index' && pathname !== '') {
    return null;
  }

  return <WebHomePage />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});

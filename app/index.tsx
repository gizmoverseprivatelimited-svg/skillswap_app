import { Redirect, useSegments, usePathname } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { useOnboarding } from '@/providers/onboarding';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';

export default function Index() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { hasCompletedOnboarding, isChecking } = useOnboarding();
  const segments = useSegments();
  const pathname = usePathname();

  const isLoading = authLoading || isChecking;

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // If we are deep-linked or directly loading a subpath (e.g. /admin), index should not redirect
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    let webPath = window.location.pathname;
    if (window.location.hash && window.location.hash.startsWith('#/')) {
      webPath = window.location.hash.substring(1);
    }
    if (webPath !== '/' && webPath !== '/index') {
      console.log('[DEBUG Index] bypassing redirect on web because of path:', webPath);
      return null;
    }
  }

  if (pathname !== '/' && pathname !== '/index') {
    console.log('[DEBUG Index] bypassing redirect because of pathname:', pathname);
    return null;
  }

  console.log('[DEBUG Index] evaluating index redirects:', { isAuthenticated, hasCompletedOnboarding });

  if (!isAuthenticated) {
    console.log('[DEBUG Index] Redirecting to /login');
    return <Redirect href="/login" />;
  }

  if (!hasCompletedOnboarding) {
    console.log('[DEBUG Index] Redirecting to /onboarding');
    return <Redirect href="/onboarding" />;
  }

  console.log('[DEBUG Index] Redirecting to /home');
  return <Redirect href="/home" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

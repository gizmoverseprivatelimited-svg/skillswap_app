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
  if (pathname !== '/' && pathname !== '/index') {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  if (!hasCompletedOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/home" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

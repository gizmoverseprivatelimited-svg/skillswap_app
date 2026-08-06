import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/colors';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    console.error('[ErrorBoundary] Captured error', error);
    return {
      hasError: true,
      errorMessage: error.message ?? 'Something went wrong',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Component stack', info.componentStack);
    if (Platform.OS === 'web') {
      console.error('[ErrorBoundary] Web error captured', error);
    }
  }

  private readonly handleReset = () => {
    console.log('[ErrorBoundary] Resetting state');
    this.setState({ hasError: false, errorMessage: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container} testID="error-boundary-fallback">
          <View style={styles.card}>
            <Text style={styles.title}>We hit a snag</Text>
            <Text style={styles.message}>
              {this.state.errorMessage ?? 'Please restart the flow or try again later.'}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              onPress={this.handleReset}
              testID="error-boundary-retry"
            >
              <Text style={styles.buttonLabel}>Retry</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    padding: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.light.text,
    textAlign: 'center' as const,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.light.textSecondary,
    textAlign: 'center' as const,
  },
  button: {
    marginTop: 8,
    backgroundColor: Colors.light.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});

export default ErrorBoundary;

import { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Shield,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ChevronLeft,
} from 'lucide-react-native';
import { useAdmin } from '@/providers/admin';

export default function AdminLoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { adminLogin } = useAdmin();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = useCallback(async () => {
    if (!email.trim() || !password) {
      setError('Please enter both email and password');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await adminLogin(email, password);
      router.replace('/admin' as any);
    } catch (err) {
      setError('Invalid admin credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [email, password, adminLogin, router]);

  const handleFillDemo = useCallback(() => {
    setEmail('admin@skillswap.app');
    setPassword('admin123');
    setError(null);
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 12 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            testID="admin-login-back"
          >
            <ChevronLeft size={20} color="#94A3B8" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.hero}>
            <View style={styles.shieldWrap}>
              <Shield size={40} color="#6366F1" fill="#6366F1" />
            </View>
            <Text style={styles.title}>Admin Access</Text>
            <Text style={styles.subtitle}>
              Sign in with administrator credentials to manage the platform
            </Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Admin Email</Text>
              <View style={styles.inputWrap}>
                <Mail size={18} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="admin@skillswap.app"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  testID="admin-email-input"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputWrap}>
                <Lock size={18} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter password"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  testID="admin-password-input"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((s) => !s)}
                  style={styles.eyeBtn}
                  testID="admin-toggle-password"
                >
                  {showPassword ? (
                    <EyeOff size={18} color="#94A3B8" />
                  ) : (
                    <Eye size={18} color="#94A3B8" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.85}
              testID="admin-login-submit"
            >
              <Text style={styles.loginBtnText}>
                {isLoading ? 'Signing In...' : 'Sign In to Admin Panel'}
              </Text>
              <ArrowRight size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleFillDemo}
              style={styles.demoBtn}
              activeOpacity={0.7}
              testID="admin-fill-demo"
            >
              <Text style={styles.demoText}>
                Use demo credentials (admin@skillswap.app / admin123)
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footerNote}>
            <Lock size={12} color="#475569" />
            <Text style={styles.footerText}>
              Authorized personnel only. All actions are logged.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  backText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '500' as const,
  },
  hero: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  shieldWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: '#F8FAFC',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  formCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#CBD5E1',
    marginBottom: 10,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    height: 54,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '500' as const,
  },
  eyeBtn: {
    padding: 6,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '500' as const,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  demoBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 10,
  },
  demoText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500' as const,
    textAlign: 'center',
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 28,
  },
  footerText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500' as const,
  },
});

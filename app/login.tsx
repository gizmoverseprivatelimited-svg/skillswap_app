import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Platform, ActivityIndicator, Image, KeyboardAvoidingView, ScrollView } from 'react-native';
import { useAlert } from '@/providers/alert';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import Colors from '@/constants/colors';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Phone, Apple, Chrome, Sparkles, Lock, User, ArrowLeft } from 'lucide-react-native';
import { useAuth } from '@/providers/auth';
import url from '@/constants/backurl';
import * as Linking from 'expo-linking';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { getAuth, GoogleAuthProvider, signInWithCredential } from '@react-native-firebase/auth';
// Configuration moved to signIn function to ensure env vars are loaded

WebBrowser.maybeCompleteAuthSession();

type AuthMode = 'otp' | 'social' | 'email';
type AuthFlow = 'signin' | 'signup' | 'forgot';

const LOGO_URI = 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/z4ehvg4ye4367cuqwgafx';

export default function LoginScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { showAlert } = useAlert();
  const [mode, setMode] = useState<AuthMode>('email');
  const [flow, setFlow] = useState<AuthFlow>('signin');
  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [step, setStep] = useState<'enter' | 'verify'>('enter');
  const [error, setError] = useState<string | null>(null);

  const [isPending, setIsPending] = useState<boolean>(false);

  const isEmail = useMemo(() => /@/.test(identifier), [identifier]);

// GoogleSignin.configure() is now called once in the AuthProvider (providers/auth.tsx)
// so it's ready even before the login screen mounts.

  const onSendCode = useCallback(async () => {
    console.log('[Login] Sending OTP for', identifier);
    setError(null);

    if (!identifier || identifier.trim().length < 7) {
      setError('Enter a valid phone number (e.g. +91 98765 43210)');
      return;
    }
    try {
      setIsPending(true);
      const res = await fetch(`${url}/api/auth/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifier }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.message || 'Failed to send OTP');
      }

      setStep('verify');
      showAlert('Code sent! 📱', result.message || 'Check your phone for the SMS OTP.');
    } catch (e: any) {
      console.error('[Login] send code error', e);
      setError(e.message || 'Could not send the code. Try again.');
    } finally {
      setIsPending(false);
    }
  }, [identifier]);


  const onVerifyOtp = useCallback(async () => {
    console.log('[Login] Verifying OTP', code);
    setError(null);
    if (!code || code.length !== 6) {
      setError('Enter a valid 6-digit code');
      return;
    }
    try {
      await auth.signInWithOtp(identifier, code);
      router.replace('/');
    } catch (e) {
      console.error('[Login] verify error', e);
      setError('Invalid or expired code');
    }
  }, [code, identifier, auth, router]);

  const onEmailSignIn = useCallback(async () => {
    console.log('[Login] Email sign in');
    setError(null);
    if (!identifier || !password) {
      setError('Enter email and password');
      return;
    }
    try {
      await auth.signIn(identifier, password);
      router.replace('/');
    } catch (e: any) {
      console.error('[Login] sign in error', e);
      setError(e.message || 'Invalid email or password');
    }
  }, [identifier, password, auth, router]);

  const onEmailSignUp = useCallback(async () => {
    console.log('[Login] Email sign up');
    setError(null);
    if (!identifier || !password || !name || !username) {
      setError('Fill in all fields');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    // Username regex validation: letters, numbers, dots, hyphens, underscores
    const usernameRegex = /^[a-z0-9_.-]{3,30}$/;
    if (!usernameRegex.test(username)) {
      setError('Username must be 3-30 characters and contain only lowercase letters, numbers, dots, hyphens, or underscores');
      return;
    }
    try {
      await auth.signUp(identifier, password, name, username);
      router.replace('/');
    } catch (e: any) {
      console.error('[Login] sign up error', e);
      setError(e.message || 'Could not create account');
    }
  }, [identifier, password, name, username, auth, router]);

  const onForgotPassword = useCallback(async () => {
    console.log('[Login] Forgot password');
    setError(null);
    if (!identifier) {
      setError('Enter your email');
      return;
    }
    try {
      setIsPending(true);
      const res = await fetch(`${url}/api/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Request failed');

      if (result.devToken) {
        showAlert('Reset link sent', `Development token: ${result.devToken}\n\nIn production, this would be sent via email.`);
      } else {
        showAlert('Reset link sent', result.message);
      }
      setFlow('signin');
    } catch (e: any) {
      console.error('[Login] forgot password error', e);
      setError(e.message || 'Could not send reset link');
    } finally {
      setIsPending(false);
    }
  }, [identifier]);

  const signInWithApple = useCallback(async () => {
    if (Platform.OS === 'web') {
      showAlert('Apple Sign in', 'Not available on web.');
      return;
    }
    try {
      console.log('[Login] Apple sign-in start');
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      console.log('[Login] Apple success', credential.user);

      const fullName = credential.fullName;
      const name = fullName ? `${fullName.givenName || ''} ${fullName.familyName || ''}`.trim() : undefined;

      await auth.signInWithOAuth('apple', {
        providerId: credential.user,
        email: credential.email || `${credential.user}@apple.privaterelay.appleid.com`,
        name,
      });

      router.replace('/');
    } catch (e: any) {
      if (e && typeof e === 'object' && 'code' in e) {
        if (e.code === 'ERR_REQUEST_CANCELED') {
          console.log('[Login] Apple sign-in canceled by user');
          return;
        }
      }
      console.error('[Login] Apple error', e);
      showAlert('Apple Sign in failed', 'Please try again or use another sign-in method.');
    }
  }, [router, auth, showAlert]);



  const signInWithGoogle = useCallback(async () => {
    if (isPending) return;
    try {
      setIsPending(true);
      console.log('[Login] Google sign-in start');

      if (Platform.OS === 'web') {
        const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_ID;
        if (!clientId) {
          showAlert('Configuration Error', 'Google Web Client ID is missing in environment variables');
          return;
        }

        // Use Google Identity Services script client dynamically on web
        const loadGis = () =>
          new Promise<void>((resolve, reject) => {
            if ((window as any).google?.accounts?.oauth2) {
              resolve();
              return;
            }
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.onload = () => resolve();
            script.onerror = (e) => reject(e);
            document.body.appendChild(script);
          });

        await loadGis();

        const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'openid profile email',
          state: 'leteski_auth_state', // Add state parameter here
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              console.error('[Login] GIS token error', tokenResponse);
              if (tokenResponse.error !== 'popup_closed_by_user') {
                showAlert('Google Sign in failed', tokenResponse.error_description || tokenResponse.error);
              }
              return;
            }

            const token = tokenResponse.access_token;
            if (token) {
              const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${token}` },
              });
              const userInfo = await userInfoResponse.json();

              await auth.signInWithOAuth('google', {
                providerId: userInfo.id,
                email: userInfo.email,
                name: userInfo.name,
                avatar: userInfo.picture,
              });

              router.replace('/');
            }
          },
        });

        tokenClient.requestAccessToken();
        return;
      } else {
        // Mobile platform: use native GoogleSignin exclusively
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

        // Force sign out first to clear any stale cached auth state
        try {
          await GoogleSignin.signOut();
        } catch (e) {
          // Ignore
        }

        const response = await GoogleSignin.signIn();
        const idToken = response.data?.idToken;
        const user = response.data?.user;

        if (!idToken || !user) {
          throw new Error('Could not retrieve user details from Google Sign-In');
        }

        // 1. Sign in to Firebase Auth using the Google idToken
        const authInstance = getAuth();
        const googleCredential = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(authInstance, googleCredential);

        // 2. Continue to authenticate with your custom backend
        await auth.signInWithOAuth('google', {
          providerId: user.id,
          email: user.email,
          name: user.name || undefined,
          avatar: user.photo || undefined,
        });

        router.replace('/');
      }
    } catch (error: any) {
      console.error('[Login] Google sign-in error', JSON.stringify(error, null, 2));

      if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('[Login] Google sign-in cancelled by user');
        return;
      }

      if (error?.code === statusCodes.IN_PROGRESS) {
        console.log('[Login] Google sign-in already in progress');
        return;
      }

      if (error?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        showAlert('Google Play Services', 'Google Play Services is not available or needs to be updated on your device.');
        return;
      }

      // DEVELOPER_ERROR (error code 10) — SHA-1 mismatch or wrong webClientId
      const errorMessage = error?.message || '';
      if (
        error?.code === '10' ||
        error?.code === 10 ||
        errorMessage.includes('DEVELOPER_ERROR') ||
        errorMessage.includes('10') ||
        errorMessage.includes('not recoverable')
      ) {
        console.error('[Login] DEVELOPER_ERROR — SHA-1 fingerprint or webClientId mismatch');
        showAlert(
          'Google Sign-In Configuration Error',
          'There is a configuration issue with Google Sign-In. Please contact support if this persists.'
        );
        return;
      }

      showAlert('Google Sign In failed', error?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsPending(false);
    }
  }, [router, auth, showAlert, isPending]);


  const isLoading = isPending;

  return (
    <SafeAreaView style={styles.root} testID="login-screen">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <LinearGradient
            colors={[Colors.light.primary, Colors.light.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.logoContainer}>
              <View style={styles.logoWrapper}>
                <Image source={{ uri: LOGO_URI }} style={styles.logo} resizeMode="contain" />
              </View>
              <Sparkles size={24} color="#FFFFFF" style={styles.sparkle1} />
              <Sparkles size={16} color="rgba(255,255,255,0.6)" style={styles.sparkle2} />
            </View>
            <Text style={styles.title}>Leteski</Text>
            <Text style={styles.subtitle}>Learn, teach, and grow together</Text>
          </LinearGradient>

          <View style={styles.contentContainer}>
            <View style={styles.card}>
              {flow === 'signin' && (
                <>
                  <Text style={styles.label}>Email</Text>
                  <View style={styles.inputRow}>
                    <View style={styles.inputIcon}>
                      <Mail size={18} color={Colors.light.textSecondary} />
                    </View>
                    <TextInput
                      testID="email-input"
                      placeholder="you@example.com"
                      placeholderTextColor={Colors.light.textTertiary}
                      style={styles.input}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={identifier}
                      onChangeText={setIdentifier}
                    />
                  </View>

                  <Text style={[styles.label, styles.labelSpaced]}>Password</Text>
                  <View style={styles.inputRow}>
                    <View style={styles.inputIcon}>
                      <Lock size={18} color={Colors.light.textSecondary} />
                    </View>
                    <TextInput
                      testID="password-input"
                      placeholder="••••••••"
                      placeholderTextColor={Colors.light.textTertiary}
                      style={styles.input}
                      secureTextEntry
                      value={password}
                      onChangeText={setPassword}
                    />
                  </View>

                  {!!error && <Text style={styles.errorText}>{error}</Text>}

                  <TouchableOpacity
                    testID="sign-in-btn"
                    style={styles.primaryBtn}
                    onPress={onEmailSignIn}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={[Colors.light.primary, Colors.light.primaryLight]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.buttonGradient}
                    >
                      <Text style={styles.primaryBtnText}>Sign In</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.googleBtn, isLoading && { opacity: 0.7 }]} 
                    onPress={signInWithGoogle} 
                    testID="google-sign-in" 
                    activeOpacity={0.85}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Chrome size={22} color="#fff" />
                    )}
                    <Text style={styles.googleText}>
                      {isLoading ? 'Signing in...' : 'Continue with Google'}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.linkRow}>
                    <TouchableOpacity testID="signup-link" onPress={() => setFlow('signup')}>
                      <Text style={styles.linkText}>Create account</Text>
                    </TouchableOpacity>
                    <TouchableOpacity testID="forgot-link" onPress={() => setFlow('forgot')}>
                      <Text style={styles.linkText}>Forgot password?</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {flow === 'signup' && (
                <>
                  <TouchableOpacity style={styles.backBtn} onPress={() => setFlow('signin')} testID="back-to-signin">
                    <ArrowLeft size={20} color={Colors.light.primary} />
                    <Text style={styles.backText}>Back to sign in</Text>
                  </TouchableOpacity>

                  <Text style={styles.label}>Name</Text>
                  <View style={styles.inputRow}>
                    <View style={styles.inputIcon}>
                      <User size={18} color={Colors.light.textSecondary} />
                    </View>
                    <TextInput
                      testID="name-input"
                      placeholder="Your name"
                      placeholderTextColor={Colors.light.textTertiary}
                      style={styles.input}
                      value={name}
                      onChangeText={setName}
                    />
                  </View>

                  <Text style={[styles.label, styles.labelSpaced]}>Username</Text>
                  <View style={styles.inputRow}>
                    <View style={styles.inputIcon}>
                      <Sparkles size={18} color={Colors.light.textSecondary} />
                    </View>
                    <TextInput
                      testID="username-input"
                      placeholder="Choose a unique username"
                      placeholderTextColor={Colors.light.textTertiary}
                      style={styles.input}
                      autoCapitalize="none"
                      value={username}
                      onChangeText={(val) => setUsername(val.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                    />
                  </View>

                  <Text style={[styles.label, styles.labelSpaced]}>Email</Text>
                  <View style={styles.inputRow}>
                    <View style={styles.inputIcon}>
                      <Mail size={18} color={Colors.light.textSecondary} />
                    </View>
                    <TextInput
                      testID="email-input"
                      placeholder="you@example.com"
                      placeholderTextColor={Colors.light.textTertiary}
                      style={styles.input}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={identifier}
                      onChangeText={setIdentifier}
                    />
                  </View>

                  <Text style={[styles.label, styles.labelSpaced]}>Password</Text>
                  <View style={styles.inputRow}>
                    <View style={styles.inputIcon}>
                      <Lock size={18} color={Colors.light.textSecondary} />
                    </View>
                    <TextInput
                      testID="password-input"
                      placeholder="At least 8 characters"
                      placeholderTextColor={Colors.light.textTertiary}
                      style={styles.input}
                      secureTextEntry
                      value={password}
                      onChangeText={setPassword}
                    />
                  </View>

                  {!!error && <Text style={styles.errorText}>{error}</Text>}

                  <TouchableOpacity
                    testID="signup-btn"
                    style={styles.primaryBtn}
                    onPress={onEmailSignUp}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={[Colors.light.primary, Colors.light.primaryLight]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.buttonGradient}
                    >
                      <Text style={styles.primaryBtnText}>Create Account</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}

              {flow === 'forgot' && (
                <>
                  <TouchableOpacity style={styles.backBtn} onPress={() => setFlow('signin')} testID="back-to-signin">
                    <ArrowLeft size={20} color={Colors.light.primary} />
                    <Text style={styles.backText}>Back to sign in</Text>
                  </TouchableOpacity>

                  <Text style={styles.forgotTitle}>Reset Password</Text>
                  <Text style={styles.forgotSubtitle}>Enter your email to receive a reset link</Text>

                  <Text style={styles.label}>Email</Text>
                  <View style={styles.inputRow}>
                    <View style={styles.inputIcon}>
                      <Mail size={18} color={Colors.light.textSecondary} />
                    </View>
                    <TextInput
                      testID="email-input"
                      placeholder="you@example.com"
                      placeholderTextColor={Colors.light.textTertiary}
                      style={styles.input}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={identifier}
                      onChangeText={setIdentifier}
                    />
                  </View>

                  {!!error && <Text style={styles.errorText}>{error}</Text>}

                  <TouchableOpacity
                    testID="reset-btn"
                    style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]}
                    onPress={onForgotPassword}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={[Colors.light.primary, Colors.light.primaryLight]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.buttonGradient}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.primaryBtnText}>Send Reset Link</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}
            </View>

            <Text style={styles.disclaimer}>
              By continuing you agree to our Terms and Privacy Policy
            </Text>

            <TouchableOpacity testID="skip" onPress={async () => {
              await auth.skipLogin();
              router.replace('/home');
            }} style={styles.skipButton}>
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerGradient: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 20,
  },
  logoContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  logoWrapper: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 18,
  },
  sparkle1: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  sparkle2: {
    position: 'absolute',
    bottom: 0,
    left: -12,
  },
  title: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500' as const,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  switcher: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: Colors.light.backgroundTertiary,
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
  },
  switchBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  switchBtnActive: {
    backgroundColor: Colors.light.background,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  switchText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
  },
  switchTextActive: {
    color: Colors.light.primary,
  },
  card: {
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    padding: 20,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  backText: {
    color: Colors.light.primary,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  forgotTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  forgotSubtitle: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 12,
  },
  labelSpaced: {
    marginTop: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.light.border,
    borderRadius: 16,
    backgroundColor: Colors.light.backgroundTertiary,
  },
  inputIcon: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
    paddingVertical: 14,
    paddingRight: 16,
  },
  errorText: {
    color: Colors.light.error,
    marginTop: 10,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  primaryBtn: {
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700' as const,
    fontSize: 16,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  linkBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    color: Colors.light.primary,
    fontWeight: '700' as const,
    fontSize: 15,
  },
  codeInput: {
    borderWidth: 2,
    borderColor: Colors.light.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center' as const,
    color: Colors.light.text,
    backgroundColor: Colors.light.backgroundTertiary,
    fontWeight: '700' as const,
  },
  appleBtn: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    marginBottom: 12,
  },
  appleFallback: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: Colors.light.border,
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 12,
    backgroundColor: Colors.light.background,
  },
  appleFallbackText: {
    color: Colors.light.text,
    fontWeight: '700' as const,
    fontSize: 16,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 12,
    backgroundColor: '#4285F4',
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: '#4285F4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  googleText: {
    color: '#fff',
    fontWeight: '700' as const,
    fontSize: 16,
  },
  disclaimer: {
    marginTop: 20,
    color: Colors.light.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  skipButton: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipText: {
    color: Colors.light.textSecondary,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  otpHint: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 6,
    marginBottom: 8,
    lineHeight: 18,
  },
});

import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Mail, Lock, ArrowLeft, KeyRound, Eye, EyeOff, CheckCircle2 } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAlert } from '@/providers/alert';
import url from '@/constants/backurl';

type ResetStep = 'email' | 'verify' | 'new_password';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();

  const [step, setStep] = useState<ResetStep>('email');
  const [email, setEmail] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  const [resetToken, setResetToken] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  const [isPending, setIsPending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const onSendOtp = useCallback(async () => {
    setError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    try {
      setIsPending(true);
      const res = await fetch(`${url}/api/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMsg = result.message || 'Failed to send verification code';
        setError(errorMsg);
        showAlert('Notice', errorMsg);
        return;
      }

      if (result.devOtp) {
        console.log('[ResetPassword DEV] OTP:', result.devOtp);
      }

      showAlert('Code Sent! ✉️', result.message || 'Check your email for the 6-digit verification code.');
      setStep('verify');
      setResendCooldown(60);
    } catch (e: any) {
      console.warn('[ResetPassword] send otp network error', e?.message || e);
      const errorMsg = e?.message || 'Could not connect to server. Please try again.';
      setError(errorMsg);
      showAlert('Notice', errorMsg);
    } finally {
      setIsPending(false);
    }
  }, [email, showAlert]);

  const onVerifyOtp = useCallback(async () => {
    setError(null);
    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }
    try {
      setIsPending(true);
      const res = await fetch(`${url}/api/auth/verify-reset-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          code: cleanOtp,
        }),
      });
      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMsg = result.message || 'Invalid or expired verification code';
        setError(errorMsg);
        showAlert('Notice', errorMsg);
        return;
      }

      setResetToken(result.resetToken || '');
      setStep('new_password');
      showAlert('Verified! ✅', 'Code verified. You can now set your new password.');
    } catch (e: any) {
      console.warn('[ResetPassword] verify otp network error', e?.message || e);
      const errorMsg = e?.message || 'Verification failed. Please try again.';
      setError(errorMsg);
      showAlert('Notice', errorMsg);
    } finally {
      setIsPending(false);
    }
  }, [email, otp, showAlert]);

  const onResetPassword = useCallback(async () => {
    setError(null);
    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    try {
      setIsPending(true);
      const res = await fetch(`${url}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          resetToken,
          code: otp.trim(),
          newPassword,
        }),
      });
      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMsg = result.message || 'Failed to reset password';
        setError(errorMsg);
        showAlert('Notice', errorMsg);
        return;
      }

      showAlert('Password Reset Success! 🎉', result.message || 'Your password has been changed. You can now sign in.');
      router.replace('/login');
    } catch (e: any) {
      console.warn('[ResetPassword] reset password network error', e?.message || e);
      const errorMsg = e?.message || 'Could not reset password. Please try again.';
      setError(errorMsg);
      showAlert('Notice', errorMsg);
    } finally {
      setIsPending(false);
    }
  }, [email, resetToken, otp, newPassword, confirmPassword, showAlert, router]);

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <LinearGradient
            colors={[Colors.light.primaryDark, Colors.light.primary, Colors.light.primaryLight]}
            style={styles.headerGradient}
          >
            <Text style={styles.headerTitle}>Leteski</Text>
            <Text style={styles.headerSubtitle}>Password Recovery</Text>
          </LinearGradient>

          <View style={styles.contentContainer}>
            <View style={styles.card}>
              {step === 'email' && (
                <>
                  <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => router.replace('/login')}
                  >
                    <ArrowLeft size={20} color={Colors.light.primary} />
                    <Text style={styles.backText}>Back to sign in</Text>
                  </TouchableOpacity>

                  <Text style={styles.title}>Reset Password</Text>
                  <Text style={styles.subtitle}>
                    Enter your registered email address to receive a 6-digit verification code.
                  </Text>

                  <Text style={styles.label}>Email Address</Text>
                  <View style={styles.inputRow}>
                    <View style={styles.inputIcon}>
                      <Mail size={18} color={Colors.light.textSecondary} />
                    </View>
                    <TextInput
                      placeholder="you@example.com"
                      placeholderTextColor={Colors.light.textTertiary}
                      style={styles.input}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={setEmail}
                    />
                  </View>

                  {!!error && <Text style={styles.errorText}>{error}</Text>}

                  <TouchableOpacity
                    style={[styles.primaryBtn, isPending && styles.primaryBtnDisabled]}
                    onPress={onSendOtp}
                    disabled={isPending}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={[Colors.light.primary, Colors.light.primaryLight]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.buttonGradient}
                    >
                      {isPending ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.primaryBtnText}>Send Verification Code</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}

              {step === 'verify' && (
                <>
                  <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => {
                      setStep('email');
                      setError(null);
                    }}
                  >
                    <ArrowLeft size={20} color={Colors.light.primary} />
                    <Text style={styles.backText}>Change email</Text>
                  </TouchableOpacity>

                  <Text style={styles.title}>Verify Code</Text>
                  <Text style={styles.subtitle}>
                    Enter the 6-digit verification code sent to {email}
                  </Text>

                  <Text style={styles.label}>6-Digit Verification Code</Text>
                  <View style={styles.inputRow}>
                    <View style={styles.inputIcon}>
                      <KeyRound size={18} color={Colors.light.textSecondary} />
                    </View>
                    <TextInput
                      placeholder="123456"
                      placeholderTextColor={Colors.light.textTertiary}
                      style={[styles.input, styles.otpInput]}
                      keyboardType="number-pad"
                      maxLength={6}
                      value={otp}
                      onChangeText={setOtp}
                    />
                  </View>

                  <View style={styles.resendRow}>
                    <TouchableOpacity onPress={() => setStep('email')}>
                      <Text style={styles.changeEmailText}>Change email</Text>
                    </TouchableOpacity>

                    {resendCooldown > 0 ? (
                      <Text style={styles.resendCooldownText}>Resend code in {resendCooldown}s</Text>
                    ) : (
                      <TouchableOpacity onPress={onSendOtp} disabled={isPending}>
                        <Text style={styles.resendLinkText}>Resend Code</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {!!error && <Text style={styles.errorText}>{error}</Text>}

                  <TouchableOpacity
                    style={[styles.primaryBtn, (isPending || otp.length < 6) && styles.primaryBtnDisabled]}
                    onPress={onVerifyOtp}
                    disabled={isPending || otp.length < 6}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={[Colors.light.primary, Colors.light.primaryLight]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.buttonGradient}
                    >
                      {isPending ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.primaryBtnText}>Verify Code</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}

              {step === 'new_password' && (
                <>
                  <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => {
                      setStep('verify');
                      setError(null);
                    }}
                  >
                    <ArrowLeft size={20} color={Colors.light.primary} />
                    <Text style={styles.backText}>Back to verification</Text>
                  </TouchableOpacity>

                  <Text style={styles.title}>New Password</Text>
                  <Text style={styles.subtitle}>
                    Choose a strong password of at least 8 characters
                  </Text>

                  <Text style={styles.label}>New Password</Text>
                  <View style={styles.inputRow}>
                    <View style={styles.inputIcon}>
                      <Lock size={18} color={Colors.light.textSecondary} />
                    </View>
                    <TextInput
                      placeholder="At least 8 characters"
                      placeholderTextColor={Colors.light.textTertiary}
                      style={styles.input}
                      secureTextEntry={!showNewPassword}
                      value={newPassword}
                      onChangeText={setNewPassword}
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowNewPassword((prev) => !prev)}
                    >
                      {showNewPassword ? (
                        <EyeOff size={18} color={Colors.light.textSecondary} />
                      ) : (
                        <Eye size={18} color={Colors.light.textSecondary} />
                      )}
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.label, styles.labelSpaced]}>Confirm Password</Text>
                  <View style={styles.inputRow}>
                    <View style={styles.inputIcon}>
                      <Lock size={18} color={Colors.light.textSecondary} />
                    </View>
                    <TextInput
                      placeholder="Re-enter new password"
                      placeholderTextColor={Colors.light.textTertiary}
                      style={styles.input}
                      secureTextEntry={!showConfirmPassword}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowConfirmPassword((prev) => !prev)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={18} color={Colors.light.textSecondary} />
                      ) : (
                        <Eye size={18} color={Colors.light.textSecondary} />
                      )}
                    </TouchableOpacity>
                  </View>

                  {!!error && <Text style={styles.errorText}>{error}</Text>}

                  <TouchableOpacity
                    style={[styles.primaryBtn, (isPending || newPassword.length < 8) && styles.primaryBtnDisabled]}
                    onPress={onResetPassword}
                    disabled={isPending || newPassword.length < 8}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={[Colors.light.primary, Colors.light.primaryLight]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.buttonGradient}
                    >
                      {isPending ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.primaryBtnText}>Reset Password</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}
            </View>
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
    paddingTop: 48,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
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
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    marginBottom: 20,
    lineHeight: 22,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 10,
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
  otpInput: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 6,
    textAlign: 'center',
  },
  eyeBtn: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  resendLinkText: {
    color: Colors.light.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  resendCooldownText: {
    color: Colors.light.textTertiary,
    fontSize: 14,
    fontWeight: '500',
  },
  changeEmailText: {
    color: Colors.light.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  errorText: {
    color: Colors.light.error,
    marginTop: 10,
    fontSize: 14,
    fontWeight: '500',
  },
  primaryBtn: {
    marginTop: 20,
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
    fontWeight: '700',
    fontSize: 16,
  },
});


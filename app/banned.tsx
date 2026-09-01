import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ShieldAlert,
  ShieldX,
  Clock,
  HelpCircle,
  LogOut,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react-native';
import { useAuth } from '@/providers/auth';
import { useCurrentUser } from '@/providers/current-user';

export default function BannedScreen() {
  const router = useRouter();
  const { user: authUser, signOut, refreshAuth } = useAuth();
  const { currentUser, loadUser } = useCurrentUser();

  // Combine auth user and current user to get the latest profile info
  const user = currentUser || authUser;

  const banStatus = user?.banStatus || 'banned'; // 'banned' | 'suspended'
  const isSuspended = banStatus === 'suspended';
  const banReason = user?.banReason || 'Violation of platform safety and community terms.';
  const bannedAt = user?.bannedAt;
  const suspendedUntil = user?.suspendedUntil;
  const daysSuspended = user?.daysSuspended;

  // Countdown timer for suspension
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: false });

  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(false);

  useEffect(() => {
    if (!isSuspended || !suspendedUntil) return;

    const calculateTimeLeft = () => {
      const difference = new Date(suspendedUntil).getTime() - new Date().getTime();
      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds, isExpired: false });
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [isSuspended, suspendedUntil]);

  // If status becomes active (unbanned or expired), automatically take them home
  useEffect(() => {
    if (user && user.banStatus === 'active') {
      router.replace('/(tabs)/home' as any);
    }
  }, [user?.banStatus, router]);

  const handleRefreshStatus = async () => {
    try {
      setIsCheckingStatus(true);
      await Promise.all([
        refreshAuth?.(),
        loadUser?.(true),
      ]);
    } catch (e) {
      console.warn('[BannedScreen] Refresh status error:', e);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/login' as any);
    } catch (e) {
      console.error('[BannedScreen] Sign out error:', e);
    }
  };

  const handleContactSupport = () => {
    router.push('/help' as any);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Hero Banner */}
        <LinearGradient
          colors={isSuspended ? ['#D97706', '#F59E0B', '#B45309'] : ['#991B1B', '#DC2626', '#7F1D1D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerHero}
        >
          <View style={styles.iconCircle}>
            {isSuspended ? (
              <ShieldAlert size={48} color="#D97706" />
            ) : (
              <ShieldX size={48} color="#DC2626" />
            )}
          </View>
          <Text style={styles.heroTitle}>
            {isSuspended ? 'Account Suspended' : 'Account Permanently Banned'}
          </Text>
          <Text style={styles.heroSubtitle}>
            {isSuspended
              ? 'Your account access has been temporarily restricted due to policy violations.'
              : 'Your account has been permanently restricted from accessing the Leteski platform.'}
          </Text>
        </LinearGradient>

        <View style={styles.mainCard}>
          {/* Suspension Countdown Box */}
          {isSuspended && (
            <View style={styles.timerCard}>
              <View style={styles.timerHeader}>
                <Clock size={20} color="#B45309" />
                <Text style={styles.timerHeaderTitle}>
                  {timeLeft.isExpired ? 'Suspension Period Concluded' : 'Suspension Duration & Time Remaining'}
                </Text>
              </View>

              {!timeLeft.isExpired ? (
                <>
                  <View style={styles.countdownRow}>
                    <View style={styles.timeBox}>
                      <Text style={styles.timeValue}>{timeLeft.days}</Text>
                      <Text style={styles.timeLabel}>DAYS</Text>
                    </View>
                    <Text style={styles.timeColon}>:</Text>
                    <View style={styles.timeBox}>
                      <Text style={styles.timeValue}>{String(timeLeft.hours).padStart(2, '0')}</Text>
                      <Text style={styles.timeLabel}>HOURS</Text>
                    </View>
                    <Text style={styles.timeColon}>:</Text>
                    <View style={styles.timeBox}>
                      <Text style={styles.timeValue}>{String(timeLeft.minutes).padStart(2, '0')}</Text>
                      <Text style={styles.timeLabel}>MIN</Text>
                    </View>
                    <Text style={styles.timeColon}>:</Text>
                    <View style={styles.timeBox}>
                      <Text style={styles.timeValue}>{String(timeLeft.seconds).padStart(2, '0')}</Text>
                      <Text style={styles.timeLabel}>SEC</Text>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaRowLabel}>Total Duration:</Text>
                    <Text style={styles.metaRowValue}>{daysSuspended ? `${daysSuspended} Days` : 'Timed'}</Text>
                  </View>

                  {suspendedUntil && (
                    <View style={styles.metaRow}>
                      <Text style={styles.metaRowLabel}>Restoration Date:</Text>
                      <Text style={styles.metaRowValue}>
                        {new Date(suspendedUntil).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.expiredNotice}>
                  <Text style={styles.expiredText}>
                    Your suspension period has expired! Tap "Check Account Status" below to unlock your account.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Reason Section */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <AlertTriangle size={18} color={isSuspended ? '#D97706' : '#EF4444'} />
              <Text style={styles.sectionTitle}>
                {isSuspended ? 'Suspension Reason' : 'Ban Reason'}
              </Text>
            </View>
            <View style={[styles.reasonBox, isSuspended ? styles.reasonBoxWarn : styles.reasonBoxDanger]}>
              <Text style={[styles.reasonText, isSuspended ? styles.reasonTextWarn : styles.reasonTextDanger]}>
                {banReason}
              </Text>
            </View>
            {bannedAt && (
              <Text style={styles.dateText}>
                Action taken on {new Date(bannedAt).toLocaleDateString(undefined, { dateStyle: 'long' })}
              </Text>
            )}
          </View>

          {/* Policy Information */}
          <View style={styles.infoBlock}>
            <Text style={styles.infoTitle}>What does this mean?</Text>
            <Text style={styles.infoDesc}>
              {isSuspended
                ? '• You cannot send exchange requests, propose swaps, publish skills, or participate in chats.\n• You will automatically regain full access once the suspension duration ends.\n• Repeated violations may lead to a permanent account ban.'
                : '• Your profile, skills, and exchanges have been permanently deactivated.\n• You cannot initiate chats or participate in community sessions.\n• If you believe this action was made in error, you may submit an appeal to our admin team.'}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.primaryBtn, isSuspended ? styles.primaryBtnWarn : styles.primaryBtnDanger]}
              onPress={handleContactSupport}
              activeOpacity={0.8}
            >
              <HelpCircle size={18} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Help & Support Center</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={handleRefreshStatus}
              activeOpacity={0.8}
              disabled={isCheckingStatus}
            >
              <RefreshCw size={16} color="#64748B" />
              <Text style={styles.refreshBtnText}>
                {isCheckingStatus ? 'Checking status...' : 'Check Account Status'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleSignOut}
              activeOpacity={0.8}
            >
              <LogOut size={16} color="#EF4444" />
              <Text style={styles.logoutBtnText}>Log Out</Text>
            </TouchableOpacity>
          </View>

          {/* Footer Links */}
          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={() => router.push('/terms' as any)}>
              <Text style={styles.footerLinkText}>Terms & Conditions</Text>
            </TouchableOpacity>
            <Text style={styles.footerDot}>{' • '}</Text>
            <TouchableOpacity onPress={() => router.push('/privacy' as any)}>
              <Text style={styles.footerLinkText}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  headerHero: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 64 : 48,
    paddingBottom: 48,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 340,
  },
  mainCard: {
    backgroundColor: '#FFFFFF',
    marginTop: -24,
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  timerCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  timerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  timerHeaderTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#92400E',
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 12,
    gap: 4,
  },
  timeBox: {
    alignItems: 'center',
    minWidth: 52,
  },
  timeValue: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#B45309',
    fontVariant: ['tabular-nums'],
  },
  timeLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#92400E',
    marginTop: 2,
  },
  timeColon: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#D97706',
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  metaRowLabel: {
    fontSize: 12,
    color: '#78350F',
    fontWeight: '500' as const,
  },
  metaRowValue: {
    fontSize: 12,
    color: '#78350F',
    fontWeight: '700' as const,
  },
  expiredNotice: {
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    padding: 12,
  },
  expiredText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#065F46',
    textAlign: 'center',
  },
  sectionBlock: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#0F172A',
  },
  reasonBox: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  reasonBoxWarn: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  reasonBoxDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  reasonText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as const,
  },
  reasonTextWarn: {
    color: '#92400E',
  },
  reasonTextDanger: {
    color: '#991B1B',
  },
  dateText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
    textAlign: 'right',
  },
  infoBlock: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#334155',
    marginBottom: 6,
  },
  infoDesc: {
    fontSize: 12,
    lineHeight: 18,
    color: '#64748B',
  },
  actionsContainer: {
    gap: 10,
    marginBottom: 16,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryBtnWarn: {
    backgroundColor: '#D97706',
  },
  primaryBtnDanger: {
    backgroundColor: '#DC2626',
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
    backgroundColor: '#F1F5F9',
  },
  refreshBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#475569',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
    backgroundColor: '#FEF2F2',
  },
  logoutBtnText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#EF4444',
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 10,
  },
  footerLinkText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600' as const,
  },
  footerDot: {
    fontSize: 12,
    color: '#CBD5E1',
  },
});

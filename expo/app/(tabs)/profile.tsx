import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin, Star, Calendar, Sparkles, TrendingUp, Award, LogOut, Coins, Crown, ShoppingBag, ShieldCheck, RefreshCw, Plus, Settings, HelpCircle, FileText, Lock, MessageSquare, Info, Wallet } from 'lucide-react-native';
import { useAuth } from '@/providers/auth';
import { useOnboarding } from '@/providers/onboarding';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { mockUsers } from '@/mocks/data';
import { trpc } from '@/lib/trpc';
import { useCurrentUser } from '@/providers/current-user';
import { useEarnings } from '@/providers/earnings';
import ReviewsSection from '@/components/ReviewsSection';
import { TrustScoreBadge } from '@/components/TrustScoreBadge';

export default function ProfileScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { resetOnboarding } = useOnboarding();
  const { currentUser } = useCurrentUser();
  const { getSummary } = useEarnings();
  const earningsSummary = getSummary(currentUser.id);
  const verificationsQuery = trpc.verification.getVerifications.useQuery();
  const verifications = verificationsQuery.data;

  const handleSignOut = async () => {
    console.log('[Profile] Signing out');
    await auth.signOut();
    router.replace('/login' as any);
  };

  const handleRestartOnboarding = async () => {
    console.log('[Profile] Restarting onboarding');
    await resetOnboarding();
    router.replace('/onboarding' as any);
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[Colors.light.primary, Colors.light.primaryLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.avatarContainer}>
            {currentUser.avatarUrl ? (
              <Image
                source={{ uri: currentUser.avatarUrl }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
            )}
            <View style={styles.badgeContainer}>
              <Award size={16} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.name}>{currentUser.name}</Text>
          <View style={styles.locationRow}>
            <MapPin size={16} color="rgba(255,255,255,0.9)" />
            <Text style={styles.location}>{currentUser.location}</Text>
          </View>
          {verifications && verifications.trustScore > 0 && (
            <TouchableOpacity 
              style={styles.trustScoreContainer}
              onPress={() => router.push('/verification' as any)}
              activeOpacity={0.7}
            >
              <TrustScoreBadge score={verifications.trustScore} size="small" showLabel={false} />
              <Text style={styles.trustScoreLabel}>Trust Score</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>

        <View style={styles.content}>
          {currentUser.premiumTier !== 'free' && (
            <View style={styles.premiumBanner}>
              <View style={[styles.premiumGlow, { backgroundColor: currentUser.premiumTier === 'elite' ? '#F59E0B' : currentUser.premiumTier === 'premium' ? '#8B5CF6' : '#6366F1' }]} />
              <View style={styles.premiumContent}>
                <Crown size={24} color="#FFFFFF" fill="#FFFFFF" />
                <View style={styles.premiumInfo}>
                  <Text style={styles.premiumTitle}>{currentUser.premiumTier.toUpperCase()} MEMBER</Text>
                  <Text style={styles.premiumExpiry}>
                    {currentUser.premiumExpiresAt ? `Active until ${new Date(currentUser.premiumExpiresAt).toLocaleDateString()}` : 'Active'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          <TouchableOpacity 
            style={styles.creditsCard}
            onPress={() => router.push('/store' as any)}
          >
            <View style={styles.creditsLeft}>
              <View style={styles.creditsIcon}>
                <Coins size={24} color="#F59E0B" />
              </View>
              <View style={styles.creditsInfo}>
                <Text style={styles.creditsLabel}>Your Credits</Text>
                <Text style={styles.creditsValue}>{currentUser.credits}</Text>
              </View>
            </View>
            <View style={styles.creditsButton}>
              <ShoppingBag size={18} color={Colors.light.primary} />
              <Text style={styles.creditsButtonText}>Top Up</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.earningsCard}
            onPress={() => router.push('/earnings' as any)}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['#6366F1', '#4F46E5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.earningsGradient}
            >
              <View style={styles.earningsIconWrap}>
                <Wallet size={22} color="#FFFFFF" />
              </View>
              <View style={styles.earningsInfo}>
                <Text style={styles.earningsLabel}>Teaching Earnings</Text>
                <Text style={styles.earningsPoints}>{earningsSummary.availablePoints.toLocaleString()} points available</Text>
                <Text style={styles.earningsSub}>This month: +{earningsSummary.currentMonthPoints} pts · {earningsSummary.currentMonthClasses} classes</Text>
              </View>
              <View style={styles.earningsArrow}>
                <Text style={styles.earningsArrowText}>View →</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <TrendingUp size={20} color={Colors.light.primary} />
              </View>
              <Text style={styles.statValue}>{currentUser.totalSwaps}</Text>
              <Text style={styles.statLabel}>Total Swaps</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Star size={20} fill={Colors.light.accent} color={Colors.light.accent} />
              </View>
              <Text style={styles.statValue}>{currentUser.rating}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Calendar size={20} color={Colors.light.secondary} />
              </View>
              <Text style={styles.statValue}>2024</Text>
              <Text style={styles.statLabel}>Joined</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.verificationCard}
            onPress={() => router.push('/verification' as any)}
            activeOpacity={0.7}
          >
            <View style={styles.verificationIcon}>
              <ShieldCheck size={24} color={Colors.light.primary} />
            </View>
            <View style={styles.verificationContent}>
              <Text style={styles.verificationTitle}>Account Verification</Text>
              <Text style={styles.verificationSubtitle}>
                {verifications ? 
                  `${[
                    verifications.identity,
                    verifications.email,
                    verifications.phone,
                    verifications.linkedIn,
                    verifications.portfolio,
                  ].filter((v) => v.status === 'verified').length}/5 verifications completed` :
                  'Build your trust score'}
              </Text>
            </View>
            <Text style={styles.verificationAction}>View</Text>
          </TouchableOpacity>

          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => router.push('/edit-profile' as any)}
            >
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.signOutButton}
              onPress={handleSignOut}
            >
              <LogOut size={18} color={Colors.light.error} />
              <Text style={styles.signOutButtonText}>Sign Out</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.adminButton}
            onPress={() => router.push('/admin/login' as any)}
            activeOpacity={0.7}
            testID="admin-panel-button"
          >
            <View style={styles.adminIconWrap}>
              <Settings size={20} color="#FFFFFF" />
            </View>
            <View style={styles.adminTextWrap}>
              <Text style={styles.adminTitle}>Admin Panel</Text>
              <Text style={styles.adminSubtitle}>Manage users, reviews & more</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.restartOnboardingButton}
            onPress={handleRestartOnboarding}
          >
            <RefreshCw size={18} color={Colors.light.primary} />
            <Text style={styles.restartOnboardingText}>Restart Onboarding</Text>
          </TouchableOpacity>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Support & Info</Text>
            <View style={styles.supportGrid}>
              <TouchableOpacity
                style={styles.supportCard}
                onPress={() => router.push('/help' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.supportIcon, { backgroundColor: Colors.light.primaryLight + '20' }]}>
                  <HelpCircle size={22} color={Colors.light.primary} />
                </View>
                <Text style={styles.supportLabel}>Help & Support</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.supportCard}
                onPress={() => router.push('/contact' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.supportIcon, { backgroundColor: Colors.light.secondary + '20' }]}>
                  <MessageSquare size={22} color={Colors.light.secondary} />
                </View>
                <Text style={styles.supportLabel}>Contact Us</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.supportCard}
                onPress={() => router.push('/about' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.supportIcon, { backgroundColor: Colors.light.accentLight + '40' }]}>
                  <Info size={22} color={Colors.light.accent} />
                </View>
                <Text style={styles.supportLabel}>About Us</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.supportCard}
                onPress={() => router.push('/terms' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.supportIcon, { backgroundColor: Colors.light.backgroundTertiary }]}>
                  <FileText size={22} color={Colors.light.textSecondary} />
                </View>
                <Text style={styles.supportLabel}>Terms</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.supportCard}
                onPress={() => router.push('/privacy' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.supportIcon, { backgroundColor: Colors.light.backgroundTertiary }]}>
                  <Lock size={22} color={Colors.light.textSecondary} />
                </View>
                <Text style={styles.supportLabel}>Privacy</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.bioContainer}>
              <Text style={styles.bioText}>{currentUser.bio}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Skills I Offer</Text>
              <TouchableOpacity
                style={styles.addSkillButton}
                onPress={() => router.push('/add-skill' as any)}
                activeOpacity={0.7}
              >
                <Plus size={16} color="#FFFFFF" />
                <Text style={styles.addSkillButtonText}>Add Skill</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.skillsGrid}>
              {currentUser.skillsOffered.map((skill) => (
                <TouchableOpacity
                  key={skill.id}
                  style={styles.skillCard}
                  onPress={() => router.push(`/skill/${skill.id}` as any)}
                >
                  {skill.imageUrl ? (
                    <Image
                      source={{ uri: skill.imageUrl }}
                      style={styles.skillImage}
                    />
                  ) : (
                    <View style={[styles.skillImage, { backgroundColor: Colors.light.backgroundTertiary }]} />
                  )}
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)']}
                    style={styles.skillOverlay}
                  >
                    <Text style={styles.skillCardTitle} numberOfLines={2}>
                      {skill.title}
                    </Text>
                    <View style={styles.skillCardBadge}>
                      <Text style={styles.skillCardBadgeText}>{skill.level}</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Want to Learn</Text>
              <TouchableOpacity
                style={styles.addWantButton}
                onPress={() => router.push('/edit-profile' as any)}
                activeOpacity={0.7}
              >
                <Plus size={14} color={Colors.light.primary} />
                <Text style={styles.addWantButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.wantsList}>
              {currentUser.skillsWanted.map((skill, index) => (
                <View key={index} style={styles.wantCard}>
                  <View style={styles.wantIconContainer}>
                    <Sparkles size={16} color={Colors.light.primary} />
                  </View>
                  <Text style={styles.wantText}>{skill}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <ReviewsSection
              revieweeId={currentUser.id}
              headline="Reviews You've Received"
            />
          </View>

          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  badgeContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.light.accent,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  name: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  location: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500' as const,
  },
  trustScoreContainer: {
    marginTop: 12,
    alignItems: 'center',
    gap: 6,
  },
  trustScoreLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.95)',
  },
  content: {
    marginTop: -20,
    backgroundColor: Colors.light.backgroundSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.light.card,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
  },
  premiumBanner: {
    position: 'relative',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  premiumGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  premiumContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 14,
  },
  premiumInfo: {
    flex: 1,
  },
  premiumTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    letterSpacing: 1,
    marginBottom: 4,
  },
  premiumExpiry: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500' as const,
  },
  creditsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.card,
    padding: 18,
    borderRadius: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  creditsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  creditsIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditsInfo: {
    flex: 1,
  },
  creditsLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 2,
    fontWeight: '500' as const,
  },
  creditsValue: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: Colors.light.text,
  },
  creditsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.light.primaryLight,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  creditsButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.primary,
  },
  earningsCard: {
    marginBottom: 20,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  earningsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 14,
  },
  earningsIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  earningsInfo: {
    flex: 1,
  },
  earningsLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  earningsPoints: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '800' as const,
    marginBottom: 2,
  },
  earningsSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500' as const,
  },
  earningsArrow: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  earningsArrowText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  verificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.card,
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    gap: 12,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  verificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verificationContent: {
    flex: 1,
  },
  verificationTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  verificationSubtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  verificationAction: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.primary,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  editButton: {
    flex: 1,
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.light.backgroundTertiary,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.error,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  addSkillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  addSkillButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  addWantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.primaryLight + '20',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.primaryLight,
  },
  addWantButtonText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.primary,
  },
  bioContainer: {
    backgroundColor: Colors.light.card,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  bioText: {
    fontSize: 15,
    lineHeight: 24,
    color: Colors.light.textSecondary,
  },
  skillsGrid: {
    gap: 12,
  },
  skillCard: {
    height: 160,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: Colors.light.backgroundTertiary,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  skillImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  skillOverlay: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  skillCardTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    lineHeight: 26,
  },
  skillCardBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  skillCardBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.light.primary,
  },
  wantsList: {
    gap: 10,
  },
  wantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.card,
    padding: 16,
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  wantIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wantText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    gap: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  adminIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminTextWrap: {
    flex: 1,
  },
  adminTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#F8FAFC',
  },
  adminSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  restartOnboardingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.light.card,
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  restartOnboardingText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.primary,
  },
  supportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  supportCard: {
    width: '30%',
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: Colors.light.card,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  supportIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 40,
  },
});

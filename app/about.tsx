import { useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView, useWindowDimensions } from 'react-native';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Heart,
  Globe,
  Target,
  Sparkles,
  Users,
  Shield,
  Zap,
  TrendingUp,
} from 'lucide-react-native';
import Colors from '@/constants/colors';

interface ValueItem {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const VALUES: ValueItem[] = [
  {
    icon: <Heart size={24} color={Colors.light.error} />,
    title: 'Community First',
    description:
      'We believe knowledge grows when shared. Our platform is built on the principle that everyone has something valuable to teach and something new to learn.',
  },
  {
    icon: <Globe size={24} color={Colors.light.secondary} />,
    title: 'Accessible to All',
    description:
      'Learning shouldn\'t be limited by money. Leteski makes education accessible through the power of barter — trade your skills, not your wallet.',
  },
  {
    icon: <Shield size={24} color={Colors.light.primary} />,
    title: 'Trust & Safety',
    description:
      'We prioritize user safety through identity verification, trust scores, and a robust review system. Every interaction should be secure and respectful.',
  },
  {
    icon: <Target size={24} color={Colors.light.accent} />,
    title: 'Quality Learning',
    description:
      'We\'re committed to facilitating meaningful skill exchanges. Our matching algorithm connects you with the best partners based on compatibility and goals.',
  },
];

const STATS = [
  { value: 'Growing', label: 'Active Learners', icon: <Users size={20} color={Colors.light.primary} /> },
  { value: 'Diverse', label: 'Skill Categories', icon: <Sparkles size={20} color={Colors.light.accent} /> },
  { value: 'High', label: 'Satisfaction Rate', icon: <TrendingUp size={20} color={Colors.light.secondary} /> },
];

export default function AboutScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const isSmallScreen = windowWidth < 600;
  const styles = useMemo(() => createStyles(isSmallScreen), [isSmallScreen]);
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'About Us' }} />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <LinearGradient
          colors={[Colors.light.primary, Colors.light.primaryLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Heart size={48} color="#FFFFFF" fill="#FFFFFF" />
          <Text style={styles.headerTitle}>About Leteski</Text>
          <Text style={styles.headerSubtitle}>
            Building a world where knowledge knows no boundaries
          </Text>
        </LinearGradient>

        <View style={styles.content}>
          <View style={styles.missionCard}>
            <Zap size={28} color={Colors.light.primary} />
            <Text style={styles.missionTitle}>Our Mission</Text>
            <Text style={styles.missionText}>
              Leteski was born from a simple idea: everyone has something to teach and
              something to learn. We're breaking down the barriers of traditional education by
              creating a community where knowledge flows freely between people — no money
              required, just a willingness to share and grow together.
            </Text>
          </View>

          <View style={styles.statsRow}>
            {STATS.map((stat, index) => (
              <View key={index} style={styles.statCard}>
                <View style={styles.statIcon}>{stat.icon}</View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Our Story</Text>
            <View style={styles.storyCard}>
              <Text style={styles.storyText}>
                Leteski started in 2024 when a group of passionate learners realized that
                the best education often happens person-to-person. Traditional learning
                platforms charge high fees, while so many talented people are eager to share
                their skills in exchange for learning something new.
              </Text>
              <Text style={styles.storyText}>
                We built this platform to connect those dots — to create a marketplace where
                the currency is knowledge itself. Whether you're a master guitarist wanting to
                learn photography, or a coding expert hoping to pick up a new language,
                Leteski makes it happen.
              </Text>
              <Text style={styles.storyText}>
                Today, we're proud to facilitate skill exchanges across the globe, proving
                that the best things in life — like learning — really can be free.
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Our Values</Text>
            <View style={styles.valuesList}>
              {VALUES.map((item, index) => (
                <View key={index} style={styles.valueCard}>
                  <View style={styles.valueIcon}>{item.icon}</View>
                  <View style={styles.valueContent}>
                    <Text style={styles.valueTitle}>{item.title}</Text>
                    <Text style={styles.valueDescription}>{item.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How It Works</Text>
            <View style={styles.stepsList}>
              <View style={styles.stepCard}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Create Your Profile</Text>
                  <Text style={styles.stepDescription}>
                    List the skills you can teach and the ones you want to learn. Build trust
                    by verifying your identity and adding details about your expertise.
                  </Text>
                </View>
              </View>
              <View style={styles.stepCard}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Find Your Match</Text>
                  <Text style={styles.stepDescription}>
                    Browse skills in the Explore tab or get personalized match
                    recommendations. Find people who want to learn what you know and can teach
                    what you want.
                  </Text>
                </View>
              </View>
              <View style={styles.stepCard}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Exchange & Learn</Text>
                  <Text style={styles.stepDescription}>
                    Send an exchange request, schedule a session, and start learning from each
                    other. Use our built-in video calls or meet in person — it's up to you.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.closingCard}>
            <Heart size={24} color={Colors.light.error} fill={Colors.light.error} />
            <Text style={styles.closingText}>
              Thank you for being part of the Leteski community. Together, we're making
              learning accessible, personal, and free.
            </Text>
          </View>

          <View style={styles.companyInfoCard}>
            <Text style={styles.companyNameText}>Gizmoverse Private Limited</Text>
            <Text style={styles.companyProductText}>leteski is a product of Gizmoverse Private Limited</Text>
          </View>

          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (isSmallScreen: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingTop: isSmallScreen ? 24 : 40,
    paddingBottom: isSmallScreen ? 20 : 32,
    paddingHorizontal: isSmallScreen ? 16 : 24,
  },
  headerTitle: {
    fontSize: isSmallScreen ? 20 : 26,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    marginTop: isSmallScreen ? 10 : 16,
    marginBottom: isSmallScreen ? 4 : 8,
  },
  headerSubtitle: {
    fontSize: isSmallScreen ? 12.5 : 15,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: isSmallScreen ? 17 : 22,
  },
  content: {
    marginTop: isSmallScreen ? -14 : -20,
    backgroundColor: Colors.light.backgroundSecondary,
    borderTopLeftRadius: isSmallScreen ? 16 : 24,
    borderTopRightRadius: isSmallScreen ? 16 : 24,
    paddingTop: isSmallScreen ? 16 : 24,
    paddingHorizontal: isSmallScreen ? 12 : 20,
  },
  missionCard: {
    backgroundColor: Colors.light.card,
    padding: isSmallScreen ? 14 : 24,
    borderRadius: isSmallScreen ? 14 : 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: isSmallScreen ? 16 : 24,
  },
  missionTitle: {
    fontSize: isSmallScreen ? 16 : 20,
    fontWeight: '800' as const,
    color: Colors.light.text,
    marginTop: isSmallScreen ? 8 : 12,
    marginBottom: isSmallScreen ? 8 : 12,
  },
  missionText: {
    fontSize: isSmallScreen ? 12.5 : 15,
    lineHeight: isSmallScreen ? 18 : 24,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: isSmallScreen ? 8 : 12,
    marginBottom: isSmallScreen ? 18 : 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.light.card,
    padding: isSmallScreen ? 10 : 16,
    borderRadius: isSmallScreen ? 12 : 16,
    alignItems: 'center',
    gap: isSmallScreen ? 6 : 8,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statIcon: {
    width: isSmallScreen ? 32 : 40,
    height: isSmallScreen ? 32 : 40,
    borderRadius: isSmallScreen ? 16 : 20,
    backgroundColor: Colors.light.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: isSmallScreen ? 15 : 20,
    fontWeight: '800' as const,
    color: Colors.light.text,
  },
  statLabel: {
    fontSize: isSmallScreen ? 9.5 : 11,
    fontWeight: '600' as const,
    color: Colors.light.textTertiary,
    textAlign: 'center',
  },
  section: {
    marginBottom: isSmallScreen ? 18 : 28,
  },
  sectionTitle: {
    fontSize: isSmallScreen ? 16 : 20,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: isSmallScreen ? 10 : 16,
  },
  storyCard: {
    backgroundColor: Colors.light.card,
    padding: isSmallScreen ? 12 : 20,
    borderRadius: isSmallScreen ? 12 : 16,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    gap: isSmallScreen ? 10 : 16,
  },
  storyText: {
    fontSize: isSmallScreen ? 12 : 15,
    lineHeight: isSmallScreen ? 18 : 24,
    color: Colors.light.textSecondary,
  },
  valuesList: {
    gap: isSmallScreen ? 8 : 12,
  },
  valueCard: {
    flexDirection: 'row',
    backgroundColor: Colors.light.card,
    padding: isSmallScreen ? 12 : 18,
    borderRadius: isSmallScreen ? 12 : 16,
    gap: isSmallScreen ? 10 : 14,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  valueIcon: {
    width: isSmallScreen ? 36 : 48,
    height: isSmallScreen ? 36 : 48,
    borderRadius: isSmallScreen ? 10 : 14,
    backgroundColor: Colors.light.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueContent: {
    flex: 1,
  },
  valueTitle: {
    fontSize: isSmallScreen ? 13.5 : 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  valueDescription: {
    fontSize: isSmallScreen ? 11.5 : 14,
    lineHeight: isSmallScreen ? 16 : 21,
    color: Colors.light.textSecondary,
  },
  stepsList: {
    gap: isSmallScreen ? 8 : 12,
  },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: Colors.light.card,
    padding: isSmallScreen ? 12 : 18,
    borderRadius: isSmallScreen ? 12 : 16,
    gap: isSmallScreen ? 10 : 14,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  stepNumber: {
    width: isSmallScreen ? 28 : 36,
    height: isSmallScreen ? 28 : 36,
    borderRadius: isSmallScreen ? 14 : 18,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: isSmallScreen ? 13 : 16,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: isSmallScreen ? 13.5 : 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: isSmallScreen ? 11.5 : 14,
    lineHeight: isSmallScreen ? 16 : 21,
    color: Colors.light.textSecondary,
  },
  closingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.card,
    padding: isSmallScreen ? 12 : 20,
    borderRadius: isSmallScreen ? 12 : 16,
    gap: isSmallScreen ? 8 : 12,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  closingText: {
    flex: 1,
    fontSize: isSmallScreen ? 11.5 : 14,
    lineHeight: isSmallScreen ? 17 : 22,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
  },
  companyInfoCard: {
    marginTop: isSmallScreen ? 14 : 20,
    padding: isSmallScreen ? 12 : 16,
    borderRadius: isSmallScreen ? 12 : 16,
    backgroundColor: Colors.light.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    gap: 4,
  },
  companyNameText: {
    fontSize: isSmallScreen ? 12.5 : 14,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  companyProductText: {
    fontSize: isSmallScreen ? 11 : 12,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 40,
  },
});

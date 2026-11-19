import { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { Stack } from 'expo-router';
import {
  ChevronDown,
  ChevronUp,
  Search,
  MessageCircle,
  LifeBuoy,
  BookOpen,
  Shield,
  ShieldX,
  Ban,
  Coins,
  Users,
  Calendar,
  Star,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';

interface FaqItem {
  question: string;
  answer: string;
  icon: React.ReactNode;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'How does skill exchange work?',
    answer:
      'Leteski connects you with people who want to learn what you know, and who can teach you what you want to learn. Browse skills on the Explore tab, find a match, and send an exchange request. Both participants teach each other their skills in scheduled sessions — no money changes hands, just knowledge.',
    icon: <Users size={20} color={Colors.light.primary} />,
  },
  {
    question: 'How do credits work?',
    answer:
      'Credits let you unlock premium features, boost your profile visibility, and access exclusive resources. You can earn free credits by completing exchanges, leaving reviews, and verifying your account. Additional credits can be purchased from the Store.',
    icon: <Coins size={20} color={Colors.light.accent} />,
  },
  {
    question: 'How do I schedule a session?',
    answer:
      'Once an exchange request is accepted, you can propose times through the chat in the exchange detail screen. Both participants agree on a time, and the session is added to your calendar. You can also use the built-in video call feature when it\'s time to meet.',
    icon: <Calendar size={20} color={Colors.light.secondary} />,
  },
  {
    question: 'What is the Trust Score?',
    answer:
      'Your Trust Score reflects how reliable and verified you are on the platform. It\'s based on completed verifications (identity, email, phone, LinkedIn), positive reviews from exchange partners, and your exchange completion rate. A higher score helps you get more exchange requests.',
    icon: <Shield size={20} color={Colors.light.primary} />,
  },
  {
    question: 'How do I leave a review?',
    answer:
      'After completing a swap, you\'ll be prompted to rate and review your partner. Reviews help build trust in the community. You can rate from 1-5 stars and leave a written comment about your experience.',
    icon: <Star size={20} color={Colors.light.accent} />,
  },
  {
    question: 'How do I verify my account?',
    answer:
      'Go to your Profile tab, tap "Account Verification", and follow the steps to verify your identity, email, phone, or LinkedIn profile. Each verification boosts your Trust Score and makes your profile more trustworthy to other users.',
    icon: <Shield size={20} color={Colors.light.secondary} />,
  },
  {
    question: 'What if someone doesn\'t show up?',
    answer:
      'If your swap partner doesn\'t attend a scheduled session, you can report it through the swap detail screen. Repeated no-shows affect a user\'s Trust Score and may result in account restrictions. We encourage communication first — reach out via chat to reschedule.',
    icon: <MessageCircle size={20} color={Colors.light.error} />,
  },
  {
    question: 'How do I report inappropriate behavior?',
    answer:
      'If you experience harassment, spam, or any inappropriate behavior, open the user\'s profile and tap "Report User". Choose a reason (harassment, inappropriate content, spam/scam, fake profile, hate speech, threats, or other), describe what happened, and submit. Our admin team reviews all reports within 24 hours and takes action ranging from warnings to permanent bans. You can also report individual reviews from the reviews section.',
    icon: <ShieldX size={20} color={Colors.light.error} />,
  },
  {
    question: 'How do I block someone?',
    answer:
      'Open the user\'s profile and tap "Block". Blocked users cannot send you swap requests or messages. You can unblock them at any time from their profile — just tap "Unblock". Your blocked list is stored on your device and persists across sessions.',
    icon: <Ban size={20} color={Colors.light.textSecondary} />,
  },
];

export default function HelpScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const isSmallScreen = windowWidth < 600;
  const styles = useMemo(() => createStyles(isSmallScreen), [isSmallScreen]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredFaqs = FAQ_ITEMS.filter(
    (item) =>
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Help & Support' }} />
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
          <LifeBuoy size={40} color="#FFFFFF" />
          <Text style={styles.headerTitle}>How can we help?</Text>
          <Text style={styles.headerSubtitle}>
            Find answers to common questions or reach out to our team
          </Text>
        </LinearGradient>

        <View style={styles.content}>
          <View style={styles.searchContainer}>
            <Search size={18} color={Colors.light.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search help articles..."
              placeholderTextColor={Colors.light.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {filteredFaqs.length === 0 ? (
            <View style={styles.emptyState}>
              <BookOpen size={48} color={Colors.light.textTertiary} />
              <Text style={styles.emptyTitle}>No results found</Text>
              <Text style={styles.emptySubtitle}>
                Try a different search or contact us directly
              </Text>
            </View>
          ) : (
            <View style={styles.faqList}>
              {filteredFaqs.map((item, index) => {
                const isExpanded = expandedIndex === index;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.faqCard,
                      isExpanded && styles.faqCardExpanded,
                    ]}
                    onPress={() =>
                      setExpandedIndex(isExpanded ? null : index)
                    }
                    activeOpacity={0.7}
                  >
                    <View style={styles.faqHeader}>
                      <View style={styles.faqIcon}>{item.icon}</View>
                      <Text style={styles.faqQuestion}>
                        {item.question}
                      </Text>
                      {isExpanded ? (
                        <ChevronUp size={20} color={Colors.light.primary} />
                      ) : (
                        <ChevronDown size={20} color={Colors.light.textTertiary} />
                      )}
                    </View>
                    {isExpanded && (
                      <View style={styles.faqAnswer}>
                        <View style={styles.faqAnswerDivider} />
                        <Text style={styles.faqAnswerText}>{item.answer}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={styles.contactSection}>
            <Text style={styles.contactTitle}>Still need help?</Text>
            <Text style={styles.contactSubtitle}>
              Our support team is ready to assist you with any questions or issues
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.card,
    paddingHorizontal: isSmallScreen ? 12 : 16,
    paddingVertical: isSmallScreen ? 9 : 14,
    borderRadius: isSmallScreen ? 12 : 16,
    marginBottom: isSmallScreen ? 14 : 24,
    gap: isSmallScreen ? 8 : 10,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: isSmallScreen ? 13.5 : 16,
    color: Colors.light.text,
  },
  faqList: {
    gap: isSmallScreen ? 8 : 12,
  },
  faqCard: {
    backgroundColor: Colors.light.card,
    borderRadius: isSmallScreen ? 12 : 16,
    padding: isSmallScreen ? 12 : 18,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  faqCardExpanded: {
    borderColor: Colors.light.primaryLight,
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isSmallScreen ? 8 : 12,
  },
  faqIcon: {
    width: isSmallScreen ? 32 : 40,
    height: isSmallScreen ? 32 : 40,
    borderRadius: isSmallScreen ? 8 : 12,
    backgroundColor: Colors.light.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqQuestion: {
    flex: 1,
    fontSize: isSmallScreen ? 13 : 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
    lineHeight: isSmallScreen ? 18 : 22,
  },
  faqAnswer: {
    marginTop: isSmallScreen ? 10 : 14,
  },
  faqAnswerDivider: {
    height: 1,
    backgroundColor: Colors.light.borderLight,
    marginBottom: isSmallScreen ? 10 : 14,
  },
  faqAnswerText: {
    fontSize: isSmallScreen ? 12 : 14,
    lineHeight: isSmallScreen ? 17 : 22,
    color: Colors.light.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: isSmallScreen ? 32 : 48,
    gap: 12,
  },
  emptyTitle: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
  },
  emptySubtitle: {
    fontSize: isSmallScreen ? 12.5 : 14,
    color: Colors.light.textTertiary,
    textAlign: 'center',
  },
  contactSection: {
    marginTop: isSmallScreen ? 20 : 32,
    alignItems: 'center',
    gap: 8,
  },
  contactTitle: {
    fontSize: isSmallScreen ? 16 : 20,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  contactSubtitle: {
    fontSize: isSmallScreen ? 12 : 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: isSmallScreen ? 16 : 20,
  },
  companyInfoCard: {
    marginTop: isSmallScreen ? 16 : 24,
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

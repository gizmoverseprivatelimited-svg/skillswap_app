import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { FileText, Scale } from 'lucide-react-native';
import Colors from '@/constants/colors';

const LAST_UPDATED = 'June 24, 2026';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. Acceptance of Terms',
    body: 'By creating an account or using Skill Swap ("the Service"), you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you must not use the Service. We reserve the right to update these terms at any time, and continued use of the Service constitutes acceptance of any changes.',
  },
  {
    title: '2. Eligibility',
    body: 'You must be at least 16 years of age to use the Service. By using the Service, you represent and warrant that you meet this age requirement and have the legal capacity to enter into a binding agreement. If you are using the Service on behalf of an organization, you represent that you have the authority to bind that organization to these terms.',
  },
  {
    title: '3. User Accounts',
    body: 'You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate. You may not share your account with others or transfer your account to another person.',
  },
  {
    title: '4. User Conduct',
    body: 'You agree to use the Service in a lawful manner and in accordance with these Terms. You will not: (a) harass, abuse, or harm other users; (b) post false, misleading, or deceptive content; (c) impersonate any person or entity; (d) use the Service for any illegal purpose; (e) attempt to gain unauthorized access to any part of the Service; (f) interfere with or disrupt the Service; (g) scrape, data-mine, or use automated means to access the Service; (h) violate any applicable laws or regulations.',
  },
  {
    title: '5. Skill Swap Sessions',
    body: 'Skill Swap facilitates connections between users for the purpose of skill exchange. We do not guarantee the quality, safety, or legality of any skill exchange session. Users participate in swaps at their own risk. We recommend using the in-app communication and video call features for safety. Users should exercise caution when sharing personal information or meeting in person.',
  },
  {
    title: '6. Credits and Payments',
    body: 'Credits are a virtual currency within the Service that can be used to access premium features. Credits may be purchased through authorized payment methods or earned through platform activities. Credits have no real-world monetary value and cannot be redeemed for cash. We reserve the right to modify credit pricing and earning mechanisms at any time. All purchases are final and non-refundable unless required by applicable law.',
  },
  {
    title: '7. User Content',
    body: 'You retain ownership of content you post on the Service, including profile information, skill listings, reviews, and messages. By posting content, you grant us a worldwide, non-exclusive, royalty-free license to use, display, and distribute your content in connection with the Service. You represent that you have all necessary rights to the content you post and that it does not infringe any third-party rights.',
  },
  {
    title: '8. Reviews and Ratings',
    body: 'Reviews and ratings must be honest and based on actual experiences. You may not post fake, manipulated, or incentivized reviews. We reserve the right to remove reviews that violate our policies and to take action against accounts that engage in review manipulation.',
  },
  {
    title: '9. Intellectual Property',
    body: 'The Service and its original content, features, and functionality are owned by Skill Swap and are protected by international copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, or create derivative works based on the Service without our prior written consent.',
  },
  {
    title: '10. Termination',
    body: 'We reserve the right to suspend or terminate your account at any time, with or without cause, including for violation of these Terms. Upon termination, your right to use the Service will immediately cease. You may terminate your account at any time by contacting us. Certain provisions of these Terms will survive termination, including ownership provisions, disclaimers, and limitations of liability.',
  },
  {
    title: '11. Disclaimer of Warranties',
    body: 'THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS. WE DISCLAIM ALL WARRANTIES, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.',
  },
  {
    title: '12. Limitation of Liability',
    body: 'TO THE MAXIMUM EXTENT PERMITTED BY LAW, SKILL SWAP SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM SHALL NOT EXCEED THE AMOUNT YOU HAVE PAID US IN THE TWELVE MONTHS PRECEDING THE CLAIM.',
  },
  {
    title: '13. Governing Law',
    body: 'These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which Skill Swap operates, without regard to its conflict of law provisions. Any disputes arising from these Terms shall be resolved through binding arbitration in accordance with applicable rules.',
  },
  {
    title: '14. Contact',
    body: 'For questions about these Terms and Conditions, please contact us through the Contact Us page in the app or at legal@skillswap.app.',
  },
];

export default function TermsScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Terms & Conditions' }} />
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
          <Scale size={40} color="#FFFFFF" />
          <Text style={styles.headerTitle}>Terms & Conditions</Text>
          <Text style={styles.headerSubtitle}>Last updated: {LAST_UPDATED}</Text>
        </LinearGradient>

        <View style={styles.content}>
          <View style={styles.introCard}>
            <FileText size={24} color={Colors.light.primary} />
            <Text style={styles.introText}>
              Please read these Terms and Conditions carefully before using the Skill Swap
              application. By using our service, you agree to be bound by these terms.
            </Text>
          </View>

          {SECTIONS.map((section, index) => (
            <View key={index} style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionBody}>{section.body}</Text>
            </View>
          ))}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              If you have any questions about these Terms, please contact us at{' '}
              <Text style={styles.footerLink}>legal@skillswap.app</Text>
            </Text>
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
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
  },
  content: {
    marginTop: -20,
    backgroundColor: Colors.light.backgroundSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  introCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.light.primaryLight + '18',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.light.primaryLight + '30',
  },
  introText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: Colors.light.text,
    fontWeight: '500' as const,
  },
  sectionCard: {
    backgroundColor: Colors.light.card,
    padding: 18,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 10,
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.light.textSecondary,
  },
  footer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: Colors.light.backgroundTertiary,
    borderRadius: 16,
  },
  footerText: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  footerLink: {
    color: Colors.light.primary,
    fontWeight: '600' as const,
  },
  bottomSpacer: {
    height: 40,
  },
});

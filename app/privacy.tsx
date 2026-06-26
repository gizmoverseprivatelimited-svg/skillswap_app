import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Shield, Eye, Lock, Database, Share2, Bell } from 'lucide-react-native';
import Colors from '@/constants/colors';

const LAST_UPDATED = 'June 24, 2026';

interface PolicySection {
  title: string;
  body: string;
  icon: React.ReactNode;
}

const SECTIONS: PolicySection[] = [
  {
    title: 'Information We Collect',
    body: 'We collect information you provide directly, including your name, email address, location, profile information, skills, and any content you post (reviews, messages, skill listings). We also collect verification documents you submit, such as identity documents. Additionally, we automatically collect certain information when you use the app, including device information, usage data, and log data.',
    icon: <Database size={20} color={Colors.light.primary} />,
  },
  {
    title: 'How We Use Your Information',
    body: 'We use your information to: (a) provide and maintain the Service; (b) match you with compatible skill swap partners; (c) verify user identities and maintain platform safety; (d) process transactions and manage credits; (e) send you notifications about swaps, messages, and platform updates; (f) improve and personalize the Service; (g) detect and prevent fraud and abuse; (h) comply with legal obligations.',
    icon: <Eye size={20} color={Colors.light.secondary} />,
  },
  {
    title: 'Information Sharing',
    body: 'We share your profile information and skill listings with other users to facilitate skill matching and swaps. We do not sell your personal information to third parties. We may share information with service providers who help us operate the Service, and with law enforcement when required by law. Your verification documents are stored securely and are only accessible to our admin team for review purposes.',
    icon: <Share2 size={20} color={Colors.light.accent} />,
  },
  {
    title: 'Data Security',
    body: 'We implement industry-standard security measures to protect your information, including encryption in transit and at rest, secure authentication, and access controls. However, no method of electronic storage or transmission is 100% secure. We cannot guarantee absolute security of your data, but we work continuously to protect it.',
    icon: <Lock size={20} color={Colors.light.primary} />,
  },
  {
    title: 'Data Retention',
    body: 'We retain your personal information for as long as your account is active or as needed to provide the Service. If you delete your account, we will delete or anonymize your personal information within 30 days, except where we are required to retain it for legal or regulatory reasons. Reviews and certain transaction records may be retained in anonymized form.',
    icon: <Database size={20} color={Colors.light.textSecondary} />,
  },
  {
    title: 'Your Rights',
    body: 'You have the right to: (a) access and download your personal data; (b) correct inaccurate information; (c) delete your account and associated data; (d) object to certain processing activities; (e) withdraw consent where processing is based on consent. To exercise these rights, contact us through the app or at privacy@skillswap.app.',
    icon: <Shield size={20} color={Colors.light.secondary} />,
  },
  {
    title: 'Cookies and Tracking',
    body: 'We use essential cookies and similar technologies to provide and improve the Service. We do not use tracking technologies for advertising purposes. You can control certain tracking settings through your device settings.',
    icon: <Eye size={20} color={Colors.light.textTertiary} />,
  },
  {
    title: "Children's Privacy",
    body: 'The Service is not directed to children under the age of 16. We do not knowingly collect personal information from children under 16. If we become aware that a child under 16 has provided us with personal information, we will take steps to delete such information promptly.',
    icon: <Shield size={20} color={Colors.light.accent} />,
  },
  {
    title: 'International Data Transfers',
    body: 'Your information may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place for such transfers in accordance with applicable data protection laws.',
    icon: <Share2 size={20} color={Colors.light.primaryLight} />,
  },
  {
    title: 'Changes to This Policy',
    body: 'We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy on this page and updating the "Last Updated" date. Your continued use of the Service after any changes constitutes acceptance of the updated policy.',
    icon: <Bell size={20} color={Colors.light.primary} />,
  },
  {
    title: 'Contact Us',
    body: 'If you have questions or concerns about this Privacy Policy or our data practices, please contact us at privacy@skillswap.app or through the Contact Us page in the app.',
    icon: <Shield size={20} color={Colors.light.textSecondary} />,
  },
];

export default function PrivacyScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Privacy Policy' }} />
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
          <Shield size={40} color="#FFFFFF" />
          <Text style={styles.headerTitle}>Privacy Policy</Text>
          <Text style={styles.headerSubtitle}>Last updated: {LAST_UPDATED}</Text>
        </LinearGradient>

        <View style={styles.content}>
          <View style={styles.introCard}>
            <Lock size={24} color={Colors.light.primary} />
            <View style={styles.introTextContainer}>
              <Text style={styles.introText}>
                Your privacy is important to us. This policy explains how we collect, use,
                and protect your personal information when you use Skill Swap.
              </Text>
            </View>
          </View>

          {SECTIONS.map((section, index) => (
            <View key={index} style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIcon}>{section.icon}</View>
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
              <Text style={styles.sectionBody}>{section.body}</Text>
            </View>
          ))}

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
  introTextContainer: {
    flex: 1,
  },
  introText: {
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.light.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
    flex: 1,
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.light.textSecondary,
  },
  bottomSpacer: {
    height: 40,
  },
});

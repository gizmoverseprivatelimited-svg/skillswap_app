import { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, MessageSquare, Send, Clock, MapPin } from 'lucide-react-native';
import Colors from '@/constants/colors';

type ContactReason = 'general' | 'bug' | 'feedback' | 'account' | 'safety';

const REASONS: { value: ContactReason; label: string }[] = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'bug', label: 'Report a Bug' },
  { value: 'feedback', label: 'Feedback & Suggestions' },
  { value: 'account', label: 'Account Issues' },
  { value: 'safety', label: 'Safety Concern' },
];

export default function ContactScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const isSmallScreen = windowWidth < 600;
  const styles = useMemo(() => createStyles(isSmallScreen), [isSmallScreen]);
  const [reason, setReason] = useState<ContactReason>('general');
  const [subject, setSubject] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Missing Fields', 'Please fill in both the subject and message fields.');
      return;
    }

    setIsSubmitting(true);

    // Simulate submission
    setTimeout(() => {
      setIsSubmitting(false);
      setSubject('');
      setMessage('');
      setReason('general');
      Alert.alert(
        'Message Sent',
        'Thank you for reaching out! We typically respond within 24 hours.',
      );
    }, 1200);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Contact Us' }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <LinearGradient
            colors={[Colors.light.primary, Colors.light.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <MessageSquare size={40} color="#FFFFFF" />
            <Text style={styles.headerTitle}>Get in Touch</Text>
            <Text style={styles.headerSubtitle}>
              We'd love to hear from you. Send us a message and we'll respond as soon as
              possible.
            </Text>
          </LinearGradient>

          <View style={styles.content}>
            <View style={styles.contactInfoRow}>
              <View style={styles.contactInfoCard}>
                <Mail size={22} color={Colors.light.primary} />
                <Text style={styles.contactInfoLabel}>Email</Text>
                <Text style={styles.contactInfoValue}>support@leteski.com</Text>
              </View>
              <View style={styles.contactInfoCard}>
                <Clock size={22} color={Colors.light.secondary} />
                <Text style={styles.contactInfoLabel}>Response Time</Text>
                <Text style={styles.contactInfoValue}>Within 24 hours</Text>
              </View>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Send a Message</Text>

              <Text style={styles.label}>Reason</Text>
              <View style={styles.reasonRow}>
                {REASONS.map((r) => (
                  <TouchableOpacity
                    key={r.value}
                    style={[
                      styles.reasonChip,
                      reason === r.value && styles.reasonChipActive,
                    ]}
                    onPress={() => setReason(r.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.reasonChipText,
                        reason === r.value && styles.reasonChipTextActive,
                      ]}
                    >
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Subject</Text>
              <TextInput
                style={styles.input}
                placeholder="Brief summary of your message"
                placeholderTextColor={Colors.light.textTertiary}
                value={subject}
                onChangeText={setSubject}
                maxLength={120}
              />

              <Text style={styles.label}>Message</Text>
              <TextInput
                style={[styles.input, styles.messageInput]}
                placeholder="Describe your question or issue in detail..."
                placeholderTextColor={Colors.light.textTertiary}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                maxLength={2000}
              />

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  isSubmitting && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                <Send
                  size={18}
                  color="#FFFFFF"
                  style={{ opacity: isSubmitting ? 0.6 : 1 }}
                />
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.locationCard}>
              <MapPin size={20} color={Colors.light.textSecondary} />
              <Text style={styles.locationText}>
                Leteski is a global community. Wherever you are, we're here to help.
              </Text>
            </View>

            <View style={styles.companyInfoCard}>
              <Text style={styles.companyNameText}>Gizmoverse Private Limited</Text>
              <Text style={styles.companyProductText}>leteski is a product of Gizmoverse Private Limited</Text>
            </View>

            <View style={styles.bottomSpacer} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (isSmallScreen: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  flex: {
    flex: 1,
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
  contactInfoRow: {
    flexDirection: 'row',
    gap: isSmallScreen ? 8 : 12,
    marginBottom: isSmallScreen ? 16 : 24,
  },
  contactInfoCard: {
    flex: 1,
    backgroundColor: Colors.light.card,
    padding: isSmallScreen ? 10 : 16,
    borderRadius: isSmallScreen ? 12 : 16,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  contactInfoLabel: {
    fontSize: isSmallScreen ? 10.5 : 12,
    fontWeight: '600' as const,
    color: Colors.light.textTertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  contactInfoValue: {
    fontSize: isSmallScreen ? 11.5 : 13,
    fontWeight: '600' as const,
    color: Colors.light.text,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: Colors.light.card,
    padding: isSmallScreen ? 14 : 20,
    borderRadius: isSmallScreen ? 14 : 20,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  formTitle: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: isSmallScreen ? 12 : 18,
  },
  label: {
    fontSize: isSmallScreen ? 11.5 : 13,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginBottom: 6,
    marginTop: 4,
  },
  reasonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: isSmallScreen ? 6 : 8,
    marginBottom: isSmallScreen ? 10 : 16,
  },
  reasonChip: {
    paddingHorizontal: isSmallScreen ? 10 : 14,
    paddingVertical: isSmallScreen ? 6 : 8,
    borderRadius: isSmallScreen ? 16 : 20,
    backgroundColor: Colors.light.backgroundTertiary,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  reasonChipActive: {
    backgroundColor: Colors.light.primaryLight + '20',
    borderColor: Colors.light.primary,
  },
  reasonChipText: {
    fontSize: isSmallScreen ? 11.5 : 13,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  reasonChipTextActive: {
    color: Colors.light.primary,
  },
  input: {
    backgroundColor: Colors.light.backgroundTertiary,
    paddingHorizontal: isSmallScreen ? 12 : 16,
    paddingVertical: isSmallScreen ? 9 : 14,
    borderRadius: isSmallScreen ? 10 : 14,
    fontSize: isSmallScreen ? 13.5 : 15,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    marginBottom: isSmallScreen ? 10 : 16,
  },
  messageInput: {
    height: isSmallScreen ? 100 : 140,
    paddingTop: isSmallScreen ? 10 : 14,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.light.primary,
    paddingVertical: isSmallScreen ? 12 : 16,
    borderRadius: isSmallScreen ? 12 : 16,
    marginTop: 4,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: isSmallScreen ? 13.5 : 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: isSmallScreen ? 16 : 24,
    padding: isSmallScreen ? 12 : 16,
    backgroundColor: Colors.light.backgroundTertiary,
    borderRadius: isSmallScreen ? 12 : 16,
    gap: 10,
  },
  locationText: {
    flex: 1,
    fontSize: isSmallScreen ? 11.5 : 13,
    lineHeight: isSmallScreen ? 16 : 20,
    color: Colors.light.textSecondary,
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

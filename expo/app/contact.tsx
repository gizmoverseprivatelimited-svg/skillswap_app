import { useState } from 'react';
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
                <Text style={styles.contactInfoValue}>support@skillswap.app</Text>
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
                Skill Swap is a global community. Wherever you are, we're here to help.
              </Text>
            </View>

            <View style={styles.bottomSpacer} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
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
    paddingTop: 40,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 22,
  },
  content: {
    marginTop: -20,
    backgroundColor: Colors.light.backgroundSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  contactInfoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  contactInfoCard: {
    flex: 1,
    backgroundColor: Colors.light.card,
    padding: 16,
    borderRadius: 16,
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
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.textTertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  contactInfoValue: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.text,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: Colors.light.card,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginBottom: 8,
    marginTop: 4,
  },
  reasonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  reasonChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.light.backgroundTertiary,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  reasonChipActive: {
    backgroundColor: Colors.light.primaryLight + '20',
    borderColor: Colors.light.primary,
  },
  reasonChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  reasonChipTextActive: {
    color: Colors.light.primary,
  },
  input: {
    backgroundColor: Colors.light.backgroundTertiary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    fontSize: 15,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    marginBottom: 16,
  },
  messageInput: {
    height: 140,
    paddingTop: 14,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 16,
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
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    padding: 16,
    backgroundColor: Colors.light.backgroundTertiary,
    borderRadius: 16,
    gap: 10,
  },
  locationText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.light.textSecondary,
  },
  bottomSpacer: {
    height: 40,
  },
});

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Sparkles,
  Send,
  ArrowLeft,
  Bot,
  User as UserIcon,
  Lightbulb,
  Compass,
  GraduationCap,
  Repeat,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { useCurrentUser } from '@/providers/current-user';
import { chatCompletionStream, type ChatMessage } from '@/lib/ai';

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

const SUGGESTIONS = [
  { icon: Compass, label: 'Find a skill to learn', prompt: 'I want to learn something new. What skills are popular on leteski?' },
  { icon: GraduationCap, label: 'Tips for teaching', prompt: 'How can I be a better teacher on leteski?' },
  { icon: Lightbulb, label: 'Skill swap ideas', prompt: 'What are some creative skill swap ideas I could try?' },
  { icon: Repeat, label: 'How do swaps work?', prompt: 'How do skill swaps work on leteski? Explain the process.' },
];

const SYSTEM_PROMPT: ChatMessage[] = [
  {
    role: 'system',
    content: `You are leteski AI, a friendly assistant inside the leteski skill-exchange app. You help users discover skills, find matches, understand how swaps and classes work, and give teaching/learning advice. Keep replies concise (2-4 sentences), warm, and actionable. Use the user's first name when known. Do not use markdown formatting.`,
  },
];

export default function AIAssistantScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentUser } = useCurrentUser();
  const scrollRef = useRef<ScrollView>(null);

  const firstName = currentUser?.name ? (currentUser.name.split(' ')[0] ?? currentUser.name) : 'there';

  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hi ${firstName}! I'm your leteski AI assistant. Ask me about finding skills, teaching tips, how swaps work, or anything else. How can I help you today?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const conversationRef = useRef<ChatMessage[]>([
    ...SYSTEM_PROMPT,
    { role: 'assistant', content: `Hi ${firstName}! I'm your leteski AI assistant.` },
  ]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    setInput('');
    setIsStreaming(true);

    const userMsgId = `u-${Date.now()}`;
    const assistantMsgId = `a-${Date.now()}`;

    setMessages(prev => [
      ...prev,
      { id: userMsgId, role: 'user', content: trimmed },
      { id: assistantMsgId, role: 'assistant', content: '', streaming: true },
    ]);

    conversationRef.current.push({ role: 'user', content: trimmed });

    try {
      let accumulated = '';
      await chatCompletionStream(
        conversationRef.current,
        (delta) => {
          accumulated += delta;
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsgId
                ? { ...m, content: accumulated }
                : m,
            ),
          );
        },
        { temperature: 0.7, maxTokens: 600 },
      );

      conversationRef.current.push({ role: 'assistant', content: accumulated });

      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMsgId ? { ...m, streaming: false } : m,
        ),
      );
    } catch (error) {
      console.error('[AI Assistant] Error:', error);
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMsgId
            ? { ...m, content: 'Sorry, I had trouble responding. Please try again.', streaming: false }
            : m,
        ),
      );
    } finally {
      setIsStreaming(false);
    }
  }, [isStreaming]);

  const handleSuggestion = useCallback((prompt: string) => {
    sendMessage(prompt);
  }, [sendMessage]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#6366F1', '#818CF8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.botIconWrap}>
              <Bot size={22} color="#FFF" />
            </View>
            <View>
              <Text style={styles.headerTitle}>leteski AI</Text>
              <Text style={styles.headerSubtitle}>Your skill guide</Text>
            </View>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.messageRow,
                msg.role === 'user' ? styles.messageRowUser : styles.messageRowAI,
              ]}
            >
              {msg.role === 'assistant' && (
                <View style={styles.avatarAI}>
                  <Bot size={16} color="#6366F1" />
                </View>
              )}
              <View
                style={[
                  styles.bubble,
                  msg.role === 'user' ? styles.bubbleUser : styles.bubbleAI,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    msg.role === 'user' ? styles.messageTextUser : styles.messageTextAI,
                  ]}
                >
                  {msg.content}
                  {msg.streaming && !msg.content && (
                    <ActivityIndicator size="small" color={Colors.light.textSecondary} />
                  )}
                  {msg.streaming && msg.content ? '▌' : ''}
                </Text>
              </View>
              {msg.role === 'user' && (
                <View style={styles.avatarUser}>
                  <UserIcon size={16} color="#FFF" />
                </View>
              )}
            </View>
          ))}

          {messages.length <= 1 && (
            <View style={styles.suggestionsWrap}>
              <Text style={styles.suggestionsTitle}>Try asking me...</Text>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity
                  key={s.label}
                  style={styles.suggestionCard}
                  onPress={() => handleSuggestion(s.prompt)}
                  disabled={isStreaming}
                  activeOpacity={0.7}
                >
                  <View style={styles.suggestionIcon}>
                    <s.icon size={18} color={Colors.light.primary} />
                  </View>
                  <Text style={styles.suggestionLabel}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={{ height: 16 }} />
        </ScrollView>

        <View style={[styles.inputWrap, { paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask me anything..."
              placeholderTextColor={Colors.light.textTertiary}
              multiline
              maxLength={500}
              editable={!isStreaming}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!input.trim() || isStreaming) && styles.sendBtnDisabled]}
              onPress={() => sendMessage(input)}
              disabled={!input.trim() || isStreaming}
              activeOpacity={0.7}
            >
              {isStreaming ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Send size={18} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.backgroundSecondary },
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  botIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800' as const, color: '#FFF' },
  headerSubtitle: { fontSize: 12, fontWeight: '500' as const, color: 'rgba(255,255,255,0.8)' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },
  messageRow: { flexDirection: 'row', marginBottom: 14, gap: 8, alignItems: 'flex-end' },
  messageRowUser: { justifyContent: 'flex-end' },
  messageRowAI: { justifyContent: 'flex-start' },
  avatarAI: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center',
  },
  avatarUser: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.light.primary, alignItems: 'center', justifyContent: 'center',
  },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleUser: {
    backgroundColor: Colors.light.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    borderBottomLeftRadius: 4,
  },
  messageText: { fontSize: 15, lineHeight: 21 },
  messageTextUser: { color: '#FFF', fontWeight: '500' as const },
  messageTextAI: { color: Colors.light.text },
  suggestionsWrap: { marginTop: 8, gap: 10 },
  suggestionsTitle: { fontSize: 14, fontWeight: '600' as const, color: Colors.light.textSecondary, marginBottom: 4 },
  suggestionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.light.card,
    paddingHorizontal: 14, paddingVertical: 14,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.light.borderLight,
  },
  suggestionIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center',
  },
  suggestionLabel: { fontSize: 15, fontWeight: '600' as const, color: Colors.light.text, flex: 1 },
  inputWrap: {
    backgroundColor: Colors.light.background,
    borderTopWidth: 1, borderTopColor: Colors.light.borderLight,
    paddingHorizontal: 12, paddingTop: 10,
  },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  input: {
    flex: 1, minHeight: 40, maxHeight: 100,
    backgroundColor: Colors.light.backgroundTertiary,
    borderRadius: 20, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10,
    fontSize: 15, color: Colors.light.text,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.light.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});

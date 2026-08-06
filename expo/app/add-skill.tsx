import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useState } from 'react';
import {
  ChevronDown,
  ImagePlus,
  GraduationCap,
  BookOpen,
  ArrowLeftRight,
  Check,
  ArrowLeft,
  Sparkles,
  IndianRupee,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useCurrentUser } from '@/providers/current-user';
import { SkillCategory, SkillLevel, Skill, PricingModel } from '@/types';
import { formatPrice } from '@/constants/locale';

type AddMode = 'teach' | 'learn' | 'swap';

const MODE_OPTIONS: {
  key: AddMode;
  title: string;
  subtitle: string;
  icon: typeof GraduationCap;
  color: string;
  bg: string;
}[] = [
  {
    key: 'teach',
    title: 'Teach a Skill',
    subtitle: 'Share something you know',
    icon: GraduationCap,
    color: '#10B981',
    bg: '#ECFDF5',
  },
  {
    key: 'learn',
    title: 'Learn a Skill',
    subtitle: 'Find someone to teach you',
    icon: BookOpen,
    color: '#6366F1',
    bg: '#EEF2FF',
  },
  {
    key: 'swap',
    title: 'Skill Swap',
    subtitle: 'Teach & learn together',
    icon: ArrowLeftRight,
    color: '#F59E0B',
    bg: '#FFFBEB',
  },
];

const CATEGORIES: SkillCategory[] = [
  'Arts & Crafts',
  'Technology',
  'Fitness & Wellness',
  'Languages',
  'Music',
  'Cooking',
  'Business',
  'Photography',
  'Classical Arts',
  'Competitive Exams',
];

const LEVELS: SkillLevel[] = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

const PRICING_MODELS: { key: PricingModel; label: string; desc: string }[] = [
  { key: 'free', label: 'Free', desc: 'No charge — pure skill exchange' },
  { key: 'per_session', label: 'Per Session', desc: 'Charge for each class' },
  { key: 'monthly', label: 'Monthly', desc: 'Recurring monthly subscription' },
];

const STOCK_IMAGES: Record<SkillCategory, string> = {
  'Arts & Crafts': 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800',
  'Technology': 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
  'Fitness & Wellness': 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800',
  'Languages': 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800',
  'Music': 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800',
  'Cooking': 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800',
  'Business': 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800',
  'Photography': 'https://images.unsplash.com/photo-1554048612-b6a482bc67e5?w=800',
  'Classical Arts': 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800',
  'Competitive Exams': 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800',
};

export default function AddSkillScreen() {
  const router = useRouter();
  const { currentUser, addSkill, addLearnSkill } = useCurrentUser();

  const [mode, setMode] = useState<AddMode | null>(null);
  const [teachTitle, setTeachTitle] = useState<string>('');
  const [teachCategory, setTeachCategory] = useState<SkillCategory | null>(null);
  const [teachLevel, setTeachLevel] = useState<SkillLevel | null>(null);
  const [teachDescription, setTeachDescription] = useState<string>('');
  const [showTeachCategory, setShowTeachCategory] = useState<boolean>(false);
  const [pricingModel, setPricingModel] = useState<PricingModel>('free');
  const [pricePerSession, setPricePerSession] = useState<string>('');
  const [monthlyPrice, setMonthlyPrice] = useState<string>('');
  const [promoteSkill, setPromoteSkill] = useState<boolean>(false);
  const [promoTagline, setPromoTagline] = useState<string>('');

  const [learnTitle, setLearnTitle] = useState<string>('');
  const [learnCategory, setLearnCategory] = useState<SkillCategory | null>(null);
  const [showLearnCategory, setShowLearnCategory] = useState<boolean>(false);

  const [isSaving, setIsSaving] = useState<boolean>(false);

  const showTeachFields = mode === 'teach' || mode === 'swap';
  const showLearnFields = mode === 'learn' || mode === 'swap';

  const teachImageUrl = teachCategory ? STOCK_IMAGES[teachCategory] : null;

  const validate = (): string | null => {
    if (!mode) return 'Please choose an option to continue.';
    if (showTeachFields) {
      if (!teachTitle.trim()) return 'Please enter the skill you can teach.';
      if (!teachCategory) return 'Please select a category for your teach skill.';
      if (!teachLevel) return 'Please select your proficiency level.';
      if (pricingModel === 'per_session' && (!pricePerSession.trim() || Number(pricePerSession) <= 0))
        return 'Please set a valid per-session price.';
      if (pricingModel === 'monthly' && (!monthlyPrice.trim() || Number(monthlyPrice) <= 0))
        return 'Please set a valid monthly price.';
      if (promoteSkill && !promoTagline.trim())
        return 'Please add a promotional tagline or disable promotion.';
    }
    if (showLearnFields) {
      if (!learnTitle.trim()) return 'Please enter the skill you want to learn.';
    }
    return null;
  };

  const handleSave = async () => {
    const error = validate();
    if (error) {
      Alert.alert('Missing Info', error);
      return;
    }

    setIsSaving(true);
    try {
      const newSkills: Skill[] = [];

      if (showTeachFields && teachTitle.trim() && teachCategory && teachLevel) {
        newSkills.push({
          id: `skill-${Date.now()}`,
          title: teachTitle.trim(),
          category: teachCategory,
          description: teachDescription.trim() || `Teaching ${teachTitle.trim()}`,
          level: teachLevel,
          userId: currentUser.id,
          imageUrl: teachImageUrl ?? STOCK_IMAGES['Technology'],
          pricingModel,
          pricePerSession: pricingModel === 'per_session' ? Number(pricePerSession) : undefined,
          monthlyPrice: pricingModel === 'monthly' ? Number(monthlyPrice) : undefined,
          promoted: promoteSkill,
          promoTagline: promoteSkill ? promoTagline.trim() : undefined,
        });
      }

      if (showLearnFields && learnTitle.trim()) {
        addLearnSkill(learnTitle.trim());
      }

      newSkills.forEach((s) => addSkill(s));

      const summary =
        mode === 'teach'
          ? `"${teachTitle.trim()}" added to your teaching skills.`
          : mode === 'learn'
          ? `"${learnTitle.trim()}" added to your learning list.`
          : `"${teachTitle.trim()}" added to teaching and "${learnTitle.trim()}" added to learning.`;

      Alert.alert('Done!', summary, [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      console.error('[AddSkill] Error:', e);
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const resetFields = () => {
    setMode(null);
    setTeachTitle('');
    setTeachCategory(null);
    setTeachLevel(null);
    setTeachDescription('');
    setShowTeachCategory(false);
    setPricingModel('free');
    setPricePerSession('');
    setMonthlyPrice('');
    setPromoteSkill(false);
    setPromoTagline('');
    setLearnTitle('');
    setLearnCategory(null);
    setShowLearnCategory(false);
  };

  // ---------- Mode selection screen ----------
  if (!mode) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Add New Skill',
            headerStyle: { backgroundColor: Colors.light.background },
            headerTintColor: Colors.light.text,
            headerShadowVisible: false,
          }}
        />
        <View style={styles.container}>
          <ScrollView
            contentContainerStyle={styles.modeScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.modeHeading}>What would you like to do?</Text>
            <Text style={styles.modeSubheading}>
              Choose one option to get started. You can add more anytime.
            </Text>

            <View style={styles.modeOptions}>
              {MODE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={styles.modeCard}
                    onPress={() => setMode(opt.key)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.modeIconWrap, { backgroundColor: opt.bg }]}>
                      <Icon size={28} color={opt.color} />
                    </View>
                    <View style={styles.modeCardContent}>
                      <Text style={styles.modeCardTitle}>{opt.title}</Text>
                      <Text style={styles.modeCardSubtitle}>{opt.subtitle}</Text>
                    </View>
                    <View style={styles.modeArrow}>
                      <ChevronDown
                        size={20}
                        color={Colors.light.textTertiary}
                        style={{ transform: [{ rotate: '-90deg' }] }}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </>
    );
  }

  // ---------- Form screen ----------
  const activeMode = MODE_OPTIONS.find((m) => m.key === mode)!;

  return (
    <>
      <Stack.Screen
        options={{
          title: activeMode.title,
          headerStyle: { backgroundColor: Colors.light.background },
          headerTintColor: Colors.light.text,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              onPress={resetFields}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <ArrowLeft size={22} color={Colors.light.text} />
            </TouchableOpacity>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Mode badge */}
          <View style={[styles.modeBadge, { backgroundColor: activeMode.bg }]}>
            <activeMode.icon size={16} color={activeMode.color} />
            <Text style={[styles.modeBadgeText, { color: activeMode.color }]}>
              {activeMode.title}
            </Text>
          </View>

          {/* TEACH FIELDS */}
          {showTeachFields && (
            <View style={styles.fieldGroup}>
              <Text style={styles.groupTitle}>
                <GraduationCap size={16} color={Colors.light.primary} /> Skill I Can Teach
                <Text style={styles.required}> *</Text>
              </Text>

              {teachImageUrl && (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: teachImageUrl }} style={styles.previewImage} />
                  <View style={styles.previewOverlay}>
                    <Text style={styles.previewLabel}>Preview</Text>
                  </View>
                </View>
              )}

              <View style={styles.section}>
                <Text style={styles.label}>Skill Title <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  value={teachTitle}
                  onChangeText={setTeachTitle}
                  placeholder="e.g. Portrait Photography, Guitar Basics"
                  placeholderTextColor={Colors.light.textTertiary}
                  maxLength={60}
                />
                <Text style={styles.charCount}>{teachTitle.length}/60</Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>Category <Text style={styles.required}>*</Text></Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowTeachCategory(!showTeachCategory)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerButtonText, !teachCategory && styles.pickerPlaceholder]}>
                    {teachCategory ?? 'Select a category'}
                  </Text>
                  <ChevronDown size={20} color={Colors.light.textSecondary} />
                </TouchableOpacity>
                {showTeachCategory && (
                  <View style={styles.optionsGrid}>
                    {CATEGORIES.map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.optionChip, teachCategory === cat && styles.optionChipSelected]}
                        onPress={() => {
                          setTeachCategory(cat);
                          setShowTeachCategory(false);
                        }}
                      >
                        <Text style={[styles.optionChipText, teachCategory === cat && styles.optionChipTextSelected]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>Proficiency Level <Text style={styles.required}>*</Text></Text>
                <View style={styles.levelRow}>
                  {LEVELS.map((lvl) => (
                    <TouchableOpacity
                      key={lvl}
                      style={[styles.levelChip, teachLevel === lvl && styles.levelChipSelected]}
                      onPress={() => setTeachLevel(lvl)}
                    >
                      <Text style={[styles.levelChipText, teachLevel === lvl && styles.levelChipTextSelected]}>
                        {lvl}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>Description (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={teachDescription}
                  onChangeText={setTeachDescription}
                  placeholder="Describe what you can teach, your experience, and what learners can expect..."
                  placeholderTextColor={Colors.light.textTertiary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={300}
                />
                <Text style={styles.charCount}>{teachDescription.length}/300</Text>
              </View>

              {/* PRICING SECTION */}
              <View style={[styles.section, styles.pricingSection]}>
                <View style={styles.pricingHeader}>
                  <IndianRupee size={16} color="#10B981" />
                  <Text style={styles.pricingTitle}>Class Pricing</Text>
                </View>
                <Text style={styles.pricingHint}>Choose how you want to charge for your classes</Text>
                <View style={styles.pricingOptions}>
                  {PRICING_MODELS.map((pm) => (
                    <TouchableOpacity
                      key={pm.key}
                      style={[styles.pricingChip, pricingModel === pm.key && styles.pricingChipSelected]}
                      onPress={() => setPricingModel(pm.key)}
                    >
                      <Text style={[styles.pricingChipLabel, pricingModel === pm.key && styles.pricingChipLabelSelected]}>
                        {pm.label}
                      </Text>
                      <Text style={[styles.pricingChipDesc, pricingModel === pm.key && styles.pricingChipDescSelected]}>
                        {pm.desc}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {pricingModel === 'per_session' && (
                  <View style={styles.priceInputWrap}>
                    <Text style={styles.pricePrefix}>{formatPrice(0).replace('0', '')}</Text>
                    <TextInput
                      style={styles.priceInput}
                      value={pricePerSession}
                      onChangeText={setPricePerSession}
                      placeholder="500"
                      placeholderTextColor={Colors.light.textTertiary}
                      keyboardType="numeric"
                      maxLength={6}
                    />
                    <Text style={styles.priceSuffix}>per session</Text>
                  </View>
                )}

                {pricingModel === 'monthly' && (
                  <View style={styles.priceInputWrap}>
                    <Text style={styles.pricePrefix}>{formatPrice(0).replace('0', '')}</Text>
                    <TextInput
                      style={styles.priceInput}
                      value={monthlyPrice}
                      onChangeText={setMonthlyPrice}
                      placeholder="2000"
                      placeholderTextColor={Colors.light.textTertiary}
                      keyboardType="numeric"
                      maxLength={6}
                    />
                    <Text style={styles.priceSuffix}>per month</Text>
                  </View>
                )}

                {pricingModel !== 'free' && Number(pricePerSession || monthlyPrice || 0) > 0 && (
                  <View style={styles.pricePreview}>
                    <Text style={styles.pricePreviewText}>
                      Learners see: <Text style={styles.pricePreviewValue}>
                        {pricingModel === 'per_session'
                          ? `${formatPrice(Number(pricePerSession))} / session`
                          : `${formatPrice(Number(monthlyPrice))} / month`}
                      </Text>
                    </Text>
                  </View>
                )}
              </View>

              {/* PROMOTION SECTION */}
              <View style={[styles.section, styles.promoteSection]}>
                <TouchableOpacity
                  style={styles.promoteToggleRow}
                  onPress={() => setPromoteSkill(!promoteSkill)}
                  activeOpacity={0.7}
                >
                  <View style={styles.promoteToggleLeft}>
                    <Sparkles size={18} color="#F59E0B" />
                    <View>
                      <Text style={styles.promoteToggleTitle}>Promote this skill</Text>
                      <Text style={styles.promoteToggleDesc}>Get featured & stand out to learners</Text>
                    </View>
                  </View>
                  <View style={[styles.toggleSwitch, promoteSkill && styles.toggleSwitchOn]}>
                    <View style={[styles.toggleKnob, promoteSkill && styles.toggleKnobOn]} />
                  </View>
                </TouchableOpacity>

                {promoteSkill && (
                  <View style={styles.promoTaglineWrap}>
                    <Text style={styles.label}>Promotional Tagline <Text style={styles.required}>*</Text></Text>
                    <TextInput
                      style={styles.input}
                      value={promoTagline}
                      onChangeText={setPromoTagline}
                      placeholder="e.g. 20% off first session! / Free trial week!"
                      placeholderTextColor={Colors.light.textTertiary}
                      maxLength={80}
                    />
                    <Text style={styles.charCount}>{promoTagline.length}/80</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* LEARN FIELDS */}
          {showLearnFields && (
            <View style={[styles.fieldGroup, showTeachFields && styles.fieldGroupSpaced]}>
              <Text style={styles.groupTitle}>
                <BookOpen size={16} color="#6366F1" /> Skill I Want to Learn
                <Text style={styles.required}> *</Text>
              </Text>

              <View style={styles.section}>
                <Text style={styles.label}>Skill Title <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  value={learnTitle}
                  onChangeText={setLearnTitle}
                  placeholder="e.g. Spanish, Watercolor Painting, Python"
                  placeholderTextColor={Colors.light.textTertiary}
                  maxLength={60}
                />
                <Text style={styles.charCount}>{learnTitle.length}/60</Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>Category (Optional)</Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowLearnCategory(!showLearnCategory)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerButtonText, !learnCategory && styles.pickerPlaceholder]}>
                    {learnCategory ?? 'Select a category'}
                  </Text>
                  <ChevronDown size={20} color={Colors.light.textSecondary} />
                </TouchableOpacity>
                {showLearnCategory && (
                  <View style={styles.optionsGrid}>
                    {CATEGORIES.map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.optionChip, learnCategory === cat && styles.optionChipSelected]}
                        onPress={() => {
                          setLearnCategory(cat);
                          setShowLearnCategory(false);
                        }}
                      >
                        <Text style={[styles.optionChipText, learnCategory === cat && styles.optionChipTextSelected]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()} disabled={isSaving}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Check size={18} color="#FFFFFF" />
            <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  // Mode selection
  modeScrollContent: {
    padding: 20,
    paddingTop: 28,
  },
  modeHeading: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  modeSubheading: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    marginBottom: 28,
    lineHeight: 22,
  },
  modeOptions: {
    gap: 14,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    padding: 18,
    gap: 16,
    borderWidth: 1.5,
    borderColor: Colors.light.borderLight,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  modeIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeCardContent: {
    flex: 1,
  },
  modeCardTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 3,
  },
  modeCardSubtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
  },
  modeArrow: {
    paddingHorizontal: 4,
  },
  // Form
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    marginBottom: 20,
  },
  modeBadgeText: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  fieldGroup: {
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  fieldGroupSpaced: {
    marginTop: 20,
  },
  groupTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  required: {
    color: '#EF4444',
    fontWeight: '700' as const,
  },
  previewContainer: {
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 18,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  section: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.light.backgroundTertiary,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: Colors.light.text,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  charCount: {
    fontSize: 11,
    color: Colors.light.textTertiary,
    textAlign: 'right' as const,
    marginTop: 4,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.backgroundTertiary,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    borderRadius: 12,
    padding: 14,
  },
  pickerButtonText: {
    fontSize: 16,
    color: Colors.light.text,
    fontWeight: '500' as const,
  },
  pickerPlaceholder: {
    color: Colors.light.textTertiary,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  optionChip: {
    backgroundColor: Colors.light.backgroundTertiary,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  optionChipSelected: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  optionChipText: {
    fontSize: 13,
    color: Colors.light.text,
    fontWeight: '600' as const,
  },
  optionChipTextSelected: {
    color: '#FFFFFF',
  },
  levelRow: {
    flexDirection: 'row',
    gap: 8,
  },
  levelChip: {
    flex: 1,
    backgroundColor: Colors.light.backgroundTertiary,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  levelChipSelected: {
    backgroundColor: Colors.light.primaryLight,
    borderColor: Colors.light.primary,
  },
  levelChipText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '700' as const,
  },
  levelChipTextSelected: {
    color: '#FFFFFF',
  },
  // Pricing section
  pricingSection: {
    marginTop: 4,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
  },
  pricingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  pricingTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  pricingHint: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 12,
  },
  pricingOptions: {
    gap: 8,
  },
  pricingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundTertiary,
    borderWidth: 1.5,
    borderColor: Colors.light.borderLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  pricingChipSelected: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  pricingChipLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.text,
    minWidth: 90,
  },
  pricingChipLabelSelected: {
    color: '#10B981',
  },
  pricingChipDesc: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    flex: 1,
  },
  pricingChipDescSelected: {
    color: '#10B981',
  },
  priceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundTertiary,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginTop: 10,
  },
  pricePrefix: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  priceInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  priceSuffix: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
  },
  pricePreview: {
    marginTop: 10,
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  pricePreviewText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  pricePreviewValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#10B981',
  },
  // Promotion section
  promoteSection: {
    marginTop: 4,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
  },
  promoteToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  promoteToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  promoteToggleTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 2,
  },
  promoteToggleDesc: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  toggleSwitch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.light.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleSwitchOn: {
    backgroundColor: '#F59E0B',
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleKnobOn: {
    transform: [{ translateX: 18 }],
  },
  promoTaglineWrap: {
    marginTop: 14,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    backgroundColor: Colors.light.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.light.card,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
  },
  saveButton: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.light.primary,
    paddingVertical: 15,
    borderRadius: 14,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});

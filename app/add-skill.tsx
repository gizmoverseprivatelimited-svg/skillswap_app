import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useState } from 'react';
import { ChevronDown, ImagePlus, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useCurrentUser } from '@/providers/current-user';
import { useAlert } from '@/providers/alert';
import { SkillCategory, SkillLevel, Skill } from '@/types';
import url from '@/constants/backurl';
import { getSkillsWithUsers } from '@/mocks/data';

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
  const { currentUser } = useCurrentUser();
  const { showAlert } = useAlert();

  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<SkillCategory | null>(null);
  const [level, setLevel] = useState<SkillLevel | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const imageUrl = category ? STOCK_IMAGES[category] : null;
  let { loadUser } = useCurrentUser()

  const handleSave = async () => {
    if (!title.trim()) {
      showAlert('Missing Info', 'Please enter a skill title.');
      return;
    }
    if (!category) {
      showAlert('Missing Info', 'Please select a category.');
      return;
    }
    if (!level) {
      showAlert('Missing Info', 'Please select your proficiency level.');
      return;
    }

    if (!currentUser?.id) {
      showAlert('Error', 'User not authenticated.');
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        title: title.trim(),
        category,
        description: description.trim() || `Teaching ${title.trim()}`,
        level,
        userId: currentUser.id,
        imageUrl: imageUrl ?? STOCK_IMAGES['Technology'],
      };

      const response = await fetch(`${url}/skills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log(response);


      if (!response.ok) {
        throw new Error('Failed to create skill');
      }

      const createdSkill = await response.json();


      console.log('[AddSkill] Skill saved to DB:', createdSkill);
      getSkillsWithUsers()
      loadUser()
      showAlert(
        'Skill Added',
        `"${payload.title}" has been added to your profile!`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('[AddSkill] Error:', error);
      showAlert('Error', 'Failed to add skill. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Add Skill to Teach',
          headerStyle: { backgroundColor: Colors.light.background },
          headerTintColor: Colors.light.text,
          headerShadowVisible: false,
        }}
      />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {imageUrl && (
            <View style={styles.previewContainer}>
              <Image source={{ uri: imageUrl }} style={styles.previewImage} />
              <View style={styles.previewOverlay}>
                <Text style={styles.previewLabel}>Preview</Text>
              </View>
            </View>
          )}

          {!imageUrl && (
            <View style={styles.placeholderImage}>
              <ImagePlus size={40} color={Colors.light.textTertiary} />
              <Text style={styles.placeholderText}>
                Image auto-selected by category
              </Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.label}>Skill Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Portrait Photography, Guitar Basics"
              placeholderTextColor={Colors.light.textTertiary}
              maxLength={60}
            />
            <Text style={styles.charCount}>{title.length}/60</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Category</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowCategoryPicker(!showCategoryPicker)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.pickerButtonText,
                  !category && styles.pickerPlaceholder,
                ]}
              >
                {category ?? 'Select a category'}
              </Text>
              <ChevronDown size={20} color={Colors.light.textSecondary} />
            </TouchableOpacity>
            {showCategoryPicker && (
              <View style={styles.optionsGrid}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.optionChip,
                      category === cat && styles.optionChipSelected,
                    ]}
                    onPress={() => {
                      setCategory(cat);
                      setShowCategoryPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        category === cat && styles.optionChipTextSelected,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Your Proficiency Level</Text>
            <View style={styles.levelRow}>
              {LEVELS.map((lvl) => (
                <TouchableOpacity
                  key={lvl}
                  style={[
                    styles.levelChip,
                    level === lvl && styles.levelChipSelected,
                  ]}
                  onPress={() => setLevel(lvl)}
                >
                  <Text
                    style={[
                      styles.levelChipText,
                      level === lvl && styles.levelChipTextSelected,
                    ]}
                  >
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
              value={description}
              onChangeText={setDescription}
              placeholder="Describe what you can teach, your experience, and what learners can expect..."
              placeholderTextColor={Colors.light.textTertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={300}
            />
            <Text style={styles.charCount}>{description.length}/300</Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            disabled={isSaving}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Adding...' : 'Add Skill'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
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
    padding: 20,
    paddingBottom: 120,
  },
  previewContainer: {
    height: 180,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
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
  placeholderImage: {
    height: 160,
    borderRadius: 20,
    backgroundColor: Colors.light.backgroundTertiary,
    borderWidth: 2,
    borderColor: Colors.light.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 10,
  },
  placeholderText: {
    fontSize: 14,
    color: Colors.light.textTertiary,
    fontWeight: '500' as const,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 10,
  },
  input: {
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    color: Colors.light.text,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 16,
  },
  charCount: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    textAlign: 'right' as const,
    marginTop: 6,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    borderRadius: 14,
    padding: 16,
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
    marginTop: 12,
  },
  optionChip: {
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  optionChipSelected: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  optionChipText: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '600' as const,
  },
  optionChipTextSelected: {
    color: '#FFFFFF',
  },
  levelRow: {
    flexDirection: 'row',
    gap: 10,
  },
  levelChip: {
    flex: 1,
    backgroundColor: Colors.light.card,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  levelChipSelected: {
    backgroundColor: Colors.light.primaryLight,
    borderColor: Colors.light.primary,
  },
  levelChipText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '700' as const,
  },
  levelChipTextSelected: {
    color: '#FFFFFF',
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
    paddingVertical: 16,
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
    flex: 1,
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
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

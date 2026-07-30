import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { X, Plus, Camera, IndianRupee, Sparkles, TrendingUp } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import { useCurrentUser } from '@/providers/current-user';
import { formatPrice } from '@/constants/locale';
import type { PricingModel } from '@/types';
import { trpc } from '@/lib/trpc';

export default function EditProfileScreen() {
  const router = useRouter();
  const { currentUser } = useCurrentUser();

  const [name, setName] = useState<string>(currentUser.name);
  const [bio, setBio] = useState<string>(currentUser.bio);
  const [location, setLocation] = useState<string>(currentUser.location);
  const [avatarUrl, setAvatarUrl] = useState<string>(currentUser.avatarUrl);
  
  const [skillsWanted, setSkillsWanted] = useState<string[]>(currentUser.skillsWanted);
  const [newSkillWanted, setNewSkillWanted] = useState<string>('');
  
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const teachSkills = currentUser.skillsOffered;
  const [skillPricing, setSkillPricing] = useState<Record<string, { model: PricingModel; price: string; promoted: boolean; tagline: string }>>({});

  useEffect(() => {
    const map: Record<string, { model: PricingModel; price: string; promoted: boolean; tagline: string }> = {};
    teachSkills.forEach(s => {
      map[s.id] = {
        model: s.pricingModel ?? 'free',
        price: s.pricingModel === 'per_session' ? String(s.pricePerSession ?? '') : s.pricingModel === 'monthly' ? String(s.monthlyPrice ?? '') : '',
        promoted: s.promoted ?? false,
        tagline: s.promoTagline ?? '',
      };
    });
    setSkillPricing(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teachSkills.length]);

  const updateSkillPricing = (skillId: string, field: 'model' | 'price' | 'promoted' | 'tagline', value: string | boolean) => {
    setSkillPricing(prev => ({
      ...prev,
      [skillId]: { ...prev[skillId], [field]: value },
    }));
  };

  const handleAddSkillWanted = () => {
    if (newSkillWanted.trim()) {
      setSkillsWanted([...skillsWanted, newSkillWanted.trim()]);
      setNewSkillWanted('');
    }
  };

  const handleRemoveSkillWanted = (index: number) => {
    setSkillsWanted(skillsWanted.filter((_, i) => i !== index));
  };

  const updateProfileMutation = trpc.profile.update.useMutation();

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    // Apply pricing changes to currentUser's skills
    teachSkills.forEach(s => {
      const p = skillPricing[s.id];
      if (!p) return;
      s.pricingModel = p.model;
      s.pricePerSession = p.model === 'per_session' ? Number(p.price) || 0 : undefined;
      s.monthlyPrice = p.model === 'monthly' ? Number(p.price) || 0 : undefined;
      s.promoted = p.promoted;
      s.promoTagline = p.promoted ? p.tagline.trim() || undefined : undefined;
    });

    setIsSaving(true);
    
    try {
      const result = await updateProfileMutation.mutateAsync({
        name: name.trim(),
        bio: bio.trim(),
        location: location.trim(),
        skillsWanted,
        avatarUrl,
      });
      
      console.log('[EditProfile] Profile updated:', result);

      Alert.alert('Success', 'Profile updated successfully!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('[EditProfile] Save error:', error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is required to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        console.log('[EditProfile] Photo taken:', result.assets[0].uri);
        setAvatarUrl(result.assets[0].uri);
      }
    } catch (error) {
      console.error('[EditProfile] Camera error:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const handleChooseFromLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Photo library permission is required to choose photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        console.log('[EditProfile] Photo selected:', result.assets[0].uri);
        setAvatarUrl(result.assets[0].uri);
      }
    } catch (error) {
      console.error('[EditProfile] Image picker error:', error);
      Alert.alert('Error', 'Failed to select photo. Please try again.');
    }
  };

  const handleChangeAvatar = () => {
    Alert.alert(
      'Change Avatar',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: handleTakePhoto,
        },
        {
          text: 'Choose from Library',
          onPress: handleChooseFromLibrary,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Edit Profile',
          headerStyle: {
            backgroundColor: Colors.light.background,
          },
          headerTintColor: Colors.light.text,
          headerShadowVisible: false,
        }}
      />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.avatarSection}>
            <View style={styles.avatarContainer}>
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, { backgroundColor: Colors.light.backgroundTertiary }]} />
              )}
              <TouchableOpacity
                style={styles.changeAvatarButton}
                onPress={handleChangeAvatar}
              >
                <Camera size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.avatarHint}>Tap to change photo</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor={Colors.light.textTertiary}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="Enter your location"
              placeholderTextColor={Colors.light.textTertiary}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell others about yourself"
              placeholderTextColor={Colors.light.textTertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Skills I Want to Learn</Text>
            <View style={styles.skillsWantedList}>
              {skillsWanted.map((skill, index) => (
                <View key={index} style={styles.skillChip}>
                  <Text style={styles.skillChipText}>{skill}</Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveSkillWanted(index)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={16} color={Colors.light.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <View style={styles.addSkillRow}>
              <TextInput
                style={styles.addSkillInput}
                value={newSkillWanted}
                onChangeText={setNewSkillWanted}
                placeholder="Add a skill"
                placeholderTextColor={Colors.light.textTertiary}
                onSubmitEditing={handleAddSkillWanted}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={styles.addSkillButton}
                onPress={handleAddSkillWanted}
              >
                <Plus size={20} color={Colors.light.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* TEACHER PRICING & PROMOTION SECTION */}
          {teachSkills.length > 0 && (
            <View style={styles.section}>
              <View style={styles.pricingSectionHeader}>
                <TrendingUp size={18} color="#10B981" />
                <Text style={styles.pricingSectionTitle}>My Teaching Prices & Promotion</Text>
              </View>
              <Text style={styles.pricingSectionHint}>
                Set your class prices and promote your skills to attract more learners.
              </Text>

              {teachSkills.map((skill) => {
                const p = skillPricing[skill.id];
                if (!p) return null;
                return (
                  <View key={skill.id} style={styles.skillPricingCard}>
                    <Text style={styles.skillPricingTitle}>{skill.title}</Text>

                    {/* Pricing model selector */}
                    <View style={styles.pricingModelRow}>
                      {(['free', 'per_session', 'monthly'] as PricingModel[]).map((m) => (
                        <TouchableOpacity
                          key={m}
                          style={[styles.pricingModelChip, p.model === m && styles.pricingModelChipSelected]}
                          onPress={() => updateSkillPricing(skill.id, 'model', m)}
                        >
                          <Text style={[styles.pricingModelChipText, p.model === m && styles.pricingModelChipTextSelected]}>
                            {m === 'free' ? 'Free' : m === 'per_session' ? 'Per Session' : 'Monthly'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Price input */}
                    {p.model !== 'free' && (
                      <View style={styles.priceInputRow}>
                        <Text style={styles.priceInputPrefix}>₹</Text>
                        <TextInput
                          style={styles.priceInputField}
                          value={p.price}
                          onChangeText={(v) => updateSkillPricing(skill.id, 'price', v)}
                          placeholder={p.model === 'per_session' ? '500' : '2000'}
                          placeholderTextColor={Colors.light.textTertiary}
                          keyboardType="numeric"
                          maxLength={6}
                        />
                        <Text style={styles.priceInputSuffix}>
                          {p.model === 'per_session' ? '/ session' : '/ month'}
                        </Text>
                      </View>
                    )}

                    {/* Promotion toggle */}
                    <TouchableOpacity
                      style={styles.promoteRow}
                      onPress={() => updateSkillPricing(skill.id, 'promoted', !p.promoted)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.promoteLeft}>
                        <Sparkles size={16} color="#F59E0B" />
                        <Text style={styles.promoteLabel}>Promote this skill</Text>
                      </View>
                      <View style={[styles.toggleSwitch, p.promoted && styles.toggleSwitchOn]}>
                        <View style={[styles.toggleKnob, p.promoted && styles.toggleKnobOn]} />
                      </View>
                    </TouchableOpacity>

                    {/* Promo tagline */}
                    {p.promoted && (
                      <TextInput
                        style={[styles.input, styles.promoInput]}
                        value={p.tagline}
                        onChangeText={(v) => updateSkillPricing(skill.id, 'tagline', v)}
                        placeholder="e.g. 20% off first session! Free trial week!"
                        placeholderTextColor={Colors.light.textTertiary}
                        maxLength={80}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Note: To edit your skills offered, please manage them individually from your profile.
            </Text>
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
              {isSaving ? 'Saving...' : 'Save Changes'}
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
    paddingBottom: 100,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: Colors.light.primary,
  },
  changeAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.light.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.light.backgroundSecondary,
  },
  avatarHint: {
    fontSize: 13,
    color: Colors.light.textSecondary,
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
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.light.text,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 16,
  },
  skillsWantedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  skillChipText: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '600' as const,
  },
  addSkillRow: {
    flexDirection: 'row',
    gap: 10,
  },
  addSkillInput: {
    flex: 1,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.light.text,
  },
  addSkillButton: {
    width: 48,
    height: 48,
    backgroundColor: Colors.light.backgroundTertiary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  infoBox: {
    backgroundColor: Colors.light.primaryLight,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.primary,
  },
  infoText: {
    fontSize: 13,
    color: Colors.light.primary,
    lineHeight: 20,
  },
  // Pricing & promotion section
  pricingSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  pricingSectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  pricingSectionHint: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  skillPricingCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    marginBottom: 14,
  },
  skillPricingTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 14,
  },
  pricingModelRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  pricingModelChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.light.backgroundTertiary,
    borderWidth: 1.5,
    borderColor: Colors.light.borderLight,
  },
  pricingModelChipSelected: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  pricingModelChipText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
  },
  pricingModelChipTextSelected: {
    color: '#10B981',
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundTertiary,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  priceInputPrefix: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  priceInputField: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  priceInputSuffix: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
  },
  promoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  promoteLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  promoteLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
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
  promoInput: {
    marginTop: 12,
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
    borderRadius: 12,
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
    borderRadius: 12,
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

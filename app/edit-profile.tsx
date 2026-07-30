import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { X, Plus, Camera, MapPin, IndianRupee, Sparkles, TrendingUp } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker'
import Colors from '@/constants/colors';
import { useCurrentUser } from '@/providers/current-user';
import { useAlert } from '@/providers/alert';
import url from '@/constants/backurl';
import { resolveImageUrl } from '@/lib/resolveImageUrl';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatPrice } from '@/constants/locale';
import type { PricingModel } from '@/types';

export default function EditProfileScreen() {
  const router = useRouter();
  const { currentUser, loadUser } = useCurrentUser();
  const { showAlert } = useAlert();

  const [name, setName] = useState<string>(currentUser?.name || "");
  const [bio, setBio] = useState<string>(currentUser?.bio || "");
  const [location, setLocation] = useState<string>(currentUser?.location || "");
  const [avatarUrl, setAvatarUrl] = useState<string>(currentUser?.avatarUrl || "");

  const [skillsWanted, setSkillsWanted] = useState<string[]>(
    (currentUser?.skillsWanted || []).filter((s) => s.trim() !== '')
  );
  const [newSkillWanted, setNewSkillWanted] = useState<string>('');

  const isInitialized = useRef(false);

  useEffect(() => {
    if (currentUser && !isInitialized.current) {
      isInitialized.current = true;
      setName(currentUser.name || '');
      setBio(currentUser.bio || '');
      setLocation(currentUser.location || '');
      setAvatarUrl(currentUser.avatarUrl || '');
      setSkillsWanted((currentUser.skillsWanted || []).filter((s) => s.trim() !== ''));
    }
  }, [currentUser]);

  const teachSkills = currentUser?.skillsOffered || [];
  const [skillPricing, setSkillPricing] = useState<Record<string, { model: PricingModel; price: string; promoted: boolean; tagline: string }>>({});

  useEffect(() => {
    const map: Record<string, { model: PricingModel; price: string; promoted: boolean; tagline: string }> = {};
    teachSkills.forEach((s, idx) => {
      const key = s.id || s._id || `skill-${idx}`;
      map[key] = {
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

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  const handleGetLocation = async () => {
    setIsLocating(true);
    try {
      console.log('[Location] Requesting location permission...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert(
          'Permission Denied',
          'Permission to access location was denied. Please enter your location manually.'
        );
        return;
      }

      console.log('[Location] Fetching current position...');
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      console.log('[Location] Reverse geocoding position...');
      let formattedLocation = '';

      if (Platform.OS === 'web') {
        // Fallback for Web using OpenStreetMap Nominatim reverse geocoder
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${currentLocation.coords.latitude}&lon=${currentLocation.coords.longitude}`,
          {
            headers: {
              'User-Agent': 'SkillSwapCommunityApp',
            },
          }
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data.address) {
            const addr = data.address;
            const city = addr.city || addr.town || addr.village || addr.suburb || addr.municipality || '';
            const state = addr.state || '';
            const country = addr.country || '';
            const parts = [city, state, country].filter((p) => p.trim() !== '');
            formattedLocation = parts.join(', ');
          }
        }
      } else {
        const geocoded = await Location.reverseGeocodeAsync({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });

        if (geocoded && geocoded.length > 0) {
          const address = geocoded[0];
          console.log('[Location] Geocode address result:', address);
          
          // Extract city, state, country
          const city = address.city || address.subregion || address.district || '';
          const state = address.region || '';
          const country = address.country || '';

          const parts = [city, state, country].filter((p) => p.trim() !== '');
          formattedLocation = parts.join(', ');
        }
      }

      if (formattedLocation) {
        setLocation(formattedLocation);
      } else {
        showAlert('Location Error', 'Could not resolve city/state from current location.');
      }
    } catch (error: any) {
      console.error('[Location] Error getting location:', error);
      showAlert(
        'Location Error',
        error.message || 'An error occurred while fetching your location. Please type manually.'
      );
    } finally {
      setIsLocating(false);
    }
  };

  const handleAddSkillWanted = () => {
    const trimmed = newSkillWanted.trim();
    if (trimmed) {
      const currentList = skillsWanted.filter((s) => s.trim() !== '');
      if (!currentList.includes(trimmed)) {
        setSkillsWanted([...currentList, trimmed]);
      }
      setNewSkillWanted('');
    }
  };

  const handleRemoveSkillWanted = (index: number) => {
    setSkillsWanted(skillsWanted.filter((_, i) => i !== index));
  };



  // const handleSave = async () => {
  //   if (!name.trim()) {
  //     Alert.alert('Error', 'Name is required');
  //     return;
  //   }

  //   setIsSaving(true);

  //   try {
  //     const result = await updateProfileMutation.mutateAsync({
  //       name: name.trim(),
  //       bio: bio.trim(),
  //       location: location.trim(),
  //       skillsWanted,
  //       avatarUrl,
  //     });

  //     console.log('[EditProfile] Profile updated:', result);

  //     Alert.alert('Success', 'Profile updated successfully!', [
  //       {
  //         text: 'OK',
  //         onPress: () => router.back(),
  //       },
  //     ]);
  //   } catch (error) {
  //     console.error('[EditProfile] Save error:', error);
  //     Alert.alert('Error', 'Failed to save profile. Please try again.');
  //   } finally {
  //     setIsSaving(false);
  //   }
  // };

  // const handleSave = async () => {
  //   if (!name.trim()) {
  //     Alert.alert('Error', 'Name is required');
  //     return;
  //   }

  //   setIsSaving(true);

  //   try {
  //     const response = await fetch(
  //       `${url}/users/me`,
  //       {
  //         method: 'PUT',
  //         headers: {
  //           'Content-Type': 'application/json',
  //           // Authorization: `Bearer ${authToken}`, // JWT token
  //         },
  //         body: JSON.stringify({
  //           name: name.trim(),
  //           bio: bio.trim(),
  //           location: location.trim(),
  //           skillsWanted,
  //           avatarUrl,
  //           userId: currentUser?.id
  //         }),
  //       }
  //     );

  //     if (!response.ok) {
  //       const error = await response.json();
  //       throw new Error(error.message || 'Update failed');
  //     }

  //     const result = await response.json();
  //     console.log('[EditProfile] Profile updated:', result);

  //     loadUser()
  //     Alert.alert('Success', 'Profile updated successfully!', [
  //       {
  //         text: 'OK',
  //         onPress: () => router.back(),
  //       },
  //     ]);
  //   } catch (error) {
  //     console.error('[EditProfile] Save error:', error);
  //     Alert.alert('Error', 'Failed to save profile. Please try again.');
  //   } finally {
  //     setIsSaving(false);
  //   }
  // };


  const handleSave = async () => {
    if (!name.trim()) {
      showAlert('Error', 'Name is required');
      return;
    }

    // Apply pricing changes to currentUser's skills
    teachSkills.forEach((s, idx) => {
      const key = s.id || s._id || `skill-${idx}`;
      const p = skillPricing[key];
      if (!p) return;
      s.pricingModel = p.model;
      s.pricePerSession = p.model === 'per_session' ? Number(p.price) || 0 : undefined;
      s.monthlyPrice = p.model === 'monthly' ? Number(p.price) || 0 : undefined;
      s.promoted = p.promoted;
      s.promoTagline = p.promoted ? p.tagline.trim() || undefined : undefined;
    });

    setIsSaving(true);

    const cleanedSkillsWanted = skillsWanted.map((s) => s.trim()).filter(Boolean);

    if (currentUser?.id === '1') {
      try {
        const guestData = {
          name: name.trim(),
          bio: bio.trim(),
          location: location.trim(),
          avatarUrl: avatarUrl,
          skillsWanted: cleanedSkillsWanted,
        };
        await AsyncStorage.setItem('@skillswap/guest_user_profile', JSON.stringify(guestData));
        await loadUser();
        
        showAlert('Success', 'Profile updated successfully', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } catch (error) {
        console.error('[EditProfile] Guest Save error:', error);
        showAlert('Error', 'Failed to save profile. Please try again.');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    try {
      const formData = new FormData();

      formData.append('userId', currentUser?.id || '');
      formData.append('name', name.trim());
      formData.append('bio', bio.trim());
      formData.append('location', location.trim());
      formData.append('skillsWanted', JSON.stringify(cleanedSkillsWanted));
      formData.append('skillsOffered', JSON.stringify(teachSkills));

      if (avatarUrl && avatarUrl !== currentUser?.avatarUrl) {
        if (Platform.OS === 'web') {
          const blob = await fetch(avatarUrl).then(res => res.blob());
          const file = new File(
            [blob],
            `avatar-${Date.now()}.jpg`,
            { type: blob.type }
          );
          formData.append('avatar', file);
        } else if (avatarUrl.startsWith('file://')) {
          const filename = avatarUrl.split('/').pop()!;
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : `image`;

          formData.append('avatar', {
            uri: avatarUrl,
            name: filename,
            type,
          } as any);
        }
      }

      let result;
      if (Platform.OS === 'web') {
        const response = await fetch(`${url}/users/me`, {
          method: 'PUT',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Profile update failed');
        }

        result = await response.json();
      } else {
        const xhrUpload = () => {
          return new Promise<any>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', `${url}/users/me`);

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  const res = JSON.parse(xhr.responseText);
                  resolve(res);
                } catch (e) {
                  reject(new Error('Failed to parse upload response'));
                }
              } else {
                reject(new Error(`Upload failed with status: ${xhr.status}`));
              }
            };

            xhr.onerror = () => {
              reject(new Error('Network error during upload'));
            };

            xhr.send(formData);
          });
        };
        result = await xhrUpload();
      }

      console.log('[EditProfile] Updated:', result);
      await loadUser(true);


      showAlert('Success', 'Profile updated successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('[EditProfile] Save error:', error);
      showAlert('Error', 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };


  const handleChangeAvatar = () => {
    showAlert(
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

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        showAlert('Permission Required', 'Camera permission is required to take photos.');
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
      showAlert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const handleChooseFromLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        showAlert('Permission Required', 'Photo library permission is required to choose photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });


      if (!result.canceled && result.assets[0]) {
        console.log(result);
        console.log('[EditProfile] Photo selected:', result.assets[0].uri);
        setAvatarUrl(result.assets[0].uri);
      }
    } catch (error) {
      console.error('[EditProfile] Image picker error:', error);
      showAlert('Error', 'Failed to select photo. Please try again.');
    }
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
                  source={{ uri: resolveImageUrl(avatarUrl) }}
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
            <TouchableOpacity
              style={[styles.getLocationButton, isLocating && styles.getLocationButtonDisabled]}
              onPress={handleGetLocation}
              disabled={isLocating}
            >
              {isLocating ? (
                <ActivityIndicator size="small" color="#FF6B9D" />
              ) : (
                <>
                  <MapPin size={16} color="#FF6B9D" style={{ marginRight: 6 }} />
                  <Text style={styles.getLocationButtonText}>Use Current Location</Text>
                </>
              )}
            </TouchableOpacity>
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

              {teachSkills.map((skill, index) => {
                const skillKey = skill.id || skill._id || `skill-${index}`;
                const p = skillPricing[skillKey];
                if (!p) return null;
                return (
                  <View key={`pricing-${skillKey}-${index}`} style={styles.skillPricingCard}>
                    <Text style={styles.skillPricingTitle}>{skill.title}</Text>

                    {/* Pricing model selector */}
                    <View style={styles.pricingModelRow}>
                      {(['free', 'per_session', 'monthly'] as PricingModel[]).map((m) => (
                        <TouchableOpacity
                          key={m}
                          style={[styles.pricingModelChip, p.model === m && styles.pricingModelChipSelected]}
                          onPress={() => updateSkillPricing(skillKey, 'model', m)}
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
                          onChangeText={(v) => updateSkillPricing(skillKey, 'price', v)}
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
                      onPress={() => updateSkillPricing(skillKey, 'promoted', !p.promoted)}
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
                        onChangeText={(v) => updateSkillPricing(skillKey, 'tagline', v)}
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
  getLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0F4',
    borderWidth: 1,
    borderColor: '#FFD1DF',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
  },
  getLocationButtonDisabled: {
    opacity: 0.6,
  },
  getLocationButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FF6B9D',
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

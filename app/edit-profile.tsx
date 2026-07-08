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
import { useState } from 'react';
import { X, Plus, Camera, MapPin } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker'
import Colors from '@/constants/colors';
import { useCurrentUser } from '@/providers/current-user';
import { useAlert } from '@/providers/alert';
import url from '@/constants/backurl';
import { resolveImageUrl } from '@/lib/resolveImageUrl';
import * as Location from 'expo-location';

export default function EditProfileScreen() {
  const router = useRouter();
  const { currentUser, loadUser } = useCurrentUser();
  const { showAlert } = useAlert();

  const [name, setName] = useState<string>(currentUser?.name || "");
  const [bio, setBio] = useState<string>(currentUser?.bio || "");
  const [location, setLocation] = useState<string>(currentUser?.location || "");
  const [avatarUrl, setAvatarUrl] = useState<string>(currentUser?.avatarUrl || "");

  const [skillsWanted, setSkillsWanted] = useState<string[]>(currentUser?.skillsWanted || [""]);
  const [newSkillWanted, setNewSkillWanted] = useState<string>('');

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
    if (newSkillWanted.trim()) {
      setSkillsWanted([...skillsWanted, newSkillWanted.trim()]);
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

    setIsSaving(true);

    try {
      const formData = new FormData();

      formData.append('userId', currentUser?.id || '');
      formData.append('name', name.trim());
      formData.append('bio', bio.trim());
      formData.append('location', location.trim());
      formData.append('skillsWanted', JSON.stringify(skillsWanted));

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
      loadUser();


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

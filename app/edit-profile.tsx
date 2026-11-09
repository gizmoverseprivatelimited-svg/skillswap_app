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
  Alert,
  Linking,
  PermissionsAndroid,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Camera,
  MapPin,
  IndianRupee,
  Sparkles,
  TrendingUp,
  GraduationCap,
  Award,
  Languages,
  BadgeCheck,
  Briefcase,
  Upload,
  FileCheck2,
  Clock,
  XCircle,
  Users,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import { useCurrentUser } from '@/providers/current-user';
import { useAlert } from '@/providers/alert';
import url from '@/constants/backurl';
import { resolveImageUrl } from '@/lib/resolveImageUrl';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatPrice } from '@/constants/locale';
import { requestCameraPermissionsSafely, requestMediaLibraryPermissionsSafely } from '@/lib/imagePickerPermissions';
import type { PricingModel, TeacherProfileData, TeacherCertification, CareerEntry } from '@/types';

const languageOptions = [
  'English', 'Hindi', 'Bengali', 'Tamil', 'Telugu', 'Marathi',
  'Kannada', 'Malayalam', 'Gujarati', 'Punjabi', 'Urdu', 'Odia',
];
const qualificationOptions = [
  "High School", "Bachelor's Degree", "Master's Degree", 'PhD / Doctorate',
  'B.Ed / D.El.Ed', 'Diploma', 'Professional Certification',
  'Industry Expert', 'Self-taught Expert',
];
const experienceOptions = ['None yet', '1–3 years', '3–5 years', '5–10 years', '10+ years'];

const genId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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

  // Teacher credentials and details
  const [languages, setLanguages] = useState<string[]>(currentUser?.teacherProfile?.languages || []);
  const [customLanguage, setCustomLanguage] = useState<string>('');
  const [qualifications, setQualifications] = useState<string[]>(currentUser?.teacherProfile?.qualifications || []);
  const [isCertified, setIsCertified] = useState<boolean>(currentUser?.teacherProfile?.isCertified || false);
  const [certifications, setCertifications] = useState<TeacherCertification[]>(currentUser?.teacherProfile?.certifications || []);
  const [certTitle, setCertTitle] = useState<string>('');
  const [yearsTeaching, setYearsTeaching] = useState<string>(currentUser?.teacherProfile?.yearsTeaching || '');
  const [privateTuition, setPrivateTuition] = useState<boolean>(currentUser?.teacherProfile?.privateTuition || false);
  const [careerRole, setCareerRole] = useState<string>('');
  const [careerOrg, setCareerOrg] = useState<string>('');
  const [careerYears, setCareerYears] = useState<string>('');
  const [careerHistory, setCareerHistory] = useState<CareerEntry[]>(currentUser?.teacherProfile?.careerHistory || []);

  const isInitialized = useRef(false);

  useEffect(() => {
    if (currentUser && !isInitialized.current) {
      isInitialized.current = true;
      setName(currentUser.name || '');
      setBio(currentUser.bio || '');
      setLocation(currentUser.location || '');
      setAvatarUrl(currentUser.avatarUrl || '');
      setSkillsWanted((currentUser.skillsWanted || []).filter((s) => s.trim() !== ''));
      if (currentUser.teacherProfile) {
        setLanguages(currentUser.teacherProfile.languages || []);
        setQualifications(currentUser.teacherProfile.qualifications || []);
        setIsCertified(currentUser.teacherProfile.isCertified || false);
        setCertifications(currentUser.teacherProfile.certifications || []);
        setYearsTeaching(currentUser.teacherProfile.yearsTeaching || '');
        setPrivateTuition(currentUser.teacherProfile.privateTuition || false);
        setCareerHistory(currentUser.teacherProfile.careerHistory || []);
      }
    }
  }, [currentUser]);

  const toggleLanguage = (lang: string) => {
    if (languages.includes(lang)) {
      setLanguages(languages.filter(l => l !== lang));
    } else {
      setLanguages([...languages, lang]);
    }
  };

  const addCustomLanguage = () => {
    const trimmed = customLanguage.trim();
    if (trimmed.length === 0) return;
    if (!languages.some(l => l.toLowerCase() === trimmed.toLowerCase())) {
      setLanguages([...languages, trimmed]);
    }
    setCustomLanguage('');
  };

  const toggleQualification = (q: string) => {
    if (qualifications.includes(q)) {
      setQualifications(qualifications.filter(item => item !== q));
    } else {
      setQualifications([...qualifications, q]);
    }
  };

  const addCertification = () => {
    const trimmed = certTitle.trim();
    if (trimmed.length === 0) return;
    setCertifications(prev => [...prev, { id: genId('cert'), title: trimmed, status: 'pending' }]);
    setCertTitle('');
  };

  const removeCertification = (id: string) => {
    setCertifications(prev => prev.filter(c => c.id !== id));
  };

  const pickCertificate = (certId: string) => {
    if (Platform.OS === 'web') {
      handlePickCertificateSource('library', certId);
      return;
    }

    showAlert(
      'Upload Certificate',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: () => {
            if (Platform.OS === 'android') {
              setTimeout(() => handlePickCertificateSource('camera', certId), 400);
            } else {
              handlePickCertificateSource('camera', certId);
            }
          },
        },
        {
          text: 'Choose from Library',
          onPress: () => {
            if (Platform.OS === 'android') {
              setTimeout(() => handlePickCertificateSource('library', certId), 400);
            } else {
              handlePickCertificateSource('library', certId);
            }
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handlePickCertificateSource = async (source: 'camera' | 'library', certId: string) => {
    try {
      if (Platform.OS !== 'web') {
        if (source === 'camera') {
          const { status } = await requestCameraPermissionsSafely();
          if (status !== 'granted') return;
        } else {
          const { status } = await requestMediaLibraryPermissionsSafely();
          if (status !== 'granted') return;
        }
      }

      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
            base64: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.7,
            base64: true,
          });

      const asset = result.assets?.[0];
      if (!result.canceled && asset) {
        let uri = asset.uri;
        try {
          const formData = new FormData();
          const filename = asset.fileName || asset.uri.split('/').pop() || 'certificate.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = asset.mimeType || (match ? `image/${match[1]}` : 'image/jpeg');

          if (Platform.OS === 'web') {
            const resp = await fetch(asset.uri);
            const blob = await resp.blob();
            formData.append('certificate', blob, filename);
          } else {
            // @ts-ignore
            formData.append('certificate', { uri: asset.uri, name: filename, type });
          }

          if (Platform.OS === 'web') {
            const uploadRes = await fetch(`${url}/skills/upload-certificate`, {
              method: 'POST',
              body: formData,
            });
            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              if (uploadData.certificateUri) {
                uri = uploadData.certificateUri.startsWith('http') ? uploadData.certificateUri : `${url}${uploadData.certificateUri}`;
              }
            }
          } else {
            const uploadData = await new Promise<any>((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open('POST', `${url}/skills/upload-certificate`);
              xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                  try {
                    resolve(JSON.parse(xhr.responseText));
                  } catch(e) {
                    reject(new Error('Failed to parse response'));
                  }
                } else {
                  reject(new Error(`Upload failed: ${xhr.status}`));
                }
              };
              xhr.onerror = () => reject(new Error('Network error during upload'));
              xhr.send(formData);
            });
            if (uploadData.certificateUri) {
              uri = uploadData.certificateUri.startsWith('http') ? uploadData.certificateUri : `${url}${uploadData.certificateUri}`;
            }
          }
        } catch (upErr) {
          console.warn('[EditProfile] Certificate server upload fallback:', upErr);
        }

        if (asset.base64 && !uri.startsWith('http')) {
          const mime = asset.mimeType || (asset.uri?.endsWith('.png') ? 'image/png' : 'image/jpeg');
          uri = `data:${mime};base64,${asset.base64}`;
        } else if (Platform.OS === 'web' && asset.uri && asset.uri.startsWith('blob:') && !uri.startsWith('http')) {
          try {
            const resp = await fetch(asset.uri);
            const blob = await resp.blob();
            uri = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } catch (e) {
            console.warn('[EditProfile] Failed to convert blob to data URI:', e);
          }
        }
        setCertifications(prev => prev.map(c => (c.id === certId ? { ...c, documentUri: uri, status: 'pending' as const } : c)));
      }
    } catch (error) {
      console.warn('[EditProfile] Document pick failed:', error);
    }
  };

  const addCareerEntry = () => {
    const roleName = careerRole.trim();
    if (roleName.length === 0) return;
    setCareerHistory(prev => [...prev, {
      id: genId('career'),
      role: roleName,
      organization: careerOrg.trim(),
      years: careerYears.trim(),
    }]);
    setCareerRole('');
    setCareerOrg('');
    setCareerYears('');
  };

  const removeCareerEntry = (id: string) => {
    setCareerHistory(prev => prev.filter(e => e.id !== id));
  };

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
              'User-Agent': 'LeteskiCommunityApp',
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
    if (!currentUser || currentUser.id === '1' || (currentUser as any)?.isDemo) {
      showAlert(
        'Login Required 🔒',
        'Please log in or create an account to add learning skills.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/login' as any) },
        ]
      );
      return;
    }
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
    if (!currentUser || currentUser.id === '1' || (currentUser as any)?.isDemo) {
      showAlert(
        'Login Required 🔒',
        'Please log in or create an account to edit learning skills.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/login' as any) },
        ]
      );
      return;
    }
    setSkillsWanted(skillsWanted.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!currentUser || currentUser.id === '1' || (currentUser as any)?.isDemo) {
      showAlert(
        'Login Required 🔒',
        'Please log in or create an account to edit your profile.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/login' as any) },
        ]
      );
      return;
    }
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

    const teacherProfileData: TeacherProfileData = {
      languages,
      qualifications,
      isCertified,
      certifications,
      yearsTeaching,
      careerHistory,
      privateTuition,
    };

    if (currentUser?.id === '1') {
      try {
        const guestData = {
          name: name.trim(),
          bio: bio.trim(),
          location: location.trim(),
          avatarUrl: avatarUrl,
          skillsWanted: cleanedSkillsWanted,
          teacherProfile: teacherProfileData,
        };
        await AsyncStorage.setItem('@leteski/guest_user_profile', JSON.stringify(guestData));
        await AsyncStorage.setItem('@skillswap/onboarding_complete_guest_data', JSON.stringify({
          teacherProfile: teacherProfileData,
        }));
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
      formData.append('teacherProfile', JSON.stringify(teacherProfileData));

      if (avatarUrl && avatarUrl !== currentUser?.avatarUrl) {
        if (Platform.OS === 'web') {
          const blob = await fetch(avatarUrl).then(res => res.blob());
          const file = new File(
            [blob],
            `avatar-${Date.now()}.jpg`,
            { type: blob.type }
          );
          formData.append('avatar', file);
        } else if (!avatarUrl.startsWith('http')) {
          const filename = avatarUrl.split('/').pop() || 'avatar.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : `image/jpeg`;

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
      if (currentUser?.id) {
        try {
          const storedKey = `@skillswap/onboarding_complete_${currentUser.id}_data`;
          const existingStored = await AsyncStorage.getItem(storedKey);
          const parsed = existingStored ? JSON.parse(existingStored) : {};
          parsed.teacherProfile = teacherProfileData;
          await AsyncStorage.setItem(storedKey, JSON.stringify(parsed));
        } catch (e) {
          console.warn('[EditProfile] Failed to update local onboarding cache:', e);
        }
      }
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


  const handleChangeAvatar = async () => {
    if (!currentUser || currentUser.id === '1' || (currentUser as any)?.isDemo) {
      showAlert(
        'Login Required 🔒',
        'Please log in or create an account to change your profile picture.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/login' as any) },
        ]
      );
      return;
    }

    if (Platform.OS === 'web') {
      await handleChooseFromLibrary();
      return;
    }

    showAlert(
      'Change Avatar',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: () => {
            if (Platform.OS === 'android') {
              setTimeout(handleTakePhoto, 400);
            } else {
              handleTakePhoto();
            }
          },
        },
        {
          text: 'Choose from Library',
          onPress: () => {
            if (Platform.OS === 'android') {
              setTimeout(handleChooseFromLibrary, 400);
            } else {
              handleChooseFromLibrary();
            }
          },
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
      const { status } = await requestCameraPermissionsSafely();
      if (status !== 'granted') return;

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setAvatarUrl(result.assets[0].uri);
      }
    } catch (error: any) {
      console.error('[EditProfile] Camera error:', error);
      showAlert('Camera Error', `Failed to take photo: ${error?.message || error}`);
    }
  };

  const handleChooseFromLibrary = async () => {
    try {
      const { status } = await requestMediaLibraryPermissionsSafely();
      if (status !== 'granted') return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setAvatarUrl(result.assets[0].uri);
      }
    } catch (error: any) {
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

          {/* TEACHER CREDENTIALS & DETAILS SECTION */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderWrap}>
              <GraduationCap size={20} color="#10B981" />
              <Text style={styles.sectionHeaderTitle}>Teacher Credentials & Details</Text>
            </View>
            <Text style={styles.sectionHeaderSubtitle}>
              Add and update your teaching qualifications, languages, certifications, and experience.
            </Text>

            {/* LANGUAGES */}
            <View style={styles.subSection}>
              <View style={styles.subSectionTitleRow}>
                <Languages size={16} color="#10B981" />
                <Text style={styles.subSectionLabel}>Languages you speak / teach in</Text>
              </View>
              <Text style={styles.subSectionHint}>Select all languages that apply.</Text>
              <View style={styles.chipWrap}>
                {languageOptions.map((lang) => {
                  const selected = languages.includes(lang);
                  return (
                    <TouchableOpacity
                      key={lang}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => toggleLanguage(lang)}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{lang}</Text>
                    </TouchableOpacity>
                  );
                })}
                {languages
                  .filter((l) => !languageOptions.includes(l))
                  .map((lang) => (
                    <TouchableOpacity
                      key={lang}
                      style={[styles.chip, styles.chipSelected]}
                      onPress={() => toggleLanguage(lang)}
                    >
                      <Text style={[styles.chipText, styles.chipTextSelected]}>{lang}</Text>
                      <X size={14} color="#fff" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  ))}
              </View>
              <View style={styles.addRow}>
                <TextInput
                  style={styles.addRowInput}
                  placeholder="Add another language"
                  placeholderTextColor={Colors.light.textTertiary}
                  value={customLanguage}
                  onChangeText={setCustomLanguage}
                  onSubmitEditing={addCustomLanguage}
                  returnKeyType="done"
                />
                <TouchableOpacity style={styles.addRowButton} onPress={addCustomLanguage}>
                  <Plus size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* QUALIFICATIONS */}
            <View style={styles.subSection}>
              <View style={styles.subSectionTitleRow}>
                <Award size={16} color="#10B981" />
                <Text style={styles.subSectionLabel}>Qualifications</Text>
              </View>
              <Text style={styles.subSectionHint}>Select all formal qualifications that apply.</Text>
              <View style={styles.chipWrap}>
                {qualificationOptions.map((q) => {
                  const selected = qualifications.includes(q);
                  return (
                    <TouchableOpacity
                      key={q}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => toggleQualification(q)}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{q}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* CERTIFIED TOGGLE & CERTIFICATES */}
            <View style={styles.subSection}>
              <TouchableOpacity
                style={[styles.certifiedToggle, isCertified && styles.certifiedToggleActive]}
                onPress={() => setIsCertified(!isCertified)}
                activeOpacity={0.75}
              >
                <View style={[styles.certifiedToggleIcon, isCertified && styles.certifiedToggleIconActive]}>
                  <BadgeCheck size={22} color={isCertified ? '#fff' : '#10B981'} />
                </View>
                <View style={styles.certifiedToggleContent}>
                  <Text style={[styles.certifiedToggleTitle, isCertified && styles.certifiedToggleTitleActive]}>
                    I am certified or professionally qualified
                  </Text>
                  <Text style={styles.certifiedToggleSubtitle}>
                    Add your certificates and upload proof documents for verification
                  </Text>
                </View>
              </TouchableOpacity>

              {isCertified && (
                <View style={styles.certSection}>
                  {certifications.map((cert) => (
                    <View key={cert.id} style={styles.certCard}>
                      <View style={styles.certCardHeader}>
                        <View style={styles.certCardTitleWrap}>
                          <Award size={16} color="#10B981" />
                          <Text style={styles.certCardTitle} numberOfLines={1}>{cert.title}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => removeCertification(cert.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <X size={16} color={Colors.light.textSecondary} />
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity
                        style={[styles.uploadButton, cert.documentUri && styles.uploadButtonDone]}
                        onPress={() => pickCertificate(cert.id)}
                      >
                        {cert.documentUri
                          ? <FileCheck2 size={16} color="#065F46" />
                          : <Upload size={16} color="#059669" />}
                        <Text style={[styles.uploadButtonText, cert.documentUri && styles.uploadButtonTextDone]}>
                          {cert.documentUri ? 'Document uploaded ✓' : 'Upload certificate document'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <View style={styles.addRow}>
                    <TextInput
                      style={styles.addRowInput}
                      placeholder="e.g. CTET, AWS Certified, Grade 8 Piano"
                      placeholderTextColor={Colors.light.textTertiary}
                      value={certTitle}
                      onChangeText={setCertTitle}
                      onSubmitEditing={addCertification}
                      returnKeyType="done"
                    />
                    <TouchableOpacity style={styles.addRowButton} onPress={addCertification}>
                      <Plus size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* YEARS OF TEACHING EXPERIENCE */}
            <View style={styles.subSection}>
              <View style={styles.subSectionTitleRow}>
                <Clock size={16} color="#10B981" />
                <Text style={styles.subSectionLabel}>Years of teaching experience</Text>
              </View>
              <View style={styles.chipWrap}>
                {experienceOptions.map((opt) => {
                  const selected = yearsTeaching === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => setYearsTeaching(opt)}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* PRIVATE TUITION TOGGLE */}
            <View style={styles.subSection}>
              <TouchableOpacity
                style={[styles.certifiedToggle, privateTuition && styles.certifiedToggleActive]}
                onPress={() => setPrivateTuition(!privateTuition)}
                activeOpacity={0.75}
              >
                <View style={[styles.certifiedToggleIcon, privateTuition && styles.certifiedToggleIconActive]}>
                  <GraduationCap size={22} color={privateTuition ? '#fff' : '#10B981'} />
                </View>
                <View style={styles.certifiedToggleContent}>
                  <Text style={[styles.certifiedToggleTitle, privateTuition && styles.certifiedToggleTitleActive]}>
                    I have given private tuitions or coaching
                  </Text>
                  <Text style={styles.certifiedToggleSubtitle}>
                    Home tuitions, coaching centres, or online 1-on-1 teaching
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* CAREER HISTORY */}
            <View style={styles.subSection}>
              <View style={styles.subSectionTitleRow}>
                <Briefcase size={16} color="#10B981" />
                <Text style={styles.subSectionLabel}>Past Career & Jobs Experience</Text>
              </View>
              <Text style={styles.subSectionHint}>Past roles and positions that make you a great teacher.</Text>
              
              {careerHistory.map((entry) => (
                <View key={entry.id} style={styles.careerCard}>
                  <View style={styles.careerIconWrap}>
                    <Briefcase size={16} color="#10B981" />
                  </View>
                  <View style={styles.careerContent}>
                    <Text style={styles.careerRole}>{entry.role}</Text>
                    <Text style={styles.careerMeta}>
                      {[entry.organization, entry.years].filter(Boolean).join(' · ') || '—'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => removeCareerEntry(entry.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={16} color={Colors.light.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}

              <View style={styles.careerForm}>
                <TextInput
                  style={styles.careerInput}
                  placeholder="Role (e.g. Software Engineer, School Teacher)"
                  placeholderTextColor={Colors.light.textTertiary}
                  value={careerRole}
                  onChangeText={setCareerRole}
                />
                <TextInput
                  style={styles.careerInput}
                  placeholder="Organization (e.g. TCS, Kendriya Vidyalaya)"
                  placeholderTextColor={Colors.light.textTertiary}
                  value={careerOrg}
                  onChangeText={setCareerOrg}
                />
                <TextInput
                  style={styles.careerInput}
                  placeholder="Years (e.g. 2018–2022 or 3 years)"
                  placeholderTextColor={Colors.light.textTertiary}
                  value={careerYears}
                  onChangeText={setCareerYears}
                />
                <TouchableOpacity style={styles.addCareerButton} onPress={addCareerEntry}>
                  <Plus size={18} color="#fff" />
                  <Text style={styles.addCareerButtonText}>Add experience</Text>
                </TouchableOpacity>
              </View>
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
  sectionHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.light.text,
  },
  sectionHeaderSubtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  subSection: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
  },
  subSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  subSectionLabel: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  subSectionHint: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 10,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: Colors.light.backgroundTertiary,
    borderWidth: 1.5,
    borderColor: Colors.light.borderLight,
  },
  chipSelected: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  addRowInput: {
    flex: 1,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.light.text,
  },
  addRowButton: {
    backgroundColor: '#10B981',
    padding: 11,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  certifiedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.card,
    borderWidth: 1.5,
    borderColor: Colors.light.borderLight,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  certifiedToggleActive: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  certifiedToggleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  certifiedToggleIconActive: {
    backgroundColor: '#10B981',
  },
  certifiedToggleContent: {
    flex: 1,
  },
  certifiedToggleTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 2,
  },
  certifiedToggleTitleActive: {
    color: '#065F46',
  },
  certifiedToggleSubtitle: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    lineHeight: 16,
  },
  certSection: {
    marginTop: 12,
    gap: 10,
  },
  certCard: {
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  certCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  certCardTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  certCardTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.text,
    flex: 1,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  uploadButtonDone: {
    backgroundColor: '#D1FAE5',
    borderColor: '#6EE7B7',
  },
  uploadButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#059669',
  },
  uploadButtonTextDone: {
    color: '#065F46',
    fontWeight: '700' as const,
  },
  careerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  careerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  careerContent: {
    flex: 1,
  },
  careerRole: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  careerMeta: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  careerForm: {
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginTop: 4,
  },
  careerInput: {
    backgroundColor: Colors.light.backgroundTertiary,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: Colors.light.text,
  },
  addCareerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 4,
  },
  addCareerButtonText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#FFFFFF',
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

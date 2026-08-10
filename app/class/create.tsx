import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Platform, Modal, Pressable, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Calendar as CalendarIcon, Clock as ClockIcon, Users, Coins, Image as ImageIcon, Check, Sparkles, X, ChevronLeft, ChevronRight, CalendarDays, Clock3, Upload, Camera } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import { categories as defaultCategories } from '@/mocks/data';
import { useClasses } from '@/providers/classes';
import type { SkillCategory, SkillLevel } from '@/types';
import url from '@/constants/backurl';

const LEVELS: SkillLevel[] = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
const DEFAULT_COVER = 'https://images.unsplash.com/photo-1497486751825-1233686d5d80?w=800';

const COMMON_TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00', '21:00'
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getTomorrowDateStr = (): string => {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateLabel = (dateString: string): string => {
  if (!dateString) return 'Select Date';
  const parts = dateString.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return dateString;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatTimeLabel12 = (timeString: string): string => {
  if (!timeString) return 'Select Time';
  const [hStr, mStr] = timeString.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return timeString;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr.toString().padStart(2, '0')} ${ampm} (${timeString})`;
};

export default function CreateClassScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { createClass } = useClasses();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoriesList, setCategoriesList] = useState<string[]>(() => defaultCategories.filter(c => c !== 'All'));
  const [category, setCategory] = useState<string>('Technology');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [level, setLevel] = useState<SkillLevel>('Beginner');
  const [coverUrl, setCoverUrl] = useState(DEFAULT_COVER);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [dateStr, setDateStr] = useState<string>(getTomorrowDateStr());
  const [startTime, setStartTime] = useState<string>('14:00');
  const [endTime, setEndTime] = useState<string>('15:30');
  const [capacity, setCapacity] = useState('10');
  const [seatPrice, setSeatPrice] = useState('0');
  const [submitting, setSubmitting] = useState(false);

  // Upload image to Multer backend
  const uploadCoverImage = useCallback(async (fileUri: string) => {
    setUploadingCover(true);
    try {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        const response = await fetch(fileUri);
        const blob = await response.blob();
        formData.append('coverImage', blob, 'cover.jpg');
      } else {
        const filename = fileUri.split('/').pop() || 'cover.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;
        // @ts-ignore
        formData.append('coverImage', { uri: fileUri, name: filename, type });
      }

      const res = await fetch(`${url}/classes/upload-cover`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.coverUrl) {
          const fullUrl = data.coverUrl.startsWith('http') ? data.coverUrl : `${url}${data.coverUrl}`;
          setCoverUrl(fullUrl);
        }
      } else {
        Alert.alert('Upload failed', 'Failed to upload cover image to backend.');
      }
    } catch (err) {
      console.error('[UploadCover] Failed to upload image:', err);
      Alert.alert('Upload error', 'An error occurred while uploading cover image.');
    } finally {
      setUploadingCover(false);
    }
  }, []);

  const handlePickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Permission to access media library is required.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        void uploadCoverImage(result.assets[0].uri);
      }
    } catch (err) {
      console.error('[ImagePicker] Error picking image:', err);
    }
  }, [uploadCoverImage]);

  const handleTakePhoto = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Permission to access camera is required.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        void uploadCoverImage(result.assets[0].uri);
      }
    } catch (err) {
      console.error('[ImagePicker] Error taking photo:', err);
    }
  }, [uploadCoverImage]);

  // Pop-up modal visibility states
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);
  const [activeTimeTarget, setActiveTimeTarget] = useState<'start' | 'end'>('start');

  // Calendar month view state
  const todayObj = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => {
    const y = todayObj.getFullYear();
    const m = String(todayObj.getMonth() + 1).padStart(2, '0');
    const d = String(todayObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [todayObj]);

  const [viewYear, setViewYear] = useState<number>(todayObj.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(todayObj.getMonth()); // 0 - 11

  // Upcoming quick chips (next 7 days)
  const quickDays = useMemo(() => {
    const list: { dateStr: string; label: string; sublabel: string }[] = [];
    const now = new Date();
    for (let i = 1; i <= 7; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const ds = `${y}-${m}-${day}`;
      const label = i === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short' });
      const sublabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      list.push({ dateStr: ds, label, sublabel });
    }
    return list;
  }, []);

  // Compute days matrix for the month calendar view
  const calendarDaysMatrix = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const startDayOfWeek = firstDay.getDay(); // 0 = Sun
    const totalDays = lastDay.getDate();

    const cells: Array<{ dayNumber: number | null; dateStr: string | null; isPast: boolean }> = [];

    // Empty lead cells
    for (let i = 0; i < startDayOfWeek; i++) {
      cells.push({ dayNumber: null, dateStr: null, isPast: true });
    }

    // Days of month
    for (let d = 1; d <= totalDays; d++) {
      const mStr = String(viewMonth + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const ds = `${viewYear}-${mStr}-${dStr}`;
      const isPast = ds < todayStr;
      cells.push({ dayNumber: d, dateStr: ds, isPast });
    }

    return cells;
  }, [viewYear, viewMonth, todayStr]);

  const monthYearHeaderLabel = useMemo(() => {
    const d = new Date(viewYear, viewMonth, 1);
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [viewYear, viewMonth]);

  const handlePrevMonth = useCallback(() => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  }, [viewMonth]);

  const handleNextMonth = useCallback(() => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  }, [viewMonth]);

  // Open calendar pop-up
  const handleOpenDatePicker = useCallback(() => {
    if (dateStr) {
      const [y, m] = dateStr.split('-').map(Number);
      if (y && m) {
        setViewYear(y);
        setViewMonth(m - 1);
      }
    }
    setShowDatePickerModal(true);
  }, [dateStr]);

  // Open time pop-up
  const handleOpenTimePicker = useCallback((target: 'start' | 'end') => {
    setActiveTimeTarget(target);
    setShowTimePickerModal(true);
  }, []);

  // Quick end time duration calculator
  const handleAddDuration = useCallback((minutesToAdd: number) => {
    const baseTime = startTime || '14:00';
    const [hStr, mStr] = baseTime.split(':').map(Number);
    if (isNaN(hStr) || isNaN(mStr)) return;
    const totalMins = hStr * 60 + mStr + minutesToAdd;
    const newH = Math.floor((totalMins / 60) % 24);
    const newM = totalMins % 60;
    const formatted = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
    setEndTime(formatted);
  }, [startTime]);

  // Fetch dynamic categories from backend
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(`${url}/skills/categories`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setCategoriesList((prev) => Array.from(new Set([...prev, ...data])).filter(c => c !== 'All' && c !== 'Other'));
          }
        }
      } catch (err) {
        console.warn('[CreateClass] Failed to fetch categories from backend:', err);
      }
    };
    void fetchCategories();
  }, []);

  const categoryOptions = useMemo(() => {
    const base = categoriesList.filter(c => c !== 'All' && c !== 'Other');
    return [...base, 'Other'];
  }, [categoriesList]);

  const handleCreate = useCallback(() => {
    if (title.trim().length < 3) { Alert.alert('Title too short', 'Please enter at least 3 characters.'); return; }
    if (description.trim().length < 10) { Alert.alert('Description too short', 'Please enter at least 10 characters.'); return; }
    if (category === 'Other' && !customCategory.trim()) {
      Alert.alert('Missing category', 'Please enter a custom category name.');
      return;
    }
    if (!dateStr || !dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) { Alert.alert('Invalid date', 'Please pick a valid date from the calendar popup.'); return; }
    if (!startTime.match(/^\d{2}:\d{2}$/) || !endTime.match(/^\d{2}:\d{2}$/)) { Alert.alert('Invalid time', 'Please pick valid start and end times from the popup.'); return; }
    const cap = parseInt(capacity, 10);
    if (!cap || cap < 1 || cap > 500) { Alert.alert('Invalid capacity', 'Enter a number between 1 and 500.'); return; }
    const price = parseInt(seatPrice, 10) || 0;
    if (price < 0) { Alert.alert('Invalid price', 'Price cannot be negative.'); return; }

    const finalCategory = (category === 'Other' ? customCategory.trim() : category) as SkillCategory;

    // Build ISO timestamps
    const startISO = new Date(`${dateStr}T${startTime}:00`).toISOString();
    const endISO = new Date(`${dateStr}T${endTime}:00`).toISOString();
    if (new Date(endISO) <= new Date(startISO)) { Alert.alert('Invalid time range', 'End time must be after start time.'); return; }

    setSubmitting(true);
    const cls = createClass({
      title: title.trim(),
      description: description.trim(),
      category: finalCategory,
      level,
      coverImageUrl: coverUrl.trim() || DEFAULT_COVER,
      startISO,
      endISO,
      maxCapacity: cap,
      seatPriceCredits: price,
    });
    setSubmitting(false);

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`Class created! "${cls.title}" is now live.`);
      router.back();
    } else {
      Alert.alert('Class created!', `"${cls.title}" is now live.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
      router.back();
    }
  }, [title, description, category, customCategory, level, coverUrl, dateStr, startTime, endTime, capacity, seatPrice, createClass, router]);

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      <LinearGradient
        colors={[Colors.light.primary, Colors.light.primaryLight]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[s.header, { paddingTop: insets.top + 20 }]}
      >
        <Text style={s.headerTitle}>Create a Group Class</Text>
        <Text style={s.headerSub}>Teach multiple students at once</Text>
      </LinearGradient>

      <View style={s.form}>
        <Text style={s.label}>Class Title</Text>
        <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="e.g. Intro to Watercolor Painting" placeholderTextColor={Colors.light.textTertiary} />

        <Text style={s.label}>Description</Text>
        <TextInput style={[s.input, s.textArea]} value={description} onChangeText={setDescription} placeholder="What will students learn? What should they bring?" placeholderTextColor={Colors.light.textTertiary} multiline numberOfLines={4} textAlignVertical="top" />

        <Text style={s.label}>Category</Text>
        <View style={s.chipRow}>
          {categoryOptions.map(cat => (
            <TouchableOpacity key={cat} style={[s.chip, category === cat && s.chipActive]} onPress={() => setCategory(cat)} activeOpacity={0.7}>
              <Text style={[s.chipText, category === cat && s.chipTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {category === 'Other' && (
          <View style={s.customCatWrap}>
            <Text style={s.subLabel}>Enter Custom Category Name</Text>
            <TextInput
              style={s.input}
              value={customCategory}
              onChangeText={setCustomCategory}
              placeholder="e.g. Calligraphy & Lettering"
              placeholderTextColor={Colors.light.textTertiary}
            />
          </View>
        )}

        <Text style={s.label}>Level</Text>
        <View style={s.chipRow}>
          {LEVELS.map(lvl => (
            <TouchableOpacity key={lvl} style={[s.chip, level === lvl && s.chipActive]} onPress={() => setLevel(lvl)} activeOpacity={0.7}>
              <Text style={[s.chipText, level === lvl && s.chipTextActive]}>{lvl}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>Cover Image</Text>
        <View style={s.coverUploadCard}>
          {coverUrl ? (
            <View style={s.coverPreviewWrap}>
              <Image source={{ uri: coverUrl }} style={s.coverPreviewImage} resizeMode="cover" />
              {uploadingCover && (
                <View style={s.coverUploadingOverlay}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                  <Text style={s.uploadingText}>Uploading via Multer...</Text>
                </View>
              )}
            </View>
          ) : null}

          <View style={s.uploadBtnRow}>
            <TouchableOpacity style={s.uploadBtn} onPress={handlePickImage} disabled={uploadingCover} activeOpacity={0.8}>
              <Upload size={18} color="#FFFFFF" />
              <Text style={s.uploadBtnText}>{uploadingCover ? 'Uploading...' : 'Upload Image'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.cameraBtn} onPress={handleTakePhoto} disabled={uploadingCover} activeOpacity={0.8}>
              <Camera size={18} color={Colors.light.primary} />
              <Text style={s.cameraBtnText}>Camera</Text>
            </TouchableOpacity>
          </View>

          <View style={s.urlFallbackWrap}>
            <Text style={s.subLabel}>Or paste image URL:</Text>
            <View style={s.inputRow}>
              <ImageIcon size={18} color={Colors.light.textTertiary} />
              <TextInput style={[s.input, { flex: 1, borderWidth: 0, paddingVertical: 10 }]} value={coverUrl} onChangeText={setCoverUrl} placeholder="https://..." placeholderTextColor={Colors.light.textTertiary} autoCapitalize="none" />
            </View>
          </View>
        </View>

        {/* 📅 Date Picker Touch Field */}
        <Text style={s.label}>Class Date</Text>
        <TouchableOpacity style={s.selectorBtn} onPress={handleOpenDatePicker} activeOpacity={0.8}>
          <CalendarDays size={20} color={Colors.light.primary} />
          <View style={{ flex: 1 }}>
            <Text style={s.selectorBtnText}>{formatDateLabel(dateStr)}</Text>
            <Text style={s.selectorBtnSubtext}>Tap to open calendar popup</Text>
          </View>
          <View style={s.badgeChip}>
            <Text style={s.badgeChipText}>Calendar</Text>
          </View>
        </TouchableOpacity>

        {/* ⏰ Start & End Time Touch Fields */}
        <View style={s.timeRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Start Time</Text>
            <TouchableOpacity style={s.selectorBtnCompact} onPress={() => handleOpenTimePicker('start')} activeOpacity={0.8}>
              <Clock3 size={18} color={Colors.light.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.selectorBtnTextCompact}>{formatTimeLabel12(startTime)}</Text>
              </View>
            </TouchableOpacity>
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={s.label}>End Time</Text>
            <TouchableOpacity style={s.selectorBtnCompact} onPress={() => handleOpenTimePicker('end')} activeOpacity={0.8}>
              <Clock3 size={18} color={Colors.light.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.selectorBtnTextCompact}>{formatTimeLabel12(endTime)}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.timeRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Max Capacity</Text>
            <View style={s.inputRow}>
              <Users size={18} color={Colors.light.textTertiary} />
              <TextInput style={[s.input, { flex: 1 }]} value={capacity} onChangeText={setCapacity} placeholder="10" placeholderTextColor={Colors.light.textTertiary} keyboardType="numeric" />
            </View>
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Seat Price (credits)</Text>
            <View style={s.inputRow}>
              <Coins size={18} color={Colors.light.textTertiary} />
              <TextInput style={[s.input, { flex: 1 }]} value={seatPrice} onChangeText={setSeatPrice} placeholder="0 = free" placeholderTextColor={Colors.light.textTertiary} keyboardType="numeric" />
            </View>
          </View>
        </View>

        {parseInt(seatPrice, 10) === 0 && (
          <View style={s.freeNote}>
            <Sparkles size={14} color="#10B981" />
            <Text style={s.freeNoteText}>Free class — you'll earn 50 credits per attending student (platform-sponsored).</Text>
          </View>
        )}
        {parseInt(seatPrice, 10) > 0 && (
          <View style={s.paidNote}>
            <Coins size={14} color="#F59E0B" />
            <Text style={s.paidNoteText}>Paid class — you'll earn 80% of seat price × enrolled students. Platform takes 20%.</Text>
          </View>
        )}

        <TouchableOpacity style={[s.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleCreate} disabled={submitting} activeOpacity={0.8}>
          <Check size={20} color="#FFFFFF" />
          <Text style={s.submitBtnText}>{submitting ? 'Creating...' : 'Create Class'}</Text>
        </TouchableOpacity>
      </View>

      {/* 📅 CALENDAR POPUP MODAL */}
      <Modal
        visible={showDatePickerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatePickerModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <LinearGradient
              colors={[Colors.light.primary, Colors.light.primaryLight]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.modalHeaderGradient}
            >
              <View style={s.modalHeaderContent}>
                <CalendarDays size={24} color="#FFFFFF" />
                <View style={{ flex: 1 }}>
                  <Text style={s.modalTitle}>Choose Class Date</Text>
                  <Text style={s.modalSubTitle}>Select when your class takes place</Text>
                </View>
                <TouchableOpacity style={s.modalCloseBtn} onPress={() => setShowDatePickerModal(false)}>
                  <X size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480, padding: 16 }}>
              {/* Quick day chips */}
              <Text style={s.modalSectionTitle}>Quick Selection</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
                {quickDays.map((qd) => {
                  const isSelected = dateStr === qd.dateStr;
                  return (
                    <TouchableOpacity
                      key={qd.dateStr}
                      style={[s.quickDayChip, isSelected && s.quickDayChipSelected]}
                      onPress={() => { setDateStr(qd.dateStr); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.quickDayLabel, isSelected && s.quickDayLabelSelected]}>{qd.label}</Text>
                      <Text style={[s.quickDaySub, isSelected && s.quickDaySubSelected]}>{qd.sublabel}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Month Navigation */}
              <View style={s.monthNavRow}>
                <TouchableOpacity style={s.monthNavBtn} onPress={handlePrevMonth}>
                  <ChevronLeft size={20} color={Colors.light.text} />
                </TouchableOpacity>
                <Text style={s.monthNavTitle}>{monthYearHeaderLabel}</Text>
                <TouchableOpacity style={s.monthNavBtn} onPress={handleNextMonth}>
                  <ChevronRight size={20} color={Colors.light.text} />
                </TouchableOpacity>
              </View>

              {/* Weekday headers */}
              <View style={s.weekdayGrid}>
                {WEEKDAY_NAMES.map(day => (
                  <Text key={day} style={s.weekdayText}>{day}</Text>
                ))}
              </View>

              {/* Month Grid */}
              <View style={s.calendarGrid}>
                {calendarDaysMatrix.map((cell, idx) => {
                  if (cell.dayNumber === null || !cell.dateStr) {
                    return <View key={`empty-${idx}`} style={s.calendarCellEmpty} />;
                  }
                  const isSelected = cell.dateStr === dateStr;
                  const isToday = cell.dateStr === todayStr;

                  return (
                    <TouchableOpacity
                      key={cell.dateStr}
                      disabled={cell.isPast}
                      style={[
                        s.calendarCell,
                        cell.isPast && s.calendarCellPast,
                        isToday && s.calendarCellToday,
                        isSelected && s.calendarCellSelected,
                      ]}
                      onPress={() => {
                        if (cell.dateStr) setDateStr(cell.dateStr);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          s.calendarCellText,
                          cell.isPast && s.calendarCellTextPast,
                          isSelected && s.calendarCellTextSelected,
                        ]}
                      >
                        {cell.dayNumber}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Web Native Fallback / HTML Input */}
              {Platform.OS === 'web' && (
                <View style={s.webPickerWrap}>
                  <Text style={s.modalSectionTitle}>Direct Browser Picker</Text>
                  {/* @ts-ignore */}
                  <input
                    type="date"
                    value={dateStr}
                    onChange={(e: any) => { if (e.target.value) setDateStr(e.target.value); }}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: `1px solid ${Colors.light.border}`,
                      backgroundColor: Colors.light.backgroundTertiary,
                      color: Colors.light.text,
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      outline: 'none',
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                      marginTop: '6px',
                    }}
                  />
                </View>
              )}
            </ScrollView>

            <View style={s.modalFooter}>
              <TouchableOpacity style={s.modalConfirmBtn} onPress={() => setShowDatePickerModal(false)}>
                <Check size={18} color="#FFFFFF" />
                <Text style={s.modalConfirmBtnText}>Confirm Date ({dateStr})</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ⏰ TIME POPUP MODAL */}
      <Modal
        visible={showTimePickerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTimePickerModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <LinearGradient
              colors={[Colors.light.primary, Colors.light.primaryLight]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.modalHeaderGradient}
            >
              <View style={s.modalHeaderContent}>
                <Clock3 size={24} color="#FFFFFF" />
                <View style={{ flex: 1 }}>
                  <Text style={s.modalTitle}>
                    {activeTimeTarget === 'start' ? 'Select Start Time' : 'Select End Time'}
                  </Text>
                  <Text style={s.modalSubTitle}>
                    {activeTimeTarget === 'start' ? 'When will your class begin?' : 'When will your class wrap up?'}
                  </Text>
                </View>
                <TouchableOpacity style={s.modalCloseBtn} onPress={() => setShowTimePickerModal(false)}>
                  <X size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440, padding: 16 }}>
              {/* Duration Shortcuts for End Time */}
              {activeTimeTarget === 'end' && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={s.modalSectionTitle}>Class Duration Presets (From Start: {startTime})</Text>
                  <View style={s.durationRow}>
                    <TouchableOpacity style={s.durationChip} onPress={() => handleAddDuration(30)}>
                      <Text style={s.durationChipText}>+30 min</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.durationChip} onPress={() => handleAddDuration(45)}>
                      <Text style={s.durationChipText}>+45 min</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.durationChip} onPress={() => handleAddDuration(60)}>
                      <Text style={s.durationChipText}>+1 hour</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.durationChip} onPress={() => handleAddDuration(90)}>
                      <Text style={s.durationChipText}>+1.5 hours</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.durationChip} onPress={() => handleAddDuration(120)}>
                      <Text style={s.durationChipText}>+2 hours</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Time Slots Grid */}
              <Text style={s.modalSectionTitle}>Popular Time Slots</Text>
              <View style={s.timeSlotsGrid}>
                {COMMON_TIME_SLOTS.map((t) => {
                  const activeVal = activeTimeTarget === 'start' ? startTime : endTime;
                  const isSelected = activeVal === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[s.timeSlotChip, isSelected && s.timeSlotChipSelected]}
                      onPress={() => {
                        if (activeTimeTarget === 'start') {
                          setStartTime(t);
                        } else {
                          setEndTime(t);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Clock3 size={14} color={isSelected ? '#FFFFFF' : Colors.light.textSecondary} />
                      <Text style={[s.timeSlotText, isSelected && s.timeSlotTextSelected]}>
                        {formatTimeLabel12(t).split(' ')[0]} {formatTimeLabel12(t).split(' ')[1]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Native HTML Browser Time Input fallback on Web */}
              {Platform.OS === 'web' && (
                <View style={s.webPickerWrap}>
                  <Text style={s.modalSectionTitle}>Custom Time Input</Text>
                  {/* @ts-ignore */}
                  <input
                    type="time"
                    value={activeTimeTarget === 'start' ? startTime : endTime}
                    onChange={(e: any) => {
                      if (e.target.value) {
                        if (activeTimeTarget === 'start') setStartTime(e.target.value);
                        else setEndTime(e.target.value);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: `1px solid ${Colors.light.border}`,
                      backgroundColor: Colors.light.backgroundTertiary,
                      color: Colors.light.text,
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      outline: 'none',
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                      marginTop: '6px',
                    }}
                  />
                </View>
              )}
            </ScrollView>

            <View style={s.modalFooter}>
              <TouchableOpacity style={s.modalConfirmBtn} onPress={() => setShowTimePickerModal(false)}>
                <Check size={18} color="#FFFFFF" />
                <Text style={s.modalConfirmBtnText}>
                  Set {activeTimeTarget === 'start' ? 'Start' : 'End'} Time ({activeTimeTarget === 'start' ? startTime : endTime})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { paddingHorizontal: 20, paddingBottom: 24 },
  headerTitle: { fontSize: 24, fontWeight: '800' as const, color: '#FFFFFF' },
  headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  form: { padding: 20 },
  label: { fontSize: 14, fontWeight: '700' as const, color: Colors.light.text, marginBottom: 8, marginTop: 16 },
  subLabel: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.primary, marginBottom: 6 },
  customCatWrap: { marginTop: 10 },
  input: { backgroundColor: Colors.light.backgroundTertiary, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: Colors.light.text, borderWidth: 1, borderColor: Colors.light.border },
  textArea: { minHeight: 100, paddingTop: 14 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.light.backgroundTertiary, borderRadius: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: Colors.light.border },
  // Cover Upload Card Styles
  coverUploadCard: { backgroundColor: Colors.light.backgroundTertiary, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.light.border, gap: 12 },
  coverPreviewWrap: { height: 160, borderRadius: 12, overflow: 'hidden', backgroundColor: '#0F172A', position: 'relative' as const },
  coverPreviewImage: { width: '100%', height: '100%' },
  coverUploadingOverlay: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'center', alignItems: 'center', gap: 8 },
  uploadingText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' as const },
  uploadBtnRow: { flexDirection: 'row', gap: 10 },
  uploadBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.light.primary, borderRadius: 12, paddingVertical: 12 },
  uploadBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' as const },
  cameraBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(99, 102, 241, 0.1)', borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  cameraBtnText: { color: Colors.light.primary, fontSize: 14, fontWeight: '700' as const },
  urlFallbackWrap: { paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.light.border },

  // Touch Selector Field Styles
  selectorBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.light.backgroundTertiary, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1.5, borderColor: Colors.light.primary },
  selectorBtnText: { fontSize: 15, fontWeight: '700' as const, color: Colors.light.text },
  selectorBtnSubtext: { fontSize: 12, color: Colors.light.textTertiary, marginTop: 2 },
  badgeChip: { backgroundColor: 'rgba(99, 102, 241, 0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeChipText: { fontSize: 12, fontWeight: '700' as const, color: Colors.light.primary },

  selectorBtnCompact: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.light.backgroundTertiary, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1.5, borderColor: Colors.light.primary },
  selectorBtnTextCompact: { fontSize: 13, fontWeight: '700' as const, color: Colors.light.text },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap' as const, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, backgroundColor: Colors.light.backgroundTertiary, borderWidth: 1, borderColor: Colors.light.border },
  chipActive: { backgroundColor: Colors.light.primary, borderColor: Colors.light.primary },
  chipText: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.textSecondary },
  chipTextActive: { color: '#FFFFFF' },
  timeRow: { flexDirection: 'row' },
  freeNote: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: 12, padding: 12, marginTop: 16 },
  freeNoteText: { fontSize: 13, color: '#10B981', fontWeight: '500' as const, flex: 1 },
  paidNote: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 12, padding: 12, marginTop: 16 },
  paidNoteText: { fontSize: 13, color: '#F59E0B', fontWeight: '500' as const, flex: 1 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.light.primary, borderRadius: 16, paddingVertical: 16, marginTop: 24, shadowColor: Colors.light.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitBtnText: { fontSize: 16, fontWeight: '700' as const, color: '#FFFFFF' },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 440, backgroundColor: Colors.light.background, borderRadius: 24, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 10 },
  modalHeaderGradient: { paddingHorizontal: 20, paddingVertical: 18 },
  modalHeaderContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800' as const, color: '#FFFFFF' },
  modalSubTitle: { fontSize: 13, color: 'rgba(255, 255, 255, 0.85)', marginTop: 2 },
  modalCloseBtn: { padding: 4 },
  modalSectionTitle: { fontSize: 13, fontWeight: '700' as const, color: Colors.light.textSecondary, marginBottom: 10, marginTop: 12 },

  // Quick Days
  quickDayChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: Colors.light.backgroundTertiary, borderWidth: 1, borderColor: Colors.light.border, alignItems: 'center' },
  quickDayChipSelected: { backgroundColor: Colors.light.primary, borderColor: Colors.light.primary },
  quickDayLabel: { fontSize: 13, fontWeight: '700' as const, color: Colors.light.text },
  quickDayLabelSelected: { color: '#FFFFFF' },
  quickDaySub: { fontSize: 11, color: Colors.light.textTertiary, marginTop: 2 },
  quickDaySubSelected: { color: 'rgba(255, 255, 255, 0.9)' },

  // Month Navigation & Calendar Grid
  monthNavRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 12 },
  monthNavTitle: { fontSize: 16, fontWeight: '700' as const, color: Colors.light.text },
  monthNavBtn: { padding: 8, borderRadius: 10, backgroundColor: Colors.light.backgroundTertiary },

  weekdayGrid: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  weekdayText: { width: 40, textAlign: 'center', fontSize: 12, fontWeight: '700' as const, color: Colors.light.textTertiary },

  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' as const },
  calendarCellEmpty: { width: '14.28%', height: 40 },
  calendarCell: { width: '14.28%', height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 10, marginVertical: 2 },
  calendarCellPast: { opacity: 0.35 },
  calendarCellToday: { borderWidth: 1.5, borderColor: Colors.light.primary },
  calendarCellSelected: { backgroundColor: Colors.light.primary },
  calendarCellText: { fontSize: 14, fontWeight: '600' as const, color: Colors.light.text },
  calendarCellTextPast: { color: Colors.light.textTertiary },
  calendarCellTextSelected: { color: '#FFFFFF', fontWeight: '800' as const },

  // Duration Chips
  durationRow: { flexDirection: 'row', flexWrap: 'wrap' as const, gap: 8 },
  durationChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(99, 102, 241, 0.12)', borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)' },
  durationChipText: { fontSize: 12, fontWeight: '700' as const, color: Colors.light.primary },

  // Time Slots
  timeSlotsGrid: { flexDirection: 'row', flexWrap: 'wrap' as const, gap: 8 },
  timeSlotChip: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '31%', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12, backgroundColor: Colors.light.backgroundTertiary, borderWidth: 1, borderColor: Colors.light.border, justifyContent: 'center' },
  timeSlotChipSelected: { backgroundColor: Colors.light.primary, borderColor: Colors.light.primary },
  timeSlotText: { fontSize: 12, fontWeight: '600' as const, color: Colors.light.text },
  timeSlotTextSelected: { color: '#FFFFFF', fontWeight: '700' as const },

  webPickerWrap: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.light.border },

  modalFooter: { padding: 16, borderTopWidth: 1, borderTopColor: Colors.light.border, backgroundColor: Colors.light.background },
  modalConfirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.light.primary, borderRadius: 14, paddingVertical: 14 },
  modalConfirmBtnText: { fontSize: 15, fontWeight: '700' as const, color: '#FFFFFF' },
});


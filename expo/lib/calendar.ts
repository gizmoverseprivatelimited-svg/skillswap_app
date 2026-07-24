import * as Calendar from 'expo-calendar';
import { Platform, Share, Alert } from 'react-native';
import type { SkillSwapRequest, SwapTimeProposal } from '@/types';

export interface CalendarSyncResult {
  success: boolean;
  eventId?: string;
  error?: string;
}

export interface ICalExportResult {
  success: boolean;
  error?: string;
}

const formatICalDate = (date: Date): string => {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
};

const escapeICal = (str: string): string => {
  return str.replace(/[,;\\]/g, '\\$&').replace(/\n/g, '\\n');
};

const generateICalContent = (title: string, startDate: Date, endDate: Date, location?: string, description?: string): string => {
  const uid = `${formatICalDate(startDate)}-${Math.random().toString(36).slice(2)}@skillswap.app`;
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LearnSwap//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${formatICalDate(new Date())}`,
    `DTSTART:${formatICalDate(startDate)}`, `DTEND:${formatICalDate(endDate)}`, `SUMMARY:${escapeICal(title)}`,
  ];
  if (location) lines.push(`LOCATION:${escapeICal(location)}`);
  if (description) lines.push(`DESCRIPTION:${escapeICal(description)}`);
  lines.push('STATUS:CONFIRMED', 'SEQUENCE:0', 'END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
};

export const addSwapToCalendar = async (
  swap: SkillSwapRequest, acceptedTime: SwapTimeProposal, skillTitle: string, partnerName: string,
): Promise<CalendarSyncResult> => {
  if (Platform.OS === 'web') {
    return { success: false, error: 'Calendar sync is not available on web. Use iCal export instead.' };
  }
  try {
    const { status: existingStatus } = await Calendar.getCalendarPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      Alert.alert('Calendar Access Required', 'Please enable calendar access in your device settings.');
      return { success: false, error: 'Calendar permission denied' };
    }
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const writable = calendars.filter(c => c.allowsModifications);
    if (writable.length === 0) return { success: false, error: 'No calendar available' };
    const calendarId = (writable.find(c => c.isPrimary) || writable[0]).id;
    const title = `Skill Swap: ${skillTitle}`;
    const location = swap.locationPreference || 'TBD';
    const eventId = await Calendar.createEventAsync(calendarId, {
      title, startDate: new Date(acceptedTime.startISO), endDate: new Date(acceptedTime.endISO),
      location, notes: `Skill swap with ${partnerName}\nSkill: ${skillTitle}\nLocation: ${location}`,
      alarms: [{ relativeOffset: -60 }, { relativeOffset: -15 }],
    });
    console.log('[Calendar] Event created:', eventId);
    return { success: true, eventId };
  } catch (error) {
    console.error('[Calendar] Failed to add event:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

export const exportSwapToICalendar = async (
  swap: SkillSwapRequest, acceptedTime: SwapTimeProposal, skillTitle: string, partnerName: string,
): Promise<ICalExportResult> => {
  try {
    const title = `Skill Swap: ${skillTitle}`;
    const location = swap.locationPreference || 'TBD';
    const icalContent = generateICalContent(title, new Date(acceptedTime.startISO), new Date(acceptedTime.endISO), location, `Skill swap with ${partnerName}. Skill: ${skillTitle}`);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `skill-swap-${swap.id}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return { success: true };
      }
      return { success: false, error: 'Web environment not available' };
    }
    await Share.share({ message: icalContent, title: `${title}.ics` });
    return { success: true };
  } catch (error) {
    console.error('[Calendar] iCal export failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

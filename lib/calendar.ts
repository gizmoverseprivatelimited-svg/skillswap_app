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

const generateICalContent = (
  title: string,
  startDate: Date,
  endDate: Date,
  location?: string,
  description?: string,
): string => {
  const formatDate = (date: Date): string => {
    return date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  };

  const escape = (str: string): string => {
    return str.replace(/[,;\\]/g, '\\$&').replace(/\n/g, '\\n');
  };

  const now = new Date();
  const dtstamp = formatDate(now);
  const dtstart = formatDate(startDate);
  const dtend = formatDate(endDate);
  const uid = `${dtstart}-${Math.random().toString(36).slice(2)}@skillswap.app`;

  let icalContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SkillSwap//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escape(title)}`,
  ];

  if (location) {
    icalContent.push(`LOCATION:${escape(location)}`);
  }

  if (description) {
    icalContent.push(`DESCRIPTION:${escape(description)}`);
  }

  icalContent.push('STATUS:CONFIRMED', 'SEQUENCE:0', 'END:VEVENT', 'END:VCALENDAR');

  return icalContent.join('\r\n');
};

export const requestCalendarPermissions = async (): Promise<boolean> => {
  if (Platform.OS === 'web') {
    console.log('[Calendar] Web does not require calendar permissions');
    return true;
  }

  try {
    const { status: existingStatus } = await Calendar.getCalendarPermissionsAsync();
    
    if (existingStatus === 'granted') {
      return true;
    }

    const { status } = await Calendar.requestCalendarPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Calendar Access Required',
        'Please enable calendar access in your device settings to sync events.',
        [{ text: 'OK' }]
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Calendar] Permission request failed:', error);
    return false;
  }
};

const getDefaultCalendarId = async (): Promise<string | null> => {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    
    const writableCalendars = calendars.filter(
      (cal) => cal.allowsModifications
    );

    if (writableCalendars.length === 0) {
      console.warn('[Calendar] No writable calendars found');
      return null;
    }

    const defaultCalendar = writableCalendars.find(
      (cal) => cal.isPrimary
    ) || writableCalendars[0];

    return defaultCalendar.id;
  } catch (error) {
    console.error('[Calendar] Failed to get default calendar:', error);
    return null;
  }
};

export const addSwapToCalendar = async (
  swap: SkillSwapRequest,
  acceptedTime: SwapTimeProposal,
  skillTitle: string,
  partnerName: string,
): Promise<CalendarSyncResult> => {
  if (Platform.OS === 'web') {
    return {
      success: false,
      error: 'Calendar sync is not available on web. Use iCal export instead.',
    };
  }

  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) {
      return {
        success: false,
        error: 'Calendar permission denied',
      };
    }

    const calendarId = await getDefaultCalendarId();
    if (!calendarId) {
      return {
        success: false,
        error: 'No calendar available',
      };
    }

    const title = `Skill Swap: ${skillTitle}`;
    const startDate = new Date(acceptedTime.startISO);
    const endDate = new Date(acceptedTime.endISO);
    const location = swap.locationPreference || 'TBD';
    const notes = `Skill swap session with ${partnerName}\n\nSkill: ${skillTitle}\nLocation: ${location}`;

    const eventId = await Calendar.createEventAsync(calendarId, {
      title,
      startDate,
      endDate,
      location,
      notes,
      alarms: [
        { relativeOffset: -60 },
        { relativeOffset: -15 },
      ],
    });

    console.log('[Calendar] Event created:', eventId);

    return {
      success: true,
      eventId,
    };
  } catch (error) {
    console.error('[Calendar] Failed to add event:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

export const exportSwapToICalendar = async (
  swap: SkillSwapRequest,
  acceptedTime: SwapTimeProposal,
  skillTitle: string,
  partnerName: string,
): Promise<ICalExportResult> => {
  try {
    const title = `Skill Swap: ${skillTitle}`;
    const startDate = new Date(acceptedTime.startISO);
    const endDate = new Date(acceptedTime.endISO);
    const location = swap.locationPreference || 'TBD';
    const description = `Skill swap session with ${partnerName}. Skill: ${skillTitle}`;

    const icalContent = generateICalContent(
      title,
      startDate,
      endDate,
      location,
      description,
    );

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

    await Share.share({
      message: icalContent,
      title: `${title}.ics`,
    });

    return { success: true };
  } catch (error) {
    console.error('[Calendar] iCal export failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

export const removeSwapFromCalendar = async (eventId: string): Promise<boolean> => {
  if (Platform.OS === 'web') {
    return false;
  }

  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) {
      return false;
    }

    await Calendar.deleteEventAsync(eventId);
    console.log('[Calendar] Event deleted:', eventId);
    return true;
  } catch (error) {
    console.error('[Calendar] Failed to delete event:', error);
    return false;
  }
};

export const updateSwapInCalendar = async (
  eventId: string,
  swap: SkillSwapRequest,
  acceptedTime: SwapTimeProposal,
  skillTitle: string,
  partnerName: string,
): Promise<boolean> => {
  if (Platform.OS === 'web') {
    return false;
  }

  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) {
      return false;
    }

    const title = `Skill Swap: ${skillTitle}`;
    const startDate = new Date(acceptedTime.startISO);
    const endDate = new Date(acceptedTime.endISO);
    const location = swap.locationPreference || 'TBD';
    const notes = `Skill swap session with ${partnerName}\n\nSkill: ${skillTitle}\nLocation: ${location}`;

    await Calendar.updateEventAsync(eventId, {
      title,
      startDate,
      endDate,
      location,
      notes,
    });

    console.log('[Calendar] Event updated:', eventId);
    return true;
  } catch (error) {
    console.error('[Calendar] Failed to update event:', error);
    return false;
  }
};

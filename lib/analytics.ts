import { Platform } from 'react-native';

let analyticsModule: any = null;

try {
  if (Platform.OS !== 'web') {
    // Dynamic import to prevent bundler errors on web
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    analyticsModule = require('@react-native-firebase/analytics').default;
  }
} catch (e) {
  console.warn('[Analytics] Failed to initialize Firebase Analytics module:', e);
}

const isAvailable = (): boolean => {
  return Platform.OS !== 'web' && analyticsModule !== null;
};

/**
 * Log a custom or standard event to Firebase Analytics
 * @param eventName Name of the event (1-40 characters, alphanumeric and underscores)
 * @param params Optional key-value parameters
 */
export async function logEvent(eventName: string, params?: Record<string, any>): Promise<void> {
  try {
    if (__DEV__) {
      console.log(`[Analytics] 📊 Event "${eventName}":`, params || {});
    }

    if (isAvailable()) {
      await analyticsModule().logEvent(eventName, params);
    }
  } catch (error) {
    console.warn(`[Analytics] Failed to log event "${eventName}":`, error);
  }
}

/**
 * Log screen / route view per rnfirebase.io/analytics/screen-tracking
 * @param screenName Screen name (e.g. "Home", "ClassDetails", "Swaps")
 * @param screenClass Optional screen class name
 */
export async function logScreenView(screenName: string, screenClass?: string): Promise<void> {
  try {
    if (__DEV__) {
      console.log(`[Analytics] 📱 Screen View: "${screenName}"`);
    }

    if (isAvailable()) {
      await analyticsModule().logScreenView({
        screen_name: screenName,
        screen_class: screenClass || screenName,
      });
    }
  } catch (error) {
    console.warn(`[Analytics] Failed to log screen view "${screenName}":`, error);
  }
}

/**
 * Set current user ID for tracking
 * @param userId Unique user ID or null on logout
 */
export async function setUserId(userId: string | null): Promise<void> {
  try {
    if (__DEV__) {
      console.log(`[Analytics] 👤 Set User ID:`, userId);
    }

    if (isAvailable()) {
      await analyticsModule().setUserId(userId);
    }
  } catch (error) {
    console.warn('[Analytics] Failed to set user ID:', error);
  }
}

/**
 * Set a custom user property (e.g. role, membership, level)
 * @param name Property name
 * @param value Property value or null to remove
 */
export async function setUserProperty(name: string, value: string | null): Promise<void> {
  try {
    if (isAvailable()) {
      await analyticsModule().setUserProperty(name, value);
    }
  } catch (error) {
    console.warn(`[Analytics] Failed to set user property "${name}":`, error);
  }
}

/**
 * Log standard Login event
 * @param method Authentication method (e.g. 'google', 'email', 'otp')
 */
export async function logLogin(method: string): Promise<void> {
  try {
    if (__DEV__) {
      console.log(`[Analytics] 🔑 Login method: ${method}`);
    }

    if (isAvailable()) {
      await analyticsModule().logLogin({ method });
    }
  } catch (error) {
    console.warn('[Analytics] Failed to log login:', error);
  }
}

/**
 * Log standard Sign Up event
 * @param method Registration method (e.g. 'google', 'email', 'otp')
 */
export async function logSignUp(method: string): Promise<void> {
  try {
    if (__DEV__) {
      console.log(`[Analytics] 📝 Sign up method: ${method}`);
    }

    if (isAvailable()) {
      await analyticsModule().logSignUp({ method });
    }
  } catch (error) {
    console.warn('[Analytics] Failed to log sign up:', error);
  }
}

/**
 * Log course view when user opens a course page
 * @param courseId ID of the course
 * @param courseName Title of the course
 */
export async function logCourseView(courseId: string, courseName: string): Promise<void> {
  await logEvent('course_view', {
    course_id: String(courseId),
    course_name: String(courseName),
  });
}

/**
 * Log course purchase when user purchases/enrolls in a course
 * @param courseId ID of the course
 * @param value Price or credits spent
 * @param currency Default is 'INR'
 */
export async function logCoursePurchase(courseId: string, value: number, currency: string = 'INR'): Promise<void> {
  await logEvent('course_purchase', {
    course_id: String(courseId),
    value: Number(value),
    currency: currency || 'INR',
  });
}

/**
 * Log skill swap request when user sends a swap request
 * @param skillOffered Title of the skill offered
 * @param skillWanted Title of the skill wanted
 */
export async function logSkillSwapRequest(skillOffered: string, skillWanted: string): Promise<void> {
  await logEvent('skill_swap_request', {
    skill_offered: String(skillOffered),
    skill_wanted: String(skillWanted),
  });
}

/**
 * Enable or disable analytics data collection
 */
export async function setAnalyticsCollectionEnabled(enabled: boolean): Promise<void> {
  try {
    if (isAvailable()) {
      await analyticsModule().setAnalyticsCollectionEnabled(enabled);
    }
  } catch (error) {
    console.warn('[Analytics] Failed to set collection state:', error);
  }
}

/**
 * Callable wrapper matching @react-native-firebase/analytics API:
 * analytics().logEvent(...)
 */
export function analytics() {
  return {
    logEvent,
    logScreenView,
    setUserId,
    setUserProperty,
    logLogin,
    logSignUp,
    logCourseView,
    logCoursePurchase,
    logSkillSwapRequest,
    setAnalyticsCollectionEnabled,
  };
}

export default analytics;

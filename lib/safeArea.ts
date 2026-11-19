import { Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Returns a robust top safe-area inset that accounts for:
 * - iOS notches, Dynamic Islands, and status bars (insets.top)
 * - Android notches, camera punch-holes, and status bar height (StatusBar.currentHeight fallback)
 * - Guaranteed minimum top gap on mobile devices so content NEVER touches the notch
 * 
 * @param extraSpacing Additional spacing to add below the safe area (default: 0)
 * @returns Total calculated top padding in pixels
 */
export function useSafeTopInset(extraSpacing: number = 0): number {
  const insets = useSafeAreaInsets();
  
  if (Platform.OS === 'web') {
    return (insets.top || 0) + extraSpacing;
  }

  // Android status bar fallback if insets.top hasn't initialized or is 0
  const androidStatusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;
  const baseInset = Math.max(insets.top || 0, androidStatusBarHeight);
  
  // Guaranteed minimum top padding on native mobile (e.g. 24px)
  const minTop = 24;
  const effectiveTop = Math.max(baseInset, minTop);
  
  return effectiveTop + extraSpacing;
}

export default useSafeTopInset;

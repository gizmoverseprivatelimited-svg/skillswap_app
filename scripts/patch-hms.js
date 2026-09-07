/**
 * patch-hms.js
 * 
 * Post-install script for @100mslive/react-native-hms.
 * 
 * Previously this patched HMSView.kt to force-attach tracks, but since we now
 * use the SDK's own HmsViewComponent (which already handles Android lifecycle
 * and track attachment correctly), the native Kotlin patching is no longer needed.
 * 
 * This script is kept as a no-op placeholder to avoid breaking the postinstall
 * script reference in package.json. It can be removed in a future cleanup.
 */

const fs = require('fs');
const path = require('path');

const hmsViewPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@100mslive',
  'react-native-hms',
  'android',
  'src',
  'main',
  'java',
  'com',
  'reactnativehmssdk',
  'HMSView.kt'
);

if (fs.existsSync(hmsViewPath)) {
  console.log('[patch-hms] HMSView.kt found — no patching needed (using SDK HmsViewComponent)');
} else {
  console.log('[patch-hms] HMSView.kt not found (skipping — expected during EAS cloud builds)');
}

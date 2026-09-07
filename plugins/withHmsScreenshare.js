const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to add 100ms screenshare activity, permissions, and foreground service
 * configuration required by Android 14+ (API 34+) and @100mslive/react-native-hms.
 */
function withHmsScreenshare(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;

    // 1. Ensure uses-permission array exists
    if (!androidManifest['uses-permission']) {
      androidManifest['uses-permission'] = [];
    }

    const permissions = [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
      'android.permission.POST_NOTIFICATIONS',
    ];

    permissions.forEach((permName) => {
      const exists = androidManifest['uses-permission'].some(
        (item) => item.$ && item.$['android:name'] === permName
      );
      if (!exists) {
        androidManifest['uses-permission'].push({
          $: { 'android:name': permName },
        });
      }
    });

    // 2. Ensure application element exists
    if (Array.isArray(androidManifest.application) && androidManifest.application.length > 0) {
      const application = androidManifest.application[0];

      // Add HmsScreenshareActivity if not already present
      if (!application.activity) {
        application.activity = [];
      }

      const screenshareActivityName = 'com.reactnativehmssdk.HmsScreenshareActivity';
      const existingActivityIndex = application.activity.findIndex(
        (act) => act.$ && act.$['android:name'] === screenshareActivityName
      );

      const activityConfig = {
        'android:name': screenshareActivityName,
        'android:label': '@string/app_name',
        'android:exported': 'false',
        'android:supportsPictureInPicture': 'true',
        'android:foregroundServiceType': 'mediaProjection',
      };

      if (existingActivityIndex !== -1) {
        application.activity[existingActivityIndex].$ = {
          ...application.activity[existingActivityIndex].$,
          ...activityConfig,
        };
        delete application.activity[existingActivityIndex].$['android:theme'];
      } else {
        application.activity.push({
          $: activityConfig,
        });
      }

      // 3. Add foreground service declarations for screen capture
      if (!application.service) {
        application.service = [];
      }

      // HMS SDK screen capture foreground service
      const serviceNames = [
        'live.hms.android.sdk.service.HmsScreenCaptureService',
        'com.reactnativehmssdk.HmsScreenshareService',
      ];

      serviceNames.forEach((serviceName) => {
        const existingServiceIndex = application.service.findIndex(
          (svc) => svc.$ && svc.$['android:name'] === serviceName
        );

        const serviceConfig = {
          'android:name': serviceName,
          'android:enabled': 'true',
          'android:exported': 'false',
          'android:foregroundServiceType': 'mediaProjection',
        };

        if (existingServiceIndex !== -1) {
          application.service[existingServiceIndex].$ = {
            ...application.service[existingServiceIndex].$,
            ...serviceConfig,
          };
        } else {
          application.service.push({
            $: serviceConfig,
          });
        }
      });
    }

    return config;
  });
}

module.exports = withHmsScreenshare;

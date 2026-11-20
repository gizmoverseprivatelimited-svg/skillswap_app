const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Config plugin to mark android.hardware.screen.portrait as optional (android:required="false").
 * This satisfies Google Play Console requirements for tablets, desktops, and foldables
 * while keeping the app locked to portrait on standard phones.
 */
const withPortraitFeatureOptional = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;

    if (!androidManifest['uses-feature']) {
      androidManifest['uses-feature'] = [];
    }

    const portraitFeature = androidManifest['uses-feature'].find(
      (f) => f.$ && f.$['android:name'] === 'android.hardware.screen.portrait'
    );

    if (portraitFeature) {
      portraitFeature.$['android:required'] = 'false';
    } else {
      androidManifest['uses-feature'].push({
        $: {
          'android:name': 'android.hardware.screen.portrait',
          'android:required': 'false',
        },
      });
    }

    return config;
  });
};

module.exports = withPortraitFeatureOptional;

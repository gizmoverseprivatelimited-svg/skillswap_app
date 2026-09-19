const { withMainApplication } = require('@expo/config-plugins');

module.exports = function withMainApplicationFix(config) {
  return withMainApplication(config, async (config) => {
    let mainApplication = config.modResults.contents;

    // The problematic lines from Expo's template in SDK 56
    const badOrder = `    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)`;

    const goodOrder = `    ApplicationLifecycleDispatcher.onApplicationCreate(this)
    loadReactNative(this)`;

    if (mainApplication.includes(badOrder)) {
      mainApplication = mainApplication.replace(badOrder, goodOrder);
    }

    config.modResults.contents = mainApplication;
    return config;
  });
};

const { withAndroidManifest } = require('@expo/config-plugins');

const withCameraIntent = (config) => {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;
    const androidManifest = manifest.manifest;

    if (!androidManifest.queries) {
      androidManifest.queries = [];
    }

    // Prepare the intents we want to add
    const imageCaptureIntent = {
      action: [{ $: { 'android:name': 'android.media.action.IMAGE_CAPTURE' } }]
    };
    
    const videoCaptureIntent = {
      action: [{ $: { 'android:name': 'android.media.action.ACTION_VIDEO_CAPTURE' } }]
    };

    // Make sure queries is an array
    if (!Array.isArray(androidManifest.queries)) {
      androidManifest.queries = [androidManifest.queries];
    }

    // Add them to the queries block
    // xml2js parses queries as an array of objects which can have 'intent' arrays
    const queriesBlock = androidManifest.queries[0];
    
    if (!queriesBlock.intent) {
      queriesBlock.intent = [];
    }

    queriesBlock.intent.push(imageCaptureIntent);
    queriesBlock.intent.push(videoCaptureIntent);

    return config;
  });
};

module.exports = withCameraIntent;

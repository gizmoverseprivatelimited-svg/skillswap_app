const { withAndroidManifest, withMainApplication, withMainActivity } = require('@expo/config-plugins');

function withHmsScreenshare(config) {
  // 1. AndroidManifest modifications
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults.manifest;

    if (!androidManifest['uses-permission']) {
      androidManifest['uses-permission'] = [];
    }

    const permissions = [
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
      'android.permission.FOREGROUND_SERVICE_CAMERA',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
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

    if (Array.isArray(androidManifest.application) && androidManifest.application.length > 0) {
      const application = androidManifest.application[0];
      if (!application.activity) {
        application.activity = [];
      }

      // Add HmsScreenshareActivity WITHOUT Theme.Translucent (which causes Android 15 / ComponentActivity crashes)
      const screenshareActivityName = 'com.reactnativehmssdk.HmsScreenshareActivity';
      const existingActivityIndex = application.activity.findIndex(
        (act) => act.$ && act.$['android:name'] === screenshareActivityName
      );

      const activityConfig = {
        'android:name': screenshareActivityName,
        'android:label': '@string/app_name',
        'android:exported': 'false',
        'android:configChanges': 'keyboard|keyboardHidden|orientation|screenSize|screenLayout|smallestScreenSize|uiMode',
        'android:supportsPictureInPicture': 'true',
      };

      if (existingActivityIndex !== -1) {
        application.activity[existingActivityIndex].$ = {
          ...application.activity[existingActivityIndex].$,
          ...activityConfig,
        };
        // Explicitly remove any invalid translucent theme that crashes ComponentActivity on API 35+
        delete application.activity[existingActivityIndex].$['android:theme'];
      } else {
        application.activity.push({
          $: activityConfig,
        });
      }

      // Add HMSScreenCaptureService explicitly for Android 14/15 validateForegroundServiceType requirement
      if (!application.service) {
        application.service = [];
      }
      
      if (!androidManifest.$['xmlns:tools']) {
        androidManifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
      }

      const screenCaptureServices = [
        'live.hms.video.media.tracks.HMSScreenCaptureService',
        'com.reactnativehmssdk.HMSScreenCaptureService',
        'live.hms.android.sdk.service.HmsScreenCaptureService',
        'com.reactnativehmssdk.HmsScreenshareService',
        'live.hms.video.services.HMSScreenCaptureService'
      ];

      screenCaptureServices.forEach(serviceName => {
        const existingServiceIndex = application.service.findIndex(
          (srv) => srv.$ && srv.$['android:name'] === serviceName
        );

        const serviceConfig = {
          'android:name': serviceName,
          'android:foregroundServiceType': 'mediaProjection|microphone',
          'tools:node': 'merge'
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

      // 100ms In-Call Foreground Service (requires camera|microphone on Android 14+)
      const callService = 'live.hms.video.sdk.HMSForegroundService';
      const existingCallServiceIndex = application.service.findIndex(
        (srv) => srv.$ && srv.$['android:name'] === callService
      );
      const callServiceConfig = {
        'android:name': callService,
        'android:foregroundServiceType': 'camera|microphone',
        'tools:node': 'merge'
      };
      if (existingCallServiceIndex !== -1) {
        application.service[existingCallServiceIndex].$ = {
          ...application.service[existingCallServiceIndex].$,
          ...callServiceConfig,
        };
      } else {
        application.service.push({
          $: callServiceConfig,
        });
      }
    }

    return config;
  });

  // 2. MainApplication.kt modifications (safe registerReceiver + native crash logger)
  config = withMainApplication(config, (config) => {
    let mainApp = config.modResults.contents;
    
    const importCode = `
import android.content.BroadcastReceiver
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.content.Context
`;

    const overrideCode = `
  override fun registerReceiver(receiver: BroadcastReceiver?, filter: IntentFilter): Intent? {
    if (receiver == null) {
      return super.registerReceiver(null, filter)
    }
    if (Build.VERSION.SDK_INT >= 34 && applicationInfo.targetSdkVersion >= 34) {
      try {
        return super.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
      } catch (e: Exception) {
        return super.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
      }
    }
    return super.registerReceiver(receiver, filter)
  }
`;

    const crashLoggerCode = `
    val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
      try {
        val sw = java.io.StringWriter()
        val pw = java.io.PrintWriter(sw)
        throwable.printStackTrace(pw)
        val stackTrace = sw.toString()
        val prefs = getSharedPreferences("app_crash_logger", Context.MODE_PRIVATE)
        prefs.edit().putString("last_crash_log", stackTrace).commit()
      } catch (e: Exception) {
        e.printStackTrace()
      }
      defaultHandler?.uncaughtException(thread, throwable)
    }
`;

    if (!mainApp.includes('import android.content.BroadcastReceiver')) {
      mainApp = mainApp.replace(
        'import android.app.Application',
        'import android.app.Application' + importCode
      );
    }

    if (!mainApp.includes('override fun registerReceiver')) {
      mainApp = mainApp.replace(
        'override fun onCreate() {',
        overrideCode + '\n  override fun onCreate() {'
      );
    } else {
      // Replace existing override with safe version
      const startIdx = mainApp.indexOf('override fun registerReceiver');
      const endIdx = mainApp.indexOf('override fun onCreate()');
      if (startIdx !== -1 && endIdx !== -1) {
        mainApp = mainApp.slice(0, startIdx) + overrideCode.trim() + '\n\n  ' + mainApp.slice(endIdx);
      }
    }

    if (!mainApp.includes('app_crash_logger')) {
      mainApp = mainApp.replace(
        'super.onCreate()',
        'super.onCreate()\n' + crashLoggerCode
      );
    }

    config.modResults.contents = mainApp;
    return config;
  });

  // 3. MainActivity.kt modifications (show crash alert on startup if previous crash occurred)
  config = withMainActivity(config, (config) => {
    let mainActivity = config.modResults.contents;

    const onResumeCode = `
  override fun onResume() {
    super.onResume()
    try {
      val prefs = getSharedPreferences("app_crash_logger", android.content.Context.MODE_PRIVATE)
      val crashLog = prefs.getString("last_crash_log", null)
      if (!crashLog.isNullOrEmpty()) {
        prefs.edit().remove("last_crash_log").commit()
        android.app.AlertDialog.Builder(this)
          .setTitle("Previous Crash Detected")
          .setMessage(crashLog)
          .setPositiveButton("Copy Log") { _, _ ->
            val clipboard = getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
            val clip = android.content.ClipData.newPlainText("Crash Log", crashLog)
            clipboard.setPrimaryClip(clip)
            android.widget.Toast.makeText(this, "Crash log copied to clipboard!", android.widget.Toast.LENGTH_LONG).show()
          }
          .setNegativeButton("Dismiss", null)
          .setCancelable(false)
          .show()
      }
    } catch (e: Exception) {
      e.printStackTrace()
    }
  }
`;

    if (!mainActivity.includes('override fun onResume()')) {
      const lastBraceIndex = mainActivity.lastIndexOf('}');
      if (lastBraceIndex !== -1) {
        mainActivity = mainActivity.slice(0, lastBraceIndex) + onResumeCode + '\n}\n';
      }
    }

    config.modResults.contents = mainActivity;
    return config;
  });

  return config;
}

module.exports = withHmsScreenshare;

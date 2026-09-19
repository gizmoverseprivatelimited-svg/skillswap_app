/**
 * patch-hms.js
 * 
 * Post-install script for @100mslive/react-native-hms.
 * Safely patches Android native files in @100mslive/react-native-hms:
 * 
 * 1. HMSView.kt:
 *    - Resolve SDK instance robustly (exact id, "12345", or newest active instance in hmsCollection).
 *    - Comprehensive video track lookup: room tracks, previewLocalTracks, previewForRoleVideoTrack, localPeer.videoTrack, cross-instance lookup.
 *    - Safe try/catch around onDetachedFromWindow and removeTrack/addTrack to avoid native WebRTC surface crashes.
 * 
 * 2. HMSRNSDK.kt:
 *    - Retain \`previewLocalTracks: Array<HMSTrack>?\` from \`onPreview(room, localTracks)\`.
 *    - In \`setLocalMute \`: if local peer audio track is null, toggle mute on preview local audio track.
 *    - In \`setLocalVideoMute\`: if local peer video track is null, toggle mute on preview local video track.
 *    - In \`switchCamera\`: if local peer video track is null, invoke switchCamera on preview local video track.
 *    - Clear \`previewLocalTracks = null\` in cancelPreview and cleanup.
 * 
 * 3. HMSEncoder.ts:
 *    - In \`encodeHmsPreviewTracks\`, return typed \`HMSLocalVideoTrack\` and \`HMSLocalAudioTrack\` so JS objects have .setMute() and .switchCamera() methods.
 */

const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..', 'node_modules', '@100mslive', 'react-native-hms');

// ============================================================================
// 1. Patch HMSView.kt
// ============================================================================
const hmsViewPath = path.join(
  baseDir,
  'android',
  'src',
  'main',
  'java',
  'com',
  'reactnativehmssdk',
  'HMSView.kt'
);

if (fs.existsSync(hmsViewPath)) {
  const customHMSViewContent = `package com.reactnativehmssdk

import android.annotation.SuppressLint
import android.content.Context
import android.os.Build
import android.util.Log
import android.view.LayoutInflater
import android.widget.FrameLayout
import androidx.annotation.RequiresApi
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.RCTEventEmitter
import hms.webrtc.RendererCommon
import live.hms.video.media.tracks.HMSLocalVideoTrack
import live.hms.video.media.tracks.HMSVideoTrack
import live.hms.video.utils.HmsUtilities
import live.hms.videoview.HMSVideoView
import live.hms.videoview.VideoViewStateChangeListener

@SuppressLint("ViewConstructor")
class HMSView(
  context: ReactContext,
) : FrameLayout(context) {
  private var hmsVideoView: HMSVideoView? = null
  private var videoTrack: HMSVideoTrack? = null
  private var sdkId: String = "12345"
  private var disableAutoSimulcastLayerSelect = false
  private var jsCanApplyStyles = false
  private var savedTrackId: String? = null
  private var savedCollection: MutableMap<String, HMSRNSDK>? = null
  private var savedMirror: Boolean? = null
  private var savedScaleType: String? = null

  init {
    val inflater = getContext().getSystemService(Context.LAYOUT_INFLATER_SERVICE) as LayoutInflater
    val view = inflater.inflate(R.layout.hms_view, this)

    hmsVideoView = view.findViewById(R.id.hmsVideoView)
    hmsVideoView?.setEnableHardwareScaler(false)

    hmsVideoView?.setMirror(false)
    hmsVideoView?.disableAutoSimulcastLayerSelect(disableAutoSimulcastLayerSelect)

    hmsVideoView?.addVideoViewStateChangeListener(
      object : VideoViewStateChangeListener {
        override fun onResolutionChange(
          newWidth: Int,
          newHeight: Int,
        ) {
          super.onResolutionChange(newWidth, newHeight)

          videoTrack?.let { nonnullVideoTrack ->
            if (nonnullVideoTrack.source == "screen" || !jsCanApplyStyles) {
              jsCanApplyStyles = true

              val data = Arguments.createMap()
              data.putInt("width", newWidth)
              data.putInt("height", newHeight)

              sendEventToJS("ON_RESOLUTION_CHANGE_EVENT", data)
            }
          }
        }
      },
    )
  }

  private fun sendEventToJS(
    eventName: String,
    data: WritableMap,
  ) {
    try {
      val event: WritableMap = Arguments.createMap()
      event.putString("event", eventName)
      event.putMap("data", data)

      val reactContext = context as? ReactContext
      reactContext?.getJSModule(RCTEventEmitter::class.java)?.receiveEvent(id, "topChange", event)
    } catch (e: Exception) {
      Log.w("HMSView", "sendEventToJS failed: " + e.message)
    }
  }

  @RequiresApi(Build.VERSION_CODES.N)
  fun captureHmsView(args: ReadableArray?) {
    hmsVideoView?.let {
      HMSHelper.captureSurfaceView(it, sdkId, args, context, id)
    }
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    try {
      hmsVideoView?.removeTrack()
    } catch (e: Exception) {
      Log.w("HMSView", "onDetachedFromWindow removeTrack notice: " + e.message)
    }
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    videoTrack?.let {
      try {
        hmsVideoView?.addTrack(it)
      } catch (e: Exception) {
        Log.w("HMSView", "onAttachedToWindow addTrack notice: " + e.message)
      }
    } ?: run {
      savedTrackId?.let { tId ->
        savedCollection?.let { col ->
          setData(sdkId, tId, col, savedMirror, savedScaleType)
        }
      }
    }
  }

  fun updateZOrderMediaOverlay(setZOrderMediaOverlay: Boolean?) {
    if (setZOrderMediaOverlay != null && setZOrderMediaOverlay) {
      hmsVideoView?.setZOrderMediaOverlay(setZOrderMediaOverlay)
    }
  }

  fun updateScaleType(scaleType: String?) {
    if (scaleType != null) {
      when (scaleType) {
        "ASPECT_FIT" -> {
          hmsVideoView?.setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FIT)
          return
        }
        "ASPECT_FILL" -> {
          hmsVideoView?.setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FILL)
          return
        }
        "ASPECT_BALANCED" -> {
          hmsVideoView?.setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_BALANCED)
          return
        }
        else -> {
          return
        }
      }
    }
  }

  fun setData(
    id: String?,
    trackId: String?,
    hmsCollection: MutableMap<String, HMSRNSDK>,
    mirror: Boolean?,
    scaleType: String?,
  ) {
    if (id != null) {
      sdkId = id
    }
    savedTrackId = trackId
    savedCollection = hmsCollection
    savedMirror = mirror
    savedScaleType = scaleType

    // Resolve SDK: try exact id, then "12345", then last active instance, then first available
    val rnSDK = hmsCollection[sdkId]
      ?: hmsCollection["12345"]
      ?: hmsCollection.values.lastOrNull()
      ?: hmsCollection.values.firstOrNull()

    val hms = rnSDK?.hmsSDK

    if (trackId != null) {
      if (mirror != null) {
        hmsVideoView?.setMirror(mirror)
      }
      updateScaleType(scaleType)

      var foundTrack: HMSVideoTrack? = null

      // 1. Try room-level lookup (works when joined in a room)
      if (hms != null) {
        try {
          val room = hms.getRoom()
          if (room != null) {
            foundTrack = HmsUtilities.getVideoTrack(trackId, room)
            if (foundTrack == null) {
              foundTrack = HmsUtilities.getTrack(trackId, room) as? HMSVideoTrack
            }
            if (foundTrack == null) {
              // Explicitly look up in auxiliaryTracks and videoTrack of peers (Screenshare tracks are auxiliaryTracks!)
              val peers = room.peerList
              for (i in 0 until peers.size) {
                val peer = peers[i]
                if (peer.videoTrack?.trackId == trackId) {
                  foundTrack = peer.videoTrack
                  break
                }
                val auxTracks = peer.auxiliaryTracks
                for (j in 0 until auxTracks.size) {
                  val auxTrack = auxTracks[j]
                  if (auxTrack is HMSVideoTrack && auxTrack.trackId == trackId) {
                    foundTrack = auxTrack
                    break
                  }
                }
                if (foundTrack != null) break
              }
            }
            if (foundTrack == null) {
              val localPeer = room.localPeer
              if (localPeer != null) {
                if (localPeer.videoTrack?.trackId == trackId) {
                  foundTrack = localPeer.videoTrack
                } else {
                  val lAux = localPeer.auxiliaryTracks
                  for (k in 0 until lAux.size) {
                    val auxTrack = lAux[k]
                    if (auxTrack is HMSVideoTrack && auxTrack.trackId == trackId) {
                      foundTrack = auxTrack
                      break
                    }
                  }
                }
              }
            }
          }
        } catch (e: Exception) {
          Log.w("HMSView", "Room track lookup notice: " + e.message)
        }
      }

      // 2. Try previewLocalTracks (populated by onPreview in HMSRNSDK)
      if (foundTrack == null && rnSDK != null) {
        try {
          val pTracks = rnSDK.previewLocalTracks
          if (pTracks != null) {
            for (t in pTracks) {
              if (t is HMSLocalVideoTrack && (t.trackId == trackId || trackId.isEmpty())) {
                foundTrack = t
                break
              }
            }
          }
        } catch (e: Exception) {
          Log.w("HMSView", "previewLocalTracks lookup notice: " + e.message)
        }
      }

      // 3. Try previewForRoleVideoTrack
      if (foundTrack == null && rnSDK != null) {
        try {
          rnSDK.previewForRoleVideoTrack?.let {
            if (it.trackId == trackId || trackId.isEmpty()) {
              foundTrack = it
            }
          }
        } catch (e: Exception) {
          Log.w("HMSView", "PreviewForRole track lookup notice: " + e.message)
        }
      }

      // 4. Try local peer's video track
      if (foundTrack == null && hms != null) {
        try {
          val localPeer = hms.getLocalPeer()
          val localVideo = localPeer?.videoTrack
          if (localVideo != null && (localVideo.trackId == trackId || trackId.isEmpty())) {
            foundTrack = localVideo
          }
        } catch (e: Exception) {
          Log.w("HMSView", "Local peer track lookup notice: " + e.message)
        }
      }

      // 5. Cross-instance lookup across any other active SDK instances
      if (foundTrack == null) {
        try {
          for ((_, sdk) in hmsCollection) {
            // Check previewLocalTracks
            val pTracks = sdk.previewLocalTracks
            if (pTracks != null) {
              for (t in pTracks) {
                if (t is HMSLocalVideoTrack && (t.trackId == trackId || trackId.isEmpty())) {
                  foundTrack = t
                  break
                }
              }
            }
            if (foundTrack != null) break

            // Check room tracks
            val sdkHms = sdk.hmsSDK ?: continue
            val sdkRoom = sdkHms.getRoom()
            if (sdkRoom != null) {
              var track = HmsUtilities.getVideoTrack(trackId, sdkRoom)
              if (track == null) {
                track = HmsUtilities.getTrack(trackId, sdkRoom) as? HMSVideoTrack
              }
              if (track == null) {
                val peers = sdkRoom.peerList
                for (i in 0 until peers.size) {
                  val peer = peers[i]
                  if (peer.videoTrack?.trackId == trackId) {
                    track = peer.videoTrack
                    break
                  }
                  val auxTracks = peer.auxiliaryTracks
                  for (j in 0 until auxTracks.size) {
                    val auxTrack = auxTracks[j]
                    if (auxTrack is HMSVideoTrack && auxTrack.trackId == trackId) {
                      track = auxTrack
                      break
                    }
                  }
                  if (track != null) break
                }
              }
              if (track == null) {
                val lPeer = sdkRoom.localPeer
                if (lPeer != null) {
                  if (lPeer.videoTrack?.trackId == trackId) {
                    track = lPeer.videoTrack
                  } else {
                    val lAux = lPeer.auxiliaryTracks
                    for (k in 0 until lAux.size) {
                      val auxTrack = lAux[k]
                      if (auxTrack is HMSVideoTrack && auxTrack.trackId == trackId) {
                        track = auxTrack
                        break
                      }
                    }
                  }
                }
              }
              if (track != null) {
                foundTrack = track
                break
              }
            }
            // Check local peer
            val lVid = sdkHms.getLocalPeer()?.videoTrack
            if (lVid != null && (lVid.trackId == trackId || trackId.isEmpty())) {
              foundTrack = lVid
              break
            }
          }
        } catch (e: Exception) {
          Log.w("HMSView", "Cross-instance track lookup notice: " + e.message)
        }
      }

      videoTrack = foundTrack
      if (foundTrack != null && isAttachedToWindow) {
        try {
          hmsVideoView?.removeTrack()
          hmsVideoView?.addTrack(foundTrack)
        } catch (e: Exception) {
          Log.w("HMSView", "Failed to addTrack dynamically: " + e.message)
        }
      } else if (foundTrack == null) {
        // Auto-retry if track was not yet ready during initial mount
        postDelayed({
          if (videoTrack == null && isAttachedToWindow) {
            setData(id, trackId, hmsCollection, mirror, scaleType)
          }
        }, 350)
        postDelayed({
          if (videoTrack == null && isAttachedToWindow) {
            setData(id, trackId, hmsCollection, mirror, scaleType)
          }
        }, 850)
      }
    }
  }

  fun updateAutoSimulcast(autoSimulcast: Boolean?) {
    autoSimulcast?.let {
      hmsVideoView?.disableAutoSimulcastLayerSelect(!it)
    }
  }
}
`;

  fs.writeFileSync(hmsViewPath, customHMSViewContent, 'utf8');
  console.log('[patch-hms] Successfully updated HMSView.kt with robust preview & room track support');
} else {
  console.log('[patch-hms] HMSView.kt not found (skipping)');
}

// ============================================================================
// 2. Patch HMSRNSDK.kt
// ============================================================================
const hmsRNSDKPath = path.join(
  baseDir,
  'android',
  'src',
  'main',
  'java',
  'com',
  'reactnativehmssdk',
  'HMSRNSDK.kt'
);

if (fs.existsSync(hmsRNSDKPath)) {
  let content = fs.readFileSync(hmsRNSDKPath, 'utf8');

  // 1. Add previewLocalTracks property if not present
  if (!content.includes('var previewLocalTracks: Array<HMSTrack>? = null')) {
    content = content.replace(
      'var previewForRoleVideoTrack: HMSLocalVideoTrack? = null',
      'var previewForRoleVideoTrack: HMSLocalVideoTrack? = null\n  var previewLocalTracks: Array<HMSTrack>? = null'
    );
  }

  // 2. In onPreview(room: HMSRoom, localTracks: Array<HMSTrack>), store previewLocalTracks
  if (!content.includes('previewLocalTracks = localTracks')) {
    content = content.replace(
      /override fun onPreview\(\s*room:\s*HMSRoom,\s*localTracks:\s*Array<HMSTrack>,\s*\)\s*\{/,
      'override fun onPreview(\n            room: HMSRoom,\n            localTracks: Array<HMSTrack>,\n          ) {\n            previewLocalTracks = localTracks'
    );
  }

  // 3. Update setLocalMute to check previewLocalTracks when localAudioTrack is null
  const setLocalMuteTarget = `  fun setLocalMute(data: ReadableMap) {
    val isMute = data.getBoolean("isMute")
    val localAudioTrack = hmsSDK?.getLocalPeer()?.audioTrack ?: previewForRoleAudioTrack
    localAudioTrack?.let {
      it.setMute(isMute)
    }
  }`;

  const setLocalMuteReplacement = `  fun setLocalMute(data: ReadableMap) {
    val isMute = data.getBoolean("isMute")
    val previewAudio = previewLocalTracks?.filterIsInstance<HMSLocalAudioTrack>()?.firstOrNull()
    val localAudioTrack = hmsSDK?.getLocalPeer()?.audioTrack ?: previewForRoleAudioTrack ?: previewAudio
    localAudioTrack?.let {
      it.setMute(isMute)
    }
  }`;

  if (content.includes(setLocalMuteTarget)) {
    content = content.replace(setLocalMuteTarget, setLocalMuteReplacement);
  }

  // 4. Update setLocalVideoMute to check previewLocalTracks when localVideoTrack is null
  const setLocalVideoMuteTarget = `  fun setLocalVideoMute(data: ReadableMap) {
    val isMute = data.getBoolean("isMute")
    val localVideoTrack = hmsSDK?.getLocalPeer()?.videoTrack ?: previewForRoleVideoTrack
    localVideoTrack?.let {
      it.setMute(isMute)
    }
  }`;

  const setLocalVideoMuteReplacement = `  fun setLocalVideoMute(data: ReadableMap) {
    val isMute = data.getBoolean("isMute")
    val previewVideo = previewLocalTracks?.filterIsInstance<HMSLocalVideoTrack>()?.firstOrNull()
    val localVideoTrack = hmsSDK?.getLocalPeer()?.videoTrack ?: previewForRoleVideoTrack ?: previewVideo
    localVideoTrack?.let {
      it.setMute(isMute)
    }
  }`;

  if (content.includes(setLocalVideoMuteTarget)) {
    content = content.replace(setLocalVideoMuteTarget, setLocalVideoMuteReplacement);
  }

  // 5. Update switchCamera to check previewLocalTracks when localVideoTrack is null
  const switchCameraTarget = `  fun switchCamera() {
    val localVideoTrack = hmsSDK?.getLocalPeer()?.videoTrack ?: previewForRoleVideoTrack
    localVideoTrack?.let {
      if (!it.isMute) {
        HMSCoroutineScope.launch { it.switchCamera() }
      }
    }
  }`;

  const switchCameraReplacement = `  fun switchCamera() {
    val previewVideo = previewLocalTracks?.filterIsInstance<HMSLocalVideoTrack>()?.firstOrNull()
    val localVideoTrack = hmsSDK?.getLocalPeer()?.videoTrack ?: previewForRoleVideoTrack ?: previewVideo
    localVideoTrack?.let {
      HMSCoroutineScope.launch {
        try {
          it.switchCamera()
        } catch (e: Exception) {
          android.util.Log.w("HMSRNSDK", "switchCamera exception: " + e.message)
        }
      }
    }
  }`;

  if (content.includes(switchCameraTarget)) {
    content = content.replace(switchCameraTarget, switchCameraReplacement);
  }

  // 6. In cancelPreview, clear previewLocalTracks
  if (content.includes('previewForRoleVideoTrack = null') && !content.includes('previewLocalTracks = null')) {
    content = content.replace(
      'previewForRoleVideoTrack = null',
      'previewForRoleVideoTrack = null\n    previewLocalTracks = null'
    );
  }

  fs.writeFileSync(hmsRNSDKPath, content, 'utf8');
  console.log('[patch-hms] Successfully updated HMSRNSDK.kt with preview track mute & camera switch support');
} else {
  console.log('[patch-hms] HMSRNSDK.kt not found (skipping)');
}

// ============================================================================
// 3. Patch HMSEncoder.ts and compiled JS files
// ============================================================================
const hmsEncoderFiles = [
  path.join(baseDir, 'src', 'classes', 'HMSEncoder.ts'),
  path.join(baseDir, 'lib', 'commonjs', 'classes', 'HMSEncoder.js'),
  path.join(baseDir, 'lib', 'module', 'classes', 'HMSEncoder.js'),
];

hmsEncoderFiles.forEach((filePath) => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    // Replace encodeHmsPreviewTracks to use encodeHmsPreviewForRoleTracks logic (returns typed HMSLocalVideoTrack / HMSLocalAudioTrack)
    if (filePath.endsWith('.ts')) {
      const oldCode = `  static encodeHmsPreviewTracks(previewTracks: any[], id: string) {
    return previewTracks?.map((track) => {
      return this.encodeHmsTrack(track, id);
    });
  }`;
      const newCode = `  static encodeHmsPreviewTracks(previewTracks: any[], id: string) {
    return previewTracks?.map((track) => {
      return track.type === HMSTrackType.VIDEO
        ? this.encodeHmsLocalVideoTrack(track, id)
        : this.encodeHmsLocalAudioTrack(track, id);
    });
  }`;
      if (content.includes(oldCode)) {
        content = content.replace(oldCode, newCode);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`[patch-hms] Updated ${path.basename(filePath)} with typed preview tracks`);
      }
    } else if (filePath.includes('commonjs')) {
      const oldCjs = `  static encodeHmsPreviewTracks(previewTracks, id) {
    return previewTracks === null || previewTracks === void 0 ? void 0 : previewTracks.map(track => {
      return this.encodeHmsTrack(track, id);
    });
  }`;
      const newCjs = `  static encodeHmsPreviewTracks(previewTracks, id) {
    return previewTracks === null || previewTracks === void 0 ? void 0 : previewTracks.map(track => {
      return track.type === _HMSTrackType.HMSTrackType.VIDEO ? this.encodeHmsLocalVideoTrack(track, id) : this.encodeHmsLocalAudioTrack(track, id);
    });
  }`;
      if (content.includes(oldCjs)) {
        content = content.replace(oldCjs, newCjs);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`[patch-hms] Updated commonjs ${path.basename(filePath)}`);
      }
    } else if (filePath.includes('module')) {
      const oldMod = `  static encodeHmsPreviewTracks(previewTracks, id) {
    return previewTracks === null || previewTracks === void 0 ? void 0 : previewTracks.map(track => {
      return this.encodeHmsTrack(track, id);
    });
  }`;
      const newMod = `  static encodeHmsPreviewTracks(previewTracks, id) {
    return previewTracks === null || previewTracks === void 0 ? void 0 : previewTracks.map(track => {
      return track.type === HMSTrackType.VIDEO ? this.encodeHmsLocalVideoTrack(track, id) : this.encodeHmsLocalAudioTrack(track, id);
    });
  }`;
      if (content.includes(oldMod)) {
        content = content.replace(oldMod, newMod);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`[patch-hms] Updated module ${path.basename(filePath)}`);
      }
    }
  }
});

// ============================================================================
// 4. Patch HmsScreenshareActivity.kt & HMSRNSDK.kt for screenshare safety
// ============================================================================
const screenshareActivityPath = path.join(
  baseDir,
  'android',
  'src',
  'main',
  'java',
  'com',
  'reactnativehmssdk',
  'HmsScreenshareActivity.kt'
);

if (fs.existsSync(screenshareActivityPath)) {
  let ssContent = fs.readFileSync(screenshareActivityPath, 'utf8');
  if (ssContent.includes('startScreenshare()') && !ssContent.includes('onCreate startScreenshare failed')) {
    ssContent = ssContent.replace(
      /override fun onCreate\(savedInstanceState: Bundle\?\) \{\s*super\.onCreate\(savedInstanceState\)\s*startScreenshare\(\)\s*\}/,
      `override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    try {
      startScreenshare()
    } catch (e: Throwable) {
      android.util.Log.e("HmsScreenshareActivity", "onCreate startScreenshare failed", e)
      val id = intent.getStringExtra("id")
      HMSManager.startingScreenShare = false
      HMSManager.hmsCollection[id]?.screenshareCallback?.reject(e)
      finish()
    }
  }`
    );
    fs.writeFileSync(screenshareActivityPath, ssContent, 'utf8');
    console.log('[patch-hms] Patched HmsScreenshareActivity.kt with try-catch protection');
  }
}

console.log('[patch-hms] All patches applied successfully');

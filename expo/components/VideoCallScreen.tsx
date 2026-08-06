import { View, StyleSheet, Text, TouchableOpacity, Image, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, PhoneOff, Mic, MicOff, Camera, CameraOff } from 'lucide-react-native';
import { useState } from 'react';

interface VideoCallScreenProps {
  partnerName: string;
  partnerImage?: string;
  onEndCall: () => void;
}

export default function VideoCallScreen({ partnerName, partnerImage, onEndCall }: VideoCallScreenProps) {
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoOff, setIsVideoOff] = useState<boolean>(false);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1F2937', '#111827']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <Text style={styles.statusText}>Connecting...</Text>
          <Text style={styles.partnerName}>{partnerName}</Text>
        </View>

        <View style={styles.videoContainer}>
          {partnerImage ? (
            <Image source={{ uri: partnerImage }} style={styles.partnerVideo} />
          ) : (
            <View style={styles.placeholderVideo}>
              <Video size={64} color="rgba(255, 255, 255, 0.3)" />
              <Text style={styles.placeholderText}>Video call</Text>
            </View>
          )}

          <View style={styles.selfVideoContainer}>
            <View style={styles.selfVideo}>
              {isVideoOff ? (
                <CameraOff size={24} color="rgba(255, 255, 255, 0.7)" />
              ) : (
                <Text style={styles.selfVideoText}>You</Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.controlButton, isMuted && styles.controlButtonActive]}
            onPress={() => setIsMuted(!isMuted)}
            testID="toggle-mic"
          >
            {isMuted ? (
              <MicOff size={24} color="#FFFFFF" />
            ) : (
              <Mic size={24} color="#FFFFFF" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.endCallButton}
            onPress={onEndCall}
            testID="end-call"
          >
            <PhoneOff size={28} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, isVideoOff && styles.controlButtonActive]}
            onPress={() => setIsVideoOff(!isVideoOff)}
            testID="toggle-video"
          >
            {isVideoOff ? (
              <CameraOff size={24} color="#FFFFFF" />
            ) : (
              <Camera size={24} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            {Platform.OS === 'web' 
              ? 'Video calling requires camera permissions' 
              : 'This is a demo UI. Integrate with WebRTC or Agora for real calls.'}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  statusText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '600' as const,
  },
  partnerName: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  videoContainer: {
    flex: 1,
    marginVertical: 40,
    borderRadius: 24,
    overflow: 'hidden' as const,
    position: 'relative' as const,
  },
  partnerVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1F2937',
  },
  placeholderVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(31, 41, 55, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  placeholderText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '600' as const,
  },
  selfVideoContainer: {
    position: 'absolute' as const,
    bottom: 20,
    right: 20,
  },
  selfVideo: {
    width: 100,
    height: 140,
    borderRadius: 16,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  selfVideoText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600' as const,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(55, 65, 81, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  controlButtonActive: {
    backgroundColor: '#EF4444',
  },
  endCallButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  noticeText: {
    fontSize: 12,
    color: 'rgba(191, 219, 254, 0.9)',
    textAlign: 'center' as const,
    lineHeight: 18,
  },
});

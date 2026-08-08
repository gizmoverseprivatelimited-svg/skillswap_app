import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState, useEffect, useCallback } from 'react';
import HMSView from '@/components/HMSView';
import { useCurrentUser } from '@/providers/current-user';
import { useAuth } from '@/providers/auth';
import { useSocket } from '@/providers/socket';
import url from '@/constants/backurl';

export default function ClassCallScreen() {
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const router = useRouter();
  const { currentUser, isLoading: isUserLoading } = useCurrentUser();
  const { user: authUser } = useAuth();
  const { socket } = useSocket();

  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | undefined>(undefined);
  const [loadingCode, setLoadingCode] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isTeacher, setIsTeacher] = useState(false);

  const currentUserId = currentUser?.id || (currentUser as any)?._id || authUser?.id || (authUser as any)?._id || '';

  useEffect(() => {
    async function fetchRoomCode() {
      if (!classId) return;
      if (isUserLoading) return;
      try {
        setLoadingCode(true);
        const res = await fetch(`${url}/classes/${classId}/100ms-room?userId=${encodeURIComponent(currentUserId)}`);
        const data = await res.json();
        if (res.ok) {
          setRoomCode(data.roomCode);
          setAuthToken(data.authToken || undefined);
          setIsTeacher(!!data.isTeacher);
        } else {
          setErrorMsg(data.error || 'This class session has ended and cannot be joined.');
        }
      } catch (err) {
        console.error('[ClassCallScreen] Fetch room code error:', err);
        setErrorMsg('Could not connect to video server.');
      } finally {
        setLoadingCode(false);
      }
    }
    void fetchRoomCode();
  }, [classId, currentUserId, isUserLoading]);

  const handleEndCall = useCallback(async () => {
    if (isTeacher && classId) {
      try {
        await fetch(`${url}/classes/${classId}/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        console.error('[ClassCallScreen] Error ending class on leave:', err);
      }
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(`/class/${classId}` as any);
    }
  }, [isTeacher, classId, router]);

  // Real-time socket listener: if teacher ends class, automatically exit students
  useEffect(() => {
    if (!socket || !classId) return;

    const handleClassEnded = (data: { classId: string }) => {
      if (data && String(data.classId) === String(classId)) {
        console.log('[ClassCallScreen] Class ended by teacher, leaving room');
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace(`/class/${classId}` as any);
        }
      }
    };

    socket.on('class_ended', handleClassEnded);
    return () => {
      socket.off('class_ended', handleClassEnded);
    };
  }, [socket, classId, router]);

  if (loadingCode) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Joining class room...</Text>
      </View>
    );
  }

  if (errorMsg || !roomCode) {
    return (
      <View style={styles.errorContainer}>
        <LinearGradient colors={['#1F2937', '#111827']} style={styles.errorGradient}>
          <TouchableOpacity style={styles.backButton} onPress={handleEndCall}>
            <ArrowLeft size={20} color="#F8FAFC" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.errorContent}>
            <Text style={styles.errorTitle}>Class Ended</Text>
            <Text style={styles.errorMessage}>{errorMsg || 'This class session is no longer active.'}</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <HMSView
        roomCode={roomCode}
        authToken={authToken}
        userName={currentUser?.name ? `${currentUser.name} (${isTeacher ? 'Teacher' : 'Student'})` : (isTeacher ? 'Teacher' : 'Student')}
        onLeave={handleEndCall}
        isTeacher={isTeacher}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
  },
  errorGradient: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backText: {
    fontSize: 14,
    color: '#F8FAFC',
    fontWeight: '600',
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  errorMessage: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});

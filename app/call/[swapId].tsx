import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useMemo, useState, useEffect } from 'react';
import VideoCallScreen from '../../components/VideoCallScreen';
import HMSView from '../../components/HMSView';
import { useCurrentUser } from '../../providers/current-user';
import { useSkillSwaps } from '../../providers/skill-swaps';
import { resolveImageUrl } from '@/lib/resolveImageUrl';

export default function CallScreen() {
  const { swapId, isJoining } = useLocalSearchParams<{ swapId: string, isJoining?: string }>();
  const router = useRouter();
  const { currentUser, allUsers } = useCurrentUser();

  const { getSwapById } = useSkillSwaps();

  const swap = useMemo(() => {
    if (!swapId) {
      return undefined;
    }
    return getSwapById(swapId);
  }, [getSwapById, swapId]);

  const partner = useMemo(() => {
    if (!swap) {
      return undefined;
    }
    const partnerId = swap.requesterId === currentUser?.id ? swap.recipientId : swap.requesterId;
    // console.log(allUsers.find((user) => user.id === partnerId));
    allUsers.find((user) => {
      console.log(user.id);
      return user.id === partnerId
    })
    return allUsers.find((user) => user.id === partnerId);
  }, [allUsers, currentUser?.id, swap]);

  const handleEndCall = () => {
    router.back();
  };



  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [loadingCode, setLoadingCode] = useState(true);

  useEffect(() => {
    async function fetchRoomCode() {
      if (!swapId) return;
      try {
        const { default: url } = await import('@/constants/backurl');
        const joinParam = isJoining ? `&isJoining=true` : '';
        const res = await fetch(`${url}/swaps/${swapId}/100ms-room?userId=${currentUser?.id || ''}${joinParam}`);
        if (res.ok) {
          const data = await res.json();
          setRoomCode(data.roomCode);
        } else {
          console.error('Failed to fetch room code', await res.text());
        }
      } catch (err) {
        console.error('Error fetching room code:', err);
      } finally {
        setLoadingCode(false);
      }
    }
    fetchRoomCode();
  }, [swapId, currentUser?.id]);

  if (!swap || !partner) {
    return (
      <View style={styles.errorContainer}>
        <LinearGradient
          colors={['#1F2937', '#111827']}
          style={styles.errorGradient}
        >
          <View style={styles.safeAreaTop} />
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={20} color="#F8FAFC" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.errorContent}>
            <Text style={styles.errorTitle}>Call not available</Text>
            <Text style={styles.errorMessage}>Unable to start the call. Please try again.</Text>
          </View>
          <View style={styles.safeAreaBottom} />
        </LinearGradient>
      </View>
    );
  }

  if (loadingCode) {
    return (
      <View style={[styles.errorContainer, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827' }]}>
        <Text style={{ color: '#fff', marginTop: 20 }}>Joining room...</Text>
      </View>
    );
  }

  if (roomCode) {
    return (
      <HMSView
        roomCode={roomCode}
        userName={currentUser?.name || 'Guest'}
        onLeave={handleEndCall}
      />
    );
  }

  // Fallback to placeholder if roomCode fails
  return (
    <VideoCallScreen
      partnerName={partner.name}
      partnerImage={resolveImageUrl(partner.avatarUrl)}
      onEndCall={handleEndCall}
    />
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
  },
  errorGradient: {
    flex: 1,
    paddingHorizontal: 20,
  },
  safeAreaTop: {
    height: 50,
  },
  safeAreaBottom: {
    height: 34,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backText: {
    fontSize: 14,
    color: '#F8FAFC',
    fontWeight: '600' as const,
  },
  errorContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  errorMessage: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center' as const,
  },
});

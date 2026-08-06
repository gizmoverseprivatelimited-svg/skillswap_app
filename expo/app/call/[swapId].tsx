import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useMemo } from 'react';
import VideoCallScreen from '../../components/VideoCallScreen';
import { useCurrentUser } from '../../providers/current-user';
import { useSkillSwaps } from '../../providers/skill-swaps';

export default function CallScreen() {
  const { swapId } = useLocalSearchParams<{ swapId: string }>();
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
    const partnerId = swap.requesterId === currentUser.id ? swap.recipientId : swap.requesterId;
    return allUsers.find((user) => user.id === partnerId);
  }, [allUsers, currentUser.id, swap]);

  const handleEndCall = () => {
    router.back();
  };

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

  return (
    <VideoCallScreen
      partnerName={partner.name}
      partnerImage={partner.avatarUrl}
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

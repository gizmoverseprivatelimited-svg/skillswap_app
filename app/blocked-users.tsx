import { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, ShieldCheck, UserX } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useSafety } from '@/providers/safety';
import { useAuth } from '@/providers/auth';
import { useAlert } from '@/providers/alert';
import { BlockedUser } from '@/types';

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';

export default function BlockedUsersScreen() {
  const router = useRouter();
  const auth = useAuth();
  const currentUserId = auth?.user?.id || (auth?.user as any)?._id || '';
  const { blockedUsers, unblockUser, fetchBlockedUsers } = useSafety();
  const { showAlert } = useAlert();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchBlockedUsers(currentUserId);
    setIsRefreshing(false);
  }, [fetchBlockedUsers, currentUserId]);

  const handleUnblock = (user: BlockedUser) => {
    if (!currentUserId || currentUserId === '1' || auth?.user?.isDemo) {
      showAlert(
        'Login Required 🔒',
        'Please log in or create an account to manage blocked users.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/login' as any) },
        ]
      );
      return;
    }
    showAlert(
      'Unblock User',
      `Are you sure you want to unblock ${user.blockedUserName}? They will be able to view your profile, request swaps, and enroll in your classes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'default',
          onPress: async () => {
            await unblockUser(user.blockedUserId, currentUserId);
            showAlert('User Unblocked', `${user.blockedUserName} has been unblocked.`);
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: BlockedUser }) => {
    const formattedDate = item.blockedAt
      ? new Date(item.blockedAt).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : '';

    return (
      <View style={styles.userCard}>
        <Image
          source={{ uri: item.blockedUserAvatar || DEFAULT_AVATAR }}
          style={styles.avatar}
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.blockedUserName || 'Blocked User'}
          </Text>
          {formattedDate ? (
            <Text style={styles.blockedDate}>Blocked on {formattedDate}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.unblockBtn}
          onPress={() => handleUnblock(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.unblockBtnText}>Unblock</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Blocked Users',
          headerStyle: { backgroundColor: Colors.light.background },
          headerTintColor: Colors.light.text,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ paddingRight: 12 }}
            >
              <ArrowLeft size={22} color={Colors.light.text} />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={styles.container}>
        {blockedUsers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <ShieldCheck size={48} color={Colors.light.primary} />
            </View>
            <Text style={styles.emptyTitle}>No Blocked Users</Text>
            <Text style={styles.emptyDesc}>
              When you block someone, they will appear here. You can unblock them at any time.
            </Text>
          </View>
        ) : (
          <FlatList
            data={blockedUsers}
            keyExtractor={(item) => item.id || item.blockedUserId}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                tintColor={Colors.light.primary}
                colors={[Colors.light.primary]}
              />
            }
            ListHeaderComponent={
              <Text style={styles.headerSubtitle}>
                Blocked users cannot send you swap requests, message you, or enroll in your classes.
              </Text>
            }
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  listContent: {
    padding: 20,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    marginBottom: 16,
    lineHeight: 18,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.card,
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.light.backgroundTertiary,
  },
  userInfo: {
    flex: 1,
    marginLeft: 14,
    marginRight: 10,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  blockedDate: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
  unblockBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
  },
  unblockBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.primary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

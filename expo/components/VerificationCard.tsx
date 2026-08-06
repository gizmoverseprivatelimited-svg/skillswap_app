import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Shield, CheckCircle, Clock, XCircle } from 'lucide-react-native';
import type { VerificationStatus } from '@/types';
import Colors from '@/constants/colors';

interface VerificationCardProps {
  title: string;
  description: string;
  status: VerificationStatus;
  icon: React.ReactNode;
  onPress: () => void;
  trustPoints?: number;
}

export function VerificationCard({
  title,
  description,
  status,
  icon,
  onPress,
  trustPoints,
}: VerificationCardProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'verified':
        return {
          color: '#10B981',
          bgColor: '#D1FAE5',
          text: 'Verified',
          icon: <CheckCircle size={16} color="#10B981" />,
          actionText: 'View',
        };
      case 'pending':
        return {
          color: '#F59E0B',
          bgColor: '#FEF3C7',
          text: 'Pending Review',
          icon: <Clock size={16} color="#F59E0B" />,
          actionText: 'View',
        };
      case 'rejected':
        return {
          color: '#EF4444',
          bgColor: '#FEE2E2',
          text: 'Rejected',
          icon: <XCircle size={16} color="#EF4444" />,
          actionText: 'Retry',
        };
      default:
        return {
          color: Colors.light.textSecondary,
          bgColor: Colors.light.backgroundTertiary,
          text: 'Not Verified',
          icon: null,
          actionText: 'Verify',
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <TouchableOpacity
      style={[
        styles.card,
        status === 'verified' && styles.verifiedCard,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: statusConfig.bgColor },
          ]}
        >
          <View>{icon}</View>
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
        {trustPoints !== undefined && trustPoints > 0 && (
          <View style={styles.trustBadge}>
            <Shield size={12} color={Colors.light.primary} />
            <Text style={styles.trustText}>+{trustPoints}</Text>
          </View>
        )}
      </View>
      <View style={styles.cardFooter}>
        <View style={styles.statusContainer}>
          {statusConfig.icon}
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {statusConfig.text}
          </Text>
        </View>
        <Text style={styles.actionText}>{statusConfig.actionText}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  verifiedCard: {
    borderColor: '#10B981',
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trustText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.light.primary,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.primary,
  },
});

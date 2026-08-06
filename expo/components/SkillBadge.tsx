import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Award, CheckCircle, Star } from 'lucide-react-native';
import type { SkillBadge as SkillBadgeType } from '@/types';

interface SkillBadgeProps {
  badge: SkillBadgeType;
  size?: 'small' | 'medium';
}

export function SkillBadge({ badge, size = 'medium' }: SkillBadgeProps) {
  const getBadgeConfig = () => {
    switch (badge.badgeType) {
      case 'verified':
        return {
          icon: <CheckCircle size={size === 'small' ? 14 : 16} color="#10B981" />,
          bgColor: '#D1FAE5',
          textColor: '#065F46',
          label: 'Verified',
        };
      case 'expert':
        return {
          icon: <Star size={size === 'small' ? 14 : 16} color="#F59E0B" fill="#F59E0B" />,
          bgColor: '#FEF3C7',
          textColor: '#92400E',
          label: 'Expert',
        };
      case 'endorsed':
        return {
          icon: <Award size={size === 'small' ? 14 : 16} color="#8B5CF6" />,
          bgColor: '#EDE9FE',
          textColor: '#5B21B6',
          label: 'Endorsed',
        };
    }
  };

  const config = getBadgeConfig();
  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.bgColor },
        isSmall && styles.badgeSmall,
      ]}
    >
      {config.icon}
      <Text
        style={[
          styles.badgeText,
          { color: config.textColor },
          isSmall && styles.badgeTextSmall,
        ]}
      >
        {badge.skillTitle}
      </Text>
      <View style={styles.separator} />
      <Text
        style={[
          styles.typeText,
          { color: config.textColor },
          isSmall && styles.typeTextSmall,
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  badgeSmall: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  badgeTextSmall: {
    fontSize: 12,
  },
  separator: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  typeText: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  typeTextSmall: {
    fontSize: 11,
  },
});

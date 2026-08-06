import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Shield, CheckCircle2 } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface TrustScoreBadgeProps {
  score: number;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

export function TrustScoreBadge({
  score,
  size = 'medium',
  showLabel = true,
}: TrustScoreBadgeProps) {
  const getScoreColor = () => {
    if (score >= 80) return '#10B981';
    if (score >= 50) return '#F59E0B';
    if (score >= 20) return '#F97316';
    return Colors.light.textSecondary;
  };

  const getScoreLabel = () => {
    if (score >= 80) return 'Highly Trusted';
    if (score >= 50) return 'Trusted';
    if (score >= 20) return 'Partially Verified';
    return 'Unverified';
  };

  const sizeConfig = {
    small: {
      container: 36,
      icon: 16,
      fontSize: 10,
      labelSize: 11,
    },
    medium: {
      container: 56,
      icon: 24,
      fontSize: 14,
      labelSize: 13,
    },
    large: {
      container: 72,
      icon: 32,
      fontSize: 18,
      labelSize: 15,
    },
  };

  const config = sizeConfig[size];
  const scoreColor = getScoreColor();

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.badge,
          {
            width: config.container,
            height: config.container,
            backgroundColor: `${scoreColor}15`,
          },
        ]}
      >
        {score >= 80 ? (
          <CheckCircle2
            size={config.icon}
            color={scoreColor}
            fill={scoreColor}
          />
        ) : (
          <Shield size={config.icon} color={scoreColor} />
        )}
        <Text
          style={[
            styles.scoreText,
            { fontSize: config.fontSize, color: scoreColor },
          ]}
        >
          {score}
        </Text>
      </View>
      {showLabel && (
        <Text
          style={[
            styles.labelText,
            { fontSize: config.labelSize, color: scoreColor },
          ]}
        >
          {getScoreLabel()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  scoreText: {
    fontWeight: '800' as const,
    position: 'absolute',
    bottom: -2,
  },
  labelText: {
    fontWeight: '600' as const,
    textAlign: 'center',
  },
});

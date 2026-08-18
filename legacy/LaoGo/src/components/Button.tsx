import React from 'react';
import { Pressable, View, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, radius, HIT } from '../theme';
import { T } from './Typography';

const APressable = Animated.createAnimatedComponent(Pressable);

export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props {
  lo: string;
  en?: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  compact?: boolean;
  /** medium impact on press — used for accept actions */
  haptic?: 'light' | 'medium' | 'success' | false;
  style?: StyleProp<ViewStyle>;
  right?: React.ReactNode;
}

export function Button({
  lo,
  en,
  onPress,
  variant = 'primary',
  disabled,
  compact,
  haptic = 'light',
  style,
  right,
}: Props) {
  const scale = useSharedValue(1);

  const skin = {
    primary: { bg: colors.black, fg: colors.lime, border: colors.black, sub: 'rgba(212,242,75,0.7)' },
    secondary: { bg: colors.white, fg: colors.text, border: colors.lime, sub: colors.muted },
    ghost: { bg: 'transparent', fg: colors.muted, border: colors.border, sub: colors.muted },
    danger: { bg: colors.white, fg: colors.danger, border: '#f0d3d2', sub: colors.muted },
  }[variant];

  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const fire = () => {
    if (haptic) {
      if (haptic === 'success') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.impactAsync(
          haptic === 'medium'
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light
        );
      }
    }
    onPress?.();
  };

  return (
    <APressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={() => {
        scale.value = withSpring(0.96, { damping: 18, stiffness: 320 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 16, stiffness: 260 });
      }}
      onPress={fire}
      style={[
        anim,
        {
          minHeight: compact ? 40 : HIT + 4,
          backgroundColor: skin.bg,
          borderColor: skin.border,
          borderWidth: variant === 'secondary' ? 2 : 1,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: compact ? 14 : 20,
          paddingVertical: compact ? 8 : 12,
          flexDirection: 'row',
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}>
      <View style={{ alignItems: 'center' }}>
        <T size={compact ? 14 : 15} w={700} color={skin.fg}>
          {lo}
        </T>
        {!!en && (
          <T size={compact ? 10 : 11} color={skin.sub}>
            {en}
          </T>
        )}
      </View>
      {right}
    </APressable>
  );
}

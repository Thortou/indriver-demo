import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, radius, shadow } from '../theme';

/**
 * Bottom sheet surface — 24px top radius and a drag handle, per the spec.
 * Static (not gesture-dismissable) because every sheet here is the primary
 * surface of its screen rather than a transient overlay.
 */
export function Sheet({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18).mass(0.7)}
      style={[
        {
          backgroundColor: colors.surface,
          borderTopLeftRadius: radius.sheet,
          borderTopRightRadius: radius.sheet,
          paddingHorizontal: 20,
          paddingTop: 10,
          paddingBottom: 20,
        },
        shadow.sheet,
        style,
      ]}>
      <Handle />
      {children}
    </Animated.View>
  );
}

export function Handle() {
  return (
    <View style={{ alignItems: 'center', paddingBottom: 12 }}>
      <View
        style={{
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
        }}
      />
    </View>
  );
}

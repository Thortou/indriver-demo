import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { colors, radius, shadow } from '../theme';

export function Card({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.card,
          padding: padded ? 16 : 0,
        },
        shadow.card,
        style,
      ]}>
      {children}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: colors.border, marginVertical: 12 }, style]} />;
}

/** Origin dot -> connector -> destination dot. */
export function RouteMarks({
  height = 34,
  originColor = colors.green,
  destColor = colors.black,
}: {
  height?: number;
  originColor?: string;
  destColor?: string;
}) {
  return (
    <View style={{ alignItems: 'center', width: 14 }}>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: originColor }} />
      <View style={{ flex: 1, minHeight: height, width: 1.5, backgroundColor: colors.border }} />
      <View
        style={{
          width: 9,
          height: 9,
          borderRadius: 2,
          backgroundColor: destColor,
        }}
      />
    </View>
  );
}

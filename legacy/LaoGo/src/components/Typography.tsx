import React from 'react';
import { Text, View, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { colors, font, laoLine } from '../theme';

type LaoWeight = 400 | 500 | 600 | 700 | 800;
type NumWeight = 500 | 600 | 700;

const LAO_FAMILY: Record<LaoWeight, string> = {
  400: font.lao,
  500: font.laoMedium,
  600: font.laoSemi,
  700: font.laoBold,
  800: font.laoBlack,
};

const NUM_FAMILY: Record<NumWeight, string> = {
  500: font.num,
  600: font.numSemi,
  700: font.numBold,
};

interface TProps {
  children: React.ReactNode;
  size?: number;
  w?: LaoWeight;
  color?: string;
  center?: boolean;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
}

/**
 * All prose. Never set fontWeight alongside a custom family — Android picks a
 * synthetic face and the Lao glyphs lose their diacritic spacing.
 */
export function T({ children, size = 14, w = 400, color = colors.text, center, numberOfLines, style }: TProps) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontFamily: LAO_FAMILY[w],
          fontSize: size,
          lineHeight: laoLine(size),
          color,
          textAlign: center ? 'center' : 'left',
        },
        style,
      ]}>
      {children}
    </Text>
  );
}

interface NumProps {
  children: React.ReactNode;
  size?: number;
  w?: NumWeight;
  color?: string;
  style?: StyleProp<TextStyle>;
}

/** Prices and figures only — Space Grotesk, per the type spec. */
export function Num({ children, size = 16, w = 700, color = colors.text, style }: NumProps) {
  return (
    <Text
      style={[
        {
          fontFamily: NUM_FAMILY[w],
          fontSize: size,
          lineHeight: Math.round(size * 1.25),
          color,
          letterSpacing: -0.3,
        },
        style,
      ]}>
      {children}
    </Text>
  );
}

/** Lao headline with the small English subtitle used throughout the app. */
export function LaoEn({
  lo,
  en,
  size = 15,
  w = 600,
  color = colors.text,
  subColor = colors.muted,
  center,
  style,
}: {
  lo: string;
  en: string;
  size?: number;
  w?: LaoWeight;
  color?: string;
  subColor?: string;
  center?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style}>
      <T size={size} w={w} color={color} center={center}>
        {lo}
      </T>
      <T size={Math.max(10, size - 4)} color={subColor} center={center}>
        {en}
      </T>
    </View>
  );
}

import React, { useEffect, useState } from 'react';
import { View, StyleProp, ViewStyle, LayoutChangeEvent, DimensionValue } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme';
import { T } from './Typography';

/**
 * A stylised map surface. Deliberately not react-native-maps: no native module,
 * no API key, identical behaviour in Expo Go on every device. Roads, river and
 * blocks are decorative; the route line and markers are laid out for real.
 */

// normalised positions of the two route ends inside the canvas
const A = { x: 0.24, y: 0.7 };
const B = { x: 0.76, y: 0.26 };

type Deco = {
  top: DimensionValue;
  left: DimensionValue;
  width: DimensionValue;
  height: DimensionValue;
  rotate: string;
};

const ROADS_H: Deco[] = [
  { top: '18%', left: '-20%', width: '150%', height: 9,  rotate: '-8deg' },
  { top: '46%', left: '-25%', width: '150%', height: 12, rotate: '4deg' },
  { top: '72%', left: '-15%', width: '150%', height: 7,  rotate: '-6deg' },
];

const ROADS_V: { left: DimensionValue; rotate: string }[] = [
  { left: '28%', rotate: '6deg' },
  { left: '62%', rotate: '-4deg' },
];

const BLOCKS: { top: DimensionValue; left: DimensionValue; width: number; height: number }[] = [
  { top: '24%', left: '10%', width: 46, height: 34 },
  { top: '30%', left: '70%', width: 58, height: 40 },
  { top: '56%', left: '44%', width: 40, height: 44 },
  { top: '60%', left: '8%',  width: 52, height: 30 },
  { top: '10%', left: '48%', width: 36, height: 30 },
];

interface Props {
  /** show pickup/destination markers joined by a route line */
  route?: boolean;
  /** 0..1 position of the vehicle marker along the route */
  carAt?: number;
  /** radar pulse, used while searching for drivers */
  pulse?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function MapCanvas({ route, carAt, pulse, style, children }: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  const ax = A.x * size.w;
  const ay = A.y * size.h;
  const bx = B.x * size.w;
  const by = B.y * size.h;

  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  /* ---- vehicle marker ---- */
  const t = useSharedValue(0);
  useEffect(() => {
    if (carAt == null) return;
    t.value = withTiming(carAt, { duration: 2600, easing: Easing.inOut(Easing.quad) });
  }, [carAt, t]);

  const carStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: ax + dx * t.value - 15 },
      { translateY: ay + dy * t.value - 15 },
    ],
  }));

  /* ---- radar pulse ---- */
  const p = useSharedValue(0);
  useEffect(() => {
    if (!pulse) return;
    p.value = 0;
    p.value = withRepeat(withTiming(1, { duration: 1900, easing: Easing.out(Easing.quad) }), -1, false);
  }, [pulse, p]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - p.value),
    transform: [{ scale: 0.35 + p.value * 1.5 }],
  }));

  return (
    <View
      onLayout={onLayout}
      style={[{ backgroundColor: '#e4e8dc', overflow: 'hidden' }, style]}>
      {/* --- decorative geography --- */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        {/* Mekong */}
        <View
          style={{
            position: 'absolute',
            left: -60,
            bottom: -90,
            width: '160%',
            height: 120,
            backgroundColor: '#cfdce4',
            transform: [{ rotate: '-18deg' }],
          }}
        />
        {/* main roads */}
        {ROADS_H.map((r, i) => (
          <View
            key={`h${i}`}
            style={{
              position: 'absolute',
              top: r.top,
              left: r.left,
              width: r.width,
              height: r.height,
              backgroundColor: '#f2f4ee',
              transform: [{ rotate: r.rotate }],
            }}
          />
        ))}
        {ROADS_V.map((r, i) => (
          <View
            key={`v${i}`}
            style={{
              position: 'absolute',
              top: '-20%',
              left: r.left,
              width: 9,
              height: '150%',
              backgroundColor: '#f2f4ee',
              transform: [{ rotate: r.rotate }],
            }}
          />
        ))}
        {/* city blocks */}
        {BLOCKS.map((b, i) => (
          <View
            key={`b${i}`}
            style={{
              position: 'absolute',
              top: b.top,
              left: b.left,
              width: b.width,
              height: b.height,
              borderRadius: 5,
              backgroundColor: '#dbe1d2',
            }}
          />
        ))}
      </View>

      {/* --- route --- */}
      {route && size.w > 0 && (
        <>
          <View
            style={{
              position: 'absolute',
              left: ax + dx / 2 - len / 2,
              top: ay + dy / 2 - 2,
              width: len,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.black,
              transform: [{ rotate: `${angle}deg` }],
            }}
          />

          {/* pickup */}
          <View
            style={{
              position: 'absolute',
              left: ax - 9,
              top: ay - 9,
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: colors.green,
              borderWidth: 3,
              borderColor: colors.white,
            }}
          />
          {/* destination */}
          <View
            style={{
              position: 'absolute',
              left: bx - 9,
              top: by - 9,
              width: 18,
              height: 18,
              borderRadius: 4,
              backgroundColor: colors.black,
              borderWidth: 3,
              borderColor: colors.white,
            }}
          />

          {carAt != null && (
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: colors.lime,
                  borderWidth: 2,
                  borderColor: colors.black,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                carStyle,
              ]}>
              <T size={14}>🚗</T>
            </Animated.View>
          )}
        </>
      )}

      {/* --- searching pulse --- */}
      {pulse && size.w > 0 && (
        <>
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: size.w / 2 - 90,
                top: size.h / 2 - 90,
                width: 180,
                height: 180,
                borderRadius: 90,
                backgroundColor: colors.lime,
              },
              pulseStyle,
            ]}
          />
          <View
            style={{
              position: 'absolute',
              left: size.w / 2 - 11,
              top: size.h / 2 - 11,
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: colors.black,
              borderWidth: 3,
              borderColor: colors.lime,
            }}
          />
        </>
      )}

      {children}
    </View>
  );
}

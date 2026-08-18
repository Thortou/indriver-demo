import React from 'react';
import { Pressable, View, StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, radius, HIT } from '../theme';
import { T, Num } from './Typography';

/* ------------------------------------------------------------------ stars */

export function Stars({
  value,
  size = 12,
  onChange,
  showNumber = true,
}: {
  value: number;
  size?: number;
  onChange?: (n: number) => void;
  showNumber?: boolean;
}) {
  if (!onChange) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <T size={size} color={colors.green}>
          ★
        </T>
        {showNumber && (
          <Num size={size} w={600} color={colors.text} style={{ marginLeft: 3 }}>
            {value.toFixed(1)}
          </Num>
        )}
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable
          key={i}
          hitSlop={8}
          onPress={() => {
            Haptics.selectionAsync();
            onChange(i);
          }}
          style={{ paddingHorizontal: 5, minHeight: HIT, justifyContent: 'center' }}>
          <T size={size} color={i <= value ? colors.green : colors.border}>
            ★
          </T>
        </Pressable>
      ))}
    </View>
  );
}

/* ----------------------------------------------------------------- avatar */

export function Avatar({ name, size = 42 }: { name: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.lime,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <T size={size * 0.4} w={700} color={colors.text}>
        {name.trim().charAt(0)}
      </T>
    </View>
  );
}

/* ------------------------------------------------------------ status pill */

export function StatusPill({
  on,
  onPress,
}: {
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: on ? colors.lime : colors.input,
        borderRadius: radius.round,
        paddingHorizontal: 14,
        paddingVertical: 9,
        minHeight: HIT - 6,
      }}>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: on ? colors.green : colors.muted,
          marginRight: 8,
        }}
      />
      <View>
        <T size={13} w={700}>
          {on ? 'ອອນລາຍ' : 'ອອບລາຍ'}
        </T>
        <T size={9} color={on ? 'rgba(17,17,17,0.55)' : colors.muted}>
          {on ? 'Online' : 'Offline'}
        </T>
      </View>
    </Pressable>
  );
}

/* -------------------------------------------------------------- segmented */

export function Segmented<T extends string>({
  items,
  value,
  onChange,
  style,
}: {
  items: { id: T; lo: string; en: string; icon?: string }[];
  value: T;
  onChange: (id: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          backgroundColor: colors.surface,
          borderRadius: radius.pill,
          padding: 4,
          gap: 4,
        },
        style,
      ]}>
      {items.map((it) => {
        const active = it.id === value;
        return (
          <Pressable
            key={it.id}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(it.id);
            }}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 8,
              borderRadius: radius.input,
              minHeight: HIT,
              backgroundColor: active ? colors.lime : 'transparent',
            }}>
            {!!it.icon && <T size={15}>{it.icon}</T>}
            <T size={12} w={active ? 700 : 500} color={active ? colors.text : colors.muted}>
              {it.lo}
            </T>
            <T size={9} color={active ? 'rgba(17,17,17,0.5)' : colors.muted}>
              {it.en}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ chips */

export function Chip({
  lo,
  en,
  active,
  onPress,
}: {
  lo: string;
  en?: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: radius.round,
        backgroundColor: active ? colors.lime : colors.input,
        borderWidth: active ? 0 : 1,
        borderColor: colors.border,
        alignItems: 'center',
        minHeight: HIT - 6,
        justifyContent: 'center',
      }}>
      <T size={13} w={active ? 700 : 500}>
        {lo}
      </T>
      {!!en && (
        <T size={9} color={active ? 'rgba(17,17,17,0.5)' : colors.muted}>
          {en}
        </T>
      )}
    </Pressable>
  );
}

/* ----------------------------------------------------------- empty states */

export function Empty({ icon, lo, en }: { icon: string; lo: string; en: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
      <T size={30}>{icon}</T>
      <T size={14} w={600} center style={{ marginTop: 8 }}>
        {lo}
      </T>
      <T size={11} color={colors.muted} center>
        {en}
      </T>
    </View>
  );
}

/* ----------------------------------------------------------- section head */

export function SectionHead({ lo, en }: { lo: string; en: string }) {
  return (
    <View style={{ marginTop: 22, marginBottom: 10 }}>
      <T size={15} w={700}>
        {lo}
      </T>
      <T size={11} color={colors.muted}>
        {en}
      </T>
    </View>
  );
}

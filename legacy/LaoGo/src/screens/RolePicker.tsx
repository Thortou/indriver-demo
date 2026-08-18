import React from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { colors, radius, shadow } from '../theme';
import { T, Num } from '../components/Typography';
import { useStore } from '../store/useStore';
import type { Role } from '../types';

const ROLES: { id: Role; lo: string; en: string; blurbLo: string; blurbEn: string; icon: string }[] = [
  {
    id: 'passenger',
    lo: 'ຜູ້ໂດຍສານ',
    en: 'Passenger',
    blurbLo: 'ຕັ້ງລາຄາຂອງທ່ານເອງ',
    blurbEn: 'Name your own fare',
    icon: '🙋',
  },
  {
    id: 'driver',
    lo: 'ຄົນຂັບ',
    en: 'Driver',
    blurbLo: 'ຮັບວຽກ ຫຼື ຕໍ່ລອງລາຄາ',
    blurbEn: 'Accept or counter-offer',
    icon: '🚕',
  },
];

export default function RolePicker() {
  const setRole = useStore((s) => s.setRole);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <Animated.View entering={FadeIn.duration(500)}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: colors.lime,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <T size={22}>🇱🇦</T>
            </View>
            <Num size={30} w={700} style={{ marginLeft: 12 }}>
              LaoGo
            </Num>
          </View>

          <T size={26} w={700} style={{ marginTop: 26 }}>
            ຕັ້ງລາຄາເອງ ຕໍ່ລອງໄດ້
          </T>
          <T size={13} color={colors.muted} style={{ marginTop: 2 }}>
            Name your fare. Drivers accept or counter.
          </T>
        </Animated.View>

        <View style={{ marginTop: 34, gap: 14 }}>
          {ROLES.map((r, i) => (
            <Animated.View key={r.id} entering={FadeInDown.delay(120 + i * 90).springify().damping(16)}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setRole(r.id);
                }}
                style={({ pressed }) => [
                  {
                    backgroundColor: pressed ? colors.lime : colors.surface,
                    borderRadius: radius.card,
                    padding: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                  },
                  shadow.card,
                ]}>
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: colors.input,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <T size={24}>{r.icon}</T>
                </View>

                <View style={{ flex: 1, marginLeft: 16 }}>
                  <T size={19} w={700}>
                    {r.lo}
                  </T>
                  <T size={12} color={colors.muted}>
                    {r.en}
                  </T>
                  <T size={12} w={500} style={{ marginTop: 6 }}>
                    {r.blurbLo}
                  </T>
                  <T size={10} color={colors.muted}>
                    {r.blurbEn}
                  </T>
                </View>

                <T size={20} color={colors.muted}>
                  ›
                </T>
              </Pressable>
            </Animated.View>
          ))}
        </View>

        <T size={11} color={colors.muted} center style={{ marginTop: 30 }}>
          ຂໍ້ມູນຈຳລອງທັງໝົດ · Demo data only, no account needed
        </T>
      </View>
    </SafeAreaView>
  );
}

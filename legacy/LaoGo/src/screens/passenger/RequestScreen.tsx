import React from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, radius, HIT } from '../../theme';
import { T, Num } from '../../components/Typography';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Segmented } from '../../components/Bits';
import { RouteMarks } from '../../components/Card';
import { FareStepper } from '../../components/FareStepper';
import { MapCanvas } from '../../components/MapCanvas';
import { SERVICES } from '../../data/services';
import { useStore } from '../../store/useStore';
import { km, roadKm, suggestFare } from '../../utils/format';
import type { PassengerStackParams } from '../../navigation/RootNavigator';
import type { ServiceId } from '../../types';

type Props = NativeStackScreenProps<PassengerStackParams, 'Request'>;

/** Step 2 — vehicle and fare. The route was chosen on WhereTo. */
export default function RequestScreen({ navigation }: Props) {
  const { service, setService, pickup, dropoff, fare, setFare, findDrivers } = useStore();

  const distance = roadKm(pickup, dropoff);
  const suggested = suggestFare(distance, service);

  const go = () => {
    findDrivers();
    navigation.navigate('Finding');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <MapCanvas route style={{ flex: 1 }} />

      {/* ---- step marker + vehicle picker float over the map ---- */}
      <SafeAreaView edges={['top']} style={{ position: 'absolute', left: 0, right: 0, top: 0 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={10}
              style={({ pressed }) => ({
                width: HIT - 6,
                height: HIT - 6,
                borderRadius: radius.round,
                backgroundColor: pressed ? colors.lime : colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 8,
              })}>
              <T size={16}>‹</T>
            </Pressable>

            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.round,
                paddingHorizontal: 14,
                paddingVertical: 7,
              }}>
              <T size={12} w={700}>
                ຂັ້ນຕອນ 2 ຈາກ 2 · Step 2 of 2
              </T>
            </View>
          </View>

          <Segmented<ServiceId>
            items={SERVICES.map((s) => ({ id: s.id, lo: s.lo, en: s.en, icon: s.icon }))}
            value={service}
            onChange={setService}
          />
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.surface }}>
        <Sheet>
          {/* ---- chosen route, tap to go back and edit ---- */}
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: pressed ? colors.border : colors.input,
              borderRadius: radius.input,
              padding: 12,
            })}>
            <RouteMarks height={16} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <T size={13} w={600} numberOfLines={1}>
                {pickup.lo}
              </T>
              <View style={{ height: 8 }} />
              <T size={13} w={600} numberOfLines={1}>
                {dropoff.lo}
              </T>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Num size={12} w={600} color={colors.muted}>
                {km(distance)}
              </Num>
              <T size={10} color={colors.muted}>
                ແກ້ໄຂ · Edit
              </T>
            </View>
          </Pressable>

          {/* ---- fare ---- */}
          <View
            style={{
              backgroundColor: colors.input,
              borderRadius: radius.card,
              paddingVertical: 10,
              paddingHorizontal: 12,
              marginTop: 12,
            }}>
            <T size={12} color={colors.muted} center>
              ລາຄາຂອງທ່ານ · Your fare
            </T>
            <FareStepper value={fare} onChange={setFare} suggested={suggested} />
          </View>

          <Button
            lo="ຊອກຫາຄົນຂັບ"
            en="Find a driver"
            onPress={go}
            haptic="medium"
            style={{ marginTop: 14 }}
          />
        </Sheet>
      </SafeAreaView>
    </View>
  );
}

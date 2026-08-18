import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, radius, HIT } from '../../theme';
import { T, Num } from '../../components/Typography';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { RouteMarks } from '../../components/Card';
import { MapCanvas } from '../../components/MapCanvas';
import { PlaceSearch } from '../../components/PlaceSearch';
import { PLACES } from '../../data/places';
import { useStore } from '../../store/useStore';
import { km, roadKm } from '../../utils/format';
import type { PassengerStackParams } from '../../navigation/RootNavigator';
import type { Place } from '../../types';

type Props = NativeStackScreenProps<PassengerStackParams, 'WhereTo'>;

/** Step 1 — choose start and end. Vehicle and fare come next. */
export default function WhereToScreen({ navigation }: Props) {
  const { pickup, dropoff, setPickup, setDropoff, swapEnds } = useStore();
  const [picking, setPicking] = useState<'pickup' | 'dropoff' | null>(null);

  const distance = roadKm(pickup, dropoff);
  const sameEnds = pickup.id === dropoff.id;

  // a few well-known destinations for one-tap selection
  const quick = PLACES.filter((p) =>
    ['wattay', 'morning-market', 'that-luang', 'itecc', 'dongdok'].includes(p.id)
  ).filter((p) => p.id !== pickup.id);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <MapCanvas route style={{ flex: 1 }} />

      <SafeAreaView edges={['top']} style={{ position: 'absolute', left: 0, right: 0, top: 0 }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: colors.surface,
              borderRadius: radius.round,
              paddingHorizontal: 14,
              paddingVertical: 7,
            }}>
            <T size={12} w={700}>
              ຂັ້ນຕອນ 1 ຈາກ 2 · Step 1 of 2
            </T>
          </View>
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.surface }}>
        <Sheet>
          <T size={22} w={700}>
            ຈະໄປໃສ?
          </T>
          <T size={12} color={colors.muted} style={{ marginBottom: 14 }}>
            Where to?
          </T>

          {/* ---- the two fields ---- */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <RouteMarks height={26} />

            <View style={{ flex: 1, marginLeft: 12 }}>
              <BigField
                label="ຈຸດເລີ່ມຕົ້ນ"
                labelEn="Start location"
                place={pickup}
                onPress={() => setPicking('pickup')}
              />
              <View style={{ height: 10 }} />
              <BigField
                label="ຈຸດປາຍທາງ"
                labelEn="End location"
                place={dropoff}
                onPress={() => setPicking('dropoff')}
              />
            </View>

            <Pressable
              onPress={swapEnds}
              hitSlop={8}
              style={({ pressed }) => ({
                width: HIT,
                height: HIT,
                borderRadius: radius.input,
                backgroundColor: pressed ? colors.lime : colors.input,
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 10,
              })}>
              <T size={17}>⇅</T>
            </Pressable>
          </View>

          {/* ---- quick destinations ---- */}
          <T size={11} color={colors.muted} style={{ marginTop: 16 }}>
            ສະຖານທີ່ນິຍົມ · Popular destinations
          </T>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
            {quick.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setDropoff(p)}
                style={({ pressed }) => ({
                  backgroundColor: p.id === dropoff.id ? colors.lime : pressed ? colors.border : colors.input,
                  borderRadius: radius.round,
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  minHeight: HIT - 8,
                  justifyContent: 'center',
                })}>
                <T size={12} w={p.id === dropoff.id ? 700 : 500}>
                  {p.lo}
                </T>
                <T size={9} color={p.id === dropoff.id ? 'rgba(17,17,17,0.55)' : colors.muted}>
                  {p.en}
                </T>
              </Pressable>
            ))}
          </ScrollView>

          {/* ---- distance + continue ---- */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 6,
            }}>
            <T size={12} color={colors.muted}>
              ໄລຍະທາງ · Distance
            </T>
            <Num size={15} w={600}>
              {km(distance)}
            </Num>
          </View>

          <Button
            lo="ຕໍ່ໄປ · ເລືອກລົດ"
            en="Continue to vehicle"
            onPress={() => navigation.navigate('Request')}
            haptic="medium"
            disabled={sameEnds}
            style={{ marginTop: 14 }}
          />

          {sameEnds && (
            <T size={11} color={colors.danger} center style={{ marginTop: 8 }}>
              ຈຸດເລີ່ມຕົ້ນ ແລະ ຈຸດປາຍທາງຕ້ອງບໍ່ຊ້ຳກັນ
            </T>
          )}
        </Sheet>
      </SafeAreaView>

      <PlaceSearch
        visible={picking === 'pickup'}
        titleLo="ເລືອກຈຸດເລີ່ມຕົ້ນ"
        titleEn="Choose start location"
        excludeId={dropoff.id}
        onPick={(p) => {
          setPickup(p);
          setPicking(null);
        }}
        onClose={() => setPicking(null)}
      />
      <PlaceSearch
        visible={picking === 'dropoff'}
        titleLo="ເລືອກຈຸດປາຍທາງ"
        titleEn="Choose end location"
        excludeId={pickup.id}
        onPick={(p) => {
          setDropoff(p);
          setPicking(null);
        }}
        onClose={() => setPicking(null)}
      />
    </View>
  );
}

function BigField({
  label,
  labelEn,
  place,
  onPress,
}: {
  label: string;
  labelEn: string;
  place: Place;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.border : colors.input,
        borderRadius: radius.input,
        paddingHorizontal: 14,
        paddingVertical: 11,
        minHeight: HIT + 8,
        justifyContent: 'center',
        flexDirection: 'row',
        alignItems: 'center',
      })}>
      <View style={{ flex: 1 }}>
        <T size={10} color={colors.muted}>
          {label} · {labelEn}
        </T>
        <T size={16} w={600} numberOfLines={1}>
          {place.lo}
        </T>
        <T size={10} color={colors.muted} numberOfLines={1}>
          {place.en}
        </T>
      </View>
      <T size={15} color={colors.muted}>
        ›
      </T>
    </Pressable>
  );
}

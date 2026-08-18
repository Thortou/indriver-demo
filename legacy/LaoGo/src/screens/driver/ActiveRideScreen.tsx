import React, { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, radius } from '../../theme';
import { T, Num } from '../../components/Typography';
import { Card, Divider, RouteMarks } from '../../components/Card';
import { Button } from '../../components/Button';
import { Avatar, Stars } from '../../components/Bits';
import { MapCanvas } from '../../components/MapCanvas';
import { useStore } from '../../store/useStore';
import { kip, km, serviceById } from '../../utils/format';
import type { DriverStackParams } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<DriverStackParams, 'ActiveRide'>;

const STEP = {
  topickup: {
    titleLo: 'ໄປຮັບຜູ້ໂດຍສານ',
    titleEn: 'Navigate to pickup',
    ctaLo: 'ຮອດຈຸດຮັບແລ້ວ',
    ctaEn: "I've arrived",
    carAt: 0.1,
  },
  arrived: {
    titleLo: 'ຮອດຈຸດຮັບແລ້ວ',
    titleEn: 'At the pickup point',
    ctaLo: 'ຮັບຜູ້ໂດຍສານແລ້ວ',
    ctaEn: 'Passenger on board',
    carAt: 0.16,
  },
  intrip: {
    titleLo: 'ກຳລັງເດີນທາງ',
    titleEn: 'Trip in progress',
    ctaLo: 'ຈົບການເດີນທາງ',
    ctaEn: 'Complete trip',
    carAt: 0.75,
  },
} as const;

export default function ActiveRideScreen({ navigation }: Props) {
  const { activeJob, jobStage, advanceJob } = useStore();

  // when the job finishes the store clears it — fall back to the list
  useEffect(() => {
    if (!activeJob) navigation.goBack();
  }, [activeJob, navigation]);

  if (!activeJob) return null;

  const step = STEP[jobStage];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <MapCanvas route carAt={step.carAt} style={{ height: 230 }} />

      <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 30 }}>
          <T size={22} w={700}>
            {step.titleLo}
          </T>
          <T size={12} color={colors.muted}>
            {step.titleEn}
          </T>

          <Card style={{ marginTop: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Avatar name={activeJob.passenger.en} size={46} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <T size={16} w={700}>
                  {activeJob.passenger.lo}
                </T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <T size={10} color={colors.muted}>
                    {serviceById(activeJob.service).en}
                  </T>
                  <Stars value={activeJob.passenger.rating} />
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Num size={20} w={700}>
                  {kip(activeJob.agreedFare)}
                </Num>
                <T size={10} color={colors.muted}>
                  ຕົກລົງແລ້ວ · agreed
                </T>
              </View>
            </View>

            <Divider />

            <View style={{ flexDirection: 'row' }}>
              <RouteMarks height={24} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <T size={14} w={600} style={{ flex: 1 }} numberOfLines={1}>
                    {activeJob.pickup.lo}
                  </T>
                  <Num size={12} w={600} color={colors.muted}>
                    {km(activeJob.pickupKm)}
                  </Num>
                </View>
                <T size={10} color={colors.muted}>
                  {activeJob.pickup.en}
                </T>

                <View style={{ height: 14 }} />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <T size={14} w={600} style={{ flex: 1 }} numberOfLines={1}>
                    {activeJob.dropoff.lo}
                  </T>
                  <Num size={12} w={600} color={colors.muted}>
                    {km(activeJob.tripKm)}
                  </Num>
                </View>
                <T size={10} color={colors.muted}>
                  {activeJob.dropoff.en}
                </T>
              </View>
            </View>

            {!!activeJob.note && (
              <View
                style={{
                  marginTop: 12,
                  backgroundColor: colors.input,
                  borderRadius: radius.input,
                  padding: 10,
                }}>
                <T size={12} color={colors.muted}>
                  “{activeJob.note}”
                </T>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <Button lo="ໂທ" en="Call" variant="secondary" compact style={{ flex: 1 }} />
              <Button lo="ຂໍ້ຄວາມ" en="Chat" variant="secondary" compact style={{ flex: 1 }} />
            </View>
          </Card>

          <Button
            lo={step.ctaLo}
            en={step.ctaEn}
            onPress={advanceJob}
            haptic={jobStage === 'intrip' ? 'success' : 'medium'}
            style={{ marginTop: 16 }}
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

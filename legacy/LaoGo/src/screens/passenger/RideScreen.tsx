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
import { Timeline } from '../../components/Timeline';
import { useStore } from '../../store/useStore';
import { kip } from '../../utils/format';
import type { PassengerStackParams } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<PassengerStackParams, 'Ride'>;

/** Where the car marker sits on the route for each stage. */
const CAR_AT = { onway: 0.08, arrived: 0, intrip: 0.62, completed: 1 } as const;

export default function RideScreen({ navigation }: Props) {
  const { accepted, stage, pickup, dropoff } = useStore();

  useEffect(() => {
    if (stage === 'completed') navigation.replace('Complete');
  }, [stage, navigation]);

  if (!accepted) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <MapCanvas route carAt={CAR_AT[stage]} style={{ height: 240 }} />

      <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 30 }}>
          {/* ---- driver ---- */}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Avatar name={accepted.driver.en} size={48} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <T size={16} w={700}>
                  {accepted.driver.lo}
                </T>
                <T size={10} color={colors.muted}>
                  {accepted.driver.en}
                </T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 }}>
                  <Stars value={accepted.driver.rating} />
                  <T size={11} color={colors.muted}>
                    {accepted.driver.car}
                  </T>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Num size={19} w={700}>
                  {kip(accepted.fare)}
                </Num>
                <View
                  style={{
                    backgroundColor: colors.input,
                    borderRadius: 6,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    marginTop: 4,
                  }}>
                  <Num size={11} w={600}>
                    {accepted.driver.plate}
                  </Num>
                </View>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <Button lo="ໂທ" en="Call" variant="secondary" compact style={{ flex: 1 }} />
              <Button lo="ຂໍ້ຄວາມ" en="Chat" variant="secondary" compact style={{ flex: 1 }} />
            </View>
          </Card>

          {/* ---- route ---- */}
          <Card style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row' }}>
              <RouteMarks height={26} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <T size={14} w={600}>
                  {pickup.lo}
                </T>
                <T size={10} color={colors.muted}>
                  {pickup.en}
                </T>
                <View style={{ height: 14 }} />
                <T size={14} w={600}>
                  {dropoff.lo}
                </T>
                <T size={10} color={colors.muted}>
                  {dropoff.en}
                </T>
              </View>
            </View>

            <Divider />
            <Timeline stage={stage} />
          </Card>

          <View
            style={{
              backgroundColor: colors.input,
              borderRadius: radius.input,
              padding: 14,
              marginTop: 12,
            }}>
            <T size={11} color={colors.muted} center>
              ການເດີນທາງຈຳລອງ · simulated trip, advances automatically
            </T>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

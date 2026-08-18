import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors } from '../../theme';
import { T, Num } from '../../components/Typography';
import { Card, Divider, RouteMarks } from '../../components/Card';
import { Button } from '../../components/Button';
import { Avatar, Chip, Stars } from '../../components/Bits';
import { useStore } from '../../store/useStore';
import { kip, km, roadKm, serviceById } from '../../utils/format';
import type { PassengerStackParams } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<PassengerStackParams, 'Complete'>;

const TIPS = [0, 5000, 10000, 20000];

export default function CompleteScreen({ navigation }: Props) {
  const {
    accepted,
    pickup,
    dropoff,
    service,
    payment,
    setPayment,
    rating,
    setRating,
    tip,
    setTip,
    closeTrip,
  } = useStore();

  if (!accepted) return null;

  const total = accepted.fare + tip;

  const done = () => {
    closeTrip();
    navigation.popToTop(); // back to step 1, WhereTo
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 30 }}>
        <Animated.View entering={FadeInDown.springify().damping(16)}>
          <View style={{ alignItems: 'center', paddingVertical: 14 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: colors.lime,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <T size={28}>✓</T>
            </View>
            <T size={22} w={700} style={{ marginTop: 12 }}>
              ຮອດຈຸດໝາຍແລ້ວ
            </T>
            <T size={12} color={colors.muted}>
              Trip complete
            </T>
          </View>
        </Animated.View>

        {/* ---- fare summary ---- */}
        <Card>
          <T size={12} color={colors.muted} center>
            ຄ່າໂດຍສານທັງໝົດ · Total fare
          </T>
          <View style={{ alignItems: 'center', marginTop: 2 }}>
            <Num size={36} w={700}>
              {kip(total)}
            </Num>
          </View>

          <Divider />

          <View style={{ flexDirection: 'row' }}>
            <RouteMarks height={22} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <T size={13} w={600}>
                {pickup.lo}
              </T>
              <View style={{ height: 12 }} />
              <T size={13} w={600}>
                {dropoff.lo}
              </T>
            </View>
          </View>

          <Divider />

          <Row lo="ໄລຍະທາງ" en="Distance" value={km(roadKm(pickup, dropoff))} />
          <Row lo="ບໍລິການ" en="Service" value={serviceById(service).en} />
          <Row lo="ຄ່າໂດຍສານ" en="Fare" value={kip(accepted.fare)} />
          {tip > 0 && <Row lo="ທິບ" en="Tip" value={kip(tip)} />}
        </Card>

        {/* ---- payment ---- */}
        <T size={15} w={700} style={{ marginTop: 20, marginBottom: 8 }}>
          ວິທີຈ່າຍ · Payment
        </T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip lo="ເງິນສົດ" en="Cash" active={payment === 'cash'} onPress={() => setPayment('cash')} />
          <Chip lo="ສະແກນ QR" en="QR" active={payment === 'qr'} onPress={() => setPayment('qr')} />
        </View>

        {/* ---- rating ---- */}
        <Card style={{ marginTop: 20, alignItems: 'center' }}>
          <Avatar name={accepted.driver.en} size={48} />
          <T size={15} w={700} style={{ marginTop: 8 }}>
            {accepted.driver.lo}
          </T>
          <T size={11} color={colors.muted}>
            ໃຫ້ຄະແນນຄົນຂັບ · Rate your driver
          </T>

          <View style={{ marginTop: 10 }}>
            <Stars value={rating} size={30} onChange={setRating} />
          </View>

          <T size={13} w={700} style={{ marginTop: 16 }}>
            ເພີ່ມທິບ · Add a tip
          </T>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {TIPS.map((t) => (
              <Chip
                key={t}
                lo={t === 0 ? 'ບໍ່ມີ' : `₭${t / 1000}k`}
                en={t === 0 ? 'None' : undefined}
                active={tip === t}
                onPress={() => setTip(t)}
              />
            ))}
          </View>
        </Card>

        <Button lo="ແລ້ວໆ" en="Done" onPress={done} haptic="success" style={{ marginTop: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ lo, en, value }: { lo: string; en: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 5,
      }}>
      <View>
        <T size={13}>{lo}</T>
        <T size={10} color={colors.muted}>
          {en}
        </T>
      </View>
      <Num size={14} w={600}>
        {value}
      </Num>
    </View>
  );
}

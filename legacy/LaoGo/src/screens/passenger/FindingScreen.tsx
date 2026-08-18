import React, { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, radius } from '../../theme';
import { T, Num } from '../../components/Typography';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Avatar, Stars } from '../../components/Bits';
import { MapCanvas } from '../../components/MapCanvas';
import { useStore } from '../../store/useStore';
import { groupDigits, kip } from '../../utils/format';
import type { PassengerStackParams } from '../../navigation/RootNavigator';
import type { Offer } from '../../types';

type Props = NativeStackScreenProps<PassengerStackParams, 'Finding'>;

export default function FindingScreen({ navigation }: Props) {
  const { offers, fare, acceptOffer, declineOffer, cancelSearch, raiseFare, pStatus } = useStore();

  // leaving the screen by any route abandons the search
  useEffect(
    () =>
      navigation.addListener('beforeRemove', () => {
        if (useStore.getState().pStatus === 'finding') useStore.getState().cancelSearch();
      }),
    [navigation]
  );

  const accept = (o: Offer) => {
    acceptOffer(o);
    navigation.replace('Ride');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <MapCanvas pulse={pStatus === 'finding'} style={{ height: 190 }} />

      <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 18 }}>
          <T size={22} w={700}>
            {offers.length === 0 ? 'ກຳລັງຊອກຫາຄົນຂັບ...' : `ມີ ${offers.length} ຄົນຂັບສະເໜີມາ`}
          </T>
          <T size={12} color={colors.muted}>
            {offers.length === 0
              ? 'Finding drivers nearby'
              : `${offers.length} driver offer${offers.length > 1 ? 's' : ''}`}
          </T>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: colors.input,
              borderRadius: radius.input,
              paddingHorizontal: 14,
              paddingVertical: 10,
              marginTop: 14,
            }}>
            <View>
              <T size={11} color={colors.muted}>
                ລາຄາທີ່ທ່ານສະເໜີ · Your fare
              </T>
              <Num size={20} w={700}>
                {kip(fare)}
              </Num>
            </View>
            <Button lo="ເພີ່ມ ₭5,000" en="Raise fare" variant="secondary" compact onPress={raiseFare} />
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 14, paddingBottom: 30 }}>
          {offers.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 26 }}>
              <T size={13} color={colors.muted} center>
                ກຳລັງສົ່ງຄຳຂໍໄປຫາຄົນຂັບໃກ້ໆ...
              </T>
              <T size={11} color={colors.muted} center>
                Sending your fare to nearby drivers
              </T>
            </View>
          )}

          {[...offers]
            .sort((a, b) => a.fare - b.fare)
            .map((o, i) => (
              <Animated.View
                key={o.id}
                entering={FadeInDown.delay(i * 40).springify().damping(16)}
                layout={LinearTransition.springify().damping(18)}>
                <OfferCard offer={o} asked={fare} onAccept={() => accept(o)} onDecline={() => declineOffer(o.id)} />
              </Animated.View>
            ))}

          <Button
            lo="ຍົກເລີກການຊອກຫາ"
            en="Cancel search"
            variant="ghost"
            onPress={() => {
              cancelSearch();
              navigation.goBack();
            }}
            style={{ marginTop: 10 }}
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function OfferCard({
  offer,
  asked,
  onAccept,
  onDecline,
}: {
  offer: Offer;
  asked: number;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const diff = offer.fare - asked;

  return (
    <Card style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Avatar name={offer.driver.en} />

        <View style={{ flex: 1, marginLeft: 12 }}>
          <T size={15} w={700} numberOfLines={1}>
            {offer.driver.lo}
          </T>
          <T size={10} color={colors.muted} numberOfLines={1}>
            {offer.driver.en}
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 10 }}>
            <Stars value={offer.driver.rating} />
            <T size={11} color={colors.muted}>
              {offer.driver.car}
            </T>
          </View>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Num size={20} w={700}>
            {kip(offer.fare)}
          </Num>
          <T size={10} color={diff > 0 ? colors.muted : colors.green}>
            {diff > 0 ? `+ ${groupDigits(diff)} ຕໍ່ລອງ` : 'ຮັບລາຄາທ່ານ · accepts'}
          </T>
          <T size={10} color={colors.muted}>
            {offer.etaMin} ນາທີ · {offer.etaMin} min
          </T>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        <Button
          lo="ຮັບ"
          en="Accept"
          onPress={onAccept}
          haptic="success"
          compact
          style={{ flex: 2 }}
        />
        <Button lo="ປະຕິເສດ" en="Decline" variant="ghost" compact onPress={onDecline} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

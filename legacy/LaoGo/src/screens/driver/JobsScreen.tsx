import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, radius, shadow } from '../../theme';
import { T, Num } from '../../components/Typography';
import { Card, Divider, RouteMarks } from '../../components/Card';
import { Button } from '../../components/Button';
import { Avatar, Empty, StatusPill, Stars } from '../../components/Bits';
import { FareStepper } from '../../components/FareStepper';
import { Handle } from '../../components/Sheet';
import { ME_DRIVER } from '../../data/people';
import { selectEarningsToday, useStore } from '../../store/useStore';
import { kip, km, serviceById } from '../../utils/format';
import type { DriverStackParams } from '../../navigation/RootNavigator';
import type { RideRequest } from '../../types';

type Props = NativeStackScreenProps<DriverStackParams, 'Jobs'>;

export default function JobsScreen({ navigation }: Props) {
  const { online, toggleOnline, requests, activeJob, acceptRequest, counterRequest } = useStore();
  const earnings = useStore(selectEarningsToday);

  const [countering, setCountering] = useState<RideRequest | null>(null);

  // a job can start from a tap here or from a simulated passenger accepting a counter
  useEffect(() => {
    if (activeJob) navigation.navigate('ActiveRide');
  }, [activeJob, navigation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      {/* ---- header ---- */}
      <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Avatar name={ME_DRIVER.en} size={44} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <T size={16} w={700} numberOfLines={1}>
              {ME_DRIVER.lo}
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <T size={10} color={colors.muted}>
                {ME_DRIVER.en}
              </T>
              <Stars value={ME_DRIVER.rating} />
            </View>
          </View>
          <StatusPill on={online} onPress={toggleOnline} />
        </View>

        <Card style={{ marginTop: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <T size={11} color={colors.muted}>
              ລາຍຮັບມື້ນີ້ · Today
            </T>
            <Num size={24} w={700}>
              {kip(earnings)}
            </Num>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <T size={11} color={colors.muted}>
              ຄຳຂໍ · Requests
            </T>
            <Num size={24} w={700}>
              {online ? requests.length : 0}
            </Num>
          </View>
        </Card>
      </View>

      {/* ---- request list ---- */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}>
        <T size={15} w={700} style={{ marginTop: 8 }}>
          ຄຳຂໍໃກ້ຄຽງ
        </T>
        <T size={11} color={colors.muted}>
          Nearby requests
        </T>

        {!online ? (
          <Empty icon="🌙" lo="ທ່ານອອບລາຍຢູ່" en="Go online to receive requests" />
        ) : requests.length === 0 ? (
          <Empty icon="📭" lo="ຍັງບໍ່ມີຄຳຂໍ" en="No requests right now" />
        ) : (
          requests.map((r, i) => (
            <Animated.View
              key={r.id}
              entering={FadeInDown.delay(i * 50).springify().damping(16)}
              layout={LinearTransition.springify().damping(18)}>
              <RequestCard
                req={r}
                onAccept={() => acceptRequest(r)}
                onCounter={() => setCountering(r)}
              />
            </Animated.View>
          ))
        )}
      </ScrollView>

      <CounterModal
        req={countering}
        onClose={() => setCountering(null)}
        onSend={(amount) => {
          if (countering) counterRequest(countering, amount);
          setCountering(null);
        }}
      />

      <EarningsToast />
    </SafeAreaView>
  );
}

/** Shown after a completed job, once the driver is back on the list. */
function EarningsToast() {
  const toast = useStore((s) => s.toast);
  if (!toast) return null;

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(16)}
      exiting={FadeOut.duration(220)}
      style={[
        {
          position: 'absolute',
          left: 20,
          right: 20,
          bottom: 24,
          backgroundColor: colors.black,
          borderRadius: radius.pill,
          paddingVertical: 14,
          alignItems: 'center',
        },
        shadow.card,
      ]}>
      <Num size={18} w={700} color={colors.lime}>
        {toast}
      </Num>
      <T size={10} color="rgba(212,242,75,0.7)">
        ເພີ່ມເຂົ້າລາຍຮັບແລ້ວ · added to earnings
      </T>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ card */

function RequestCard({
  req,
  onAccept,
  onCounter,
}: {
  req: RideRequest;
  onAccept: () => void;
  onCounter: () => void;
}) {
  const waiting = req.state === 'waiting';
  const lost = req.state === 'lost';

  return (
    <Card style={{ marginTop: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Avatar name={req.passenger.en} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <T size={15} w={700} numberOfLines={1}>
            {req.passenger.lo}
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T size={10} color={colors.muted}>
              {serviceById(req.service).en}
            </T>
            <Stars value={req.passenger.rating} />
          </View>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Num size={22} w={700}>
            {kip(req.fare)}
          </Num>
          <T size={10} color={colors.muted}>
            ລາຄາຜູ້ໂດຍສານ · offered
          </T>
        </View>
      </View>

      <Divider />

      <View style={{ flexDirection: 'row' }}>
        <RouteMarks height={22} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T size={14} w={600} numberOfLines={1} style={{ flex: 1 }}>
              {req.pickup.lo}
            </T>
            <Num size={12} w={600} color={colors.muted}>
              {km(req.pickupKm)} ຫ່າງ
            </Num>
          </View>
          <T size={10} color={colors.muted}>
            {req.pickup.en}
          </T>

          <View style={{ height: 12 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T size={14} w={600} numberOfLines={1} style={{ flex: 1 }}>
              {req.dropoff.lo}
            </T>
            <Num size={12} w={600} color={colors.muted}>
              {km(req.tripKm)}
            </Num>
          </View>
          <T size={10} color={colors.muted}>
            {req.dropoff.en}
          </T>
        </View>
      </View>

      {!!req.note && (
        <View
          style={{
            marginTop: 12,
            backgroundColor: colors.input,
            borderRadius: radius.input,
            padding: 10,
          }}>
          <T size={12} color={colors.muted}>
            “{req.note}”
          </T>
        </View>
      )}

      {lost ? (
        <View style={{ marginTop: 14, alignItems: 'center' }}>
          <T size={13} w={600} color={colors.danger}>
            ຜູ້ໂດຍສານເລືອກຄົນອື່ນແລ້ວ
          </T>
          <T size={10} color={colors.muted}>
            Passenger chose another driver
          </T>
        </View>
      ) : waiting ? (
        <View
          style={{
            marginTop: 14,
            backgroundColor: colors.input,
            borderRadius: radius.input,
            padding: 12,
            alignItems: 'center',
          }}>
          <T size={13} w={600}>
            ສົ່ງລາຄາ {kip(req.countered ?? 0)} ແລ້ວ
          </T>
          <T size={10} color={colors.muted}>
            Counter sent · waiting for reply
          </T>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <Button lo="ຕໍ່ລອງ" en="Counter" variant="secondary" compact onPress={onCounter} style={{ flex: 1 }} />
          <Button lo="ຮັບວຽກ ✓" en="Accept" compact haptic="success" onPress={onAccept} style={{ flex: 1 }} />
        </View>
      )}
    </Card>
  );
}

/* ----------------------------------------------------------------- modal */

function CounterModal({
  req,
  onClose,
  onSend,
}: {
  req: RideRequest | null;
  onClose: () => void;
  onSend: (amount: number) => void;
}) {
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    if (req) setAmount(req.fare + 5000);
  }, [req]);

  return (
    <Modal visible={!!req} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(17,17,17,0.35)' }} />
      <View
        style={[
          {
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: 34,
          },
          shadow.sheet,
        ]}>
        <Handle />

        <T size={19} w={700} center>
          ຕໍ່ລອງລາຄາ
        </T>
        <T size={11} color={colors.muted} center>
          Send your counter-offer
        </T>

        {!!req && (
          <T size={12} color={colors.muted} center style={{ marginTop: 10 }}>
            ຜູ້ໂດຍສານສະເໜີ {kip(req.fare)} · passenger offered
          </T>
        )}

        <View
          style={{
            backgroundColor: colors.input,
            borderRadius: radius.card,
            paddingVertical: 10,
            paddingHorizontal: 12,
            marginTop: 12,
          }}>
          <FareStepper value={amount} onChange={setAmount} />
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <Button lo="ຍົກເລີກ" en="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
          <Button
            lo="ສົ່ງລາຄາ"
            en="Send offer"
            haptic="medium"
            onPress={() => onSend(amount)}
            style={{ flex: 2 }}
          />
        </View>
      </View>
    </Modal>
  );
}

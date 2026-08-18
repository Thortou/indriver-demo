import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../../theme';
import { T, Num } from '../../components/Typography';
import { Card, RouteMarks } from '../../components/Card';
import { Empty, Stars } from '../../components/Bits';
import { useStore } from '../../store/useStore';
import { clockTime, kip, laoDate, serviceById } from '../../utils/format';
import type { Trip } from '../../types';

export default function HistoryScreen() {
  const history = useStore((s) => s.history);
  const total = history.reduce((a, t) => a + t.fare, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 30 }}>
        <T size={24} w={700}>
          ປະຫວັດການເດີນທາງ
        </T>
        <T size={12} color={colors.muted}>
          Trip history
        </T>

        <Card style={{ marginTop: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <T size={11} color={colors.muted}>
              ທັງໝົດ · Total spent
            </T>
            <Num size={22} w={700}>
              {kip(total)}
            </Num>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <T size={11} color={colors.muted}>
              ຖ້ຽວ · Trips
            </T>
            <Num size={22} w={700}>
              {history.length}
            </Num>
          </View>
        </Card>

        {history.length === 0 ? (
          <Empty icon="🧾" lo="ຍັງບໍ່ມີການເດີນທາງ" en="No trips yet" />
        ) : (
          history.map((t) => <TripRow key={t.id} trip={t} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export function TripRow({ trip, showRating = true }: { trip: Trip; showRating?: boolean }) {
  return (
    <Card style={{ marginTop: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View>
          <T size={12} w={600}>
            {laoDate(trip.date)}
          </T>
          <T size={10} color={colors.muted}>
            {clockTime(trip.date)} · {serviceById(trip.service).en}
          </T>
        </View>
        <Num size={17} w={700}>
          {kip(trip.fare)}
        </Num>
      </View>

      <View style={{ flexDirection: 'row', marginTop: 12 }}>
        <RouteMarks height={18} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <T size={13} w={500} numberOfLines={1}>
            {trip.pickup.lo}
          </T>
          <View style={{ height: 10 }} />
          <T size={13} w={500} numberOfLines={1}>
            {trip.dropoff.lo}
          </T>
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 12,
        }}>
        <T size={11} color={colors.muted} numberOfLines={1} style={{ flex: 1 }}>
          {trip.counterpartLo}
        </T>
        {showRating && trip.rating != null && <Stars value={trip.rating} />}
      </View>
    </Card>
  );
}

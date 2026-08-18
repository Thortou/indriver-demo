import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius } from '../../theme';
import { T, Num } from '../../components/Typography';
import { Card } from '../../components/Card';
import { Empty } from '../../components/Bits';
import { TripRow } from '../passenger/HistoryScreen';
import { selectEarningsToday, selectEarningsWeek, selectWeekBars, useStore } from '../../store/useStore';
import { groupDigits, kip } from '../../utils/format';

export default function EarningsScreen() {
  const trips = useStore((s) => s.driverHistory);
  const today = useStore(selectEarningsToday);
  const week = useStore(selectEarningsWeek);
  const bars = selectWeekBars(trips);

  const peak = Math.max(...bars.map((b) => b.total), 1);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 30 }}>
        <T size={24} w={700}>
          ລາຍຮັບ
        </T>
        <T size={12} color={colors.muted}>
          Earnings
        </T>

        {/* ---- totals ---- */}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
          <Card style={{ flex: 1 }}>
            <T size={11} color={colors.muted}>
              ມື້ນີ້ · Today
            </T>
            <Num size={21} w={700}>
              {kip(today)}
            </Num>
          </Card>
          <Card style={{ flex: 1 }}>
            <T size={11} color={colors.muted}>
              ອາທິດນີ້ · This week
            </T>
            <Num size={21} w={700}>
              {kip(week)}
            </Num>
          </Card>
        </View>

        {/* ---- bar chart ---- */}
        <Card style={{ marginTop: 12 }}>
          <T size={13} w={700}>
            7 ມື້ຜ່ານມາ
          </T>
          <T size={10} color={colors.muted}>
            Last 7 days
          </T>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              height: 120,
              marginTop: 16,
              gap: 8,
            }}>
            {bars.map((b, i) => {
              const isToday = i === bars.length - 1;
              return (
                <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                  <Num size={9} w={600} color={colors.muted}>
                    {b.total > 0 ? `${Math.round(b.total / 1000)}k` : ''}
                  </Num>
                  <View
                    style={{
                      width: '100%',
                      height: Math.max(4, (b.total / peak) * 82),
                      borderRadius: 6,
                      backgroundColor: isToday ? colors.black : colors.lime,
                      marginTop: 4,
                    }}
                  />
                  <T size={10} color={isToday ? colors.text : colors.muted} style={{ marginTop: 6 }}>
                    {b.label}
                  </T>
                </View>
              );
            })}
          </View>

          <View
            style={{
              marginTop: 14,
              backgroundColor: colors.input,
              borderRadius: radius.input,
              padding: 10,
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}>
            <T size={11} color={colors.muted}>
              ສະເລ່ຍຕໍ່ຖ້ຽວ · Avg per trip
            </T>
            <Num size={12} w={600}>
              ₭ {groupDigits(trips.length ? week / trips.length : 0)}
            </Num>
          </View>
        </Card>

        {/* ---- trip list ---- */}
        <T size={15} w={700} style={{ marginTop: 22 }}>
          ຖ້ຽວທັງໝົດ
        </T>
        <T size={11} color={colors.muted}>
          All trips · {trips.length}
        </T>

        {trips.length === 0 ? (
          <Empty icon="📈" lo="ຍັງບໍ່ມີລາຍຮັບ" en="No earnings yet" />
        ) : (
          trips.map((t) => <TripRow key={t.id} trip={t} showRating={false} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

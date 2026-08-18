import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius } from '../theme';
import { T, Num } from '../components/Typography';
import { Card, Divider } from '../components/Card';
import { Button } from '../components/Button';
import { Avatar, Stars } from '../components/Bits';
import { ME_DRIVER, ME_PASSENGER } from '../data/people';
import { selectEarningsWeek, useStore } from '../store/useStore';
import { kip } from '../utils/format';

export default function ProfileScreen() {
  const role = useStore((s) => s.role);
  const switchRole = useStore((s) => s.switchRole);
  const history = useStore((s) => s.history);
  const driverHistory = useStore((s) => s.driverHistory);
  const week = useStore(selectEarningsWeek);

  const isDriver = role === 'driver';
  const me = isDriver ? ME_DRIVER : ME_PASSENGER;
  const trips = isDriver ? driverHistory : history;
  const spent = history.reduce((a, t) => a + t.fare, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 30 }}>
        <T size={24} w={700}>
          ໂປຣໄຟລ໌
        </T>
        <T size={12} color={colors.muted}>
          Profile
        </T>

        <Card style={{ marginTop: 16, alignItems: 'center', paddingVertical: 24 }}>
          <Avatar name={me.en} size={72} />
          <T size={19} w={700} style={{ marginTop: 12 }}>
            {me.lo}
          </T>
          <T size={12} color={colors.muted}>
            {me.en}
          </T>
          <View style={{ marginTop: 6 }}>
            <Stars value={me.rating} size={14} />
          </View>

          <View
            style={{
              marginTop: 12,
              backgroundColor: colors.lime,
              borderRadius: radius.round,
              paddingHorizontal: 14,
              paddingVertical: 6,
            }}>
            <T size={12} w={700}>
              {isDriver ? 'ຄົນຂັບ · Driver' : 'ຜູ້ໂດຍສານ · Passenger'}
            </T>
          </View>
        </Card>

        <Card style={{ marginTop: 12 }}>
          <Stat
            lo="ຖ້ຽວທັງໝົດ"
            en="Total trips"
            value={String(isDriver ? driverHistory.length : history.length)}
          />
          <Divider />
          {isDriver ? (
            <Stat lo="ລາຍຮັບອາທິດນີ້" en="Earned this week" value={kip(week)} />
          ) : (
            <Stat lo="ຈ່າຍໄປທັງໝົດ" en="Total spent" value={kip(spent)} />
          )}
          {isDriver && (
            <>
              <Divider />
              <Stat lo="ລົດ" en="Vehicle" value={`${ME_DRIVER.car} · ${ME_DRIVER.plate}`} />
            </>
          )}
        </Card>

        <Card style={{ marginTop: 12 }}>
          <MenuRow lo="ວິທີການຈ່າຍເງິນ" en="Payment methods" glyph="💳" />
          <Divider />
          <MenuRow lo="ຄວາມປອດໄພ" en="Safety" glyph="🛡️" />
          <Divider />
          <MenuRow lo="ຊ່ວຍເຫຼືອ" en="Help & support" glyph="💬" />
          <Divider />
          <MenuRow lo="ຕັ້ງຄ່າ" en="Settings" glyph="⚙️" />
        </Card>

        <Button
          lo="ປ່ຽນບົດບາດ"
          en="Switch role"
          variant="secondary"
          onPress={switchRole}
          style={{ marginTop: 20 }}
        />

        <T size={10} color={colors.muted} center style={{ marginTop: 18 }}>
          LaoGo demo · {trips.length} mock trips · no account, no backend
        </T>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ lo, en, value }: { lo: string; en: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <View>
        <T size={13} w={500}>
          {lo}
        </T>
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

function MenuRow({ lo, en, glyph }: { lo: string; en: string; glyph: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: colors.input,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}>
        <T size={14}>{glyph}</T>
      </View>
      <View style={{ flex: 1 }}>
        <T size={14} w={500}>
          {lo}
        </T>
        <T size={10} color={colors.muted}>
          {en}
        </T>
      </View>
      <T size={16} color={colors.muted}>
        ›
      </T>
    </View>
  );
}

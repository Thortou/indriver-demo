/* =============================================================================
   TripView — the current trip (§6): passenger, Call, navigation, the
   Arrived → Start → Complete buttons, Cancel with per-state reasons and the
   5-minute no-show timer; then the finished summary with Rate passenger.
   ========================================================================== */

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Linking, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { C, R, theme } from '../../theme';
import { LiveMap, fetchRoute } from '../../MapPicker';
import { ApiError, errorText } from '../api';
import { cancelRide, dismissRide, tripAction } from '../engine';
import { countdown, fmtTime, money, t, tOr } from '../i18n';
import { toast, useApp } from '../store';
import { Avatar, Badge, Btn, Card, Field, Kip, RouteLine, Sheet, Sub, useNow } from '../ui';

const NO_SHOW_WAIT_MS = 5 * 60 * 1000;

const CANCEL_REASONS = {
  driver_assigned: ['vehicle_issue', 'safety_concern', 'other'],
  driver_arrived: ['passenger_no_show', 'vehicle_issue', 'safety_concern', 'other'],
};

const STEPS = ['driver_assigned', 'driver_arrived', 'in_progress'];

const NEXT_ACTION = {
  driver_assigned: { action: 'arrive', label: 'btnArrived' },
  driver_arrived: { action: 'start', label: 'btnStart' },
  in_progress: { action: 'complete', label: 'btnComplete' },
};

export function openMaps(point) {
  if (!point) return;
  Linking.openURL(
    `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}&travelmode=driving`
  );
}

export default function TripView({ ride, navigation }) {
  const fix = useApp((s) => s.fix);
  useApp((s) => s.lang);
  const [route, setRoute] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  useEffect(() => {
    const ctl = new AbortController();
    fetchRoute(ride.pickup, ride.destination, ctl.signal).then((r) => r && setRoute(r.coords));
    return () => ctl.abort();
  }, [ride.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ride.active) return <TripFinished ride={ride} navigation={navigation} />;

  const next = NEXT_ACTION[ride.status];
  const passenger = ride.passenger || {};
  const beforePickup = ride.status === 'driver_assigned' || ride.status === 'driver_arrived';
  const target = beforePickup ? ride.pickup : ride.destination;

  const run = async () => {
    if (!next) return;
    const go = async () => {
      setBusy(true);
      try {
        await tripAction(ride, next.action);
      } catch (e) {
        toast(errorText(e));
      } finally {
        setBusy(false);
      }
    };
    if (next.action === 'complete') {
      Alert.alert(t('btnComplete'), t('collectCashConfirm', { p: money(ride.agreed_price) }), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('btnComplete'), onPress: go },
      ]);
    } else go();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <LiveMap
        from={ride.pickup}
        to={ride.destination}
        coords={route}
        myLocation={fix}
        lineColor={C.blue}
        height={260}
        switchStyle={{ top: 12 }}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Steps status={ride.status} />

        <Card>
          <View style={st.pRow}>
            <Avatar uri={passenger.profile_photo_url} name={passenger.name} size={52} />
            <View style={{ flex: 1 }}>
              <Text style={st.pName} numberOfLines={1}>
                {passenger.name || '—'}
              </Text>
              <Text style={st.meta}>
                {passenger.average_rating != null ? `★ ${Number(passenger.average_rating).toFixed(1)}` : '★ —'}
              </Text>
            </View>
            {!!passenger.phone_number && (
              <Pressable onPress={() => Linking.openURL(`tel:${passenger.phone_number}`)} style={st.roundBtn}>
                <Text style={st.roundIcon}>📞</Text>
                <Text style={st.roundLabel}>{t('call')}</Text>
              </Pressable>
            )}
          </View>
        </Card>

        <Card>
          <RouteLine from={ride.pickup} to={ride.destination} />
          <Btn
            small
            variant="outline"
            title={`🧭 ${t('navigate')} · ${beforePickup ? t('pickup') : t('destination')}`}
            onPress={() => openMaps(target)}
            style={{ marginTop: 14 }}
          />
        </Card>

        <Card style={st.fareRow}>
          <View style={{ flex: 1 }}>
            <Text style={st.meta}>{t('fare')}</Text>
            <Kip value={ride.agreed_price} style={st.fare} unitStyle={st.fareUnit} />
          </View>
          <Badge label={`💵 ${t('cashOnly')}`} tone="lime" />
        </Card>

        {next && <Btn title={t(next.label)} onPress={run} busy={busy} />}

        {ride.status === 'in_progress' ? (
          <Sub style={{ textAlign: 'center', marginTop: 14 }}>{t('noCancelInProgress')}</Sub>
        ) : (
          <Btn variant="danger" title={t('cancelTrip')} onPress={() => setCancelOpen(true)} style={{ marginTop: 10 }} />
        )}
      </ScrollView>

      <CancelSheet ride={ride} visible={cancelOpen} onClose={() => setCancelOpen(false)} />
    </SafeAreaView>
  );
}

function Steps({ status }) {
  const idx = STEPS.indexOf(status);
  return (
    <View style={st.steps}>
      {STEPS.map((s, i) => (
        <View key={s} style={{ flex: 1 }}>
          <View style={[st.stepBar, i <= idx && { backgroundColor: C.lime }]} />
          <Text style={[st.stepText, i === idx && st.stepTextOn]} numberOfLines={1}>
            {t(`st_${s}`)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/* ---------------------------------------------------------------- cancel */

function CancelSheet({ ride, visible, onClose }) {
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const now = useNow(1000);

  const reasons = CANCEL_REASONS[ride.status] || [];
  const arrivedAt = ride.driver_arrived_at ? new Date(ride.driver_arrived_at).getTime() : 0;
  const noShowAt = Math.max(arrivedAt + NO_SHOW_WAIT_MS, retryAt);
  const noShowWait = noShowAt - now;

  const submit = async () => {
    setBusy(true);
    try {
      await cancelRide(ride, reason, note);
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'ride.no_show_too_early' && e.retryAfter) {
        setRetryAt(Date.now() + e.retryAfter * 1000);
      }
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('cancelReason')}>
      <View style={{ gap: 8, marginBottom: 14 }}>
        {reasons.map((r) => {
          const locked = r === 'passenger_no_show' && noShowWait > 0;
          return (
            <Pressable
              key={r}
              disabled={locked}
              onPress={() => setReason(r)}
              style={[st.reason, reason === r && st.reasonOn, locked && { opacity: 0.5 }]}>
              <Text style={st.reasonText}>{t(`cr_${r}`)}</Text>
              {locked && <Text style={st.meta}>{t('noShowIn', { t: countdown(noShowWait) })}</Text>}
            </Pressable>
          );
        })}
      </View>
      <Field placeholder={t('note')} value={note} onChangeText={setNote} maxLength={500} />
      <Btn variant="dark" title={t('confirmCancel')} onPress={submit} busy={busy} disabled={!reason} />
    </Sheet>
  );
}

/* -------------------------------------------------------------- finished */

function TripFinished({ ride, navigation }) {
  const completed = ride.status === 'completed';
  const passenger = ride.passenger || {};
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 40 }}>
        <View style={[st.bigMark, !completed && { backgroundColor: '#FDE8E4' }]}>
          <Text style={[st.bigMarkText, !completed && { color: C.red }]}>{completed ? '✓' : '✕'}</Text>
        </View>
        <Text style={st.doneTitle}>{completed ? t('tripCompleted') : t('tripCancelled')}</Text>

        {completed ? (
          <Card style={{ alignItems: 'center', marginTop: 20 }}>
            <Text style={st.meta}>{t('cashToCollect')}</Text>
            <Kip value={ride.agreed_price} style={st.bigFare} unitStyle={st.fareUnit} />
            <Sub>
              {passenger.name} · {fmtTime(ride.completed_at)}
            </Sub>
          </Card>
        ) : (
          <Card style={{ marginTop: 20 }}>
            <Text style={st.pName}>
              {t('cancelledBy', { who: tOr(`by_${ride.cancelled_by}`, ride.cancelled_by || '—') })}
            </Text>
            {!!ride.cancellation_reason && (
              <Sub>{tOr(`cr_${ride.cancellation_reason}`, ride.cancellation_reason)}</Sub>
            )}
          </Card>
        )}

        <Card>
          <RouteLine from={ride.pickup} to={ride.destination} />
        </Card>

        {ride.can_rate && (
          <Btn
            title={`★ ${t('ratePassenger')}`}
            onPress={() => navigation.navigate('Rate', { rideId: ride.id, name: passenger.name })}
            style={{ marginBottom: 10 }}
          />
        )}
        <Btn variant={ride.can_rate ? 'ghost' : 'primary'} title={t('backToRequests')} onPress={dismissRide} />
      </ScrollView>
    </SafeAreaView>
  );
}

const st = theme(
  {
    meta: { color: C.sub, fontSize: 13, lineHeight: 20 },
    pRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    pName: { color: C.text, fontSize: 17, lineHeight: 26, fontWeight: '700' },
    roundBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 64,
      height: 58,
      borderRadius: R.input,
      backgroundColor: C.limeSoft,
    },
    roundIcon: { fontSize: 18, lineHeight: 24 },
    roundLabel: { color: C.accentText, fontSize: 12, lineHeight: 18, fontWeight: '700' },

    fareRow: { flexDirection: 'row', alignItems: 'center' },
    fare: { color: C.text, fontSize: 26, lineHeight: 34, fontWeight: '700' },
    fareUnit: { color: C.sub, fontSize: 16, lineHeight: 26, fontWeight: '600' },

    steps: { flexDirection: 'row', gap: 6, marginBottom: 14 },
    stepBar: { height: 5, borderRadius: 3, backgroundColor: C.line, marginBottom: 6 },
    stepText: { color: C.faint, fontSize: 12, lineHeight: 18, fontWeight: '500' },
    stepTextOn: { color: C.text, fontWeight: '700' },

    reason: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: C.line,
      borderRadius: R.input,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    reasonOn: { borderColor: C.lime, backgroundColor: C.limeWash },
    reasonText: { color: C.text, fontSize: 15, lineHeight: 23, fontWeight: '600' },

    bigMark: {
      alignSelf: 'center',
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: C.limeSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bigMarkText: { color: C.accentText, fontSize: 34, lineHeight: 44, fontWeight: '700' },
    doneTitle: { color: C.text, fontSize: 24, lineHeight: 36, fontWeight: '700', textAlign: 'center', marginTop: 14 },
    bigFare: { color: C.text, fontSize: 38, lineHeight: 50, fontWeight: '700', marginVertical: 4 },
  },
  []
);

/* =============================================================================
   Home (Rides tab): online toggle, availability (§4.3), own position on the
   map, live request list with Accept / Counter / Skip (§5), the open offer
   with its countdown and Withdraw — or the trip, when there is one (§6).
   ========================================================================== */

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { C, R, theme } from '../../theme';
import { LiveMap } from '../../MapPicker';
import { errorText } from '../api';
import { makeOffer, offerTimedOut, refreshCurrent, setOnline, skipRequest, withdrawOffer } from '../engine';
import { countdown, fmtDistance, money, t, tOr } from '../i18n';
import { toast, useApp, visibleRide } from '../store';
import { Avatar, Badge, Btn, Card, Kip, RouteLine, Sheet, Sub, useNow } from '../ui';
import TripView from './TripView';

const STEP = 1000;
const MAX_REVISIONS = 2;

export default function HomeScreen({ navigation }) {
  const ride = useApp(visibleRide);
  if (ride) return <TripView ride={ride} navigation={navigation} />;
  return <RequestsView navigation={navigation} />;
}

/* ============================================================= requests */

function RequestsView({ navigation }) {
  const me = useApp((s) => s.me);
  const account = useApp((s) => s.account);
  const online = useApp((s) => s.online);
  const fix = useApp((s) => s.fix);
  const requests = useApp((s) => s.requests);
  const loaded = useApp((s) => s.requestsLoaded);
  const offer = useApp((s) => s.offer);
  const availability = useApp((s) => s.availability);
  useApp((s) => s.lang); // re-render on language change

  const [toggling, setToggling] = useState(false);
  const [counterFor, setCounterFor] = useState(null); // request being countered
  const [busyId, setBusyId] = useState(null);
  const now = useNow(1000);

  const approved = !me || me.verification_status === 'approved';

  const toggle = async () => {
    setToggling(true);
    try {
      await setOnline(!online);
    } catch (e) {
      toast(e.message && !e.status ? e.message : errorText(e));
    } finally {
      setToggling(false);
    }
  };

  const accept = async (req) => {
    setBusyId(req.id);
    try {
      await makeOffer(req, req.proposed_price);
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusyId(null);
    }
  };

  const skip = async (req) => {
    setBusyId(req.id);
    try {
      await skipRequest(req);
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusyId(null);
    }
  };

  const visible = requests.filter((r) => new Date(r.expires_at).getTime() > now && (!offer || r.id !== offer.ride_id));

  const header = (
    <View>
      <View style={st.top}>
        <Avatar uri={account && account.profile_photo_url} name={account && account.full_name} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={st.name} numberOfLines={1}>
            {(account && account.full_name) || t('appName')}
          </Text>
          <Text style={st.meta}>
            {me && me.average_rating != null ? `★ ${Number(me.average_rating).toFixed(1)}` : t('newDriver')}
            {me ? `  ·  ${t('ridesN', { n: me.total_rides || 0 })}` : ''}
          </Text>
        </View>
        {approved && (
          <Pressable
            onPress={toggling ? undefined : toggle}
            style={[st.switch, online && st.switchOn]}
            accessibilityRole="switch"
            accessibilityState={{ checked: online }}>
            {toggling ? (
              <ActivityIndicator size="small" color={online ? C.ink : C.sub} />
            ) : (
              <>
                <View style={[st.switchDot, online && st.switchDotOn]} />
                <Text style={[st.switchText, online && st.switchTextOn]}>{online ? t('online') : t('offline')}</Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      {approved ? (
        <AvailabilityBanner online={online} availability={availability} navigation={navigation} />
      ) : (
        <StatusCard me={me} navigation={navigation} />
      )}

      <View style={st.mapBox}>
        {fix ? (
          <LiveMap from={fix} myLocation={fix} soloOrigin height={200} switchStyle={{ top: 10 }} />
        ) : (
          <View style={st.mapEmpty}>
            <Sub>📍 {t('av_NO_LOCATION')}</Sub>
          </View>
        )}
      </View>

      {!!offer && <OfferCard offer={offer} now={now} onRevise={() => setCounterFor(offer.request)} />}

      {online && approved && <Text style={st.section}>{t('requests')}</Text>}
    </View>
  );

  const empty = !approved ? null : !online ? (
    <Sub style={st.emptyText}>{t('goOnlineToSee')}</Sub>
  ) : !loaded ? (
    <ActivityIndicator color={C.accentText} style={{ marginTop: 24 }} />
  ) : (
    <Sub style={st.emptyText}>{t('noRequests')}</Sub>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <FlatList
        data={online && approved ? visible : []}
        keyExtractor={(r) => String(r.id)}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        renderItem={({ item }) => (
          <RequestCard
            req={item}
            now={now}
            busy={busyId === item.id}
            locked={!!offer}
            onAccept={() => accept(item)}
            onCounter={() => setCounterFor(item)}
            onSkip={() => skip(item)}
          />
        )}
      />
      <CounterSheet req={counterFor} offer={offer} onClose={() => setCounterFor(null)} />
    </SafeAreaView>
  );
}

/* ---------------------------------------------------------- availability */

const TONE = {
  AVAILABLE: 'green',
  OFFLINE: 'grey',
  NO_LOCATION: 'amber',
  STANDING_UNKNOWN: 'amber',
  LOCATION_UNKNOWN: 'amber',
  LOCATION_STALE: 'amber',
  ON_RIDE: 'lime',
};

function AvailabilityBanner({ online, availability, navigation }) {
  const reason = !online ? 'OFFLINE' : (availability && availability.reason) || 'NO_LOCATION';
  const text = tOr(`av_${reason}`, t('av_unknown', { r: reason }));
  const tone = TONE[reason] || 'red';
  const bg = { green: '#E3F6EC', grey: C.card2, amber: '#FEF3DC', red: '#FDE8E4', lime: C.limeSoft }[tone];
  const fg = { green: '#1F8A55', grey: C.sub, amber: '#A76400', red: '#C23B26', lime: C.accentText }[tone];

  let action = null;
  if (reason === 'NOT_ELIGIBLE' || reason === 'DOCUMENT_EXPIRED')
    action = { label: t('openProfile'), go: () => navigation.navigate('Account') };
  if (reason === 'COMMISSION_OWED') action = { label: t('openWallet'), go: () => navigation.navigate('Earnings', { wallet: true }) };
  if (reason === 'ON_RIDE') action = { label: t('continueTrip'), go: () => refreshCurrent() };

  return (
    <View style={[st.banner, { backgroundColor: bg }]}>
      <View style={[st.bannerDot, { backgroundColor: fg }]} />
      <Text style={[st.bannerText, { color: fg }]}>{text}</Text>
      {action && (
        <Pressable onPress={action.go} hitSlop={8}>
          <Text style={[st.bannerLink, { color: fg }]}>{action.label} ›</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Not approved yet: the verification status in place of the request list (§10.3). */
function StatusCard({ me, navigation }) {
  const vs = me.verification_status;
  const tone = { rejected: 'red', under_review: 'amber', pending: 'grey' }[vs] || 'grey';
  return (
    <Card style={{ marginTop: 12 }}>
      <Badge label={tOr(`vs_${vs}`, vs)} tone={tone} />
      <Text style={st.statusBody}>{t('reviewBody')}</Text>
      {vs === 'rejected' && !!me.rejection_reason && (
        <View style={st.reject}>
          <Text style={st.rejectLabel}>{t('rejectionReason')}</Text>
          <Text style={st.rejectText}>{me.rejection_reason}</Text>
        </View>
      )}
      <Btn
        small
        variant={vs === 'rejected' ? 'primary' : 'outline'}
        title={vs === 'rejected' ? t('replaceDocs') : t('openProfile')}
        onPress={() => navigation.navigate(vs === 'rejected' ? 'ReplaceDocs' : 'Account')}
        style={{ marginTop: 12 }}
      />
    </Card>
  );
}

/* ------------------------------------------------------------- request */

function RequestCard({ req, now, busy, locked, onAccept, onCounter, onSkip }) {
  const left = new Date(req.expires_at).getTime() - now;
  return (
    <Card>
      <View style={st.reqTop}>
        <View style={{ flex: 1 }}>
          <Kip value={req.proposed_price} style={st.price} unitStyle={st.priceUnit} />
          <Text style={st.meta}>
            {t('fromYou', { d: fmtDistance(req.distance_m) })} · {req.vehicle_type}
          </Text>
        </View>
        <Badge label={countdown(left)} tone={left < 30000 ? 'red' : 'grey'} />
      </View>
      <RouteLine from={req.pickup} to={req.destination} />
      <View style={st.actions}>
        <Btn small variant="ghost" title={t('skip')} onPress={onSkip} disabled={busy} style={{ flex: 0.8 }} />
        <Btn small variant="outline" title={t('counter')} onPress={onCounter} disabled={busy || locked} style={{ flex: 1 }} />
        <Btn small title={t('accept')} onPress={onAccept} busy={busy} disabled={locked} style={{ flex: 1.2 }} />
      </View>
    </Card>
  );
}

/* --------------------------------------------------------- waiting offer */

function OfferCard({ offer, now, onRevise }) {
  const [busy, setBusy] = useState(false);
  const left = new Date(offer.expires_at).getTime() - now;

  useEffect(() => {
    if (left <= 0) offerTimedOut();
  }, [left <= 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const withdraw = async () => {
    setBusy(true);
    try {
      await withdrawOffer();
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const canRevise = (offer.revision || 0) < MAX_REVISIONS;
  return (
    <Card style={st.offerCard}>
      <View style={st.reqTop}>
        <View style={{ flex: 1 }}>
          <Text style={st.offerLabel}>{t('waitingPassenger')}</Text>
          <Kip value={offer.price} style={st.price} unitStyle={st.priceUnit} />
          <Text style={st.meta}>{t('yourOffer')}</Text>
        </View>
        <View style={st.ring}>
          <Text style={st.ringText}>{countdown(left)}</Text>
        </View>
      </View>
      {offer.request && <RouteLine from={offer.request.pickup} to={offer.request.destination} />}
      <View style={st.actions}>
        <Btn small variant="danger" title={t('withdraw')} onPress={withdraw} busy={busy} style={{ flex: 1 }} />
        {canRevise && offer.request && (
          <Btn small variant="outline" title={t('changePrice')} onPress={onRevise} style={{ flex: 1 }} />
        )}
      </View>
    </Card>
  );
}

/* ---------------------------------------------------------- counter sheet */

function CounterSheet({ req, offer, onClose }) {
  const revising = !!(req && offer && offer.ride_id === req.id);
  const proposed = req ? req.proposed_price : 0;
  const max = Math.floor((proposed * 3) / STEP) * STEP;
  const min = Math.ceil(proposed / STEP) * STEP;
  const start = revising ? offer.price + STEP : Math.ceil((proposed + 1) / STEP) * STEP;
  const [price, setPrice] = useState(start);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (req) setPrice(Math.min(Math.max(start, min), max));
  }, [req && req.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!req) return null;

  const send = async () => {
    setBusy(true);
    try {
      await makeOffer(req, price);
      onClose();
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const revisionsLeft = revising ? MAX_REVISIONS - (offer.revision || 0) : null;

  return (
    <Sheet visible={!!req} onClose={onClose} title={t('counterTitle')}>
      <Text style={st.meta}>
        {t('offeredPrice')}: <Kip value={proposed} style={st.meta} />
      </Text>
      <View style={st.stepper}>
        <Pressable
          onPress={() => setPrice((p) => Math.max(min, p - STEP))}
          style={[st.stepBtn, price <= min && { opacity: 0.35 }]}
          disabled={price <= min}>
          <Text style={st.stepBtnText}>−</Text>
        </Pressable>
        <Kip value={price} style={st.stepPrice} unitStyle={st.priceUnit} />
        <Pressable
          onPress={() => setPrice((p) => Math.min(max, p + STEP))}
          style={[st.stepBtn, price >= max && { opacity: 0.35 }]}
          disabled={price >= max}>
          <Text style={st.stepBtnText}>+</Text>
        </Pressable>
      </View>
      <View style={st.quick}>
        {[2000, 5000, 10000].map((d) => (
          <Pressable key={d} onPress={() => setPrice((p) => Math.min(max, p + d))} style={st.quickBtn}>
            <Text style={st.quickText}>+{d / 1000}k</Text>
          </Pressable>
        ))}
      </View>
      <Sub style={{ textAlign: 'center', marginBottom: 16 }}>
        {t('counterMax', { p: money(max) })}
        {revisionsLeft != null ? `  ·  ${t('revisionsLeft', { n: revisionsLeft })}` : ''}
      </Sub>
      <Btn title={price === proposed ? t('accept') : t('sendOffer')} onPress={send} busy={busy} />
    </Sheet>
  );
}

const st = theme(
  {
    top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    name: { color: C.text, fontSize: 17, lineHeight: 26, fontWeight: '700' },
    meta: { color: C.sub, fontSize: 13, lineHeight: 20 },
    switch: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      height: 40,
      minWidth: 104,
      justifyContent: 'center',
      borderRadius: R.pill,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.line,
    },
    switchOn: { backgroundColor: C.lime, borderColor: C.lime },
    switchDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.faint },
    switchDotOn: { backgroundColor: C.ink },
    switchText: { color: C.sub, fontSize: 14, lineHeight: 22, fontWeight: '700' },
    switchTextOn: { color: C.ink, fontWeight: '700' },

    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 14,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: R.input,
    },
    bannerDot: { width: 8, height: 8, borderRadius: 4 },
    bannerText: { flex: 1, fontSize: 14, lineHeight: 22, fontWeight: '600' },
    bannerLink: { fontSize: 13, lineHeight: 20, fontWeight: '700' },

    statusBody: { color: C.text, fontSize: 14, lineHeight: 23, marginTop: 10 },
    reject: { backgroundColor: '#FDE8E4', borderRadius: R.sm, padding: 12, marginTop: 12 },
    rejectLabel: { color: '#C23B26', fontSize: 12, lineHeight: 18, fontWeight: '700' },
    rejectText: { color: C.text, fontSize: 14, lineHeight: 22, fontWeight: '500' },

    mapBox: { marginTop: 14, borderRadius: R.card, overflow: 'hidden', borderWidth: 1, borderColor: C.line },
    mapEmpty: { height: 120, alignItems: 'center', justifyContent: 'center', backgroundColor: C.mapBg },

    section: { color: C.text, fontSize: 17, lineHeight: 27, fontWeight: '700', marginTop: 18, marginBottom: 10 },
    emptyText: { textAlign: 'center', marginTop: 28 },

    reqTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
    price: { color: C.text, fontSize: 26, lineHeight: 34, fontWeight: '700' },
    priceUnit: { color: C.sub, fontSize: 16, lineHeight: 26, fontWeight: '600' },
    actions: { flexDirection: 'row', gap: 8, marginTop: 14 },

    offerCard: { marginTop: 14, borderColor: C.lime, borderWidth: 2 },
    offerLabel: { color: C.accentText, fontSize: 13, lineHeight: 20, fontWeight: '700' },
    ring: {
      width: 62,
      height: 62,
      borderRadius: 31,
      borderWidth: 3,
      borderColor: C.lime,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringText: { color: C.text, fontSize: 15, lineHeight: 22, fontWeight: '700' },

    stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 18 },
    stepBtn: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: C.card2,
      borderWidth: 1,
      borderColor: C.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBtnText: { color: C.text, fontSize: 28, lineHeight: 34, fontWeight: '500' },
    stepPrice: { color: C.text, fontSize: 34, lineHeight: 44, fontWeight: '700' },
    quick: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 12 },
    quickBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: R.pill,
      backgroundColor: C.limeSoft,
    },
    quickText: { color: C.accentText, fontSize: 14, lineHeight: 21, fontWeight: '700' },
  },
  ['ringText', 'quickText']
);

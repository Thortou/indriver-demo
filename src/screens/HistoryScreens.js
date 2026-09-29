/* =============================================================================
   Trip history (§7.4): newest first, infinite scroll by cursor, filter by
   outcome; and the detail of one trip with its earning.
   ========================================================================== */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { C, theme } from '../../theme';
import { errorText, get, qs, requestFull } from '../api';
import { fmtDateTime, money, t, tOr } from '../i18n';
import { useApp } from '../store';
import { Avatar, Badge, Btn, Card, Chip, ErrorBox, Kip, Loading, Page, Row, RouteLine, Sub } from '../ui';

const FILTERS = [
  { id: '', label: 'all' },
  { id: 'completed', label: 'completed' },
  { id: 'cancelled', label: 'cancelled' },
];

const statusTone = (s) => (s === 'completed' ? 'green' : s === 'cancelled' ? 'red' : 'amber');

export function HistoryScreen({ navigation }) {
  useApp((s) => s.lang);
  const [status, setStatus] = useState('');
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const loadingRef = useRef(false);

  const load = useCallback(
    async (reset) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError('');
      try {
        const out = await requestFull(
          'GET',
          `/driver/rides${qs({ limit: 20, status, cursor: reset ? null : cursor })}`
        );
        const list = out.data || [];
        setItems((cur) => (reset ? list : [...cur, ...list]));
        const p = out.pagination || {};
        setCursor(p.next_cursor || null);
        setHasMore(!!p.has_more && !!p.next_cursor);
      } catch (e) {
        setError(errorText(e));
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [status, cursor]
  );

  // reload from the top when the filter changes
  useEffect(() => {
    setCursor(null);
    setHasMore(true);
    loadingRef.current = false;
    load(true);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <View style={st.head}>
        <Text style={st.title}>{t('tabHistory')}</Text>
        <View style={st.chips}>
          {FILTERS.map((f) => (
            <Chip key={f.id} label={t(f.label)} active={status === f.id} onPress={() => setStatus(f.id)} />
          ))}
        </View>
      </View>
      {error && !items.length ? (
        <ErrorBox message={error} onRetry={() => load(true)} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => String(r.id)}
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          refreshControl={<RefreshControl refreshing={loading && !items.length} onRefresh={() => load(true)} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => hasMore && !loading && items.length && load(false)}
          ListEmptyComponent={!loading ? <Sub style={{ textAlign: 'center', marginTop: 32 }}>{t('noHistory')}</Sub> : null}
          ListFooterComponent={loading && items.length ? <ActivityIndicator color={C.accentText} /> : null}
          renderItem={({ item }) => (
            <Pressable onPress={() => navigation.navigate('RideDetail', { id: item.id })}>
              <Card>
                <View style={st.rowTop}>
                  <Text style={st.when}>{fmtDateTime(item.requested_at)}</Text>
                  <Badge label={tOr(`st_${item.status}`, item.status)} tone={statusTone(item.status)} />
                </View>
                <RouteLine from={item.pickup} to={item.destination} />
                <View style={st.rowBottom}>
                  <Text style={st.meta}>{(item.passenger && item.passenger.name) || ''}</Text>
                  {item.earning ? (
                    <Kip value={item.earning.net_earning} style={st.value} />
                  ) : (
                    <Kip value={item.agreed_price || item.proposed_price} style={[st.value, { color: C.faint }]} />
                  )}
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

export function RideDetailScreen({ navigation, route }) {
  const { id } = route.params;
  const [ride, setRide] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setRide(await get(`/driver/rides/${id}`));
    } catch (e) {
      setError(errorText(e));
    }
  }, [id]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load); // re-read after rating
    return unsub;
  }, [navigation, load]);

  const body = error ? (
    <ErrorBox message={error} onRetry={load} />
  ) : !ride ? (
    <Loading />
  ) : (
    <>
      <Card>
        <View style={st.rowTop}>
          <Text style={st.when}>#{ride.id}</Text>
          <Badge label={tOr(`st_${ride.status}`, ride.status)} tone={statusTone(ride.status)} />
        </View>
        <RouteLine from={ride.pickup} to={ride.destination} />
      </Card>

      {ride.passenger && (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar uri={ride.passenger.profile_photo_url} name={ride.passenger.name} />
          <Text style={st.name}>{ride.passenger.name}</Text>
        </Card>
      )}

      <Card>
        <Row label={t('fare')} value={money(ride.agreed_price || ride.proposed_price)} />
        {ride.earning && (
          <>
            <Row label={t('commission')} value={money(ride.earning.commission)} />
            <Row label={t('netEarning')} value={money(ride.earning.net_earning)} />
          </>
        )}
        <Row label={t('st_driver_assigned')} value={fmtDateTime(ride.driver_assigned_at)} />
        {!!ride.started_at && <Row label={t('st_in_progress')} value={fmtDateTime(ride.started_at)} />}
        {!!ride.completed_at && <Row label={t('st_completed')} value={fmtDateTime(ride.completed_at)} />}
        {!!ride.cancelled_at && (
          <Row
            label={t('cancelledBy', { who: tOr(`by_${ride.cancelled_by}`, ride.cancelled_by || '—') })}
            value={tOr(`cr_${ride.cancellation_reason}`, ride.cancellation_reason || '')}
          />
        )}
        <Row label={t('requestedAt')} value={fmtDateTime(ride.requested_at)} last />
      </Card>

      {ride.can_rate && (
        <Btn
          title={`★ ${t('ratePassenger')}`}
          onPress={() => navigation.navigate('Rate', { rideId: ride.id, name: ride.passenger && ride.passenger.name })}
        />
      )}
    </>
  );

  return (
    <Page title={t('rideDetail')} onBack={() => navigation.goBack()}>
      {body}
    </Page>
  );
}

const st = theme(
  {
    head: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
    title: { color: C.text, fontSize: 24, lineHeight: 36, fontWeight: '700', marginBottom: 8 },
    chips: { flexDirection: 'row', gap: 8 },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    rowBottom: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: C.hair,
    },
    when: { color: C.sub, fontSize: 13, lineHeight: 20, fontWeight: '600' },
    meta: { color: C.sub, fontSize: 13, lineHeight: 20 },
    value: { color: C.text, fontSize: 17, lineHeight: 26, fontWeight: '700' },
    name: { color: C.text, fontSize: 16, lineHeight: 25, fontWeight: '700' },
  },
  []
);

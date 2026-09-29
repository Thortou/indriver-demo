/* =============================================================================
   Earnings tab: per-day earnings for a date range and the trip list (§7.2),
   and the Wallet — commission owed against the limit, and its entries (§7.3).
   ========================================================================== */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, RefreshControl, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { C, R, theme } from '../../theme';
import { errorText, qs, requestFull, get } from '../api';
import { fmtDateTime, money, shortDay, t, tOr, vteDate } from '../i18n';
import { useApp } from '../store';
import { Btn, Card, Chip, ErrorBox, H2, Kip, Sub } from '../ui';

const RANGES = [
  { id: 'today', label: 'today', from: () => vteDate(0) },
  { id: 'week', label: 'last7', from: () => vteDate(6) },
  { id: 'month', label: 'thisMonth', from: () => `${vteDate(0).slice(0, 8)}01` },
];

export default function EarningsScreen({ route }) {
  useApp((s) => s.lang);
  const [tab, setTab] = useState(route.params && route.params.wallet ? 'wallet' : 'earnings');

  useEffect(() => {
    if (route.params && route.params.wallet) setTab('wallet');
  }, [route.params]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <View style={st.seg}>
        {['earnings', 'wallet'].map((k) => (
          <Pressable key={k} onPress={() => setTab(k)} style={[st.segBtn, tab === k && st.segOn]}>
            <Text style={[st.segText, tab === k && st.segTextOn]}>{t(k)}</Text>
          </Pressable>
        ))}
      </View>
      {tab === 'earnings' ? <Earnings /> : <Wallet />}
    </SafeAreaView>
  );
}

/* ============================================================== earnings */

function Earnings() {
  const [range, setRange] = useState('week');
  const [data, setData] = useState(null);
  const [rides, setRides] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (p = 1) => {
      const r = RANGES.find((x) => x.id === range);
      setLoading(true);
      setError('');
      try {
        const out = await requestFull(
          'GET',
          `/driver/earnings${qs({ from: r.from(), to: vteDate(0), page: p, limit: 20 })}`
        );
        const d = out.data || {};
        const pag = d.pagination || out.pagination || {};
        setData(d);
        setRides((cur) => (p === 1 ? d.rides || [] : [...cur, ...(d.rides || [])]));
        setPage(p);
        setPages(pag.total_pages || 1);
      } catch (e) {
        setError(errorText(e));
      } finally {
        setLoading(false);
      }
    },
    [range]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  if (error && !data) return <ErrorBox message={error} onRetry={() => load(1)} />;

  const days = (data && data.days) || [];
  const total = days.reduce(
    (a, d) => ({ net: a.net + d.net_earning, fare: a.fare + d.fare, commission: a.commission + d.commission, rides: a.rides + d.rides }),
    { net: 0, fare: 0, commission: 0, rides: 0 }
  );
  const maxNet = Math.max(1, ...days.map((d) => d.net_earning));

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={loading && page === 1} onRefresh={() => load(1)} />}>
      <View style={st.chips}>
        {RANGES.map((r) => (
          <Chip key={r.id} label={t(r.label)} active={range === r.id} onPress={() => setRange(r.id)} />
        ))}
      </View>

      <View style={st.hero}>
        <Text style={st.heroLabel}>{t('netEarning')}</Text>
        <Kip value={total.net} style={st.heroValue} unitStyle={st.heroUnit} />
        <Text style={st.heroSub}>
          {t('ridesN', { n: total.rides })} · {t('fare')} {money(total.fare)} · {t('commission')} {money(total.commission)}
        </Text>
      </View>

      {days.length > 0 && (
        <Card>
          <H2>{t('daily')}</H2>
          {days.map((d) => (
            <View key={d.date} style={st.dayRow}>
              <Text style={st.dayDate}>{shortDay(d.date)}</Text>
              <View style={st.barTrack}>
                <View style={[st.barFill, { width: `${(d.net_earning / maxNet) * 100}%` }]} />
              </View>
              <Text style={st.dayValue}>{money(d.net_earning)}</Text>
            </View>
          ))}
        </Card>
      )}

      <Card>
        <H2>{t('tripsList')}</H2>
        {rides.length === 0 && !loading && <Sub>{t('empty')}</Sub>}
        {rides.map((r, i) => (
          <View key={r.id} style={[st.item, i === rides.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={st.itemTitle}>#{r.ride_id}</Text>
              <Text style={st.itemSub}>
                {fmtDateTime(r.paid_at)} · {t('commission')} {money(r.commission)}
              </Text>
            </View>
            <Text style={st.itemValue}>{money(r.net_earning)}</Text>
          </View>
        ))}
        {page < pages && (
          <Btn small variant="ghost" title={t('loadMore')} onPress={() => load(page + 1)} busy={loading} />
        )}
      </Card>
    </ScrollView>
  );
}

/* ================================================================ wallet */

function Wallet() {
  const [wallet, setWallet] = useState(null);
  const [entries, setEntries] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    setError('');
    try {
      const [w, e] = await Promise.all([
        p === 1 ? get('/driver/wallet') : Promise.resolve(null),
        requestFull('GET', `/driver/wallet/entries${qs({ page: p, limit: 20 })}`),
      ]);
      if (w) setWallet(w);
      setEntries((cur) => (p === 1 ? e.data || [] : [...cur, ...(e.data || [])]));
      setPage(p);
      setPages((e.pagination && e.pagination.total_pages) || 1);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(1);
  }, [load]);

  if (error && !wallet) return <ErrorBox message={error} onRetry={() => load(1)} />;
  if (!wallet) return <ActivityIndicator color={C.accentText} style={{ marginTop: 40 }} />;

  const pct = wallet.limit ? Math.min(1, wallet.owed / wallet.limit) : 0;

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={loading && page === 1} onRefresh={() => load(1)} />}>
      <Card>
        <Text style={st.meta}>{t('youOwe')}</Text>
        <Kip
          value={wallet.owed}
          style={[st.owe, wallet.blocks_availability && { color: C.red }]}
          unitStyle={st.heroUnit}
        />
        <View style={[st.barTrack, { height: 10, marginTop: 10 }]}>
          <View
            style={[
              st.barFill,
              { height: 10, width: `${pct * 100}%` },
              pct >= 0.8 && { backgroundColor: C.red },
            ]}
          />
        </View>
        <Text style={[st.meta, { marginTop: 6 }]}>{t('limit', { p: money(wallet.limit) })}</Text>
        {wallet.blocks_availability && (
          <View style={st.blocked}>
            <Text style={st.blockedText}>{t('walletBlocked')}</Text>
          </View>
        )}
      </Card>

      <Card>
        <H2>{t('walletEntries')}</H2>
        {entries.length === 0 && !loading && <Sub>{t('empty')}</Sub>}
        {entries.map((e, i) => (
          <View key={e.id} style={[st.item, i === entries.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={st.itemTitle}>
                {tOr(`we_${e.type}`, e.type)}
                {e.ride_id ? `  #${e.ride_id}` : ''}
              </Text>
              <Text style={st.itemSub}>{fmtDateTime(e.created_at)}</Text>
            </View>
            <Text style={[st.itemValue, { color: e.amount < 0 ? C.red : '#1F8A55' }]}>
              {e.amount > 0 ? '+' : ''}
              {money(e.amount)}
            </Text>
          </View>
        ))}
        {page < pages && (
          <Btn small variant="ghost" title={t('loadMore')} onPress={() => load(page + 1)} busy={loading} />
        )}
      </Card>
    </ScrollView>
  );
}

const st = theme(
  {
    seg: {
      flexDirection: 'row',
      backgroundColor: C.card2,
      borderRadius: R.input,
      padding: 4,
      margin: 16,
      marginBottom: 0,
      borderWidth: 1,
      borderColor: C.line,
    },
    segBtn: { flex: 1, paddingVertical: 9, borderRadius: R.xs, alignItems: 'center' },
    segOn: { backgroundColor: C.lime },
    segText: { color: C.sub, fontSize: 14, lineHeight: 22, fontWeight: '600' },
    segTextOn: { color: C.ink, fontWeight: '700' },

    chips: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    hero: { backgroundColor: C.ink, borderRadius: R.card, padding: 18, marginBottom: 12 },
    heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 20, fontWeight: '600' },
    heroValue: { color: C.lime, fontSize: 36, lineHeight: 48, fontWeight: '700' },
    heroUnit: { color: C.sub, fontSize: 18, lineHeight: 28, fontWeight: '600' },
    heroSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12.5, lineHeight: 20 },

    dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    dayDate: { width: 44, color: C.sub, fontSize: 13, lineHeight: 20, fontWeight: '600' },
    barTrack: { flex: 1, height: 8, borderRadius: 5, backgroundColor: C.card2, overflow: 'hidden' },
    barFill: { height: 8, borderRadius: 5, backgroundColor: C.lime },
    dayValue: { width: 96, textAlign: 'right', color: C.text, fontSize: 13, lineHeight: 20, fontWeight: '600' },

    item: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: C.hair,
    },
    itemTitle: { color: C.text, fontSize: 15, lineHeight: 23, fontWeight: '600' },
    itemSub: { color: C.faint, fontSize: 12.5, lineHeight: 19 },
    itemValue: { color: C.text, fontSize: 15, lineHeight: 23, fontWeight: '700' },

    meta: { color: C.sub, fontSize: 13, lineHeight: 20, fontWeight: '500' },
    owe: { color: C.text, fontSize: 34, lineHeight: 46, fontWeight: '700' },
    blocked: { backgroundColor: '#FDE8E4', borderRadius: R.sm, padding: 12, marginTop: 12 },
    blockedText: { color: '#C23B26', fontSize: 14, lineHeight: 22, fontWeight: '600' },
  },
  []
);

/* =============================================================================
   Account tab: profile, verification status and per-document badges (§3.1);
   Replace documents (§3.2).
   ========================================================================== */

import React, { useCallback, useState } from 'react';
import { View, Text, Alert, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { C, R, theme } from '../../theme';
import { ApiError, errorText, isUnavailable, post, upload } from '../api';
import { loadMe, loadAccount, logout } from '../engine';
import { t, tOr } from '../i18n';
import { pickPhoto } from '../photo';
import { toast, useApp } from '../store';
import { Avatar, Badge, Btn, Card, Field, H2, Page, Row, Sub } from '../ui';
import { PhotoRow } from './AuthScreens';

const STATE_TONE = { valid: 'green', expiring_soon: 'amber', expired: 'red', missing: 'grey' };
const VS_TONE = { approved: 'green', under_review: 'amber', rejected: 'red', pending: 'grey' };

function docBadge(d) {
  const label =
    d.state === 'expiring_soon'
      ? t('state_expiring_soon', { n: d.days_until_expiry })
      : tOr(`state_${d.state}`, d.state);
  return <Badge label={label} tone={STATE_TONE[d.state] || 'grey'} />;
}

function DocRow({ d, last }) {
  return (
    <View style={[st.docRow, last && { borderBottomWidth: 0 }]}>
      <View style={{ flex: 1 }}>
        <Text style={st.docName}>{tOr(`doc_${d.document}`, d.document)}</Text>
        {!!d.expires_on && <Text style={st.docSub}>{t('expiresOn', { d: d.expires_on })}</Text>}
      </View>
      {docBadge(d)}
    </View>
  );
}

export function AccountScreen({ navigation }) {
  const me = useApp((s) => s.me);
  const account = useApp((s) => s.account);
  useApp((s) => s.lang);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadMe().catch(() => {}), loadAccount().catch(() => {})]);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMe().catch(() => {});
    }, [])
  );

  const vs = me && me.verification_status;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <View style={st.profile}>
          <Avatar uri={account && account.profile_photo_url} name={account && account.full_name} size={64} />
          <View style={{ flex: 1 }}>
            <Text style={st.name}>{(account && account.full_name) || '—'}</Text>
            <Text style={st.meta}>{account && account.phone_number}</Text>
            {vs && <Badge label={tOr(`vs_${vs}`, vs)} tone={VS_TONE[vs]} style={{ marginTop: 6 }} />}
          </View>
        </View>

        {me && (
          <View style={st.stats}>
            <Stat label={t('rating')} value={me.average_rating != null ? `★ ${Number(me.average_rating).toFixed(1)}` : t('newDriver')} />
            <Stat label={t('totalRides')} value={String(me.total_rides || 0)} />
          </View>
        )}

        {vs === 'rejected' && !!me.rejection_reason && (
          <View style={st.reject}>
            <Text style={st.rejectLabel}>{t('rejectionReason')}</Text>
            <Text style={st.rejectText}>{me.rejection_reason}</Text>
          </View>
        )}
        {vs === 'under_review' && <Sub style={{ marginBottom: 12 }}>{t('reviewBody')}</Sub>}

        {me && (
          <Card>
            <H2>{t('documents')}</H2>
            {me.documents.map((d, i) => (
              <DocRow key={d.document} d={d} last={i === me.documents.length - 1 && !me.vehicles.length} />
            ))}
            {me.vehicles.map((v) => (
              <View key={v.vehicle_id}>
                <Text style={st.vehicle}>
                  🚗 {v.plate_number} · {v.type}
                </Text>
                {v.documents.map((d, i) => (
                  <DocRow key={d.document} d={d} last={i === v.documents.length - 1} />
                ))}
              </View>
            ))}
            {!!(me.missing && me.missing.length) && (
              <Sub style={{ marginTop: 8, color: C.red }}>
                {t('missingItems')}: {me.missing.map((m) => tOr(`doc_${m}`, m)).join(', ')}
              </Sub>
            )}
            <Btn
              small
              variant={vs === 'rejected' ? 'primary' : 'outline'}
              title={t('replaceDocs')}
              onPress={() => navigation.navigate('ReplaceDocs')}
              style={{ marginTop: 12 }}
            />
          </Card>
        )}

        <Card>
          <Row label={`⚙  ${t('settings')}`} onPress={() => navigation.navigate('Settings')} last />
        </Card>
        <Btn variant="danger" title={t('logout')} onPress={logout} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }) {
  return (
    <View style={st.stat}>
      <Text style={st.statValue}>{value}</Text>
      <Text style={st.meta}>{label}</Text>
    </View>
  );
}

/* ====================================================== replace documents */

// purpose -> where its key goes, and which expiry date goes with it (DD-MM-YYYY)
const REPLACEABLE = [
  { purpose: 'license_photo', key: 'license_photo_key', expiry: 'license_expiry' },
  { purpose: 'license_selfie', key: 'license_selfie_key' },
  { purpose: 'id_card_photo', key: 'id_card_photo_key', expiry: 'id_card_expiry' },
  { purpose: 'vehicle_photo', key: 'vehicle_photo_key', vehicle: true },
  { purpose: 'registration_doc', key: 'registration_doc_key', expiry: 'registration_expires_at', vehicle: true },
  { purpose: 'insurance_doc', key: 'insurance_doc_key', expiry: 'insurance_expires_at', vehicle: true },
];

const EXPIRY_LABEL = {
  license_expiry: 'licenseExpiry',
  id_card_expiry: 'idCardExpiry',
  registration_expires_at: 'registrationExpiry',
  insurance_expires_at: 'insuranceExpiry',
};

const DMY = /^\d{2}-\d{2}-\d{4}$/;

export function ReplaceDocsScreen({ navigation }) {
  const me = useApp((s) => s.me);
  const [keys, setKeys] = useState({}); //     purpose -> key
  const [previews, setPreviews] = useState({});
  const [dates, setDates] = useState({}); //   expiry field -> DD-MM-YYYY
  const [uploading, setUploading] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retryAt, setRetryAt] = useState(0);

  const vehicle = me && me.vehicles && me.vehicles[0];
  const docState = (purpose) => {
    const all = [...((me && me.documents) || []), ...((vehicle && vehicle.documents) || [])];
    return all.find((d) => d.document === purpose);
  };

  const take = async (purpose) => {
    if (Date.now() < retryAt) {
      setError(t('waitSeconds', { n: Math.ceil((retryAt - Date.now()) / 1000) }));
      return;
    }
    const uri = await pickPhoto({ selfie: purpose === 'license_selfie' });
    if (!uri) return;
    setUploading(purpose);
    setError('');
    try {
      const res = await upload({ uri, purpose, name: `${purpose}.jpg` });
      setKeys((k) => ({ ...k, [purpose]: res.key }));
      setPreviews((p) => ({ ...p, [purpose]: uri }));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'driver.too_many_uploads' && e.retryAfter) {
        setRetryAt(Date.now() + e.retryAfter * 1000);
      }
      setError(isUnavailable(e) ? t('unavailableFeature') : errorText(e));
    } finally {
      setUploading(null);
    }
  };

  const buildBody = () => {
    const body = {};
    const veh = {};
    REPLACEABLE.forEach((r) => {
      const target = r.vehicle ? veh : body;
      if (keys[r.purpose]) target[r.key] = keys[r.purpose];
      if (r.expiry && dates[r.expiry]) target[r.expiry] = dates[r.expiry].trim();
    });
    if (Object.keys(veh).length && vehicle) body.vehicle = { vehicle_id: vehicle.vehicle_id, ...veh };
    return body;
  };

  const send = async (body) => {
    setBusy(true);
    setError('');
    try {
      await post('/driver/verification/documents', body);
      await loadMe().catch(() => {});
      toast(t('submitted'));
      navigation.goBack();
    } catch (e) {
      setError(errorText(e)); // incl. 409 driver.submission_under_review: show detail
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    const bad = Object.entries(dates).find(([, v]) => v && !DMY.test(v.trim()));
    if (bad) {
      setError(`${t(EXPIRY_LABEL[bad[0]])}: ${t('dateFormatDmy')}`);
      return;
    }
    const body = buildBody();
    if (!Object.keys(body).length) {
      setError(t('nothingToSubmit'));
      return;
    }
    if (me && me.verification_status === 'approved') {
      Alert.alert(t('replaceDocs'), t('replaceWarnApproved'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('submit'), style: 'destructive', onPress: () => send(body) },
      ]);
    } else send(body);
  };

  return (
    <Page
      title={t('replaceDocs')}
      onBack={() => navigation.goBack()}
      footer={<Btn title={t('submit')} onPress={submit} busy={busy} disabled={!!uploading} />}>
      <Sub style={{ marginBottom: 14 }}>{t('replaceIntro')}</Sub>
      {!!error && <Text style={st.error}>{error}</Text>}
      {REPLACEABLE.filter((r) => !r.vehicle || vehicle).map((r) => {
        const d = docState(r.purpose);
        return (
          <View key={r.purpose}>
            <PhotoRow
              label={t(`doc_${r.purpose}`)}
              uri={previews[r.purpose]}
              done={!!keys[r.purpose]}
              busy={uploading === r.purpose}
              disabled={!!uploading}
              sub={d ? tOr(`state_${d.state}`, d.state, { n: d.days_until_expiry }) : undefined}
              onPress={() => take(r.purpose)}
            />
            {r.expiry && (
              <Field
                label={t(EXPIRY_LABEL[r.expiry])}
                hint={t('dateFormatDmy')}
                placeholder={d && d.expires_on ? d.expires_on : '31-12-2030'}
                value={dates[r.expiry] || ''}
                onChangeText={(v) => setDates((cur) => ({ ...cur, [r.expiry]: v }))}
                keyboardType="numbers-and-punctuation"
                style={{ marginLeft: 12 }}
              />
            )}
          </View>
        );
      })}
    </Page>
  );
}

const st = theme(
  {
    profile: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
    name: { color: C.text, fontSize: 20, lineHeight: 30, fontWeight: '700' },
    meta: { color: C.sub, fontSize: 13, lineHeight: 20 },
    stats: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    stat: {
      flex: 1,
      backgroundColor: C.card,
      borderRadius: R.card,
      borderWidth: 1,
      borderColor: C.line,
      padding: 14,
    },
    statValue: { color: C.text, fontSize: 18, lineHeight: 28, fontWeight: '700' },
    reject: { backgroundColor: '#FDE8E4', borderRadius: R.sm, padding: 12, marginBottom: 12 },
    rejectLabel: { color: '#C23B26', fontSize: 12, lineHeight: 18, fontWeight: '700' },
    rejectText: { color: C.text, fontSize: 14, lineHeight: 22, fontWeight: '500' },
    docRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: C.hair,
      gap: 10,
    },
    docName: { color: C.text, fontSize: 14.5, lineHeight: 22, fontWeight: '600' },
    docSub: { color: C.faint, fontSize: 12, lineHeight: 18 },
    vehicle: { color: C.text, fontSize: 14, lineHeight: 22, fontWeight: '700', marginTop: 14, marginBottom: 2 },
    error: { color: C.red, fontSize: 14, lineHeight: 22, marginBottom: 12, fontWeight: '500' },
  },
  []
);

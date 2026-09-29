/* =============================================================================
   Logged-out screens: Login and Settings (language + API base URL, also
   reachable when logged in). The sign-up wizard is in SignupScreen.js.
   ========================================================================== */

import React, { useState } from 'react';
import { View, Text, Pressable, Image, ActivityIndicator } from 'react-native';

import { C, R, theme } from '../../theme';
import { ApiError, errorText, get } from '../api';
import { getBaseUrl, getConfiguredBaseUrl, getDeviceId, setBaseUrl } from '../config';
import { changeLang, login, logout } from '../engine';
import { t } from '../i18n';
import { PUSH_SUPPORTED } from '../push';
import { useApp } from '../store';
import { Btn, Card, Chip, Field, H1, H2, Page, Row, Sub } from '../ui';

/** "020 5551 2345" / "8562055512345" / "+856…" -> "+8562055512345" */
export function normalizePhone(raw) {
  const v = (raw || '').replace(/[^\d+]/g, '');
  if (v.startsWith('+')) return v;
  if (v.startsWith('856')) return `+${v}`;
  if (v.startsWith('0')) return `+856${v.slice(1)}`;
  return `+856${v}`;
}

/* ================================================================= login */

export function LoginScreen({ navigation, route }) {
  const [phone, setPhone] = useState((route.params && route.params.phone) || '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await login(normalizePhone(phone), password);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? t('badCredentials') : errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page scroll>
      <View style={st.brandMark}>
        <Text style={st.brandMarkText}>ຂ</Text>
      </View>
      <H1 style={{ marginTop: 18 }}>{t('appName')}</H1>
      <Sub style={{ marginBottom: 28 }}>{t('tagline')}</Sub>

      <Field
        label={t('phone')}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="020 5551 2345"
        autoComplete="tel"
      />
      <Field
        label={t('password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        onSubmitEditing={submit}
      />
      {!!error && <Text style={st.error}>{error}</Text>}
      <Btn title={t('login')} onPress={submit} busy={busy} disabled={!phone || !password} />

      <View style={{ height: 28 }} />
      <Sub style={{ textAlign: 'center' }}>{t('noAccount')}</Sub>
      <Btn
        title={t('signup')}
        variant="outline"
        style={{ marginTop: 10 }}
        onPress={() => navigation.navigate('Signup')}
      />
      <Pressable onPress={() => navigation.navigate('Settings')} style={{ marginTop: 24, alignSelf: 'center' }}>
        <Text style={st.link}>⚙ {t('serverSettings')}</Text>
      </Pressable>
    </Page>
  );
}

/* ========================================================== photo row */

export function PhotoRow({ label, uri, done, busy, disabled, onPress, sub }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [st.photoRow, done && { borderColor: C.lime }, pressed && { opacity: 0.8 }]}>
      {uri ? <Image source={{ uri }} style={st.thumb} /> : <View style={[st.thumb, st.thumbEmpty]}><Text>📷</Text></View>}
      <View style={{ flex: 1 }}>
        <Text style={st.photoLabel}>{label}</Text>
        <Text style={[st.photoSub, done && { color: C.accentText }]}>
          {busy ? t('uploading') : done ? `✓ ${t('uploaded')}` : sub || t('takePhoto')}
        </Text>
      </View>
      {busy ? <ActivityIndicator color={C.accentText} /> : <Text style={st.chev}>›</Text>}
    </Pressable>
  );
}

/* ============================================================== settings */

export function SettingsScreen({ navigation }) {
  const lang = useApp((s) => s.lang);
  const session = useApp((s) => s.session);
  const realtime = useApp((s) => s.realtime);
  const [url, setUrl] = useState(getConfiguredBaseUrl());
  const [test, setTest] = useState('');
  const [testing, setTesting] = useState(false);

  const saveAndTest = async () => {
    setTesting(true);
    setTest('');
    try {
      await setBaseUrl(url);
      await get('/health/live', { auth: false });
      setTest(`✓ ${t('connectionOk')}`);
    } catch (e) {
      setTest(`✕ ${errorText(e)}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Page title={t('settings')} onBack={() => navigation.goBack()}>
      <Card>
        <H2>{t('language')}</H2>
        <View style={st.chips}>
          <Chip label="ລາວ" active={lang === 'lo'} onPress={() => changeLang('lo')} />
          <Chip label="English" active={lang === 'en'} onPress={() => changeLang('en')} />
        </View>
      </Card>

      <Card>
        <H2>{t('apiBaseUrl')}</H2>
        <Field
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="http://localhost:8080"
          hint={getBaseUrl() !== url.trim() ? `→ ${getBaseUrl()}` : undefined}
        />
        <Btn small variant="outline" title={t('testConnection')} onPress={saveAndTest} busy={testing} />
        {!!test && <Sub style={{ marginTop: 10 }}>{test}</Sub>}
      </Card>

      <Card>
        <Row label={t('deviceId')} value={getDeviceId()} />
        {session && (
          <Row label="Realtime" value={realtime === 'live' ? t('realtimeLive') : t('realtimePolling')} />
        )}
        <Row label="Push" value={PUSH_SUPPORTED ? 'FCM' : t('pushOff')} last />
      </Card>

      {session && <Btn variant="danger" title={t('logout')} onPress={logout} />}
    </Page>
  );
}

const st = theme({
  brandMark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  brandMarkText: { color: C.lime, fontSize: 30, lineHeight: 42, fontWeight: '700' },
  error: { color: C.red, fontSize: 14, lineHeight: 22, marginBottom: 12, fontWeight: '500' },
  link: { color: C.sub, fontSize: 14, lineHeight: 22, fontWeight: '600' },
  label: { color: C.sub, fontSize: 13, lineHeight: 20, fontWeight: '600', marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.input,
    padding: 10,
    marginBottom: 10,
  },
  thumb: { width: 52, height: 52, borderRadius: R.xs, backgroundColor: C.card2 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  photoLabel: { color: C.text, fontSize: 15, lineHeight: 23, fontWeight: '600' },
  photoSub: { color: C.faint, fontSize: 13, lineHeight: 20 },
  chev: { color: C.faint, fontSize: 20, lineHeight: 24 },
});

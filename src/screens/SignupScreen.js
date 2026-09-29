/* =============================================================================
   Driver sign-up wizard (DRIVER_APP_API.md §2.1), one topic per step:

     1 phone         → registration ticket
     2 about you     name, password, email · profile_photo
     3 licence       number, expiry        · license_photo, license_selfie
     4 ID card       number, expiry        · id_card_photo
     5 vehicle       type, plate, make, model, colour, year · vehicle_photo
     6 registration  expiry                · registration_doc
     7 insurance     expiry                · insurance_doc
     8 review        → POST /auth/drivers/register

   Each photo uploads as soon as it is taken (with the ticket), on the step
   whose document it is. The ticket lasts 30 minutes and allows 10 uploads.
   ========================================================================== */

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Image, ActivityIndicator, Alert, BackHandler } from 'react-native';

import { C, R, theme } from '../../theme';
import { ApiError, errorText, isUnavailable, post, upload } from '../api';
import { t } from '../i18n';
import { pickPhoto } from '../photo';
import { useApp } from '../store';
import { Btn, Card, Chip, Field, H1, Page, Sub } from '../ui';
import { normalizePhone } from './AuthScreens';

export const VEHICLE_TYPES = ['economy', 'comfort', 'xl', 'moto', 'delivery', 'freight'];

const STEPS = [
  { id: 'phone', fields: [], photos: [] },
  { id: 'account', fields: ['full_name', 'password', 'email'], photos: ['profile_photo'] },
  { id: 'license', fields: ['license_number', 'license_expiry'], photos: ['license_photo', 'license_selfie'] },
  { id: 'id', fields: ['id_card_number', 'id_card_expiry'], photos: ['id_card_photo'] },
  {
    id: 'vehicle',
    fields: [
      'vehicle.vehicle_type',
      'vehicle.plate_number',
      'vehicle.make',
      'vehicle.model',
      'vehicle.color',
      'vehicle.year',
    ],
    photos: ['vehicle_photo'],
  },
  { id: 'registration', fields: ['vehicle.registration_expires_at'], photos: ['registration_doc'] },
  { id: 'insurance', fields: ['vehicle.insurance_expires_at'], photos: ['insurance_doc'] },
  { id: 'review', fields: [], photos: [] },
];

const OPTIONAL = new Set(['email']);
const DATE_FIELDS = new Set([
  'license_expiry',
  'id_card_expiry',
  'vehicle.registration_expires_at',
  'vehicle.insurance_expires_at',
]);

// server error path / photo key -> the step that shows it
const STEP_OF = {};
STEPS.forEach((s, i) => {
  s.fields.forEach((f) => (STEP_OF[f] = i));
  s.photos.forEach((p) => {
    STEP_OF[p] = i;
    STEP_OF[`${p}_key`] = i;
    STEP_OF[`vehicle.${p}_key`] = i;
  });
});
STEP_OF.phone_number = 0;

const EMPTY_FORM = {
  full_name: '',
  password: '',
  email: '',
  license_number: '',
  license_expiry: '',
  id_card_number: '',
  id_card_expiry: '',
  'vehicle.vehicle_type': 'economy',
  'vehicle.plate_number': '',
  'vehicle.make': '',
  'vehicle.model': '',
  'vehicle.color': '',
  'vehicle.year': '',
  'vehicle.registration_expires_at': '',
  'vehicle.insurance_expires_at': '',
};

const LABEL = {
  full_name: 'fullName',
  password: 'password',
  email: 'email',
  license_number: 'licenseNumber',
  license_expiry: 'licenseExpiry',
  id_card_number: 'idCardNumber',
  id_card_expiry: 'idCardExpiry',
  'vehicle.vehicle_type': 'vehicleType',
  'vehicle.plate_number': 'plate',
  'vehicle.make': 'make',
  'vehicle.model': 'model',
  'vehicle.color': 'color',
  'vehicle.year': 'year',
  'vehicle.registration_expires_at': 'registrationExpiry',
  'vehicle.insurance_expires_at': 'insuranceExpiry',
};

/** Digits typed -> "YYYY-MM-DD" as you go. */
function maskIsoDate(v) {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
}

function checkDate(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return t('dateFormatIso');
  const [y, m, d] = v.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return t('dateFormatIso');
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (date < today) return t('dateInPast');
  return null;
}

export default function SignupScreen({ navigation }) {
  const lang = useApp((s) => s.lang);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [phone, setPhone] = useState('');
  const [ticket, setTicket] = useState(null); // { token, phone, expiresAt }
  const [keys, setKeys] = useState({}); //       purpose -> uploaded key
  const [previews, setPreviews] = useState({}); // purpose -> local uri
  const [uploading, setUploading] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const cur = STEPS[step];
  const upd = (k) => (v) => {
    setForm((f) => ({ ...f, [k]: DATE_FIELDS.has(k) ? maskIsoDate(v) : v }));
    if (errs[k]) setErrs((e) => ({ ...e, [k]: null }));
  };

  const goBack = () => {
    setError('');
    if (step > 0) setStep(step - 1);
    else navigation.goBack();
    return true;
  };

  // Android back button steps back through the wizard
  useEffect(() => {
    if (done) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => sub.remove();
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const ticketValid = () => ticket && Date.now() < ticket.expiresAt;

  const restart = () => {
    setTicket(null);
    setKeys({});
    setPreviews({});
    setStep(0);
    setError(t('ticketExpired'));
  };

  /* ------------------------------------------------------------ step 1 */
  const getTicket = async () => {
    const normalized = normalizePhone(phone);
    if (ticketValid() && ticket.phone === normalized) return true;
    const data = await post('/auth/drivers/registration-ticket', { phone_number: normalized }, { auth: false });
    setTicket({ token: data.ticket, phone: normalized, expiresAt: Date.now() + data.expires_in * 1000 });
    setKeys({});
    setPreviews({});
    return true;
  };

  /* ------------------------------------------------------------ photos */
  const takePhoto = async (purpose) => {
    if (!ticketValid()) return restart();
    const uri = await pickPhoto({ selfie: purpose === 'license_selfie' });
    if (!uri) return;
    setUploading(purpose);
    setErrs((e) => ({ ...e, [purpose]: null }));
    setError('');
    try {
      const res = await upload({ uri, purpose, bearer: ticket.token, name: `${purpose}.jpg` });
      setKeys((k) => ({ ...k, [purpose]: res.key }));
      setPreviews((p) => ({ ...p, [purpose]: uri }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return restart();
      setErrs((x) => ({ ...x, [purpose]: isUnavailable(e) ? t('signupUnavailable') : errorText(e) }));
    } finally {
      setUploading(null);
    }
  };

  /* -------------------------------------------------------- validation */
  const validateStep = (i) => {
    const s = STEPS[i];
    const out = {};
    s.fields.forEach((k) => {
      const v = String(form[k]).trim();
      if (!v) {
        if (!OPTIONAL.has(k)) out[k] = t('required');
        return;
      }
      if (DATE_FIELDS.has(k)) {
        const bad = checkDate(v);
        if (bad) out[k] = bad;
      }
    });
    if (s.fields.includes('password') && form.password.length < 8) out.password = t('passwordHint');
    if (s.fields.includes('vehicle.year') && form['vehicle.year'] && !/^\d{4}$/.test(form['vehicle.year']))
      out['vehicle.year'] = 'YYYY';
    s.photos.forEach((p) => {
      if (!keys[p]) out[p] = t('photoNeeded');
    });
    return out;
  };

  const next = async () => {
    setError('');
    if (cur.id === 'phone') {
      setBusy(true);
      try {
        await getTicket();
        setStep(1);
      } catch (e) {
        if (e instanceof ApiError && e.code === 'identity.already_drives') {
          Alert.alert(t('alreadyDrives'), undefined, [
            { text: t('cancel'), style: 'cancel' },
            { text: t('goToLogin'), onPress: () => navigation.navigate('Login', { phone }) },
          ]);
        } else setError(isUnavailable(e) ? t('signupUnavailable') : errorText(e));
      } finally {
        setBusy(false);
      }
      return;
    }
    if (cur.id === 'review') return register();

    const found = validateStep(step);
    setErrs((e) => ({ ...e, ...found }));
    if (Object.keys(found).length) return;
    setStep(step + 1);
  };

  /* ---------------------------------------------------------- register */
  const register = async () => {
    // every step once more, in case the driver jumped around
    for (let i = 1; i < STEPS.length - 1; i++) {
      const found = validateStep(i);
      if (Object.keys(found).length) {
        setErrs((e) => ({ ...e, ...found }));
        setStep(i);
        return;
      }
    }
    if (!ticketValid()) return restart();

    setBusy(true);
    const f = (k) => form[k].trim();
    const body = {
      password: form.password,
      full_name: f('full_name'),
      email: f('email') || null,
      language_pref: lang,
      profile_photo_key: keys.profile_photo,
      license_number: f('license_number'),
      license_expiry: f('license_expiry'),
      license_photo_key: keys.license_photo,
      license_selfie_key: keys.license_selfie,
      id_card_number: f('id_card_number'),
      id_card_expiry: f('id_card_expiry'),
      id_card_photo_key: keys.id_card_photo,
      vehicle: {
        vehicle_type: form['vehicle.vehicle_type'],
        plate_number: f('vehicle.plate_number'),
        make: f('vehicle.make'),
        model: f('vehicle.model'),
        color: f('vehicle.color'),
        year: Number(f('vehicle.year')),
        vehicle_photo_key: keys.vehicle_photo,
        registration_doc_key: keys.registration_doc,
        registration_expires_at: f('vehicle.registration_expires_at'),
        insurance_doc_key: keys.insurance_doc,
        insurance_expires_at: f('vehicle.insurance_expires_at'),
      },
    };
    try {
      await post('/auth/drivers/register', body, { bearer: ticket.token });
      setDone(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return restart();
      const found = {};
      (e.errors || []).forEach((x) => {
        if (x.path) found[x.path.replace(/_key$/, '').replace(/^vehicle\.(?=\w+_(photo|doc))/, '')] = x.message || x.code;
      });
      // 409s name the field in the code
      const byCode = {
        'identity.phone_taken': 'phone_number',
        'driver.license_taken': 'license_number',
        'driver.plate_taken': 'vehicle.plate_number',
      };
      if (e.code && byCode[e.code]) found[byCode[e.code]] = e.detail;
      setErrs((x) => ({ ...x, ...found }));
      const steps = Object.keys(found)
        .map((k) => STEP_OF[k])
        .filter((i) => i != null);
      if (steps.length) setStep(Math.min(...steps));
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  /* ------------------------------------------------------------ render */

  if (done) {
    return (
      <Page title={t('signup')}>
        <View style={st.doneMark}>
          <Text style={st.doneMarkText}>✓</Text>
        </View>
        <H1 style={{ marginTop: 16 }}>{t('signupDone')}</H1>
        <Sub style={{ marginBottom: 24 }}>{t('signupDoneBody')}</Sub>
        <Btn title={t('goToLogin')} onPress={() => navigation.navigate('Login', { phone })} />
      </Page>
    );
  }

  const field = (k, props = {}) => (
    <Field
      key={k}
      label={t(LABEL[k]) + (OPTIONAL.has(k) ? '' : ' *')}
      value={form[k]}
      onChangeText={upd(k)}
      error={errs[k]}
      {...(DATE_FIELDS.has(k)
        ? { placeholder: '2030-12-31', keyboardType: 'number-pad', maxLength: 10, hint: t('dateFormatIso') }
        : null)}
      {...props}
    />
  );

  const photo = (p) => (
    <PhotoSlot
      key={p}
      label={t(`doc_${p}`)}
      uri={previews[p]}
      done={!!keys[p]}
      busy={uploading === p}
      disabled={!!uploading}
      error={errs[p]}
      onPress={() => takePhoto(p)}
    />
  );

  const isLast = cur.id === 'review';

  return (
    <Page
      onBack={goBack}
      title={t('signup')}
      footer={
        <Btn
          title={isLast ? t('submit') : t('next')}
          onPress={next}
          busy={busy}
          disabled={!!uploading || (cur.id === 'phone' && phone.replace(/\D/g, '').length < 8)}
        />
      }>
      <Progress step={step} />
      <Text style={st.stepNo}>{t('stepOf', { n: step + 1, total: STEPS.length })}</Text>
      <H1 style={st.title}>{t(`sg_${cur.id}`)}</H1>
      <Sub style={{ marginBottom: 20 }}>{t(`sg_${cur.id}_sub`)}</Sub>
      {!!error && <Text style={st.error}>{error}</Text>}

      {cur.id === 'phone' && (
        <Field
          label={t('phone')}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="020 5551 2345"
          autoFocus
          error={errs.phone_number}
        />
      )}

      {cur.id === 'account' && (
        <>
          {photo('profile_photo')}
          {field('full_name', { autoCapitalize: 'words' })}
          {field('password', { secureTextEntry: true, autoCapitalize: 'none', hint: t('passwordHint') })}
          {field('email', { keyboardType: 'email-address', autoCapitalize: 'none' })}
        </>
      )}

      {cur.id === 'license' && (
        <>
          {field('license_number', { autoCapitalize: 'characters' })}
          {field('license_expiry')}
          {photo('license_photo')}
          {photo('license_selfie')}
        </>
      )}

      {cur.id === 'id' && (
        <>
          {field('id_card_number', { keyboardType: 'number-pad' })}
          {field('id_card_expiry')}
          {photo('id_card_photo')}
        </>
      )}

      {cur.id === 'vehicle' && (
        <>
          <Text style={st.label}>{t('vehicleType')} *</Text>
          <View style={st.chips}>
            {VEHICLE_TYPES.map((vt) => (
              <Chip
                key={vt}
                label={vt}
                active={form['vehicle.vehicle_type'] === vt}
                onPress={() => upd('vehicle.vehicle_type')(vt)}
              />
            ))}
          </View>
          {field('vehicle.plate_number')}
          <View style={st.twoCol}>
            {field('vehicle.make', { style: st.col })}
            {field('vehicle.model', { style: st.col })}
          </View>
          <View style={st.twoCol}>
            {field('vehicle.color', { style: st.col })}
            {field('vehicle.year', { style: st.col, keyboardType: 'number-pad', maxLength: 4, placeholder: '2020' })}
          </View>
          {photo('vehicle_photo')}
        </>
      )}

      {cur.id === 'registration' && (
        <>
          {photo('registration_doc')}
          {field('vehicle.registration_expires_at')}
        </>
      )}

      {cur.id === 'insurance' && (
        <>
          {photo('insurance_doc')}
          {field('vehicle.insurance_expires_at')}
        </>
      )}

      {cur.id === 'review' && (
        <Review form={form} previews={previews} phone={ticket && ticket.phone} onEdit={setStep} />
      )}
    </Page>
  );
}

/* ---------------------------------------------------------------- parts */

function Progress({ step }) {
  return (
    <View style={st.progress}>
      {STEPS.map((s, i) => (
        <View key={s.id} style={[st.progressSeg, i <= step && st.progressOn]} />
      ))}
    </View>
  );
}

/** A large tap-to-photograph slot for one document. */
function PhotoSlot({ label, uri, done, busy, disabled, error, onPress }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={st.label}>{label} *</Text>
      <Pressable
        onPress={disabled ? undefined : onPress}
        style={({ pressed }) => [
          st.slot,
          done && st.slotDone,
          !!error && { borderColor: C.red },
          pressed && { opacity: 0.85 },
        ]}>
        {uri ? (
          <Image source={{ uri }} style={st.slotImage} resizeMode="cover" />
        ) : (
          <View style={st.slotEmpty}>
            <Text style={st.slotIcon}>📷</Text>
            <Text style={st.slotHint}>{t('takePhoto')}</Text>
          </View>
        )}
        {busy && (
          <View style={st.slotOverlay}>
            <ActivityIndicator color="#fff" />
            <Text style={st.slotOverlayText}>{t('uploading')}</Text>
          </View>
        )}
        {done && !busy && (
          <View style={st.slotBadge}>
            <Text style={st.slotBadgeText}>✓ {t('uploaded')}</Text>
          </View>
        )}
        {done && !busy && (
          <View style={st.slotRetake}>
            <Text style={st.slotRetakeText}>{t('retake')}</Text>
          </View>
        )}
      </Pressable>
      {!!error && <Text style={st.slotError}>{error}</Text>}
    </View>
  );
}

function Review({ form, previews, phone, onEdit }) {
  const sections = [
    { step: 0, rows: [[t('phone'), phone]] },
    {
      step: 1,
      rows: [
        [t('fullName'), form.full_name],
        [t('email'), form.email || '—'],
      ],
      photos: ['profile_photo'],
    },
    {
      step: 2,
      rows: [
        [t('licenseNumber'), form.license_number],
        [t('licenseExpiry'), form.license_expiry],
      ],
      photos: ['license_photo', 'license_selfie'],
    },
    {
      step: 3,
      rows: [
        [t('idCardNumber'), form.id_card_number],
        [t('idCardExpiry'), form.id_card_expiry],
      ],
      photos: ['id_card_photo'],
    },
    {
      step: 4,
      rows: [
        [t('vehicleType'), form['vehicle.vehicle_type']],
        [t('plate'), form['vehicle.plate_number']],
        [
          t('vehicle'),
          `${form['vehicle.make']} ${form['vehicle.model']} · ${form['vehicle.color']} · ${form['vehicle.year']}`,
        ],
      ],
      photos: ['vehicle_photo'],
    },
    { step: 5, rows: [[t('registrationExpiry'), form['vehicle.registration_expires_at']]], photos: ['registration_doc'] },
    { step: 6, rows: [[t('insuranceExpiry'), form['vehicle.insurance_expires_at']]], photos: ['insurance_doc'] },
  ];
  return (
    <>
      {sections.map((sec) => (
        <Pressable key={sec.step} onPress={() => onEdit(sec.step)}>
          <Card>
            <View style={st.reviewHead}>
              <Text style={st.reviewTitle}>{t(`sg_${STEPS[sec.step].id}`)}</Text>
              <Text style={st.reviewEdit}>{t('edit')} ›</Text>
            </View>
            {sec.rows.map(([k, v]) => (
              <View key={k} style={st.reviewRow}>
                <Text style={st.reviewKey}>{k}</Text>
                <Text style={st.reviewValue} numberOfLines={2}>
                  {v}
                </Text>
              </View>
            ))}
            {!!sec.photos && (
              <View style={st.thumbs}>
                {sec.photos.map((p) =>
                  previews[p] ? <Image key={p} source={{ uri: previews[p] }} style={st.thumb} /> : null
                )}
              </View>
            )}
          </Card>
        </Pressable>
      ))}
    </>
  );
}

const st = theme({
  progress: { flexDirection: 'row', gap: 4, marginBottom: 14 },
  progressSeg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: C.line },
  progressOn: { backgroundColor: C.lime },
  stepNo: { color: C.accentText, fontSize: 13, lineHeight: 20, fontWeight: '700' },
  title: { fontSize: 26, lineHeight: 38, fontWeight: '700' },
  error: { color: C.red, fontSize: 14, lineHeight: 22, marginBottom: 12, fontWeight: '500' },
  label: { color: C.sub, fontSize: 13, lineHeight: 20, fontWeight: '600', marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  twoCol: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },

  slot: {
    height: 170,
    borderRadius: R.card,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: C.line,
    backgroundColor: C.card,
    overflow: 'hidden',
  },
  slotDone: { borderStyle: 'solid', borderColor: C.lime },
  slotImage: { width: '100%', height: '100%' },
  slotEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  slotIcon: { fontSize: 30, lineHeight: 40 },
  slotHint: { color: C.accentText, fontSize: 14, lineHeight: 22, fontWeight: '700', marginTop: 4 },
  slotOverlay: {
    ...{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    backgroundColor: 'rgba(23,36,10,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotOverlayText: { color: '#FFFFFF', fontSize: 13, lineHeight: 20, fontWeight: '600', marginTop: 6 },
  slotBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: C.lime,
    borderRadius: R.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  slotBadgeText: { color: C.ink, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  slotRetake: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: R.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  slotRetakeText: { color: C.text, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  slotError: { color: C.red, fontSize: 12.5, lineHeight: 19, marginTop: 4 },

  reviewHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  reviewTitle: { color: C.text, fontSize: 15, lineHeight: 23, fontWeight: '700' },
  reviewEdit: { color: C.accentText, fontSize: 13, lineHeight: 20, fontWeight: '700' },
  reviewRow: { flexDirection: 'row', gap: 10, paddingVertical: 3 },
  reviewKey: { color: C.sub, fontSize: 13, lineHeight: 20, width: 120 },
  reviewValue: { flex: 1, color: C.text, fontSize: 13.5, lineHeight: 20, fontWeight: '600' },
  thumbs: { flexDirection: 'row', gap: 8, marginTop: 8 },
  thumb: { width: 56, height: 56, borderRadius: R.xs, backgroundColor: C.card2 },

  doneMark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: C.limeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  doneMarkText: { color: C.accentText, fontSize: 30, lineHeight: 42, fontWeight: '700' },
});

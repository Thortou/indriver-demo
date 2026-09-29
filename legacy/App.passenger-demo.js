/* =============================================================================
   ໄປນຳກັນ (Pai Nam Kan) — inDriver-style ride bidding demo
   Vientiane, Lao PDR.  Single-file Expo app, mock data only.
   No backend, no API calls, no persistence.

   Visual language follows the "LaoRide Mockups" design file — tokens, radii
   and the two type faces all live in ./theme.js.

   SECTIONS
     1. BRAND + CONSTANTS
     2. MOCK DATA        — places, vehicles, people, seeded history
     3. UTILS            — haversine, fare, random
     4. UI PRIMITIVES    — Kip, Btn, Stars, Chip, RouteLine
     5. ONBOARDING       — splash, phone login, OTP
     6. SEARCH           — full-screen destination search (mockup 04)
     7. PASSENGER        — booking -> waiting -> trip -> pay & rate
     8. PROFILE          — profile + trip history (mockup 14)
     9. DRIVER           — requests, bidding, active job, earnings
    10. APP              — owns ALL shared state + every timer
    11. STYLES
   ========================================================================== */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Modal,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

import MapPicker, {
  LiveMap,
  fetchRoute,
  getCurrentPlace,
  laoManeuver,
} from './MapPicker';

import { C, R, FONTS, theme, grotesk, fmtNum, fmtKip, fmtKm } from './theme';

// Keep the native splash up until the two type faces are in memory, otherwise
// the first frame renders in the system font and visibly reflows.
SplashScreen.preventAutoHideAsync().catch(() => {});

/* =============================================================================
   1. BRAND + CONSTANTS
   ========================================================================== */

const BRAND = {
  name: 'ໄປນຳກັນ',
  latin: 'LaoRide',
  tagline: 'ທ່ານກຳນົດລາຄາເອງ',
  taglineEn: 'You set the price. Drivers make offers.',
};

/** Drivers only see requests whose pick-up is within this radius. */
const NEARBY_RADIUS_KM = 5;

/** Simulated drivers that bid on a request — drives the search progress bar. */
const EXPECTED_BIDS = 4;

/** How long a request stays on the driver's board before it lapses. */
const REQUEST_TTL_MS = 45000;

/** Below this share of the suggested fare, warn that nobody may accept. */
const LOW_FARE_RATIO = 0.75;

/** The mockups step the fare in 5,000 ₭ increments. */
const FARE_STEP = 5000;

/** The signed-in passenger (mockup 14). */
const ME_RIDER = {
  name: 'ນາງ ຄຳຫລ້າ ພົມມະ',
  phone: '+856 20 55 123 456',
  rating: 4.8,
  avatar: '👩',
};

/** The signed-in driver (mockup 07 / 10). */
const ME_DRIVER = {
  name: 'ທ້າວ ສົມສັກ ວົງໄຊ',
  rating: 4.9,
  vehicle: 'Honda Wave 110',
  plate: 'ກຂ 4821',
  trips: 1240,
  avatar: '🧔',
};

const PAY_METHODS = [
  { id: 'cash', icon: '💵', label: 'ເງິນສົດ', labelEn: 'Cash' },
  { id: 'qr', icon: '📱', label: 'OnePay QR', labelEn: 'OnePay' },
];

const payById = (id) => PAY_METHODS.find((p) => p.id === id) || PAY_METHODS[0];

/** Tip chips on the pay & rate screen (mockup 09). */
const TIPS = [0, 5000, 10000, 20000];

/** Compliment chips under the star rating (mockup 09). */
const RATE_TAGS = ['ຂັບດີ 👍', 'ສຸພາບ 😊', 'ລົດສະອາດ ✨'];

/* =============================================================================
   2. MOCK DATA
   ========================================================================== */

// 12 real places in Vientiane with real coordinates
const PLACES = [
  { id: 'p1',  icon: '🏬', name: 'ຕະຫຼາດເຊົ້າ',                 district: 'ເມືອງຈັນທະບູລີ',  alias: 'talat sao morning market', lat: 17.9668, lng: 102.6135 },
  { id: 'p2',  icon: '🏛️', name: 'ປະຕູໄຊ',                      district: 'ເມືອງຈັນທະບູລີ',  alias: 'patuxai victory gate',     lat: 17.9757, lng: 102.6167 },
  { id: 'p3',  icon: '🛕', name: 'ພະທາດຫຼວງ',                   district: 'ເມືອງໄຊເສດຖາ',   alias: 'pha that luang stupa',     lat: 17.9757, lng: 102.6335 },
  { id: 'p4',  icon: '✈️', name: 'ສະໜາມບິນສາກົນວັດໄຕ',          district: 'ເມືອງສີໂຄດຕະບອງ', alias: 'wattay airport',           lat: 17.9884, lng: 102.5633 },
  { id: 'p5',  icon: '🎓', name: 'ມະຫາວິທະຍາໄລແຫ່ງຊາດ ດົງໂດກ',  district: 'ເມືອງໄຊທານີ',    alias: 'nuol dongdok university',  lat: 18.0575, lng: 102.5442 },
  { id: 'p6',  icon: '🏥', name: 'ໂຮງໝໍມະໂຫສົດ',                district: 'ເມືອງສີສັດຕະນາກ', alias: 'mahosot hospital',         lat: 17.9583, lng: 102.6083 },
  { id: 'p7',  icon: '🏬', name: 'ຕະຫຼາດຂົວດິນ',                 district: 'ເມືອງຈັນທະບູລີ',  alias: 'khua din market',          lat: 17.9679, lng: 102.6161 },
  { id: 'p8',  icon: '🛕', name: 'ວັດສີເມືອງ',                   district: 'ເມືອງສີສັດຕະນາກ', alias: 'wat si muang temple',      lat: 17.9600, lng: 102.6183 },
  { id: 'p9',  icon: '🌳', name: 'ສວນສາທາລະນະເຈົ້າອະນຸວົງ',      district: 'ເມືອງຈັນທະບູລີ',  alias: 'chao anouvong park',       lat: 17.9611, lng: 102.6053 },
  { id: 'p10', icon: '🛍️', name: 'ສູນການຄ້າ ໄອເຕັກ (ITECC)',     district: 'ເມືອງໄຊເສດຖາ',   alias: 'itecc mall',               lat: 17.9853, lng: 102.6469 },
  { id: 'p11', icon: '🚆', name: 'ສະຖານີລົດໄຟວຽງຈັນ',            district: 'ເມືອງໄຊທານີ',    alias: 'vientiane railway station',lat: 18.0930, lng: 102.5560 },
  { id: 'p12', icon: '🏬', name: 'ຕະຫຼາດທົ່ງຂັນຄຳ',              district: 'ເມືອງຈັນທະບູລີ',  alias: 'thong khan kham market',   lat: 17.9760, lng: 102.6060 },
];

// base fare + per-km rate in kip. Moto first — the mockups default to it.
const VEHICLES = [
  { id: 'moto',  label: 'ລົດຈັກ',    labelEn: 'Moto',     icon: '🏍️', base: 5000, perKm: 2000, min: 8000  },
  { id: 'car',   label: 'ລົດໃຫຍ່',   labelEn: 'Car',      icon: '🚗', base: 8000, perKm: 3500, min: 15000 },
  { id: 'deliv', label: 'ສົ່ງເຄື່ອງ', labelEn: 'Delivery', icon: '📦', base: 6000, perKm: 2500, min: 10000 },
];

const DRIVER_NAMES = [
  'ທ້າວ ສົມສັກ ພົມມະຈັນ',
  'ທ້າວ ບຸນມີ ແກ້ວມະນີ',
  'ນາງ ຄຳຫຼ້າ ວົງໄຊ',
  'ທ້າວ ວິໄລ ສີສຸກ',
  'ທ້າວ ອຳພອນ ສຸລິຍະວົງ',
  'ນາງ ດາລາ ຈັນທະວົງ',
  'ທ້າວ ໄຊຍະ ສີຫາລາດ',
];

const PASSENGER_NAMES = [
  'ນາງ ນາລີ ສີສຸວັນ',
  'ທ້າວ ພູວົງ ອິນທະວົງ',
  'ນາງ ມະລິວັນ ພັນທະວົງ',
  'ທ້າວ ເກີດສະໜາ ລາຊະບຸນ',
  'ນາງ ສຸກສະຫວັນ ໄຊຍະວົງ',
];

const NOTES = [
  'ມີກະເປົ໋າ 1 ໜ່ວຍ',
  'ຟ້າວໜ້ອຍໜຶ່ງ ຂອບໃຈ',
  'ລໍຖ້າຢູ່ປະຕູໜ້າ',
  'ໄປກັບເດັກນ້ອຍ 1 ຄົນ',
  '',
];

/** Vehicle models and colours shown on the waiting / trip screen. */
const MODELS = {
  moto:  ['Honda Wave 110', 'Yamaha Finn', 'Honda Click', 'Suzuki Smash'],
  car:   ['Toyota Vios', 'Honda City', 'Toyota Yaris', 'Suzuki Ertiga'],
  deliv: ['Honda Wave 110', 'Suzuki Carry', 'Toyota Hilux'],
};

const COLORS = [
  { lo: 'ສີຂຽວ', en: 'Green' },
  { lo: 'ສີດຳ', en: 'Black' },
  { lo: 'ສີຂາວ', en: 'White' },
  { lo: 'ສີແດງ', en: 'Red' },
  { lo: 'ສີເງິນ', en: 'Silver' },
];

const PLATE_PREFIX = ['ກຂ', 'ຄງ', 'ຈສ', 'ຍດ', 'ຖທ'];

/** Saved shortcuts on the home sheet + search screen. */
const SAVED = [
  { id: 'home', icon: '🏠', label: 'ບ້ານ', labelEn: 'Home', placeId: 'p12' },
  { id: 'work', icon: '💼', label: 'ຫ້ອງການ', labelEn: 'Work', placeId: 'p10' },
];

/** How far ahead a scheduled ride can be booked. */
const SCHEDULE_OPTIONS = [
  { id: 30, label: '+30 ນາທີ' },
  { id: 60, label: '+1 ຊົ່ວໂມງ' },
  { id: 120, label: '+2 ຊົ່ວໂມງ' },
];

/** Seeded rider history so mockup 14 is never an empty screen. */
const SEED_RIDES = [
  { id: 'h1', icon: '🏍️', route: 'ຕະຫຼາດເຊົ້າ → ວັດໄຕ',   when: 'ມື້ນີ້ 14:20',    price: 45000 },
  { id: 'h2', icon: '🚗', route: 'ບ້ານ → ຫ້ອງການ',          when: 'ວານນີ້ 08:10',   price: 60000 },
  { id: 'h3', icon: '📦', route: 'ສົ່ງເຄື່ອງ · ລ້ານຊ້າງ',    when: '10 ສຫ 16:45',    price: 25000 },
];

/** Seeded driver earnings so the chart and list have shape on first launch. */
const SEED_EARNINGS = [
  { id: 'e1', route: 'ຕະຫຼາດເຊົ້າ → ວັດໄຕ',      when: '14:20', pay: 'cash', price: 45000 },
  { id: 'e2', route: 'ໂພນຕ້ອງ → ຕະຫຼາດເຊົ້າ',    when: '13:05', pay: 'qr',   price: 30000 },
  { id: 'e3', route: 'ສົ່ງເຄື່ອງ · ລ້ານຊ້າງ',     when: '11:40', pay: 'cash', price: 25000 },
];

/** Mon..Sun totals behind the earnings bar chart. Index 4 is "today". */
const WEEK = [
  { day: 'ຈ',  amount: 285000 },
  { day: 'ຄ',  amount: 392000 },
  { day: 'ພ',  amount: 249000 },
  { day: 'ພຫ', amount: 498000 },
  { day: 'ສ',  amount: 605000 },
  { day: 'ສ',  amount: 427000 },
  { day: 'ອາ', amount: 342000 },
];
const TODAY_INDEX = 4;

/* =============================================================================
   3. UTILS
   ========================================================================== */

const rnd = (min, max) => min + Math.random() * (max - min);
const rndInt = (min, max) => Math.floor(rnd(min, max + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const roundTo = (n, step) => Math.round(n / step) * step;

let _seq = 0;
const uid = (p) => `${p}_${++_seq}`;

const makePlate = () => `${pick(PLATE_PREFIX)} ${rndInt(1000, 9999)}`;

// Great-circle distance in km
function haversine(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const Rk = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * Rk * Math.asin(Math.sqrt(s));
}

// straight-line -> road distance
const roadDistance = (a, b) => haversine(a, b) * 1.35;

// suggested fare = base + perKm * km, floored at min, rounded to nearest 1000
function suggestFare(km, vehicle) {
  const raw = vehicle.base + vehicle.perKm * km;
  return roundTo(Math.max(raw, vehicle.min), 1000);
}

const vehicleById = (id) => VEHICLES.find((v) => v.id === id) || VEHICLES[0];

const clock = (d = new Date()) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/* =============================================================================
   4. UI PRIMITIVES
   ========================================================================== */

/**
 * Money, set the way the mockups do it: the digits in Space Grotesk, the ₭ in
 * the Lao face. Space Grotesk has no ₭ glyph, so the two must not share a Text.
 */
function Kip({ value, style, unitStyle }) {
  return (
    <Text style={style} numberOfLines={1}>
      <Text style={grotesk(700)}>{fmtNum(value)}</Text>
      <Text style={unitStyle}> ₭</Text>
    </Text>
  );
}

function Btn({ title, onPress, variant = 'primary', disabled, small, style }) {
  const v = {
    primary: { bg: C.lime, fg: C.ink, border: C.lime },
    outline: { bg: C.card2, fg: C.accentText, border: C.lime },
    ghost: { bg: C.card2, fg: C.sub, border: C.line },
    danger: { bg: 'transparent', fg: C.red, border: C.line },
  }[variant];

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        s.btn,
        small && s.btnSmall,
        { backgroundColor: v.bg, borderColor: v.border },
        disabled && { opacity: 0.4 },
        pressed && !disabled && { opacity: 0.75 },
        style,
      ]}>
      <Text style={[s.btnText, small && s.btnTextSmall, { color: v.fg }]}>{title}</Text>
    </Pressable>
  );
}

function Stars({ value, size = 13, onChange }) {
  if (!onChange) {
    return (
      <Text style={{ color: C.accentText, fontSize: size, lineHeight: size * 1.5 }}>
        {'★'.repeat(Math.round(value))}
        <Text style={{ color: C.line }}>{'★'.repeat(5 - Math.round(value))}</Text>
      </Text>
    );
  }
  return (
    <View style={{ flexDirection: 'row' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} onPress={() => onChange(i)} hitSlop={6} style={{ paddingHorizontal: 4 }}>
          <Text style={{ fontSize: size, lineHeight: size * 1.35, color: i <= value ? C.text : C.line }}>
            ★
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Pill chip — used for tips, compliments and quick destinations. */
function Chip({ label, active, onPress, style }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.chip, active && s.chipOn, pressed && { opacity: 0.75 }, style]}>
      <Text style={[s.chipText, active && s.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

/** Two payment tiles, exactly as drawn on mockups 05 and 09. */
function PayPicker({ value, onChange, compact }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {PAY_METHODS.map((p) => {
        const on = p.id === value;
        return (
          <Pressable
            key={p.id}
            onPress={() => onChange(p.id)}
            style={[s.payTile, compact && s.payTileSm, on && s.payTileOn]}>
            <Text style={{ fontSize: compact ? 12 : 14 }}>{p.icon}</Text>
            <Text style={[s.payText, compact && s.payTextSm, on && s.payTextOn]}>{p.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Green origin dot -> connector -> lime destination square. */
function RouteLine({ from, to, right }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ width: 12, alignItems: 'center', paddingTop: 7 }}>
        <View style={s.dotFrom} />
        <View style={s.connector} />
        <View style={s.dotTo} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={s.routeName} numberOfLines={1}>{from.name}</Text>
        <Text style={s.routeSub} numberOfLines={1}>{from.district}</Text>
        <View style={{ height: 12 }} />
        <Text style={s.routeName} numberOfLines={1}>{to.name}</Text>
        <Text style={s.routeSub} numberOfLines={1}>{to.district}</Text>
      </View>
      {right}
    </View>
  );
}

/** Settings / history row with a leading glyph and an optional trailing value. */
function ListRow({ icon, label, value, last, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.listRow, last && { borderBottomWidth: 0 }, pressed && { backgroundColor: C.limeWash }]}>
      <Text style={{ fontSize: 15, width: 24 }}>{icon}</Text>
      <Text style={s.listLabel}>{label}</Text>
      {!!value && <Text style={s.listValue}>{value}</Text>}
      <Text style={s.chev}>›</Text>
    </Pressable>
  );
}

/* =============================================================================
   5. ONBOARDING — splash (01), phone login (02), OTP
   ========================================================================== */

function SplashScreenView({ onStart }) {
  return (
    <LinearGradient colors={[C.lime, C.limeDeep]} style={s.splash}>
      <View>
        <View style={s.splashMark}>
          <Text style={s.splashMarkText}>₭</Text>
        </View>
        <Text style={s.splashName}>{BRAND.name}</Text>
        <Text style={s.splashLatin}>{BRAND.latin}</Text>
        <Text style={s.splashTag}>{BRAND.tagline}</Text>
        <Text style={s.splashTagEn}>{BRAND.taglineEn}</Text>
      </View>

      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View style={[s.pageDot, s.pageDotOn]} />
          <View style={s.pageDot} />
          <View style={s.pageDot} />
        </View>
        <Pressable onPress={onStart} style={({ pressed }) => [s.splashCta, pressed && { opacity: 0.85 }]}>
          <Text style={s.splashCtaText}>ເລີ່ມຕົ້ນໃຊ້ງານ · Get started</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

function LoginScreen({ onSend }) {
  const [phone, setPhone] = useState('');
  const digits = phone.replace(/\D/g, '');
  const ready = digits.length >= 8;

  // 20 55 123 456
  const pretty = digits
    .replace(/^(\d{2})(\d{0,2})(\d{0,3})(\d{0,3}).*$/, (_, a, b, c, d) =>
      [a, b, c, d].filter(Boolean).join(' ')
    );

  return (
    <View style={s.authScreen}>
      <Text style={s.authTitle}>ເບີໂທຂອງທ່ານ</Text>
      <Text style={s.authSub}>Enter your phone number — we'll send a code.</Text>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 32 }}>
        <View style={s.dialCode}>
          <Text style={{ fontSize: 15 }}>🇱🇦</Text>
          <Text style={s.dialCodeText}>+856</Text>
        </View>
        <TextInput
          value={pretty}
          onChangeText={setPhone}
          placeholder="20 5x xxx xxx"
          placeholderTextColor={C.faint}
          keyboardType="phone-pad"
          maxLength={13}
          style={[s.authInput, grotesk(600)]}
        />
      </View>

      <Btn
        title="ຮັບລະຫັດ OTP · Send code"
        disabled={!ready}
        onPress={() => onSend(`+856 ${pretty}`)}
        style={{ marginTop: 28 }}
      />

      <Text style={s.authTerms}>
        ການສືບຕໍ່ແມ່ນຍອມຮັບ ເງື່ອນໄຂການໃຊ້ງານ ແລະ ນະໂຍບາຍຄວາມເປັນສ່ວນຕົວ
      </Text>
    </View>
  );
}

function OtpScreen({ phone, onBack, onVerify }) {
  const [code, setCode] = useState('');
  const boxes = [0, 1, 2, 3, 4, 5];

  // Demo only: any six digits are accepted.
  useEffect(() => {
    if (code.length === 6) {
      const id = setTimeout(onVerify, 350);
      return () => clearTimeout(id);
    }
  }, [code]);

  return (
    <View style={s.authScreen}>
      <Pressable onPress={onBack} style={s.backCircle}>
        <Text style={s.backCircleText}>←</Text>
      </Pressable>

      <Text style={[s.authTitle, { marginTop: 20 }]}>ໃສ່ລະຫັດ 6 ໂຕ</Text>
      <Text style={s.authSub}>ສົ່ງລະຫັດໄປທີ່ {phone} ແລ້ວ</Text>

      {/* The real input is transparent and stretched over the boxes, so a tap
          anywhere on the row focuses it and re-opens the keypad. */}
      <View style={s.otpRow}>
        {boxes.map((i) => (
          <View key={i} style={[s.otpBox, i === code.length && s.otpBoxOn]}>
            <Text style={[s.otpDigit, grotesk(700)]}>{code[i] || ''}</Text>
          </View>
        ))}
        <TextInput
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          autoFocus
          maxLength={6}
          style={s.otpInput}
          caretHidden
        />
      </View>

      <Text style={s.authHint}>ໂໝດສາທິດ — ໃສ່ເລກໃດກໍ່ໄດ້ 6 ໂຕ</Text>
      <Text style={s.authTerms}>ບໍ່ໄດ້ຮັບລະຫັດ? ສົ່ງໃໝ່ອີກຄັ້ງ</Text>
    </View>
  );
}

/* =============================================================================
   6. SEARCH — full-screen destination search (mockup 04)
   ========================================================================== */

/** Splits `name` around the matched query so it can be highlighted. */
function Highlight({ name, needle, style }) {
  const i = needle ? name.toLowerCase().indexOf(needle.toLowerCase()) : -1;
  if (i < 0) return <Text style={style} numberOfLines={1}>{name}</Text>;
  return (
    <Text style={style} numberOfLines={1}>
      {name.slice(0, i)}
      <Text style={s.mark}>{name.slice(i, i + needle.length)}</Text>
      {name.slice(i + needle.length)}
    </Text>
  );
}

function SearchScreen({ visible, from, to, onPickFrom, onPickTo, onOpenMap, onClose }) {
  const [field, setField] = useState('to'); // which row is being edited
  const [q, setQ] = useState('');

  useEffect(() => {
    if (visible) {
      setField('to');
      setQ('');
    }
  }, [visible]);

  const origin = field === 'to' ? from : to;
  const exclude = field === 'to' ? from : to;

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return PLACES.filter((p) => {
      if (exclude && p.id === exclude.id) return false;
      if (!needle) return true;
      return (
        p.name.toLowerCase().includes(needle) ||
        p.district.toLowerCase().includes(needle) ||
        p.alias.includes(needle)
      );
    }).map((p) => ({ ...p, away: origin ? roadDistance(origin, p) : null }));
  }, [q, exclude && exclude.id, origin && origin.id]);

  const commit = (p) => {
    if (field === 'to') onPickTo(p);
    else onPickFrom(p);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={s.searchScreen} edges={['top', 'bottom']}>
        <View style={s.searchHead}>
          <Pressable onPress={onClose} style={s.backCircle}>
            <Text style={s.backCircleText}>←</Text>
          </Pressable>
          <Text style={s.searchHeadTitle}>ໄປໃສ?</Text>
        </View>

        {/* from / to card — tap a row to choose which one you are editing */}
        <View style={s.fromToCard}>
          <Pressable
            onPress={() => {
              setField('from');
              setQ('');
            }}
            style={s.fromToRow}>
            <View style={s.dotFrom} />
            {field === 'from' ? (
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="ຈຸດຮັບ"
                placeholderTextColor={C.faint}
                autoFocus
                style={s.fromToInput}
              />
            ) : (
              <Text style={s.fromToText} numberOfLines={1}>
                {from ? `${from.name} (ຈຸດຢືນຂອງທ່ານ)` : 'ຈຸດຮັບ'}
              </Text>
            )}
          </Pressable>

          <View style={s.fromToHair} />

          <Pressable
            onPress={() => {
              setField('to');
              setQ('');
            }}
            style={s.fromToRow}>
            <View style={s.dotTo} />
            {field === 'to' ? (
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="ໄປໃສ?"
                placeholderTextColor={C.faint}
                autoFocus
                style={s.fromToInput}
              />
            ) : (
              <Text style={s.fromToText} numberOfLines={1}>{to ? to.name : 'ໄປໃສ?'}</Text>
            )}
          </Pressable>
        </View>

        {/* quick chips */}
        <View style={s.quickRow}>
          {SAVED.map((sv) => {
            const p = PLACES.find((x) => x.id === sv.placeId);
            if (!p) return null;
            return <Chip key={sv.id} label={`${sv.icon} ${sv.label}`} onPress={() => commit(p)} />;
          })}
          <Chip label="📍 ແຜນທີ່" onPress={() => onOpenMap(field)} />
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" style={{ marginTop: 14 }}>
          <View style={s.resultCard}>
            {list.length === 0 && <Text style={s.emptyText}>ບໍ່ພົບສະຖານທີ່ທີ່ຄົ້ນຫາ</Text>}

            {list.map((p, i) => (
              <Pressable
                key={p.id}
                onPress={() => commit(p)}
                style={({ pressed }) => [
                  s.resultRow,
                  i === list.length - 1 && { borderBottomWidth: 0 },
                  (pressed || (i === 0 && !!q)) && { backgroundColor: C.limeWash },
                ]}>
                <View style={[s.resultIcon, i === 0 && !!q && { backgroundColor: C.limeSoft }]}>
                  <Text style={{ fontSize: 15 }}>{p.icon}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Highlight name={p.name} needle={q.trim()} style={s.resultName} />
                  <Text style={s.resultSub} numberOfLines={1}>
                    {p.district}
                    {p.away != null ? ` · ${fmtKm(p.away)}` : ''}
                  </Text>
                </View>
                <Text style={s.chev}>›</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/* =============================================================================
   7. PASSENGER
   ========================================================================== */

function PassengerScreen({
  stage,
  ride,
  bids,
  accepted,
  tripStep,
  rating,
  tip,
  tags,
  pay,
  myPlace,
  locStatus,
  recents,
  mapLayer,
  onMapLayer,
  onRefreshLocation,
  onPay,
  onSubmit,
  onAcceptBid,
  onDeclineBid,
  onCancelRequest,
  onCancelTrip,
  onRate,
  onTip,
  onToggleTag,
  onReset,
  onOpenProfile,
}) {
  /* ---------------------------------------------------- booking form state */
  const [from, setFrom] = useState(PLACES[0]);
  const [to, setTo] = useState(PLACES[3]);
  const [vehicleId, setVehicleId] = useState('moto');
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [price, setPrice] = useState(null);      // null = follow the suggestion
  const [search, setSearch] = useState(false);   // full-screen search (mockup 04)
  const [mapPicker, setMapPicker] = useState(null); // 'from' | 'to' | null

  // real road distance from OSRM; null until it resolves, or if it fails
  const [route, setRoute] = useState(null);

  // once the rider picks a pick-up themselves, stop overriding it
  const [fromTouched, setFromTouched] = useState(false);

  // 'home' is the mockup layout; choosing a destination opens the fare step
  const [bookingStep, setBookingStep] = useState('home');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduled, setScheduled] = useState(null); // minutes ahead, or null

  // returning from a finished trip should land on the home sheet, not the fare step
  useEffect(() => {
    if (stage !== 'booking') setBookingStep('home');
  }, [stage]);

  // Where the assigned driver is coming from. There is no real driver device in
  // the demo, so it is a stable offset from the pick-up, seeded per ride.
  const driverOrigin = useMemo(() => {
    if (!ride) return null;
    const a = (parseInt(ride.id.replace(/\D/g, ''), 10) || 1) * 2.399;
    return {
      id: `drv_${ride.id}`,
      name: 'ຄົນຂັບ',
      district: '',
      alias: '',
      lat: ride.from.lat + Math.sin(a) * 0.009,
      lng: ride.from.lng + Math.cos(a) * 0.009,
    };
  }, [ride]);

  // real road route from the driver to the rider, for the waiting screen
  const [approach, setApproach] = useState(null);
  useEffect(() => {
    if (stage !== 'trip' || !driverOrigin || !ride) {
      setApproach(null);
      return;
    }
    const ctl = new AbortController();
    fetchRoute(driverOrigin, ride.from, ctl.signal).then((r) => {
      if (!ctl.signal.aborted) setApproach(r);
    });
    return () => ctl.abort();
  }, [stage, ride && ride.id]);

  const pickTo = (p) => {
    setTo(p);
    setPrice(null);
    setSearch(false);
    setBookingStep('fare');
  };

  const pickFrom = (p) => {
    setFrom(p);
    setFromTouched(true);
    setPrice(null);
  };

  // GPS wins; if it is refused or slow, the most recent address used stands in
  useEffect(() => {
    if (fromTouched) return;
    const def = myPlace || recents[0];
    if (def) {
      setFrom(def);
      setPrice(null);
    }
  }, [myPlace, recents.length, fromTouched]);

  const vehicle = vehicleById(vehicleId);
  const estKm = from && to ? roadDistance(from, to) : 0;   // haversine * 1.35 fallback
  const km = route ? route.km : estKm;                     // OSRM km is already road distance
  const suggested = from && to ? suggestFare(km, vehicle) : 0;
  const offer = price == null ? suggested : price;

  // Re-route whenever either endpoint changes, however it was chosen — so the
  // preset list gets a real road distance too, not just map picks.
  useEffect(() => {
    if (!from || !to || from.id === to.id) {
      setRoute(null);
      return;
    }
    const ctl = new AbortController();
    fetchRoute(from, to, ctl.signal).then((r) => {
      if (!ctl.signal.aborted) setRoute(r);
    });
    return () => ctl.abort();
  }, [from.lat, from.lng, to.lat, to.lng]);

  const bump = (delta) => setPrice(Math.max(1000, roundTo(offer + delta, 1000)));

  // warn once the offer drops well below the going rate for this route
  const tooLow = suggested > 0 && offer < suggested * LOW_FARE_RATIO;
  const percentBelow = suggested > 0 ? Math.round((1 - offer / suggested) * 100) : 0;

  const canSubmit = from && to && from.id !== to.id && offer >= 1000;

  /* ------------------------------------------------------------- 1. BOOKING */
  if (stage === 'booking') {
    const pickers = (
      <>
        <MapPicker
          visible={mapPicker !== null}
          mode={mapPicker || 'from'}
          from={from}
          to={to}
          layer={mapLayer}
          onLayerChange={onMapLayer}
          onCancel={() => setMapPicker(null)}
          onUsePresetList={() => {
            setMapPicker(null);
            setSearch(true);
          }}
          onConfirm={({ from: f, to: t, route: r }) => {
            setFrom(f);
            setTo(t);
            setFromTouched(true);
            setRoute(r);
            setPrice(null);
            setMapPicker(null);
            setBookingStep('fare');
          }}
        />

        <SearchScreen
          visible={search}
          from={from}
          to={to}
          onPickFrom={(p) => {
            pickFrom(p);
            setSearch(false);
          }}
          onPickTo={pickTo}
          onOpenMap={(which) => {
            setSearch(false);
            setMapPicker(which);
          }}
          onClose={() => setSearch(false)}
        />
      </>
    );

    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {/* --- full-bleed map: pick-up only on home, full route on the fare step --- */}
        <LiveMap
          from={from}
          to={to}
          coords={route ? route.coords : null}
          cars
          vehicle={vehicleId}
          soloOrigin={bookingStep === 'home'}
          myLocation={myPlace}
          onLocate={async () => {
            const p = myPlace || (await onRefreshLocation());
            if (p) pickFrom(p);
          }}
          locating={locStatus === 'pending'}
          layer={mapLayer}
          onToggleLayer={onMapLayer}
          style={{ flex: 1 }}
        />

        {/* --- pick-up callout, anchored over the marker at map centre --- */}
        {bookingStep === 'home' && (
          <View style={s.calloutWrap} pointerEvents="box-none">
            <Pressable onPress={() => setMapPicker('from')} style={s.callout}>
              <View style={{ flex: 1 }}>
                <Text style={s.calloutLabel}>ຈຸດເລີ່ມຕົ້ນ</Text>
                <Text style={s.calloutName} numberOfLines={1}>
                  {from.name}
                  {from.district ? `, ${from.district}` : ''}
                </Text>
              </View>
              <Text style={s.calloutChev}>›</Text>
            </Pressable>
            <View style={s.calloutTail} />
          </View>
        )}

        {/* --- floating top bar --- */}
        <View style={s.topBar} pointerEvents="box-none">
          <Pressable style={s.iconBtn} onPress={onOpenProfile}>
            <Text style={s.iconBtnText}>☰</Text>
          </Pressable>

          <Pressable style={s.searchPill} onPress={() => setMapPicker('from')}>
            <Text style={s.searchPin}>📍</Text>
            <Text style={s.searchPillText} numberOfLines={1}>
              {from.name}
              {from.district ? `, ${from.district}` : ''}
            </Text>
          </Pressable>
        </View>

        {/* --- bottom sheet --- */}
        <View style={s.sheet}>
          <View style={s.handle} />

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 12 }}>
            {bookingStep === 'home' ? (
              <>
                {/* service tiles */}
                <View style={s.tileRow}>
                  {VEHICLES.map((v) => {
                    const on = v.id === vehicleId && !scheduleOpen;
                    return (
                      <Pressable
                        key={v.id}
                        onPress={() => {
                          setVehicleId(v.id);
                          setPrice(null);
                          setScheduleOpen(false);
                        }}
                        style={[s.tile, on && s.tileOn]}>
                        <Text style={s.tileIcon}>{v.icon}</Text>
                        <Text style={[s.tileLabel, on && { color: C.ink }]}>{v.label}</Text>
                        <Text style={[s.tileSub, on && { color: 'rgba(23,36,10,0.7)' }]}>
                          {v.labelEn}
                        </Text>
                      </Pressable>
                    );
                  })}

                  <Pressable
                    onPress={() => setScheduleOpen((o) => !o)}
                    style={[s.tile, scheduleOpen && s.tileOn]}>
                    <Text style={s.tileIcon}>🗓️</Text>
                    <Text style={[s.tileLabel, scheduleOpen && { color: C.ink }]}>ຈອງລ່ວງໜ້າ</Text>
                    <Text style={[s.tileSub, scheduleOpen && { color: 'rgba(23,36,10,0.7)' }]}>
                      Schedule
                    </Text>
                  </Pressable>
                </View>

                {scheduleOpen && (
                  <View style={s.schedRow}>
                    {SCHEDULE_OPTIONS.map((o) => (
                      <Chip
                        key={o.id}
                        label={o.label}
                        active={scheduled === o.id}
                        onPress={() => setScheduled(scheduled === o.id ? null : o.id)}
                        style={{ flex: 1 }}
                      />
                    ))}
                  </View>
                )}

                {/* where to */}
                <Pressable style={s.whereTo} onPress={() => setSearch(true)}>
                  <Text style={s.whereToIcon}>🔍</Text>
                  <Text style={s.whereToText}>ໄປໃສ? · Where to?</Text>
                </Pressable>

                {/* saved shortcuts */}
                {SAVED.map((sv) => {
                  const p = PLACES.find((x) => x.id === sv.placeId);
                  if (!p) return null;
                  return (
                    <Pressable key={sv.id} style={s.savedRow} onPress={() => pickTo(p)}>
                      <View style={s.savedIcon}>
                        <Text style={{ fontSize: 15 }}>{sv.icon}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={s.savedName}>{sv.label}</Text>
                        <Text style={s.savedSub} numberOfLines={1}>
                          {p.name}, {p.district}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}

                {/* recent destinations */}
                {recents.slice(0, 3).map((p) => (
                  <Pressable key={p.id} style={s.savedRow} onPress={() => pickTo(p)}>
                    <View style={s.savedIcon}>
                      <Text style={{ fontSize: 14 }}>🕘</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={s.savedName} numberOfLines={1}>{p.name}</Text>
                      <Text style={s.savedSub} numberOfLines={1}>
                        {p.district || 'ບ່ອນທີ່ໃຊ້ຫຼ້າສຸດ'}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </>
            ) : (
              <>
                {/* ---------------- fare step (mockup 05) ---------------- */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Pressable onPress={() => setBookingStep('home')} style={s.backCircle}>
                    <Text style={s.backCircleText}>←</Text>
                  </Pressable>
                  <Text style={s.sheetTitle}>
                    {vehicle.label} · {vehicle.labelEn}
                  </Text>
                </View>

                <Pressable onPress={() => setSearch(true)} style={s.routeCard}>
                  <RouteLine
                    from={from}
                    to={to}
                    right={
                      <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                        <Text style={[s.routeKm, grotesk(700)]}>{km.toFixed(1)}</Text>
                        <Text style={s.routeKmUnit}>{route ? 'km ຕາມທາງ' : 'km ປະມານ'}</Text>
                      </View>
                    }
                  />
                </Pressable>

                {/* fare stepper */}
                <View style={s.fareCard}>
                  <Text style={s.fareLabel}>ສະເໜີລາຄາຂອງທ່ານ · Your fare</Text>

                  <View style={s.fareRow}>
                    <Pressable
                      onPress={() => bump(-FARE_STEP)}
                      hitSlop={6}
                      style={({ pressed }) => [s.stepBtn, pressed && { opacity: 0.6 }]}>
                      <Text style={s.stepBtnText}>−</Text>
                    </Pressable>

                    <View style={s.fareValueWrap}>
                      <TextInput
                        value={fmtNum(offer)}
                        onChangeText={(t) => {
                          const d = t.replace(/[^0-9]/g, '');
                          setPrice(d === '' ? 0 : parseInt(d, 10));
                        }}
                        keyboardType="number-pad"
                        selectTextOnFocus
                        style={[s.fareValue, grotesk(700)]}
                      />
                      <Text style={s.fareUnit}>₭</Text>
                    </View>

                    <Pressable
                      onPress={() => bump(FARE_STEP)}
                      hitSlop={6}
                      style={({ pressed }) => [s.stepBtn, pressed && { opacity: 0.6 }]}>
                      <Text style={s.stepBtnText}>+</Text>
                    </Pressable>
                  </View>

                  {tooLow ? (
                    <Text style={s.fareWarn}>
                      ຕ່ຳກວ່າປົກກະຕິ {percentBelow}% — ອາດບໍ່ມີຄົນຂັບຮັບ
                    </Text>
                  ) : (
                    <Text style={s.fareHint}>
                      ລາຄາແນະນຳ {fmtKip(suggested)} · Recommended
                    </Text>
                  )}
                </View>

                <View style={{ marginTop: 12 }}>
                  <PayPicker value={pay} onChange={onPay} />
                </View>

                {/* note to driver */}
                {noteOpen ? (
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="ຂໍ້ຄວາມຫາຄົນຂັບ · Note to driver"
                    placeholderTextColor={C.faint}
                    style={s.noteInput}
                    autoFocus
                    multiline
                  />
                ) : (
                  <Pressable onPress={() => setNoteOpen(true)} style={s.noteRow}>
                    <Text style={s.noteRowText} numberOfLines={1}>
                      💬 {note || 'ຂໍ້ຄວາມຫາຄົນຂັບ (ທາງເລືອກ) · Note to driver'}
                    </Text>
                  </Pressable>
                )}

                {scheduled != null && (
                  <Text style={s.schedNote}>
                    ຈອງລ່ວງໜ້າ {SCHEDULE_OPTIONS.find((o) => o.id === scheduled)?.label}
                  </Text>
                )}

                <Btn
                  title={scheduled != null ? 'ຈອງລ່ວງໜ້າ · Schedule' : 'ສະເໜີລາຄາ · Offer your fare'}
                  disabled={!canSubmit}
                  onPress={() =>
                    onSubmit({
                      from,
                      to,
                      vehicleId,
                      price: offer,
                      note: note.trim(),
                      km,
                      route,
                      scheduled,
                    })
                  }
                  style={{ marginTop: 14 }}
                />
                {!canSubmit && (
                  <Text style={s.warn}>
                    {from.id === to.id
                      ? 'ຈຸດຮັບ ແລະ ຈຸດສົ່ງຕ້ອງບໍ່ຊ້ຳກັນ'
                      : 'ລາຄາຕ້ອງບໍ່ຕ່ຳກວ່າ 1,000 ₭'}
                  </Text>
                )}
              </>
            )}
          </ScrollView>
        </View>

        {pickers}
      </View>
    );
  }

  /* ------------------------------------------- 2. WAITING (mockup 06) */
  if (stage === 'waiting') {
    const sorted = [...bids].sort((a, b) => a.price - b.price);
    const searchPct = Math.min(100, (bids.length / EXPECTED_BIDS) * 100);

    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <LiveMap
          from={ride.from}
          to={ride.to}
          coords={ride.route ? ride.route.coords : null}
          cars
          radar
          vehicle={ride.vehicleId}
          lineColor={C.blue}
          layer={mapLayer}
          onToggleLayer={onMapLayer}
          style={{ flex: 1 }}
        />

        <Pressable onPress={onCancelRequest} style={s.closeCircle}>
          <Text style={s.closeCircleText}>✕</Text>
        </Pressable>

        <View style={s.searchCard} pointerEvents="none">
          <ActivityIndicator size="small" color={C.accentText} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={s.searchTitle} numberOfLines={1}>
              {sorted.length === 0 ? 'ກຳລັງຊອກຄົນຂັບ…' : `ມີ ${sorted.length} ຂໍ້ສະເໜີແລ້ວ`}
            </Text>
            <Text style={s.searchSub} numberOfLines={1}>
              Your offer {fmtKip(ride.price)}
            </Text>
          </View>
        </View>

        <View style={s.sheet}>
          <View style={s.handle} />

          <View style={s.track}>
            <View style={[s.trackFill, { width: `${searchPct}%` }]} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 12 }}>
            {sorted.length === 0 && (
              <View style={{ alignItems: 'center', paddingVertical: 26 }}>
                <Text style={{ fontSize: 26 }}>⏳</Text>
                <Text style={s.emptyText}>ສົ່ງຄຳຂໍໄປແລ້ວ — ຄົນຂັບໃກ້ໆກຳລັງເບິ່ງຢູ່</Text>
              </View>
            )}

            {sorted.map((b, i) => (
              <BidCard
                key={b.id}
                bid={b}
                best={i === 0 && sorted.length > 1}
                onAccept={() => onAcceptBid(b)}
                onDecline={() => onDeclineBid(b)}
              />
            ))}
          </ScrollView>
        </View>
      </View>
    );
  }

  /* ------------------------------------ 3. TRIP (mockups 07 / 08) */
  if (stage === 'trip') {
    const waiting = tripStep === 0;

    const statusLo = waiting
      ? 'ລົດກຳລັງມາຮັບທ່ານ'
      : tripStep === 1
      ? 'ຄົນຂັບຮອດຈຸດຮັບແລ້ວ'
      : 'ກຳລັງເດີນທາງ';
    const statusEn = waiting
      ? 'Your ride is arriving'
      : tripStep === 1
      ? 'Driver has arrived'
      : 'On the way';

    // during the wait the pill counts down to pick-up; afterwards it shows the trip
    const pill = waiting
      ? `${approach ? Math.max(1, Math.round(approach.min)) : accepted.eta} ນາທີ · ${
          approach ? approach.km.toFixed(1) : '—'
        } km`
      : fmtKm(ride.km);

    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {waiting ? (
          <LiveMap
            from={driverOrigin}
            to={ride.from}
            coords={approach ? approach.coords : null}
            phase={2}
            vehicle={ride.vehicleId}
            lineColor={C.lime}
            dashed
            destHalo
            layer={mapLayer}
            onToggleLayer={onMapLayer}
            style={{ flex: 1 }}
          />
        ) : (
          <LiveMap
            from={ride.from}
            to={ride.to}
            coords={ride.route ? ride.route.coords : null}
            phase={tripStep}
            vehicle={ride.vehicleId}
            lineColor={C.lime}
            layer={mapLayer}
            onToggleLayer={onMapLayer}
            style={{ flex: 1 }}
          />
        )}

        <View style={s.statusCard} pointerEvents="none">
          <View style={{ flex: 1 }}>
            <Text style={s.statusLo}>{statusLo}</Text>
            <Text style={s.statusEn}>{statusEn}</Text>
          </View>
          <View style={s.etaPill}>
            <Text style={s.etaPillText}>{pill}</Text>
          </View>
        </View>

        <View style={s.sheet}>
          <View style={s.handle} />

          {/* vehicle */}
          <View style={s.vehicleCard}>
            <View style={s.vehicleIcon}>
              <Text style={{ fontSize: 24 }}>{vehicleById(ride.vehicleId).icon}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={s.vehicleModel} numberOfLines={1}>
                {accepted.model || vehicleById(ride.vehicleId).label}
              </Text>
              <Text style={s.vehicleColor}>
                {accepted.color ? `${accepted.color.lo} · ${accepted.color.en}` : accepted.vehicle}
              </Text>
            </View>
            <View style={s.plateBadge}>
              <Text style={s.plateText}>{accepted.plate}</Text>
            </View>
          </View>

          {/* driver */}
          <View style={s.driverRow}>
            <View style={s.avatar}>
              <Text style={{ fontSize: 20 }}>{ME_DRIVER.avatar}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={s.driverName} numberOfLines={1}>{accepted.name}</Text>
              <Text style={s.driverMeta}>
                ⭐ {accepted.rating.toFixed(1)} · {fmtNum(accepted.trips)} ຖ້ຽວ
              </Text>
            </View>
            <Pressable style={s.circleBtn}><Text style={{ fontSize: 16 }}>📞</Text></Pressable>
            <Pressable style={[s.circleBtn, { marginLeft: 10 }]}><Text style={{ fontSize: 16 }}>💬</Text></Pressable>
          </View>

          <View style={[s.track, { marginTop: 16 }]}>
            <View style={[s.trackFill, { width: `${((tripStep + 1) / 3) * 100}%` }]} />
          </View>

          <View style={s.footRow}>
            <Text style={s.footLeft} numberOfLines={1}>
              {waiting ? 'ຈຸດຮັບ · ' : 'ໄປ · '}
              <Text style={s.footStrong}>{waiting ? ride.from.name : ride.to.name}</Text>
            </Text>
            <Text style={s.footRight}>
              {fmtKip(accepted.price)} · {payById(ride.pay).label}
            </Text>
          </View>

          <Pressable
            onPress={tripStep >= 2 ? undefined : onCancelTrip}
            disabled={tripStep >= 2}
            style={{ paddingVertical: 12, alignItems: 'center' }}>
            <Text style={[s.cancelLink, tripStep >= 2 && { color: C.faint }]}>
              {tripStep >= 2 ? 'ເລີ່ມເດີນທາງແລ້ວ ຍົກເລີກບໍ່ໄດ້' : 'ຍົກເລີກ · Cancel trip'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  /* -------------------------------- 4. PAY & RATE (mockup 09) */
  const total = accepted.price + tip;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={s.payScreen}>
      <View style={s.doneBadge}>
        <Text style={s.doneBadgeText}>✓</Text>
      </View>

      <Text style={s.payTitle}>ຮອດປາຍທາງແລ້ວ</Text>
      <Text style={s.paySub}>
        Trip completed · {Math.max(1, Math.round(ride.km * 2.6))} min · {fmtKm(ride.km)}
      </Text>

      {/* fare summary */}
      <View style={s.payCard}>
        <View style={s.payLine}>
          <Text style={s.payLineLabel}>ຄ່າໂດຍສານທີ່ຕົກລົງ</Text>
          <Text style={s.payLineValue}>{fmtKip(accepted.price)}</Text>
        </View>
        <View style={s.payLine}>
          <Text style={s.payLineLabel}>ທິບ · Tip</Text>
          <Text style={s.payLineValue}>{fmtKip(tip)}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          {TIPS.map((t) => (
            <Chip
              key={t}
              label={t === 0 ? 'ບໍ່ມີ' : fmtNum(t)}
              active={tip === t}
              onPress={() => onTip(t)}
              style={{ flex: 1 }}
            />
          ))}
        </View>

        <View style={s.hair} />

        <View style={s.payLine}>
          <Text style={s.payTotalLabel}>ລວມ · Total</Text>
          <Kip value={total} style={s.payTotal} unitStyle={s.payTotalUnit} />
        </View>

        <View style={{ marginTop: 12 }}>
          <PayPicker value={pay} onChange={onPay} compact />
        </View>
      </View>

      {/* rating */}
      <View style={[s.payCard, { alignItems: 'center' }]}>
        <Text style={s.payLineLabel}>
          ໃຫ້ຄະແນນ {accepted.name.split(' ')[1] || accepted.name} · Rate your driver
        </Text>
        <View style={{ marginTop: 12 }}>
          <Stars value={rating} size={32} onChange={onRate} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          {RATE_TAGS.map((t) => (
            <Chip key={t} label={t} active={tags.includes(t)} onPress={() => onToggleTag(t)} />
          ))}
        </View>
      </View>

      <Btn title="ສຳເລັດ · Done" onPress={onReset} style={{ marginTop: 8 }} />
    </ScrollView>
  );
}

/* --------------------------------------------- bid card (mockup 06) */
function BidCard({ bid, best, onAccept, onDecline }) {
  return (
    <View style={[s.bidCard, best && s.bidCardBest]}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={s.avatar}>
          <Text style={{ fontSize: 19 }}>{bid.isMe ? '🧑' : bid.avatar}</Text>
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.bidName} numberOfLines={1}>{bid.name}</Text>
          <Text style={s.bidMeta} numberOfLines={1}>
            ⭐ {bid.rating.toFixed(1)} · {bid.model || bid.vehicle}
            {bid.color ? ` · ${bid.color.lo}` : ''}
          </Text>
          {bid.isMe && <Text style={s.mineTag}>ຈາກແທັບ "ຄົນຂັບ" ຂອງທ່ານ</Text>}
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Kip value={bid.price} style={s.bidPrice} unitStyle={s.bidPriceUnit} />
          <Text style={s.bidEta}>{bid.eta} ນາທີ</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <Pressable onPress={onDecline} style={s.declineBtn}>
          <Text style={s.declineText}>ປະຕິເສດ</Text>
        </Pressable>
        <Pressable onPress={onAccept} style={s.acceptWide}>
          <Text style={s.acceptWideText}>ຮັບ · Accept {fmtKip(bid.price)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* =============================================================================
   8. PROFILE + HISTORY (mockup 14)
   ========================================================================== */

function ProfileScreen({ visible, who, trips, pay, onClose, onLogout }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={s.profilePad}>
          <View style={s.profileHead}>
            <Pressable onPress={onClose} style={s.backCircle}>
              <Text style={s.backCircleText}>←</Text>
            </Pressable>
            <Text style={s.searchHeadTitle}>ໂປຣໄຟລ໌</Text>
          </View>

          <View style={s.profileRow}>
            <View style={s.profileAvatar}>
              <Text style={{ fontSize: 28 }}>{who.avatar}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={s.profileName}>{who.name}</Text>
              <Text style={s.profileMeta}>
                {who.phone} · ⭐ {who.rating}
              </Text>
            </View>
            <Text style={s.chev}>›</Text>
          </View>

          <View style={s.listCard}>
            <ListRow icon="💳" label="ວິທີຈ່າຍເງິນ" value={payById(pay).label} />
            <ListRow icon="📍" label="ສະຖານທີ່ບັນທຶກໄວ້" />
            <ListRow icon="🌐" label="ພາສາ · Language" value="ລາວ" />
            <ListRow icon="🛟" label="ຊ່ວຍເຫຼືອ · Support" last />
          </View>

          <Text style={s.sectionLabel}>ປະຫວັດການເດີນທາງ · Recent trips</Text>

          {trips.map((t) => (
            <View key={t.id} style={s.histRow}>
              <Text style={{ fontSize: 16 }}>{t.icon}</Text>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.histRoute} numberOfLines={1}>{t.route}</Text>
                <Text style={s.histWhen}>{t.when}</Text>
              </View>
              <Text style={s.histPrice}>{fmtKip(t.price)}</Text>
            </View>
          ))}

          <Pressable onPress={onLogout} style={{ paddingVertical: 22, alignItems: 'center' }}>
            <Text style={s.cancelLink}>ອອກຈາກລະບົບ · Log out</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/* =============================================================================
   9. DRIVER
   ========================================================================== */

/** Mockups 11 and 12: turn-by-turn to the rider, then to their destination. */
function DriverNav({ job, driverLoc, mapLayer, onMapLayer, onStep }) {
  const [approach, setApproach] = useState(null);
  const [tripRoute, setTripRoute] = useState(null);

  const origin = useMemo(
    () =>
      driverLoc || {
        id: `drv_${job.id}`,
        name: 'ຕຳແໜ່ງຄົນຂັບ',
        district: '',
        alias: '',
        lat: job.from.lat + 0.0075,
        lng: job.from.lng - 0.006,
      },
    [driverLoc, job.id, job.from.lat, job.from.lng]
  );

  useEffect(() => {
    const ctl = new AbortController();
    fetchRoute(origin, job.from, ctl.signal, { steps: true }).then((r) => {
      if (!ctl.signal.aborted) setApproach(r);
    });
    return () => ctl.abort();
  }, [job.id, origin.lat, origin.lng]);

  useEffect(() => {
    const ctl = new AbortController();
    fetchRoute(job.from, job.to, ctl.signal, { steps: true }).then((r) => {
      if (!ctl.signal.aborted) setTripRoute(r);
    });
    return () => ctl.abort();
  }, [job.id]);

  const toPickup = job.step === 0;
  const leg = toPickup ? approach : tripRoute;

  // the first step with real length — step 0 is always a zero-distance "depart"
  const nextStep = leg && leg.steps ? leg.steps.find((st) => st.distance > 5) || leg.steps[0] : null;
  const man = laoManeuver(nextStep);

  const etaClock = () => clock(new Date(Date.now() + (leg ? leg.min : 0) * 60000));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {toPickup ? (
        <LiveMap
          from={origin}
          to={job.from}
          coords={approach ? approach.coords : null}
          phase={2}
          vehicle={job.vehicleId}
          lineColor={C.lime}
          destHalo
          layer={mapLayer}
          onToggleLayer={onMapLayer}
          style={{ flex: 1 }}
        />
      ) : (
        <LiveMap
          from={job.from}
          to={job.to}
          coords={tripRoute ? tripRoute.coords : null}
          phase={job.step === 1 ? 1 : 2}
          vehicle={job.vehicleId}
          lineColor={C.lime}
          layer={mapLayer}
          onToggleLayer={onMapLayer}
          style={{ flex: 1 }}
        />
      )}

      {/* --- navigation banner --- */}
      <View style={s.navBanner} pointerEvents="none">
        <Text style={s.navArrow}>{man ? man.icon : '↑'}</Text>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={s.navLo} numberOfLines={1}>
            {man ? man.lo : 'ກຳລັງຄິດໄລ່ເສັ້ນທາງ...'}
          </Text>
          <Text style={s.navEn} numberOfLines={1}>
            {man ? man.en : 'Calculating route'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.navMin}>{leg ? `${Math.max(1, Math.round(leg.min))} ນາທີ` : '—'}</Text>
          <Text style={s.navKm}>{leg ? fmtKm(leg.km) : ''}</Text>
        </View>
      </View>

      {/* --- sheet --- */}
      <View style={s.sheet}>
        <View style={s.handle} />

        {job.step < 2 ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={s.avatar}>
                <Text style={{ fontSize: 20 }}>👩</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={s.driverName} numberOfLines={1}>ໄປຮັບ {job.passengerName}</Text>
                <Text style={s.driverMeta} numberOfLines={1}>
                  {job.from.name}
                  {job.from.district ? ` · ${job.from.district}` : ''}
                </Text>
              </View>
              <Pressable style={s.circleBtn}><Text style={{ fontSize: 16 }}>📞</Text></Pressable>
              <Pressable style={[s.circleBtn, { marginLeft: 10 }]}><Text style={{ fontSize: 16 }}>💬</Text></Pressable>
            </View>

            <View style={s.footRow}>
              <Text style={s.footLeft}>ຄ່າໂດຍສານທີ່ຕົກລົງ</Text>
              <Text style={s.footRight}>
                {fmtKip(job.price)} · {payById(job.pay).label}
              </Text>
            </View>

            <Pressable onPress={onStep} style={s.bigCta}>
              <Text style={s.bigCtaText}>
                {job.step === 0
                  ? 'ຮອດຈຸດຮັບແລ້ວ · I’ve arrived'
                  : 'ຮັບຜູ້ໂດຍສານແລ້ວ · Start trip'}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={s.dotFrom} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.onTripLabel}>ກຳລັງໄປສົ່ງ · On trip</Text>
                <Text style={s.onTripDest} numberOfLines={1}>{job.to.name}</Text>
              </View>
              <View style={s.etaSoftPill}>
                <Text style={s.etaSoftText}>ETA {etaClock()}</Text>
              </View>
            </View>

            <View style={s.onboardCard}>
              <View style={s.avatarSm}>
                <Text style={{ fontSize: 17 }}>👩</Text>
              </View>
              <Text style={s.onboardName} numberOfLines={1}>{job.passengerName} ຢູ່ໃນລົດ</Text>
              <Text style={s.onboardFare}>
                {fmtKip(job.price)} · {payById(job.pay).label}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Pressable style={s.sosBtn}>
                <Text style={s.sosText}>🛟 SOS</Text>
              </Pressable>
              <Pressable onPress={onStep} style={[s.bigCta, { flex: 2, marginTop: 0 }]}>
                <Text style={s.bigCtaText}>ສຳເລັດການເດີນທາງ · Complete</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------- driver home */

const DRIVER_TABS = [
  { id: 'home', icon: '🚦', label: 'ວຽກ' },
  { id: 'earn', icon: '💰', label: 'ລາຍຮັບ' },
  { id: 'sched', icon: '🗓️', label: 'ຈອງລ່ວງໜ້າ' },
  { id: 'profile', icon: '👤', label: 'ໂປຣໄຟລ໌' },
];

/** Mockup 13 — gradient hero, 7-day bar chart, trip list, withdraw. */
function EarningsTab({ earnings, driverTrips }) {
  const week = WEEK.map((d, i) =>
    i === TODAY_INDEX ? { ...d, amount: d.amount + earnings } : d
  );
  const weekTotal = week.reduce((t, d) => t + d.amount, 0);
  const peak = Math.max(...week.map((d) => d.amount), 1);

  const rows = [
    ...driverTrips.map((t) => ({
      id: t.id,
      route: `${t.from.name} → ${t.to.name}`,
      when: clock(new Date(t.at)),
      pay: t.pay,
      price: t.price,
    })),
    ...SEED_EARNINGS,
  ];

  return (
    <>
      <LinearGradient colors={[C.lime, C.limeDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.earnHero}>
        <Text style={s.earnHeroLabel}>ອາທິດນີ້ · This week</Text>
        <Kip value={weekTotal} style={s.earnHeroValue} unitStyle={s.earnHeroUnit} />
        <Text style={s.earnHeroDelta}>▲ 12% ຈາກອາທິດແລ້ວ</Text>
      </LinearGradient>

      {/* bar chart */}
      <View style={s.chart}>
        {week.map((d, i) => {
          const on = i === TODAY_INDEX;
          return (
            <View key={i} style={s.chartCol}>
              {/* capped at 82% so the tallest bar still leaves room for its
                  day label inside the fixed-height column */}
              <View
                style={[
                  s.bar,
                  { height: `${Math.max(8, (d.amount / peak) * 82)}%` },
                  on && { backgroundColor: C.lime },
                ]}
              />
              <Text style={[s.barLabel, on && { color: C.accentText }]}>{d.day}</Text>
            </View>
          );
        })}
      </View>

      <View style={{ gap: 10, marginTop: 16 }}>
        {rows.map((t) => (
          <View key={t.id} style={s.earnRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.earnRoute} numberOfLines={1}>{t.route}</Text>
              <Text style={s.earnWhen}>
                {t.when} · {payById(t.pay).label}
              </Text>
            </View>
            <Text style={s.earnPlus}>+{fmtKip(t.price)}</Text>
          </View>
        ))}
      </View>

      <Btn variant="outline" title="ຖອນເງິນ · Withdraw" style={{ marginTop: 20 }} />
    </>
  );
}

function DriverScreen({
  online,
  earnings,
  trips,
  requests,
  activeJob,
  driverLoc,
  driverTrips,
  mapLayer,
  onMapLayer,
  onToggleOnline,
  onAcceptPrice,
  onCounter,
  onSkip,
  onJobStep,
  onLogout,
}) {
  const [tab, setTab] = useState('home');
  const [showAll, setShowAll] = useState(false);
  const [now, setNow] = useState(Date.now());

  // drives the countdown bars
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // an active job takes over the whole screen — no tabs, no list
  if (activeJob) {
    return (
      <DriverNav
        job={activeJob}
        driverLoc={driverLoc}
        mapLayer={mapLayer}
        onMapLayer={onMapLayer}
        onStep={onJobStep}
      />
    );
  }

  const open = requests
    .filter((r) => r.state !== 'won')
    .map((r) => ({ ...r, awayKm: driverLoc ? haversine(driverLoc, r.from) : null }))
    .sort((a, b) => (a.awayKm ?? 0) - (b.awayKm ?? 0));

  const inRange = open.filter((r) => r.awayKm != null && r.awayKm <= NEARBY_RADIUS_KM);
  const outOfRange = open.length - inRange.length;
  const visible = !driverLoc || showAll ? open : inRange;

  const scheduled = open.filter((r) => r.scheduled != null);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 28 }}
        keyboardShouldPersistTaps="handled">
        {/* --- header (mockup 10) --- */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={s.driverH1}>ໂໝດຄົນຂັບ</Text>
            <Text style={[s.driverH1sub, { color: online ? C.green : C.faint }]}>
              {online ? 'ອອນໄລນ໌ · ພ້ອມຮັບວຽກ' : 'ອອຟໄລນ໌ · Offline'}
            </Text>
          </View>
          <Pressable onPress={onToggleOnline} style={[s.switchTrack, online && s.switchTrackOn]}>
            <View style={[s.switchKnob, online && s.switchKnobOn]} />
          </Pressable>
        </View>

        {/* --- stats --- */}
        <View style={s.statRow}>
          <View style={s.statCard}>
            <Text style={s.statLabel}>ລາຍຮັບມື້ນີ້</Text>
            <Kip value={earnings} style={s.statValue} unitStyle={s.statUnit} />
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>ຖ້ຽວ · Trips</Text>
            <Text style={[s.statBig, grotesk(700)]}>{trips}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>ຄະແນນ</Text>
            <Text style={s.statBig}>
              <Text style={grotesk(700)}>{ME_DRIVER.rating}</Text> ⭐
            </Text>
          </View>
        </View>

        {/* --- tab bodies --- */}
        {tab === 'home' && (
          <>
            {!online && (
              <View style={s.emptyDashed}>
                <Text style={{ fontSize: 26 }}>🌙</Text>
                <Text style={s.emptyText}>ທ່ານອອຟໄລນ໌ຢູ່ — ເປີດເພື່ອຮັບວຽກ</Text>
              </View>
            )}

            {online && open.length === 0 && (
              <View style={s.emptyDashed}>
                <Text style={{ fontSize: 26 }}>📭</Text>
                <Text style={s.emptyText}>ຍັງບໍ່ມີຄຳຂໍໃໝ່</Text>
              </View>
            )}

            {online && open.length > 0 && visible.length === 0 && (
              <View style={s.emptyDashed}>
                <Text style={{ fontSize: 26 }}>📍</Text>
                <Text style={s.emptyText}>
                  ບໍ່ມີຄຳຂໍພາຍໃນ {NEARBY_RADIUS_KM} ກມ · ໃກ້ສຸດ {fmtKm(open[0].awayKm)}
                </Text>
              </View>
            )}

            {online && outOfRange > 0 && (
              <Pressable onPress={() => setShowAll((v) => !v)} style={s.radiusToggle}>
                <Text style={s.radiusToggleText}>
                  {showAll
                    ? `ສະແດງສະເພາະພາຍໃນ ${NEARBY_RADIUS_KM} ກມ`
                    : `ມີອີກ ${outOfRange} ຄຳຂໍນອກ ${NEARBY_RADIUS_KM} ກມ · ສະແດງທັງໝົດ`}
                </Text>
              </Pressable>
            )}

            {online &&
              visible.map((r) => (
                <RequestCard
                  key={r.id}
                  req={r}
                  now={now}
                  far={r.awayKm != null && r.awayKm > NEARBY_RADIUS_KM}
                  onAccept={() => onAcceptPrice(r)}
                  onCounter={(amount) => onCounter(r, amount)}
                  onSkip={() => onSkip(r)}
                />
              ))}
          </>
        )}

        {tab === 'earn' && <EarningsTab earnings={earnings} driverTrips={driverTrips} />}

        {tab === 'sched' && (
          <>
            <Text style={s.sectionLabel}>ຄຳຂໍທີ່ຈອງລ່ວງໜ້າ</Text>
            {scheduled.length === 0 ? (
              <View style={s.emptyDashed}>
                <Text style={{ fontSize: 26 }}>🗓️</Text>
                <Text style={s.emptyText}>ຍັງບໍ່ມີການຈອງລ່ວງໜ້າ</Text>
              </View>
            ) : (
              scheduled.map((r) => (
                <View key={r.id} style={s.earnRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.earnRoute} numberOfLines={1}>
                      {r.from.name} → {r.to.name}
                    </Text>
                    <Text style={s.earnWhen}>
                      {r.passengerName} · ອີກ {r.scheduled} ນາທີ
                    </Text>
                  </View>
                  <Text style={s.earnPlus}>{fmtKip(r.price)}</Text>
                </View>
              ))
            )}
          </>
        )}

        {tab === 'profile' && (
          <View style={{ marginTop: 18 }}>
            <View style={s.profileRow}>
              <View style={s.profileAvatar}>
                <Text style={{ fontSize: 28 }}>{ME_DRIVER.avatar}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={s.profileName}>{ME_DRIVER.name}</Text>
                <Text style={s.profileMeta}>
                  ⭐ {ME_DRIVER.rating} · {fmtNum(ME_DRIVER.trips + trips)} ຖ້ຽວ
                </Text>
              </View>
              <View style={s.plateBadge}>
                <Text style={s.plateText}>{ME_DRIVER.plate}</Text>
              </View>
            </View>

            <View style={s.listCard}>
              <ListRow icon="🏍️" label="ລົດຂອງຂ້ອຍ" value={ME_DRIVER.vehicle} />
              <ListRow icon="📄" label="ເອກະສານ · Documents" />
              <ListRow icon="🌐" label="ພາສາ · Language" value="ລາວ" />
              <ListRow icon="🛟" label="ຊ່ວຍເຫຼືອ · Support" last />
            </View>

            <Pressable onPress={onLogout} style={{ paddingVertical: 20, alignItems: 'center' }}>
              <Text style={s.cancelLink}>ອອກຈາກລະບົບ · Log out</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* --- bottom tabs --- */}
      <View style={s.driverTabs}>
        {DRIVER_TABS.map((t) => {
          const on = t.id === tab;
          return (
            <Pressable key={t.id} onPress={() => setTab(t.id)} style={s.driverTab}>
              <Text style={{ fontSize: 17, opacity: on ? 1 : 0.4 }}>{t.icon}</Text>
              <Text style={[s.driverTabText, on && s.driverTabTextOn]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ------------------------------------------- request card (mockup 10) */

function RequestCard({ req, now, far, onAccept, onCounter, onSkip }) {
  const [countering, setCountering] = useState(false);
  const [amount, setAmount] = useState(req.price + FARE_STEP);

  const waiting = req.state === 'bidding';
  const lost = req.state === 'lost';

  // how much of its life the request has left
  const left = req.expiresAt ? Math.max(0, req.expiresAt - now) : REQUEST_TTL_MS;
  const frac = Math.max(0, Math.min(1, left / REQUEST_TTL_MS));

  return (
    <View style={[s.reqCard, !far && !waiting && !lost && s.reqCardLive]}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={s.avatarSm}>
          <Text style={{ fontSize: 17 }}>{req.mine ? '🧑' : '👩'}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.reqName} numberOfLines={1}>{req.passengerName}</Text>
          <Text style={s.reqMeta}>
            ⭐ {(4.5 + (req.price % 5) / 10).toFixed(1)} · {payById(req.pay).label}
          </Text>
          {req.mine && <Text style={s.mineTag}>ຄຳຂໍຈາກແທັບ "ຜູ້ໂດຍສານ" ຂອງທ່ານ</Text>}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Kip value={req.price} style={s.reqPrice} unitStyle={s.reqPriceUnit} />
          <Text style={s.reqKm}>{fmtKm(req.km)}</Text>
        </View>
      </View>

      <View style={{ marginTop: 14, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={s.dotFrom} />
          <Text style={s.reqStop} numberOfLines={1}>
            {req.from.name}
            {req.awayKm != null ? ` · ${fmtKm(req.awayKm)} ຈາກທ່ານ` : ''}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={s.dotTo} />
          <Text style={s.reqStop} numberOfLines={1}>{req.to.name}</Text>
        </View>
      </View>

      {!!req.note && <Text style={s.note}>"{req.note}"</Text>}

      {/* countdown */}
      {!waiting && !lost && (
        <View style={[s.track, { marginTop: 14 }]}>
          <View style={[s.trackFill, { width: `${frac * 100}%`, backgroundColor: frac < 0.3 ? C.red : '#E8A04C' }]} />
        </View>
      )}

      {lost ? (
        <Text style={[s.reqStateText, { color: C.red }]}>ຜູ້ໂດຍສານເລືອກຄົນອື່ນແລ້ວ</Text>
      ) : waiting ? (
        <Text style={s.reqStateText}>
          ສົ່ງລາຄາ <Text style={s.footStrong}>{fmtKip(req.countered ?? req.myBid ?? 0)}</Text> ແລ້ວ · ລໍຖ້າຄຳຕອບ
        </Text>
      ) : countering ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <Pressable onPress={() => setAmount((a) => Math.max(1000, a - FARE_STEP))} style={s.stepSquare}>
            <Text style={s.stepSquareText}>−</Text>
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Kip value={amount} style={s.counterAmount} unitStyle={s.counterAmountUnit} />
          </View>
          <Pressable onPress={() => setAmount((a) => a + FARE_STEP)} style={s.stepSquare}>
            <Text style={s.stepSquareText}>+</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              onCounter(amount);
              setCountering(false);
            }}
            style={s.sendBtn}>
            <Text style={s.sendBtnText}>ສົ່ງ</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <Pressable onPress={onSkip} style={s.skipBtn}>
            <Text style={s.skipText}>ຂ້າມ</Text>
          </Pressable>
          <Pressable onPress={() => setCountering(true)} style={s.counterBtn}>
            <Text style={s.counterBtnText}>ຕໍ່ລອງ {fmtKip(req.price + FARE_STEP)}</Text>
          </Pressable>
          <Pressable onPress={onAccept} style={s.acceptBtn}>
            <Text style={s.acceptText}>ຮັບ {fmtKip(req.price)}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/* =============================================================================
   10. APP — owns every piece of shared state and every timer
   ========================================================================== */

// build a request from a simulated passenger
function makeSimRequest() {
  const from = pick(PLACES);
  let to = pick(PLACES);
  while (to.id === from.id) to = pick(PLACES);
  const vehicle = pick(VEHICLES);
  const km = roadDistance(from, to);
  const price = roundTo(suggestFare(km, vehicle) * rnd(0.85, 1.05), 500);
  return {
    id: uid('req'),
    passengerName: pick(PASSENGER_NAMES),
    from,
    to,
    km,
    vehicleId: vehicle.id,
    price,
    pay: Math.random() < 0.75 ? 'cash' : 'qr',
    note: pick(NOTES),
    mine: false,
    state: 'open',
    myBid: null,
    expiresAt: Date.now() + REQUEST_TTL_MS,
  };
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts(FONTS);

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  /* ------------------------------------------------------- onboarding */
  const [phase, setPhase] = useState('splash'); // splash | login | otp | app
  const [phone, setPhone] = useState('');

  const [tab, setTab] = useState('passenger');
  const [profileOpen, setProfileOpen] = useState(false);

  /* ------------------------------------------------------ passenger state */
  const [pStage, setPStage] = useState('booking'); // booking | waiting | trip | receipt
  const [ride, setRide] = useState(null);
  const [bids, setBids] = useState([]);
  const [accepted, setAccepted] = useState(null);
  const [tripStep, setTripStep] = useState(0);
  const [rating, setRating] = useState(0);
  const [tip, setTip] = useState(0);
  const [tags, setTags] = useState([]);
  const [pay, setPay] = useState('cash');
  const [myTrips, setMyTrips] = useState(SEED_RIDES);

  /* ------------------------------------------------- location + recents */
  // Asked for once on launch. Falls back to the most recent address used this
  // session, then to the first preset place — the app is never blocked on it.
  const [myPlace, setMyPlace] = useState(null);
  const [locStatus, setLocStatus] = useState('pending'); // pending|granted|denied|failed
  const [recents, setRecents] = useState([]);

  // one base-layer choice shared by every map in the app
  const [mapLayer, setMapLayer] = useState('street'); // 'street' | 'satellite'

  useEffect(() => {
    let alive = true;
    getCurrentPlace().then((r) => {
      if (!alive) return;
      setLocStatus(r.status);
      if (r.place) setMyPlace(r.place);
    });
    return () => {
      alive = false;
    };
  }, []);

  const samePlace = (a, b) =>
    a.id === b.id || (Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6);

  const addRecent = useCallback((p) => {
    if (!p) return;
    setRecents((rs) => [p, ...rs.filter((r) => !samePlace(r, p))].slice(0, 6));
  }, []);

  const refreshLocation = useCallback(async () => {
    setLocStatus('pending');
    const r = await getCurrentPlace();
    setLocStatus(r.status);
    if (r.place) setMyPlace(r.place);
    return r.place;
  }, []);

  /* --------------------------------------------------------- driver state */
  const [online, setOnline] = useState(true);
  const [earnings, setEarnings] = useState(0);
  const [doneTrips, setDoneTrips] = useState(0);
  const [requests, setRequests] = useState(() => [makeSimRequest(), makeSimRequest()]);
  const [activeJob, setActiveJob] = useState(null);
  const [driverTrips, setDriverTrips] = useState([]);

  /* -------------------------------------------------------------- timers */
  const timers = useRef([]);
  const rideIdRef = useRef(null); // guards stale callbacks after cancel/reset

  const later = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      timers.current = timers.current.filter((t) => t !== id);
      fn();
    }, ms);
    timers.current.push(id);
    return id;
  }, []);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    },
    []
  );

  // requests lapse if nobody takes them; keep at least two on the board
  useEffect(() => {
    const id = setInterval(() => {
      setRequests((rs) => {
        const live = rs.filter(
          (r) => r.mine || r.state !== 'open' || !r.expiresAt || r.expiresAt > Date.now()
        );
        if (live.length === rs.length) return rs;
        return live.length < 2 ? [...live, makeSimRequest()] : live;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  /* ================================================== passenger: submit ride */
  const submitRide = ({ from, to, vehicleId, price, note, km, route, scheduled }) => {
    const id = uid('ride');
    const r = {
      id,
      from,
      to,
      km,
      route,        // OSRM polyline, so the trip map can follow the real road
      scheduled,    // minutes ahead, or null for right now
      vehicleId,
      price,
      pay,
      note,
      passengerName: 'ທ່ານ (ຜູ້ໂດຍສານ)',
      mine: true,
      state: 'open',
      myBid: null,
      expiresAt: Date.now() + REQUEST_TTL_MS,
    };

    addRecent(from);
    addRecent(to);

    rideIdRef.current = id;
    setRide(r);
    setBids([]);
    setAccepted(null);
    setRating(0);
    setTip(0);
    setTags([]);
    setTripStep(0);
    setPStage('waiting');

    // the ride becomes a real, biddable request on the driver side
    setRequests((rs) => [r, ...rs]);

    // 4 simulated drivers bid one by one between 2s and 8s
    const pool = [...DRIVER_NAMES].sort(() => Math.random() - 0.5).slice(0, EXPECTED_BIDS);
    const delays = pool.map(() => rndInt(2000, 8000)).sort((a, b) => a - b);

    pool.forEach((name, i) => {
      later(() => {
        if (rideIdRef.current !== id) return; // request was cancelled
        setBids((prev) => [
          ...prev,
          {
            id: uid('bid'),
            name,
            avatar: pick(['🧔', '👨', '🧑', '👩']),
            rating: Number(rnd(4.2, 5.0).toFixed(1)),
            vehicle: vehicleById(vehicleId).label,
            plate: `${pick(PLATE_PREFIX)} ${rndInt(1000, 9999)}`,
            model: pick(MODELS[vehicleId] || MODELS.car),
            color: pick(COLORS),
            eta: rndInt(2, 12),
            trips: rndInt(180, 3200),
            price: roundTo(price * rnd(0.92, 1.27), 500),
            isMe: false,
          },
        ]);
      }, delays[i]);
    });
  };

  /* ============================================ passenger: accept / decline */
  const acceptBid = (bid) => {
    setAccepted(bid);
    setTripStep(0);
    setPStage('trip');

    if (bid.isMe) {
      // the user's own driver tab won the job — they drive the trip manually
      setRequests((rs) => rs.filter((r) => !r.mine));
      setActiveJob({ ...ride, price: bid.price, step: 0 });
      return;
    }

    // the request is no longer open on the driver side; if the driver had
    // already bid on it, tell them the passenger picked someone else
    setRequests((rs) =>
      rs
        .map((r) => (r.mine && r.state === 'bidding' ? { ...r, state: 'lost' } : r))
        .filter((r) => !r.mine || r.state === 'lost')
    );

    // otherwise the simulated driver advances the trip on timers
    const id = rideIdRef.current;
    later(() => rideIdRef.current === id && setTripStep(1), 5000);
    later(() => rideIdRef.current === id && setTripStep(2), 10000);
    later(() => {
      if (rideIdRef.current !== id) return;
      setPStage('receipt');
      setRequests((rs) => rs.filter((r) => !r.mine));
    }, 19000);
  };

  const declineBid = (bid) => setBids((prev) => prev.filter((b) => b.id !== bid.id));

  const cancelRequest = () => {
    rideIdRef.current = null;
    setRequests((rs) => rs.filter((r) => !r.mine));
    setBids([]);
    setRide(null);
    setPStage('booking');
  };

  const cancelTrip = () => {
    rideIdRef.current = null;
    setRequests((rs) => rs.filter((r) => !r.mine));
    setActiveJob((j) => (j && j.mine ? null : j)); // only drop the linked job
    setBids([]);
    setRide(null);
    setAccepted(null);
    setPStage('booking');
  };

  /** Filing the finished ride into history is what "Done" does. */
  const resetPassenger = () => {
    if (ride && accepted) {
      setMyTrips((t) => [
        {
          id: ride.id,
          icon: vehicleById(ride.vehicleId).icon,
          route: `${ride.from.name} → ${ride.to.name}`,
          when: `ມື້ນີ້ ${clock()}`,
          price: accepted.price + tip,
        },
        ...t,
      ]);
    }
    rideIdRef.current = null;
    setRide(null);
    setBids([]);
    setAccepted(null);
    setRating(0);
    setTip(0);
    setTags([]);
    setTripStep(0);
    setPStage('booking');
  };

  const toggleTag = (t) =>
    setTags((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]));

  /* ================================================== driver: place a bid */
  const placeBid = (req, amount) => {
    setRequests((rs) =>
      rs.map((r) => (r.id === req.id ? { ...r, state: 'bidding', myBid: amount } : r))
    );

    if (req.mine) {
      // bidding on the ride the user created in the Passenger tab —
      // it shows up there as a real bid they can accept or decline
      setBids((prev) => [
        ...prev,
        {
          id: uid('bid'),
          name: 'ທ່ານ (ຄົນຂັບ)',
          avatar: '🧑',
          rating: ME_DRIVER.rating,
          vehicle: vehicleById(req.vehicleId).label,
          plate: ME_DRIVER.plate,
          model: ME_DRIVER.vehicle,
          color: pick(COLORS),
          eta: rndInt(2, 8),
          trips: ME_DRIVER.trips + doneTrips,
          price: amount,
          isMe: true,
        },
      ]);
      return;
    }

    // simulated passenger answers in 4-8 seconds
    later(() => {
      const accept = Math.random() < 0.6;
      if (accept) {
        setRequests((rs) => rs.filter((r) => r.id !== req.id));
        setActiveJob({ ...req, price: amount, step: 0 });
      } else {
        setRequests((rs) => rs.map((r) => (r.id === req.id ? { ...r, state: 'lost' } : r)));
        later(() => setRequests((rs) => rs.filter((r) => r.id !== req.id)), 2500);
      }
    }, rndInt(4000, 8000));
  };

  const skipRequest = (r) => setRequests((rs) => rs.filter((x) => x.id !== r.id));

  /* ================================================ driver: advance the job */
  const jobStep = () => {
    if (!activeJob) return;
    const next = activeJob.step + 1;

    // if this job IS the user's own passenger ride, drive that screen too
    const linked = activeJob.mine && pStage === 'trip';

    if (next <= 2) {
      setActiveJob({ ...activeJob, step: next });
      if (linked) setTripStep(next);
      return;
    }

    // finished
    setDriverTrips((t) => [
      {
        id: activeJob.id,
        at: Date.now(),
        price: activeJob.price,
        pay: activeJob.pay || 'cash',
        from: activeJob.from,
        to: activeJob.to,
        km: activeJob.km,
        passengerName: activeJob.passengerName,
      },
      ...t,
    ]);
    setEarnings((e) => e + activeJob.price);
    setDoneTrips((t) => t + 1);
    setActiveJob(null);
    if (linked) setPStage('receipt');

    // keep the driver tab supplied with work
    later(() => setRequests((rs) => [...rs, makeSimRequest()]), 3000);
  };

  const logout = () => {
    setProfileOpen(false);
    setPhase('login');
  };

  /* ------------------------------------------------------------------ render */
  if (!fontsLoaded && !fontError) return null;

  if (phase !== 'app') {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor={phase === 'splash' ? C.lime : C.bg} />
        {/* the splash gradient runs edge to edge; its own 90px top pad clears
            the notch, so it opts out of safe-area insets */}
        <SafeAreaView
          style={{ flex: 1, backgroundColor: phase === 'splash' ? C.limeDeep : C.bg }}
          edges={phase === 'splash' ? [] : ['top', 'bottom']}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {phase === 'splash' && <SplashScreenView onStart={() => setPhase('login')} />}
            {phase === 'login' && (
              <LoginScreen
                onSend={(p) => {
                  setPhone(p);
                  setPhase('otp');
                }}
              />
            )}
            {phase === 'otp' && (
              <OtpScreen phone={phone} onBack={() => setPhase('login')} onVerify={() => setPhase('app')} />
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const openRequests = requests.filter((r) => r.state === 'open').length;

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* header + role tabs */}
          <View style={s.header}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={s.brand}>{BRAND.name}</Text>
              <Text style={s.brandSub}>ຕັ້ງລາຄາເອງ · ຕໍ່ລອງໄດ້</Text>
            </View>

            <View style={s.tabs}>
              <Pressable
                onPress={() => setTab('passenger')}
                style={[s.tab, tab === 'passenger' && s.tabOn]}>
                <Text style={[s.tabText, tab === 'passenger' && s.tabTextOn]}>ຜູ້ໂດຍສານ</Text>
              </Pressable>
              <Pressable onPress={() => setTab('driver')} style={[s.tab, tab === 'driver' && s.tabOn]}>
                <Text style={[s.tabText, tab === 'driver' && s.tabTextOn]}>ຄົນຂັບ</Text>
                {openRequests > 0 && (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{openRequests}</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>

          {tab === 'passenger' ? (
            <PassengerScreen
              stage={pStage}
              ride={ride}
              bids={bids}
              accepted={accepted}
              tripStep={tripStep}
              rating={rating}
              tip={tip}
              tags={tags}
              pay={pay}
              myPlace={myPlace}
              locStatus={locStatus}
              recents={recents}
              mapLayer={mapLayer}
              onMapLayer={setMapLayer}
              onRefreshLocation={refreshLocation}
              onPay={setPay}
              onSubmit={submitRide}
              onAcceptBid={acceptBid}
              onDeclineBid={declineBid}
              onCancelRequest={cancelRequest}
              onCancelTrip={cancelTrip}
              onRate={setRating}
              onTip={setTip}
              onToggleTag={toggleTag}
              onReset={resetPassenger}
              onOpenProfile={() => setProfileOpen(true)}
            />
          ) : (
            <DriverScreen
              online={online}
              earnings={earnings}
              trips={doneTrips}
              requests={requests}
              activeJob={activeJob}
              driverLoc={myPlace || recents[0] || null}
              driverTrips={driverTrips}
              mapLayer={mapLayer}
              onMapLayer={setMapLayer}
              onToggleOnline={() => setOnline((o) => !o)}
              onAcceptPrice={(r) => placeBid(r, r.price)}
              onCounter={placeBid}
              onSkip={skipRequest}
              onJobStep={jobStep}
              onLogout={logout}
            />
          )}

          <ProfileScreen
            visible={profileOpen}
            who={{ ...ME_RIDER, phone: phone || ME_RIDER.phone }}
            trips={myTrips}
            pay={pay}
            onClose={() => setProfileOpen(false)}
            onLogout={logout}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

/* =============================================================================
   11. STYLES

   `theme()` resolves every fontWeight to a real Noto Sans Lao Looped file.
   Space Grotesk is applied per-element with grotesk() / <Kip>, never here —
   almost every label in this app mixes Lao with its numbers.
   ========================================================================== */

const s = theme({
  /* ---------------------------------------------------------- app header */
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    backgroundColor: C.bg,
  },
  brand: { color: C.text, fontSize: 21, lineHeight: 32, fontWeight: '700' },
  brandSub: { color: C.faint, fontSize: 12, lineHeight: 20, marginLeft: 10 },

  tabs: {
    flexDirection: 'row',
    backgroundColor: C.card2,
    borderRadius: R.input,
    padding: 4,
    marginTop: 12,
    borderWidth: 1,
    borderColor: C.line,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: R.xs,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  tabOn: { backgroundColor: C.lime },
  tabText: { color: C.sub, fontSize: 14, lineHeight: 22, fontWeight: '600' },
  tabTextOn: { color: C.ink, fontWeight: '700' },
  badge: {
    marginLeft: 7,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { color: C.lime, fontSize: 11, lineHeight: 16, fontWeight: '700' },

  /* ---------------------------------------------------------- onboarding */
  splash: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingTop: 90,
    paddingBottom: 40,
  },
  splashMark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashMarkText: { color: C.lime, fontSize: 30, lineHeight: 42, fontWeight: '700' },
  splashName: { color: C.ink, fontSize: 46, lineHeight: 66, fontWeight: '800', marginTop: 18 },
  splashLatin: { color: 'rgba(23,36,10,0.55)', fontSize: 17, lineHeight: 26, fontWeight: '600', letterSpacing: 2 },
  splashTag: { color: C.ink, fontSize: 22, lineHeight: 34, fontWeight: '600', marginTop: 18 },
  splashTagEn: { color: 'rgba(23,36,10,0.62)', fontSize: 14, lineHeight: 22, marginTop: 4 },

  pageDot: { width: 8, height: 5, borderRadius: 3, backgroundColor: 'rgba(23,36,10,0.25)' },
  pageDotOn: { width: 24, backgroundColor: C.ink },

  splashCta: {
    backgroundColor: C.ink,
    borderRadius: R.btn,
    paddingVertical: 18,
    alignItems: 'center',
  },
  splashCtaText: { color: C.lime, fontSize: 16, lineHeight: 25, fontWeight: '600' },

  authScreen: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 28, paddingTop: 48 },
  authTitle: { color: C.text, fontSize: 30, lineHeight: 44, fontWeight: '700' },
  authSub: { color: C.sub, fontSize: 14, lineHeight: 22, marginTop: 6 },
  authHint: { color: C.accentText, fontSize: 12.5, lineHeight: 21, marginTop: 18, textAlign: 'center' },
  authTerms: {
    color: C.faint,
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 'auto',
    paddingBottom: 20,
    paddingHorizontal: 12,
  },
  dialCode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.input,
    paddingHorizontal: 14,
  },
  dialCodeText: { color: C.text, fontSize: 16, lineHeight: 25, fontWeight: '600' },
  authInput: {
    flex: 1,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.lime,
    borderRadius: R.input,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: C.text,
    fontSize: 17,
    lineHeight: 24,
  },

  otpRow: { flexDirection: 'row', gap: 10, marginTop: 32, justifyContent: 'center' },
  otpBox: {
    width: 48,
    height: 58,
    borderRadius: R.input,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxOn: { borderColor: C.lime, borderWidth: 2, backgroundColor: C.limeWash },
  otpDigit: { color: C.text, fontSize: 24, lineHeight: 34, fontWeight: '700' },
  otpInput: { position: 'absolute', opacity: 0, width: '100%', height: '100%' },

  /* ---------------------------------------------------- shared primitives */
  dotFrom: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.green },
  dotTo: { width: 10, height: 10, borderRadius: 2, backgroundColor: C.lime },
  connector: { flex: 1, width: 1.5, backgroundColor: C.line, marginVertical: 4 },
  routeName: { color: C.text, fontSize: 15, lineHeight: 23, fontWeight: '500' },
  routeSub: { color: C.sub, fontSize: 12, lineHeight: 19 },
  routeKm: { color: C.text, fontSize: 17, lineHeight: 26, fontWeight: '700' },
  routeKmUnit: { color: C.sub, fontSize: 11, lineHeight: 18 },

  hair: { height: 1, backgroundColor: C.line, marginVertical: 12 },
  chev: { color: C.faint, fontSize: 18, lineHeight: 24, marginLeft: 8 },
  sectionLabel: { color: C.sub, fontSize: 14, lineHeight: 22, fontWeight: '600', marginTop: 22, marginBottom: 10 },
  emptyText: { color: C.faint, fontSize: 13, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  warn: { color: C.red, fontSize: 12, lineHeight: 20, marginTop: 8, textAlign: 'center' },
  mineTag: { color: C.accentText, fontSize: 11, lineHeight: 18, marginTop: 2, fontWeight: '600' },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSm: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backCircleText: { color: C.text, fontSize: 17, lineHeight: 24 },

  chip: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  chipOn: { borderColor: C.lime, backgroundColor: C.limeWash },
  chipText: { color: C.sub, fontSize: 13, lineHeight: 20, fontWeight: '500' },
  chipTextOn: { color: C.text, fontWeight: '600' },

  payTile: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.input,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payTileSm: { paddingVertical: 11, borderRadius: R.sm },
  payTileOn: { borderColor: C.lime },
  payText: { color: C.sub, fontSize: 14, lineHeight: 22, fontWeight: '500' },
  payTextSm: { fontSize: 13, lineHeight: 20, fontWeight: '500' },
  payTextOn: { color: C.text, fontWeight: '600' },

  track: { height: 4, borderRadius: 2, backgroundColor: C.card2, overflow: 'hidden' },
  trackFill: { height: 4, borderRadius: 2, backgroundColor: C.lime },

  btn: {
    borderRadius: R.btn,
    borderWidth: 1,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSmall: { paddingVertical: 11, paddingHorizontal: 12, borderRadius: R.sm },
  btnText: { fontSize: 16, lineHeight: 25, fontWeight: '700' },
  // Modifier styles must restate fontWeight: theme() resolves weight to a font
  // FILE, so a rule that sets only fontSize would reset the family to Regular.
  btnTextSmall: { fontSize: 13, lineHeight: 20, fontWeight: '700' },

  listCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.card,
    marginTop: 16,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: C.hair,
  },
  listLabel: { color: C.text, fontSize: 15, lineHeight: 23, flex: 1, marginLeft: 10 },
  listValue: { color: C.sub, fontSize: 12.5, lineHeight: 20 },

  /* ------------------------------------------------------ search (04) */
  searchScreen: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 20 },
  searchHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  searchHeadTitle: { color: C.text, fontSize: 19, lineHeight: 29, fontWeight: '600' },

  fromToCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.card,
    padding: 16,
    marginTop: 2,
  },
  fromToRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 34 },
  fromToHair: { height: 1, backgroundColor: C.hair, marginLeft: 22, marginVertical: 10 },
  fromToText: { color: C.sub, fontSize: 15, lineHeight: 23, flex: 1 },
  fromToInput: {
    flex: 1,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.lime,
    borderRadius: R.xs,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: C.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 14 },

  resultCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.card,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.hair,
  },
  resultIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultName: { color: C.text, fontSize: 15, lineHeight: 23, fontWeight: '600' },
  resultSub: { color: C.sub, fontSize: 12, lineHeight: 19 },
  mark: { color: C.accentText, backgroundColor: C.limeSoft },

  /* ------------------------------------------ home map + top bar (03) */
  calloutWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    // lift clear of the marker, which sits at the centre of the map view
    paddingBottom: 128,
  },
  callout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.ink,
    borderRadius: R.sm,
    paddingVertical: 11,
    paddingHorizontal: 16,
    maxWidth: '80%',
    shadowColor: '#101828',
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  calloutLabel: { color: '#9AA79B', fontSize: 11, lineHeight: 17 },
  calloutName: { color: '#FFFFFF', fontSize: 14, lineHeight: 22, fontWeight: '600' },
  calloutChev: { color: C.lime, fontSize: 16, lineHeight: 22, marginLeft: 12 },
  calloutTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: C.ink,
  },

  topBar: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 12,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#101828',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  iconBtnText: { color: C.text, fontSize: 17, lineHeight: 24 },
  searchPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
    shadowColor: '#101828',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  searchPin: { fontSize: 13, marginRight: 8 },
  searchPillText: { color: C.sub, fontSize: 14, lineHeight: 22, flex: 1 },

  /* -------------------------------------------------------- bottom sheet */
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: R.sheet,
    borderTopRightRadius: R.sheet,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    maxHeight: '70%',
    shadowColor: '#101828',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -8 },
    elevation: 14,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D6DBE1',
    marginBottom: 14,
  },
  sheetTitle: { color: C.text, fontSize: 19, lineHeight: 29, fontWeight: '600' },

  /* ---- service tiles ---- */
  tileRow: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.input,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 3,
  },
  tileOn: { backgroundColor: C.lime, borderColor: C.lime },
  tileIcon: { fontSize: 21, lineHeight: 28 },
  tileLabel: { color: C.text, fontSize: 13, lineHeight: 20, fontWeight: '600' },
  tileSub: { color: C.sub, fontSize: 10, lineHeight: 15 },

  schedRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  schedNote: { color: C.accentText, fontSize: 12.5, lineHeight: 21, marginTop: 10, fontWeight: '600', textAlign: 'center' },

  /* ---- where to + saved ---- */
  whereTo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.btn,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginTop: 16,
  },
  whereToIcon: { fontSize: 14, marginRight: 12 },
  whereToText: { color: C.sub, fontSize: 17, lineHeight: 26, fontWeight: '600' },

  savedRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, marginTop: 2 },
  savedIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedName: { color: C.text, fontSize: 15, lineHeight: 23, fontWeight: '500' },
  savedSub: { color: C.sub, fontSize: 12, lineHeight: 19 },

  /* ---- fare step (05) ---- */
  routeCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.card,
    padding: 18,
    marginTop: 16,
  },
  fareCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.card,
    paddingVertical: 22,
    paddingHorizontal: 18,
    marginTop: 12,
    alignItems: 'center',
  },
  fareLabel: { color: C.sub, fontSize: 13, lineHeight: 21 },
  fareRow: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 10 },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: C.accentText, fontSize: 24, lineHeight: 30, fontWeight: '600' },
  fareValueWrap: { flexDirection: 'row', alignItems: 'baseline', minWidth: 150, justifyContent: 'center' },
  fareValue: {
    color: C.accentText,
    fontSize: 38,
    lineHeight: 50,
    fontWeight: '700',
    padding: 0,
    textAlign: 'center',
    minWidth: 118,
  },
  fareUnit: { color: C.accentText, fontSize: 24, lineHeight: 34, fontWeight: '700', marginLeft: 6 },
  fareHint: { color: C.green, fontSize: 13, lineHeight: 21, marginTop: 10 },
  fareWarn: { color: C.red, fontSize: 13, lineHeight: 21, marginTop: 10, fontWeight: '600' },

  noteRow: {
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.input,
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginTop: 12,
  },
  noteRowText: { color: C.sub, fontSize: 14, lineHeight: 22 },
  noteInput: {
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.lime,
    borderRadius: R.input,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 12,
    color: C.text,
    fontSize: 14,
    lineHeight: 22,
    minHeight: 62,
    textAlignVertical: 'top',
  },

  /* ---- waiting for bids (06) ---- */
  closeCircle: {
    position: 'absolute',
    top: 12,
    left: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#101828',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  closeCircleText: { color: C.red, fontSize: 18, lineHeight: 24, fontWeight: '600' },

  searchCard: {
    position: 'absolute',
    top: 12,
    right: 20,
    left: 80,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 18,
    shadowColor: '#101828',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  searchTitle: { color: C.text, fontSize: 13, lineHeight: 21, fontWeight: '600' },
  searchSub: { color: C.sub, fontSize: 11, lineHeight: 18 },

  bidCard: {
    backgroundColor: C.card,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    marginBottom: 10,
  },
  bidCardBest: { borderColor: C.lime },
  bidName: { color: C.text, fontSize: 15, lineHeight: 23, fontWeight: '600' },
  bidMeta: { color: C.sub, fontSize: 12, lineHeight: 19 },
  bidPrice: { color: C.accentText, fontSize: 18, lineHeight: 27, fontWeight: '700' },
  bidPriceUnit: { fontSize: 14, fontWeight: '700' },
  bidEta: { color: C.sub, fontSize: 12, lineHeight: 19 },

  declineBtn: {
    flex: 1,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  declineText: { color: C.sub, fontSize: 14, lineHeight: 22 },
  acceptWide: {
    flex: 2,
    backgroundColor: C.lime,
    borderRadius: R.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  acceptWideText: { color: C.ink, fontSize: 14, lineHeight: 22, fontWeight: '700' },

  /* ---- trip (07 / 08) ---- */
  statusCard: {
    position: 'absolute',
    top: 12,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.btn,
    paddingVertical: 14,
    paddingHorizontal: 18,
    shadowColor: '#101828',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  statusLo: { color: C.text, fontSize: 15, lineHeight: 23, fontWeight: '600' },
  statusEn: { color: C.sub, fontSize: 12, lineHeight: 19 },
  etaPill: {
    backgroundColor: C.lime,
    borderRadius: R.xs,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 10,
  },
  etaPillText: { color: C.ink, fontSize: 14, lineHeight: 22, fontWeight: '700' },

  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.btn,
    padding: 16,
  },
  vehicleIcon: {
    width: 72,
    height: 52,
    borderRadius: R.sm,
    backgroundColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleModel: { color: C.text, fontSize: 16, lineHeight: 25, fontWeight: '600' },
  vehicleColor: { color: C.sub, fontSize: 13, lineHeight: 20 },
  plateBadge: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.lime,
    borderRadius: R.xs,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  plateText: { color: C.accentText, fontSize: 17, lineHeight: 25, fontWeight: '700', letterSpacing: 1.2 },

  driverRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  driverName: { color: C.text, fontSize: 16, lineHeight: 25, fontWeight: '600' },
  driverMeta: { color: C.sub, fontSize: 13, lineHeight: 20 },

  footRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  footLeft: { color: C.sub, fontSize: 13, lineHeight: 21, flex: 1, marginRight: 10 },
  footStrong: { color: C.text, fontWeight: '600' },
  footRight: { color: C.text, fontSize: 13, lineHeight: 21, fontWeight: '600' },
  cancelLink: { color: C.red, fontSize: 14, lineHeight: 22 },

  /* ---- pay & rate (09) ---- */
  payScreen: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 48, alignItems: 'center' },
  doneBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(61,190,123,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBadgeText: { color: C.green, fontSize: 32, lineHeight: 44, fontWeight: '700' },
  payTitle: { color: C.text, fontSize: 24, lineHeight: 36, fontWeight: '700', marginTop: 16 },
  paySub: { color: C.sub, fontSize: 14, lineHeight: 22, marginTop: 2 },

  payCard: {
    alignSelf: 'stretch',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.card,
    padding: 18,
    marginTop: 18,
    gap: 10,
  },
  payLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  payLineLabel: { color: C.sub, fontSize: 14, lineHeight: 22 },
  payLineValue: { color: C.text, fontSize: 14, lineHeight: 22 },
  payTotalLabel: { color: C.text, fontSize: 17, lineHeight: 26, fontWeight: '700' },
  payTotal: { color: C.accentText, fontSize: 19, lineHeight: 28, fontWeight: '700' },
  payTotalUnit: { fontSize: 15, fontWeight: '700' },

  /* ------------------------------------------------ profile + history (14) */
  profilePad: { paddingHorizontal: 20, paddingBottom: 40 },
  profileHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  profileRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: { color: C.text, fontSize: 19, lineHeight: 29, fontWeight: '700' },
  profileMeta: { color: C.sub, fontSize: 13, lineHeight: 20, marginTop: 2 },

  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.input,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  histRoute: { color: C.text, fontSize: 14, lineHeight: 22, fontWeight: '500' },
  histWhen: { color: C.sub, fontSize: 12, lineHeight: 19 },
  histPrice: { color: C.text, fontSize: 14, lineHeight: 22, fontWeight: '600' },

  /* ------------------------------------------------- driver header (10) */
  driverH1: { color: C.text, fontSize: 19, lineHeight: 29, fontWeight: '600' },
  driverH1sub: { fontSize: 13, lineHeight: 21, marginTop: 1 },

  switchTrack: {
    width: 58,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D6DBE1',
    padding: 3,
    justifyContent: 'center',
  },
  switchTrackOn: { backgroundColor: C.green },
  switchKnob: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF' },
  switchKnobOn: { alignSelf: 'flex-end' },

  statRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  statCard: {
    flex: 1,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.input,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  statLabel: { color: C.sub, fontSize: 12, lineHeight: 19 },
  statValue: { color: C.accentText, fontSize: 16, lineHeight: 25, fontWeight: '700', marginTop: 1 },
  statUnit: { fontSize: 13, fontWeight: '700' },
  statBig: { color: C.text, fontSize: 19, lineHeight: 28, fontWeight: '700', marginTop: 1 },

  emptyDashed: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D6DBE1',
    borderRadius: R.card,
    alignItems: 'center',
    paddingVertical: 36,
    marginTop: 16,
  },

  radiusToggle: {
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card2,
    borderRadius: R.sm,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 14,
  },
  radiusToggleText: { color: C.accentText, fontSize: 12.5, lineHeight: 21, fontWeight: '600' },

  /* ---- driver request card (10) ---- */
  reqCard: {
    backgroundColor: C.card,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.line,
    padding: 18,
    marginTop: 14,
  },
  reqCardLive: { borderColor: C.lime },
  reqName: { color: C.text, fontSize: 15, lineHeight: 23, fontWeight: '600' },
  reqMeta: { color: C.sub, fontSize: 12, lineHeight: 19 },
  reqPrice: { color: C.accentText, fontSize: 20, lineHeight: 29, fontWeight: '700' },
  reqPriceUnit: { fontSize: 15, fontWeight: '700' },
  reqKm: { color: C.sub, fontSize: 12, lineHeight: 19 },
  reqStop: { color: C.text, fontSize: 13, lineHeight: 21, marginLeft: 10, flex: 1 },
  reqStateText: { color: C.sub, fontSize: 12.5, lineHeight: 21, marginTop: 12, textAlign: 'center' },
  note: {
    color: C.sub,
    fontSize: 13,
    lineHeight: 21,
    fontStyle: 'italic',
    marginTop: 12,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: C.limeSoft,
  },

  skipBtn: {
    flex: 1,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.sm,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: { color: C.sub, fontSize: 13, lineHeight: 20 },
  counterBtn: {
    flex: 1.5,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.lime,
    borderRadius: R.sm,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnText: { color: C.accentText, fontSize: 13, lineHeight: 20, fontWeight: '600' },
  acceptBtn: {
    flex: 1.5,
    backgroundColor: C.lime,
    borderRadius: R.sm,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: { color: C.ink, fontSize: 13, lineHeight: 20, fontWeight: '700' },

  stepSquare: {
    width: 42,
    height: 42,
    borderRadius: R.sm,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepSquareText: { color: C.accentText, fontSize: 20, lineHeight: 26, fontWeight: '600' },
  counterAmount: { color: C.text, fontSize: 17, lineHeight: 26, fontWeight: '700' },
  counterAmountUnit: { fontSize: 13, fontWeight: '700' },
  sendBtn: { backgroundColor: C.lime, borderRadius: R.sm, paddingHorizontal: 18, paddingVertical: 12 },
  sendBtnText: { color: C.ink, fontSize: 14, lineHeight: 22, fontWeight: '700' },

  /* ---- driver nav banner (11 / 12) ---- */
  navBanner: {
    position: 'absolute',
    top: 12,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.ink,
    borderRadius: R.btn,
    paddingVertical: 14,
    paddingHorizontal: 18,
    shadowColor: '#101828',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  navArrow: { color: C.lime, fontSize: 24, lineHeight: 30 },
  navLo: { color: '#FFFFFF', fontSize: 17, lineHeight: 26, fontWeight: '700' },
  navEn: { color: '#C9D6BE', fontSize: 12, lineHeight: 19 },
  navMin: { color: C.lime, fontSize: 16, lineHeight: 25, fontWeight: '700' },
  navKm: { color: '#C9D6BE', fontSize: 12, lineHeight: 19 },

  bigCta: {
    backgroundColor: C.lime,
    borderRadius: R.btn,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  bigCtaText: { color: C.ink, fontSize: 16, lineHeight: 25, fontWeight: '700' },
  sosBtn: {
    flex: 1,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.input,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosText: { color: C.sub, fontSize: 14, lineHeight: 22 },

  onTripLabel: { color: C.sub, fontSize: 13, lineHeight: 20 },
  onTripDest: { color: C.text, fontSize: 16, lineHeight: 25, fontWeight: '600' },
  etaSoftPill: { backgroundColor: C.limeSoft, borderRadius: R.xs, paddingHorizontal: 12, paddingVertical: 6 },
  etaSoftText: { color: C.accentText, fontSize: 13, lineHeight: 20, fontWeight: '700' },
  onboardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.input,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 14,
  },
  onboardName: { color: C.text, fontSize: 14, lineHeight: 22, fontWeight: '500', flex: 1, marginLeft: 12 },
  onboardFare: { color: C.accentText, fontSize: 14, lineHeight: 22, fontWeight: '700' },

  /* ---- driver earnings (13) ---- */
  earnHero: { borderRadius: 20, padding: 22, marginTop: 20 },
  earnHeroLabel: { color: 'rgba(23,36,10,0.75)', fontSize: 13, lineHeight: 21, fontWeight: '600' },
  earnHeroValue: { color: C.ink, fontSize: 34, lineHeight: 48, fontWeight: '700' },
  earnHeroUnit: { fontSize: 24, fontWeight: '700' },
  earnHeroDelta: { color: C.ink, fontSize: 13, lineHeight: 21, fontWeight: '600' },

  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: 132,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.card,
    padding: 18,
    marginTop: 16,
  },
  chartCol: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: 6 },
  bar: { width: '100%', backgroundColor: '#D6DBE1', borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  barLabel: { color: C.sub, fontSize: 10, lineHeight: 15 },

  earnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.input,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  earnRoute: { color: C.text, fontSize: 14, lineHeight: 22, fontWeight: '500' },
  earnWhen: { color: C.sub, fontSize: 12, lineHeight: 19 },
  earnPlus: { color: C.green, fontSize: 15, lineHeight: 23, fontWeight: '700' },

  /* ---- driver bottom tabs ---- */
  driverTabs: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 9,
    paddingBottom: 10,
  },
  driverTab: { flex: 1, alignItems: 'center', gap: 3 },
  driverTabText: { color: C.faint, fontSize: 11, lineHeight: 17 },
  driverTabTextOn: { color: C.accentText, fontWeight: '700' },
});

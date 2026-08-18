/* =============================================================================
   ໄປນຳກັນ (Pai Nam Kan) — inDriver-style ride bidding demo
   Vientiane, Lao PDR.  Single-file Expo app, mock data only.
   No backend, no API calls, no persistence.

   SECTIONS
     1. THEME
     2. MOCK DATA        — places, vehicles, people
     3. UTILS            — haversine, fare, formatting, random
     4. UI PRIMITIVES    — Chip, Btn, Stars, RouteLine
     5. PLACE PICKER     — searchable modal
     6. PASSENGER SCREEN — booking -> waiting -> trip -> receipt
     7. DRIVER SCREEN    — open requests, bidding, active job
     8. APP              — owns ALL shared state + every timer
     9. STYLES
   ========================================================================== */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Modal,
  SafeAreaView,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  StyleSheet,
} from 'react-native';

/* =============================================================================
   1. THEME
   ========================================================================== */

const C = {
  bg: '#12100E',       // warm near-black
  card: '#1B1815',
  card2: '#231F1A',
  line: '#2F2822',
  gold: '#E8B04B',     // Lao temple gilding — the single accent
  goldSoft: '#4A3A1B',
  teal: '#3FA796',     // secondary actions
  red: '#D96A5B',      // destructive
  green: '#5FBF8C',    // "cheaper than your offer"
  text: '#F3EDE4',
  sub: '#A0968B',
  faint: '#6C645B',
};

const R = 14; // card radius

/* =============================================================================
   2. MOCK DATA
   ========================================================================== */

// 12 real places in Vientiane with real coordinates
const PLACES = [
  { id: 'p1',  name: 'ຕະຫຼາດເຊົ້າ',                 district: 'ເມືອງຈັນທະບູລີ',  alias: 'talat sao morning market', lat: 17.9668, lng: 102.6135 },
  { id: 'p2',  name: 'ປະຕູໄຊ',                      district: 'ເມືອງຈັນທະບູລີ',  alias: 'patuxai victory gate',     lat: 17.9757, lng: 102.6167 },
  { id: 'p3',  name: 'ພະທາດຫຼວງ',                   district: 'ເມືອງໄຊເສດຖາ',   alias: 'pha that luang stupa',     lat: 17.9757, lng: 102.6335 },
  { id: 'p4',  name: 'ສະໜາມບິນສາກົນວັດໄຕ',          district: 'ເມືອງສີໂຄດຕະບອງ', alias: 'wattay airport',           lat: 17.9884, lng: 102.5633 },
  { id: 'p5',  name: 'ມະຫາວິທະຍາໄລແຫ່ງຊາດ ດົງໂດກ',  district: 'ເມືອງໄຊທານີ',    alias: 'nuol dongdok university',  lat: 18.0575, lng: 102.5442 },
  { id: 'p6',  name: 'ໂຮງໝໍມະໂຫສົດ',                district: 'ເມືອງສີສັດຕະນາກ', alias: 'mahosot hospital',         lat: 17.9583, lng: 102.6083 },
  { id: 'p7',  name: 'ຕະຫຼາດຂົວດິນ',                 district: 'ເມືອງຈັນທະບູລີ',  alias: 'khua din market',          lat: 17.9679, lng: 102.6161 },
  { id: 'p8',  name: 'ວັດສີເມືອງ',                   district: 'ເມືອງສີສັດຕະນາກ', alias: 'wat si muang temple',      lat: 17.9600, lng: 102.6183 },
  { id: 'p9',  name: 'ສວນສາທາລະນະເຈົ້າອະນຸວົງ',      district: 'ເມືອງຈັນທະບູລີ',  alias: 'chao anouvong park',       lat: 17.9611, lng: 102.6053 },
  { id: 'p10', name: 'ສູນການຄ້າ ໄອເຕັກ (ITECC)',     district: 'ເມືອງໄຊເສດຖາ',   alias: 'itecc mall',               lat: 17.9853, lng: 102.6469 },
  { id: 'p11', name: 'ສະຖານີລົດໄຟວຽງຈັນ',            district: 'ເມືອງໄຊທານີ',    alias: 'vientiane railway station',lat: 18.0930, lng: 102.5560 },
  { id: 'p12', name: 'ຕະຫຼາດທົ່ງຂັນຄຳ',              district: 'ເມືອງຈັນທະບູລີ',  alias: 'thong khan kham market',   lat: 17.9760, lng: 102.6060 },
];

// base fare + per-km rate in kip
const VEHICLES = [
  { id: 'moto', label: 'ລົດຈັກ', icon: '🛵', base: 5000,  perKm: 2000, min: 8000  },
  { id: 'car',  label: 'ລົດເກັງ', icon: '🚗', base: 8000,  perKm: 3500, min: 15000 },
  { id: 'van',  label: 'ລົດຕູ້',  icon: '🚐', base: 15000, perKm: 5000, min: 25000 },
];

const DRIVER_NAMES = [
  'ທ້າວ ສົມສັກ ພົມມະຈັນ',
  'ທ້າວ ບຸນມີ ໄຊຍະສານ',
  'ນາງ ຄຳຫຼ້າ ວົງໄຊ',
  'ທ້າວ ວິໄລ ສຸລິຍະວົງ',
  'ທ້າວ ອຳພອນ ແກ້ວມະນີ',
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

/* =============================================================================
   3. UTILS
   ========================================================================== */

const rnd = (min, max) => min + Math.random() * (max - min);
const rndInt = (min, max) => Math.floor(rnd(min, max + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const roundTo = (n, step) => Math.round(n / step) * step;

let _seq = 0;
const uid = (p) => `${p}_${++_seq}`;

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

const fmtKip = (n) =>
  `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')} ກີບ`;

const fmtNum = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const fmtKm = (km) => `${km.toFixed(1)} ກມ`;

const vehicleById = (id) => VEHICLES.find((v) => v.id === id) || VEHICLES[1];

/* =============================================================================
   4. UI PRIMITIVES
   ========================================================================== */

function Chip({ label, sub, icon, active, onPress, style }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.chip,
        active && s.chipActive,
        pressed && { opacity: 0.75 },
        style,
      ]}>
      {!!icon && <Text style={s.chipIcon}>{icon}</Text>}
      <Text style={[s.chipLabel, active && s.chipLabelActive]}>{label}</Text>
      {!!sub && <Text style={[s.chipSub, active && { color: C.gold }]}>{sub}</Text>}
    </Pressable>
  );
}

function Btn({ title, onPress, variant = 'primary', disabled, small, style }) {
  const v = {
    primary: { bg: C.gold, fg: '#1A1409', border: C.gold },
    teal: { bg: 'transparent', fg: C.teal, border: C.teal },
    ghost: { bg: 'transparent', fg: C.sub, border: C.line },
    danger: { bg: 'transparent', fg: C.red, border: '#4A2C27' },
    solidTeal: { bg: C.teal, fg: '#08201C', border: C.teal },
  }[variant];

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        s.btn,
        small && s.btnSmall,
        { backgroundColor: v.bg, borderColor: v.border },
        disabled && { opacity: 0.35 },
        pressed && !disabled && { opacity: 0.7 },
        style,
      ]}>
      <Text style={[s.btnText, small && s.btnTextSmall, { color: v.fg }]}>{title}</Text>
    </Pressable>
  );
}

function Stars({ value, size = 13, onChange }) {
  const items = [1, 2, 3, 4, 5];
  if (!onChange) {
    return (
      <Text style={{ color: C.gold, fontSize: size, lineHeight: size * 1.5 }}>
        {'★'.repeat(Math.round(value))}
        <Text style={{ color: C.faint }}>{'★'.repeat(5 - Math.round(value))}</Text>
        <Text style={{ color: C.sub }}>{`  ${value.toFixed(1)}`}</Text>
      </Text>
    );
  }
  return (
    <View style={{ flexDirection: 'row' }}>
      {items.map((i) => (
        <Pressable key={i} onPress={() => onChange(i)} hitSlop={6} style={{ paddingHorizontal: 4 }}>
          <Text style={{ fontSize: size, lineHeight: size * 1.4, color: i <= value ? C.gold : C.faint }}>
            ★
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// origin dot -> vertical connector -> destination dot
function RouteLine({ from, to, compact }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ width: 14, alignItems: 'center', paddingTop: compact ? 6 : 7 }}>
        <View style={[s.dot, { backgroundColor: C.teal }]} />
        <View style={s.connector} />
        <View style={[s.dot, { backgroundColor: C.gold }]} />
        <View style={{ height: compact ? 5 : 6 }} />
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={[s.routeName, compact && { fontSize: 14 }]} numberOfLines={1}>
          {from.name}
        </Text>
        <Text style={s.routeSub} numberOfLines={1}>{from.district}</Text>
        <View style={{ height: compact ? 8 : 12 }} />
        <Text style={[s.routeName, compact && { fontSize: 14 }]} numberOfLines={1}>
          {to.name}
        </Text>
        <Text style={s.routeSub} numberOfLines={1}>{to.district}</Text>
      </View>
    </View>
  );
}

/* =============================================================================
   5. PLACE PICKER — searchable modal list
   ========================================================================== */

function PlacePicker({ visible, title, excludeId, onPick, onClose }) {
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return PLACES.filter((p) => {
      if (p.id === excludeId) return false;
      if (!needle) return true;
      return (
        p.name.toLowerCase().includes(needle) ||
        p.district.toLowerCase().includes(needle) ||
        p.alias.includes(needle)
      );
    });
  }, [q, excludeId]);

  const close = () => {
    setQ('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={s.modalBackdrop}>
        <View style={s.modalSheet}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>{title}</Text>
            <Pressable onPress={close} hitSlop={10}>
              <Text style={s.modalClose}>✕</Text>
            </Pressable>
          </View>

          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="ຄົ້ນຫາສະຖານທີ່ ຫຼື ເມືອງ..."
            placeholderTextColor={C.faint}
            style={s.search}
          />

          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 420 }}>
            {list.length === 0 && (
              <Text style={s.emptyText}>ບໍ່ພົບສະຖານທີ່ທີ່ຄົ້ນຫາ</Text>
            )}
            {list.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => {
                  onPick(p);
                  setQ('');
                }}
                style={({ pressed }) => [s.placeRow, pressed && { backgroundColor: C.card2 }]}>
                <View style={[s.dot, { backgroundColor: C.gold, marginTop: 7 }]} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.placeName}>{p.name}</Text>
                  <Text style={s.placeDistrict}>{p.district}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* =============================================================================
   6. PASSENGER SCREEN
   ========================================================================== */

function PassengerScreen({
  stage,
  ride,
  bids,
  accepted,
  tripStep,
  rating,
  onSubmit,
  onAcceptBid,
  onDeclineBid,
  onCancelRequest,
  onCancelTrip,
  onRate,
  onReset,
}) {
  /* ---------------------------------------------------- booking form state */
  const [from, setFrom] = useState(PLACES[0]);
  const [to, setTo] = useState(PLACES[2]);
  const [vehicleId, setVehicleId] = useState('car');
  const [note, setNote] = useState('');
  const [price, setPrice] = useState(null);      // null = follow the suggestion
  const [picker, setPicker] = useState(null);    // 'from' | 'to' | null

  const vehicle = vehicleById(vehicleId);
  const km = from && to ? roadDistance(from, to) : 0;
  const suggested = from && to ? suggestFare(km, vehicle) : 0;
  const offer = price == null ? suggested : price;

  // re-suggest whenever the route or vehicle changes, unless the user typed a price
  const touched = price != null;
  const bump = (delta) => setPrice(Math.max(1000, roundTo(offer + delta, 500)));

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const canSubmit = from && to && from.id !== to.id && offer >= 1000;

  /* ------------------------------------------------------------- 1. BOOKING */
  if (stage === 'booking') {
    return (
      <ScrollView
        style={s.screen}
        contentContainerStyle={s.screenPad}
        keyboardShouldPersistTaps="handled">
        <Text style={s.h1}>ຈະໄປໃສ?</Text>
        <Text style={s.h1sub}>ຕັ້ງລາຄາຂອງທ່ານເອງ ແລ້ວໃຫ້ຄົນຂັບຕໍ່ລອງ</Text>

        {/* --- route --- */}
        <View style={s.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Pressable onPress={() => setPicker('from')} style={s.pickRow}>
                <View style={[s.dot, { backgroundColor: C.teal }]} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={s.pickLabel}>ຈຸດຮັບ</Text>
                  <Text style={s.pickValue} numberOfLines={1}>{from.name}</Text>
                </View>
              </Pressable>

              <View style={s.hair} />

              <Pressable onPress={() => setPicker('to')} style={s.pickRow}>
                <View style={[s.dot, { backgroundColor: C.gold }]} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={s.pickLabel}>ຈຸດສົ່ງ</Text>
                  <Text style={s.pickValue} numberOfLines={1}>{to.name}</Text>
                </View>
              </Pressable>
            </View>

            <Pressable onPress={swap} style={s.swapBtn} hitSlop={8}>
              <Text style={s.swapIcon}>⇅</Text>
            </Pressable>
          </View>

          <View style={s.metaRow}>
            <Text style={s.metaLabel}>ໄລຍະທາງໂດຍປະມານ</Text>
            <Text style={s.metaValue}>{fmtKm(km)}</Text>
          </View>
        </View>

        {/* --- vehicle --- */}
        <Text style={s.section}>ປະເພດລົດ</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {VEHICLES.map((v) => (
            <Chip
              key={v.id}
              icon={v.icon}
              label={v.label}
              sub={fmtNum(suggestFare(km, v))}
              active={v.id === vehicleId}
              onPress={() => {
                setVehicleId(v.id);
                setPrice(null);
              }}
              style={{ flex: 1 }}
            />
          ))}
        </View>

        {/* --- price --- */}
        <Text style={s.section}>ລາຄາທີ່ທ່ານສະເໜີ</Text>
        <View style={s.card}>
          <View style={s.priceInputRow}>
            <TextInput
              value={String(offer)}
              onChangeText={(t) => {
                const digits = t.replace(/[^0-9]/g, '');
                setPrice(digits === '' ? 0 : parseInt(digits, 10));
              }}
              keyboardType="number-pad"
              style={s.priceInput}
              selectTextOnFocus
            />
            <Text style={s.priceUnit}>ກີບ</Text>
          </View>

          <Text style={s.priceHint}>
            {touched && offer !== suggested
              ? `ລາຄາແນະນຳ ${fmtKip(suggested)}`
              : `ລາຄາແນະນຳສຳລັບ${vehicle.label}`}
          </Text>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Btn small variant="ghost" title="−5,000" onPress={() => bump(-5000)} style={{ flex: 1 }} />
            <Btn small variant="ghost" title="−1,000" onPress={() => bump(-1000)} style={{ flex: 1 }} />
            <Btn small variant="ghost" title="+1,000" onPress={() => bump(1000)} style={{ flex: 1 }} />
            <Btn small variant="ghost" title="+5,000" onPress={() => bump(5000)} style={{ flex: 1 }} />
          </View>
        </View>

        {/* --- note --- */}
        <Text style={s.section}>ໝາຍເຫດເຖິງຄົນຂັບ</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="ເຊັ່ນ: ລໍຖ້າຢູ່ປະຕູໜ້າ, ມີກະເປົ໋າ 2 ໜ່ວຍ"
          placeholderTextColor={C.faint}
          style={s.noteInput}
          multiline
        />

        <Btn
          title="ສົ່ງຄຳຂໍໄປຫາຄົນຂັບ"
          disabled={!canSubmit}
          onPress={() =>
            onSubmit({ from, to, vehicleId, price: offer, note: note.trim(), km })
          }
          style={{ marginTop: 20 }}
        />
        {!canSubmit && (
          <Text style={s.warn}>
            {from.id === to.id
              ? 'ຈຸດຮັບ ແລະ ຈຸດສົ່ງຕ້ອງບໍ່ຊ້ຳກັນ'
              : 'ລາຄາຕ້ອງບໍ່ຕ່ຳກວ່າ 1,000 ກີບ'}
          </Text>
        )}

        <PlacePicker
          visible={picker === 'from'}
          title="ເລືອກຈຸດຮັບ"
          excludeId={to?.id}
          onPick={(p) => {
            setFrom(p);
            setPrice(null);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
        <PlacePicker
          visible={picker === 'to'}
          title="ເລືອກຈຸດສົ່ງ"
          excludeId={from?.id}
          onPick={(p) => {
            setTo(p);
            setPrice(null);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      </ScrollView>
    );
  }

  /* ------------------------------------------------------------- 2. WAITING */
  if (stage === 'waiting') {
    const sorted = [...bids].sort((a, b) => a.price - b.price);
    return (
      <ScrollView style={s.screen} contentContainerStyle={s.screenPad}>
        <Text style={s.h1}>ກຳລັງລໍຖ້າຄົນຂັບ</Text>
        <Text style={s.h1sub}>
          {sorted.length === 0
            ? 'ສົ່ງຄຳຂໍໄປແລ້ວ ຄົນຂັບໃກ້ໆກຳລັງເບິ່ງຢູ່...'
            : `ມີ ${sorted.length} ຂໍ້ສະເໜີເຂົ້າມາແລ້ວ ເລືອກຄົນທີ່ທ່ານພໍໃຈ`}
        </Text>

        <View style={s.card}>
          <RouteLine from={ride.from} to={ride.to} compact />
          <View style={s.hair} />
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>ລາຄາທີ່ທ່ານສະເໜີ</Text>
            <Text style={s.priceBig}>{fmtKip(ride.price)}</Text>
          </View>
        </View>

        {sorted.length === 0 && (
          <View style={[s.card, { alignItems: 'center', paddingVertical: 28 }]}>
            <Text style={{ fontSize: 26 }}>⏳</Text>
            <Text style={[s.emptyText, { marginTop: 8 }]}>ຍັງບໍ່ມີຂໍ້ສະເໜີ</Text>
          </View>
        )}

        {sorted.map((b) => (
          <BidCard
            key={b.id}
            bid={b}
            offer={ride.price}
            onAccept={() => onAcceptBid(b)}
            onDecline={() => onDeclineBid(b)}
          />
        ))}

        <Btn
          title="ຍົກເລີກຄຳຂໍ"
          variant="danger"
          onPress={onCancelRequest}
          style={{ marginTop: 18 }}
        />
      </ScrollView>
    );
  }

  /* ---------------------------------------------------------------- 3. TRIP */
  if (stage === 'trip') {
    const steps = ['ຄົນຂັບກຳລັງມາຮັບ', 'ຄົນຂັບຮອດຈຸດຮັບແລ້ວ', 'ກຳລັງເດີນທາງ'];
    return (
      <ScrollView style={s.screen} contentContainerStyle={s.screenPad}>
        <Text style={s.h1}>{steps[tripStep]}</Text>
        <Text style={s.h1sub}>
          {tripStep === 0
            ? `ຮອດພາຍໃນ ${accepted.eta} ນາທີ`
            : tripStep === 1
            ? 'ຄົນຂັບລໍຖ້າທ່ານຢູ່ຈຸດຮັບ'
            : 'ກຳລັງໄປຫາຈຸດໝາຍ'}
        </Text>

        {/* progress */}
        <View style={s.card}>
          <View style={{ flexDirection: 'row' }}>
            {steps.map((label, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                  <View style={[s.rail, { opacity: i === 0 ? 0 : 1 }, i <= tripStep && s.railOn]} />
                  <View style={[s.stepDot, i <= tripStep && s.stepDotOn]}>
                    <Text style={[s.stepDotText, i <= tripStep && { color: '#1A1409' }]}>
                      {i + 1}
                    </Text>
                  </View>
                  <View style={[s.rail, { opacity: i === 2 ? 0 : 1 }, i < tripStep && s.railOn]} />
                </View>
                <Text style={[s.stepLabel, i <= tripStep && { color: C.text }]}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* driver */}
        <View style={s.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{accepted.name.trim().slice(-1) || '·'}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.cardName}>{accepted.name}</Text>
              <Stars value={accepted.rating} />
              <Text style={s.cardMeta}>
                {accepted.vehicle} · {accepted.plate}
              </Text>
            </View>
            <Text style={s.priceBig}>{fmtKip(accepted.price)}</Text>
          </View>

          <View style={s.hair} />
          <RouteLine from={ride.from} to={ride.to} compact />

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <Btn small variant="solidTeal" title="ໂທຫາຄົນຂັບ" onPress={() => {}} style={{ flex: 1 }} />
            <Btn small variant="teal" title="ສົ່ງຂໍ້ຄວາມ" onPress={() => {}} style={{ flex: 1 }} />
          </View>
        </View>

        <Btn
          title={tripStep >= 2 ? 'ເລີ່ມເດີນທາງແລ້ວ ຍົກເລີກບໍ່ໄດ້' : 'ຍົກເລີກການເດີນທາງ'}
          variant="danger"
          disabled={tripStep >= 2}
          onPress={onCancelTrip}
          style={{ marginTop: 10 }}
        />
      </ScrollView>
    );
  }

  /* ------------------------------------------------------------- 4. RECEIPT */
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.screenPad}>
      <Text style={s.h1}>ຮອດຈຸດໝາຍແລ້ວ</Text>
      <Text style={s.h1sub}>ຂອບໃຈທີ່ໃຊ້ບໍລິການ</Text>

      <View style={s.card}>
        <Text style={s.metaLabel}>ຄ່າໂດຍສານທັງໝົດ</Text>
        <Text style={s.priceHuge}>{fmtKip(accepted.price)}</Text>
        <View style={s.hair} />
        <RouteLine from={ride.from} to={ride.to} compact />
        <View style={s.hair} />
        <View style={s.metaRow}>
          <Text style={s.metaLabel}>ໄລຍະທາງ</Text>
          <Text style={s.metaValue}>{fmtKm(ride.km)}</Text>
        </View>
        <View style={s.metaRow}>
          <Text style={s.metaLabel}>ປະເພດລົດ</Text>
          <Text style={s.metaValue}>{vehicleById(ride.vehicleId).label}</Text>
        </View>
        <View style={s.metaRow}>
          <Text style={s.metaLabel}>ຄົນຂັບ</Text>
          <Text style={s.metaValue}>{accepted.name}</Text>
        </View>
      </View>

      <View style={[s.card, { alignItems: 'center' }]}>
        <Text style={s.cardName}>ໃຫ້ຄະແນນຄົນຂັບ</Text>
        <View style={{ marginTop: 10 }}>
          <Stars value={rating} size={30} onChange={onRate} />
        </View>
        <Text style={s.cardMeta}>
          {rating === 0 ? 'ແຕະດາວເພື່ອໃຫ້ຄະແນນ' : `ທ່ານໃຫ້ ${rating} ດາວ`}
        </Text>
      </View>

      <Btn title="ກັບໄປໜ້າຈອງລົດ" onPress={onReset} style={{ marginTop: 8 }} />
    </ScrollView>
  );
}

/* --------------------------------------------------------------- bid card */
function BidCard({ bid, offer, onAccept, onDecline }) {
  const diff = bid.price - offer;
  const cheaper = diff < 0;
  return (
    <View style={[s.card, bid.isMe && { borderColor: C.goldSoft }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{bid.name.trim().slice(-1) || '·'}</Text>
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.cardName} numberOfLines={1}>{bid.name}</Text>
          <Stars value={bid.rating} />
          <Text style={s.cardMeta}>
            {bid.vehicle} · {bid.trips} ຖ້ຽວ · ຮອດໃນ {bid.eta} ນາທີ
          </Text>
          {bid.isMe && <Text style={s.mineTag}>ຂໍ້ສະເໜີຈາກແທັບ “ຄົນຂັບ” ຂອງທ່ານ</Text>}
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.priceBig}>{fmtKip(bid.price)}</Text>
          <Text style={[s.diff, { color: diff === 0 ? C.sub : cheaper ? C.green : C.red }]}>
            {diff === 0
              ? 'ເທົ່າລາຄາທ່ານ'
              : cheaper
              ? `ຖືກກວ່າ ${fmtNum(-diff)}`
              : `ແພງກວ່າ ${fmtNum(diff)}`}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        <Btn small title="ຮັບຂໍ້ສະເໜີນີ້" onPress={onAccept} style={{ flex: 2 }} />
        <Btn small variant="ghost" title="ປະຕິເສດ" onPress={onDecline} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

/* =============================================================================
   7. DRIVER SCREEN
   ========================================================================== */

function DriverScreen({
  online,
  earnings,
  trips,
  requests,
  activeJob,
  onToggleOnline,
  onAcceptPrice,
  onCounter,
  onJobStep,
}) {
  const [drafts, setDrafts] = useState({}); // per-request counter-offer text

  const setDraft = (id, v) => setDrafts((d) => ({ ...d, [id]: v.replace(/[^0-9]/g, '') }));

  const open = requests.filter((r) => r.state !== 'won');

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.screenPad}
      keyboardShouldPersistTaps="handled">
      {/* --- status header --- */}
      <View style={s.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={s.metaLabel}>ລາຍຮັບມື້ນີ້</Text>
            <Text style={s.priceHuge}>{fmtKip(earnings)}</Text>
            <Text style={s.cardMeta}>{trips} ຖ້ຽວ ສຳເລັດແລ້ວ</Text>
          </View>

          <Pressable onPress={onToggleOnline} style={[s.toggle, online && s.toggleOn]}>
            <View style={[s.toggleDot, online && s.toggleDotOn]} />
            <Text style={[s.toggleText, online && { color: C.gold }]}>
              {online ? 'ອອນລາຍ' : 'ອອບລາຍ'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* --- active job --- */}
      {activeJob && (
        <>
          <Text style={s.section}>ງານປັດຈຸບັນ</Text>
          <View style={[s.card, { borderColor: C.goldSoft }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardName}>{activeJob.passengerName}</Text>
                <Text style={s.cardMeta}>
                  {vehicleById(activeJob.vehicleId).label} · {fmtKm(activeJob.km)}
                </Text>
              </View>
              <Text style={s.priceBig}>{fmtKip(activeJob.price)}</Text>
            </View>

            <View style={s.hair} />
            <RouteLine from={activeJob.from} to={activeJob.to} compact />

            {!!activeJob.note && <Text style={s.note}>“{activeJob.note}”</Text>}

            <Btn
              title={
                activeJob.step === 0
                  ? 'ຮອດຈຸດຮັບແລ້ວ'
                  : activeJob.step === 1
                  ? 'ຮັບຜູ້ໂດຍສານແລ້ວ ເລີ່ມເດີນທາງ'
                  : 'ຮອດຈຸດໝາຍ ຈົບການເດີນທາງ'
              }
              onPress={onJobStep}
              style={{ marginTop: 14 }}
            />
          </View>
        </>
      )}

      {/* --- open requests --- */}
      <Text style={s.section}>ຄຳຂໍທີ່ເປີດຢູ່</Text>

      {!online && (
        <View style={[s.card, { alignItems: 'center', paddingVertical: 26 }]}>
          <Text style={{ fontSize: 24 }}>🌙</Text>
          <Text style={[s.emptyText, { marginTop: 8 }]}>
            ທ່ານອອບລາຍຢູ່ — ເປີດອອນລາຍເພື່ອຮັບຄຳຂໍ
          </Text>
        </View>
      )}

      {online && open.length === 0 && (
        <View style={[s.card, { alignItems: 'center', paddingVertical: 26 }]}>
          <Text style={{ fontSize: 24 }}>📭</Text>
          <Text style={[s.emptyText, { marginTop: 8 }]}>
            ຍັງບໍ່ມີຄຳຂໍໃໝ່ — ລອງສ້າງຄຳຂໍຈາກແທັບ “ຜູ້ໂດຍສານ”
          </Text>
        </View>
      )}

      {online &&
        open.map((r) => (
          <RequestCard
            key={r.id}
            req={r}
            draft={drafts[r.id] || ''}
            onDraft={(v) => setDraft(r.id, v)}
            onAcceptPrice={() => onAcceptPrice(r)}
            onCounter={() => {
              const amount = parseInt(drafts[r.id] || '0', 10);
              if (amount >= 1000) {
                onCounter(r, amount);
                setDraft(r.id, '');
              }
            }}
            disabled={!!activeJob}
          />
        ))}
    </ScrollView>
  );
}

function RequestCard({ req, draft, onDraft, onAcceptPrice, onCounter, disabled }) {
  const bidding = req.state === 'bidding';
  const lost = req.state === 'lost';

  return (
    <View style={[s.card, req.mine && { borderColor: C.goldSoft }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardName} numberOfLines={1}>{req.passengerName}</Text>
          <Text style={s.cardMeta}>
            {vehicleById(req.vehicleId).label} · {fmtKm(req.km)}
          </Text>
          {req.mine && <Text style={s.mineTag}>ຄຳຂໍຈາກແທັບ “ຜູ້ໂດຍສານ” ຂອງທ່ານ</Text>}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.priceBig}>{fmtKip(req.price)}</Text>
          <Text style={s.diffLabel}>ລາຄາຜູ້ໂດຍສານ</Text>
        </View>
      </View>

      <View style={s.hair} />
      <RouteLine from={req.from} to={req.to} compact />

      {!!req.note && <Text style={s.note}>“{req.note}”</Text>}

      {lost ? (
        <View style={s.stateBox}>
          <Text style={[s.stateText, { color: C.red }]}>
            ຜູ້ໂດຍສານເລືອກຄົນຂັບອື່ນແລ້ວ
          </Text>
        </View>
      ) : bidding ? (
        <View style={s.stateBox}>
          <Text style={s.stateText}>
            ສົ່ງລາຄາ <Text style={{ color: C.gold }}>{fmtKip(req.myBid)}</Text> ແລ້ວ
          </Text>
          <Text style={s.stateSub}>ກຳລັງລໍຖ້າຄຳຕອບຈາກຜູ້ໂດຍສານ...</Text>
        </View>
      ) : (
        <>
          <Btn
            title={`ຮັບລາຄານີ້ເລີຍ · ${fmtKip(req.price)}`}
            onPress={onAcceptPrice}
            disabled={disabled}
            style={{ marginTop: 14 }}
          />

          <Text style={s.counterLabel}>ຫຼື ຕໍ່ລອງລາຄາຂອງທ່ານ</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={draft}
              onChangeText={onDraft}
              placeholder="ໃສ່ລາຄາ"
              placeholderTextColor={C.faint}
              keyboardType="number-pad"
              editable={!disabled}
              style={[s.counterInput, { flex: 1 }]}
            />
            <Btn
              small
              variant="solidTeal"
              title="ສົ່ງລາຄາ"
              onPress={onCounter}
              disabled={disabled || parseInt(draft || '0', 10) < 1000}
              style={{ paddingHorizontal: 18 }}
            />
          </View>
        </>
      )}
    </View>
  );
}

/* =============================================================================
   8. APP — owns every piece of shared state and every timer
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
    note: pick(NOTES),
    mine: false,
    state: 'open',
    myBid: null,
  };
}

export default function App() {
  const [tab, setTab] = useState('passenger');

  /* ------------------------------------------------------ passenger state */
  const [pStage, setPStage] = useState('booking'); // booking | waiting | trip | receipt
  const [ride, setRide] = useState(null);
  const [bids, setBids] = useState([]);
  const [accepted, setAccepted] = useState(null);
  const [tripStep, setTripStep] = useState(0);
  const [rating, setRating] = useState(0);

  /* --------------------------------------------------------- driver state */
  const [online, setOnline] = useState(true);
  const [earnings, setEarnings] = useState(0);
  const [doneTrips, setDoneTrips] = useState(0);
  const [requests, setRequests] = useState(() => [makeSimRequest(), makeSimRequest()]);
  const [activeJob, setActiveJob] = useState(null);

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

  /* ================================================== passenger: submit ride */
  const submitRide = ({ from, to, vehicleId, price, note, km }) => {
    const id = uid('ride');
    const r = {
      id,
      from,
      to,
      km,
      vehicleId,
      price,
      note,
      passengerName: 'ທ່ານ (ຜູ້ໂດຍສານ)',
      mine: true,
      state: 'open',
      myBid: null,
    };

    rideIdRef.current = id;
    setRide(r);
    setBids([]);
    setAccepted(null);
    setRating(0);
    setTripStep(0);
    setPStage('waiting');

    // the ride becomes a real, biddable request on the driver side
    setRequests((rs) => [r, ...rs]);

    // 4 simulated drivers bid one by one between 2s and 8s
    const pool = [...DRIVER_NAMES].sort(() => Math.random() - 0.5).slice(0, 4);
    const delays = pool.map(() => rndInt(2000, 8000)).sort((a, b) => a - b);

    pool.forEach((name, i) => {
      later(() => {
        if (rideIdRef.current !== id) return; // request was cancelled
        setBids((prev) => [
          ...prev,
          {
            id: uid('bid'),
            name,
            rating: Number(rnd(4.2, 5.0).toFixed(1)),
            vehicle: vehicleById(vehicleId).label,
            plate: `${rndInt(1, 9)}${rndInt(1000, 9999)} ວຽງຈັນ`,
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

  const resetPassenger = () => {
    rideIdRef.current = null;
    setRide(null);
    setBids([]);
    setAccepted(null);
    setRating(0);
    setTripStep(0);
    setPStage('booking');
  };

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
          rating: 4.9,
          vehicle: vehicleById(req.vehicleId).label,
          plate: '0001 ວຽງຈັນ',
          eta: rndInt(2, 8),
          trips: 128 + doneTrips,
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
        setRequests((rs) =>
          rs.map((r) => (r.id === req.id ? { ...r, state: 'lost' } : r))
        );
        later(() => setRequests((rs) => rs.filter((r) => r.id !== req.id)), 2500);
      }
    }, rndInt(4000, 8000));
  };

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
    setEarnings((e) => e + activeJob.price);
    setDoneTrips((t) => t + 1);
    setActiveJob(null);
    if (linked) setPStage('receipt');

    // keep the driver tab supplied with work
    later(() => setRequests((rs) => [...rs, makeSimRequest()]), 3000);
  };

  /* ------------------------------------------------------------------ render */
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* header + role tabs */}
        <View style={s.header}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={s.brand}>ໄປນຳກັນ</Text>
            <Text style={s.brandSub}>ຕັ້ງລາຄາເອງ · ຕໍ່ລອງໄດ້</Text>
          </View>

          <View style={s.tabs}>
            <Pressable
              onPress={() => setTab('passenger')}
              style={[s.tab, tab === 'passenger' && s.tabOn]}>
              <Text style={[s.tabText, tab === 'passenger' && s.tabTextOn]}>ຜູ້ໂດຍສານ</Text>
            </Pressable>
            <Pressable
              onPress={() => setTab('driver')}
              style={[s.tab, tab === 'driver' && s.tabOn]}>
              <Text style={[s.tabText, tab === 'driver' && s.tabTextOn]}>ຄົນຂັບ</Text>
              {requests.filter((r) => r.state === 'open').length > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>
                    {requests.filter((r) => r.state === 'open').length}
                  </Text>
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
            onSubmit={submitRide}
            onAcceptBid={acceptBid}
            onDeclineBid={declineBid}
            onCancelRequest={cancelRequest}
            onCancelTrip={cancelTrip}
            onRate={setRating}
            onReset={resetPassenger}
          />
        ) : (
          <DriverScreen
            online={online}
            earnings={earnings}
            trips={doneTrips}
            requests={requests}
            activeJob={activeJob}
            onToggleOnline={() => setOnline((o) => !o)}
            onAcceptPrice={(r) => placeBid(r, r.price)}
            onCounter={placeBid}
            onJobStep={jobStep}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* =============================================================================
   9. STYLES
   ========================================================================== */

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },

  /* header */
  header: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  brand: { color: C.gold, fontSize: 21, lineHeight: 32, fontWeight: '700', letterSpacing: 0.3 },
  brandSub: { color: C.faint, fontSize: 12, lineHeight: 20, marginLeft: 10 },

  tabs: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 4,
    marginTop: 12,
    borderWidth: 1,
    borderColor: C.line,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  tabOn: { backgroundColor: C.gold },
  tabText: { color: C.sub, fontSize: 14, lineHeight: 21, fontWeight: '600' },
  tabTextOn: { color: '#1A1409' },
  badge: {
    marginLeft: 7,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: C.teal,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { color: '#08201C', fontSize: 11, lineHeight: 16, fontWeight: '700' },

  /* layout */
  screen: { flex: 1, backgroundColor: C.bg },
  screenPad: { padding: 18, paddingBottom: 48 },

  h1: { color: C.text, fontSize: 24, lineHeight: 38, fontWeight: '700' },
  h1sub: { color: C.sub, fontSize: 13, lineHeight: 21, marginBottom: 16 },
  section: {
    color: C.faint,
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0.6,
    marginTop: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
  },

  card: {
    backgroundColor: C.card,
    borderRadius: R,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    marginBottom: 12,
  },

  hair: { height: 1, backgroundColor: C.line, marginVertical: 14 },

  /* route */
  dot: { width: 9, height: 9, borderRadius: 5 },
  connector: { flex: 1, width: 1.5, backgroundColor: C.line, marginVertical: 3 },
  routeName: { color: C.text, fontSize: 15, lineHeight: 23, fontWeight: '600' },
  routeSub: { color: C.faint, fontSize: 11.5, lineHeight: 18 },

  /* booking pickers */
  pickRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  pickLabel: { color: C.faint, fontSize: 11, lineHeight: 17 },
  pickValue: { color: C.text, fontSize: 16, lineHeight: 25, fontWeight: '600' },
  swapBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  swapIcon: { color: C.gold, fontSize: 18, lineHeight: 24 },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  metaLabel: { color: C.sub, fontSize: 12.5, lineHeight: 20 },
  metaValue: { color: C.text, fontSize: 13.5, lineHeight: 21, fontWeight: '600' },

  /* chips */
  chip: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  chipActive: { borderColor: C.gold, backgroundColor: C.card2 },
  chipIcon: { fontSize: 19, lineHeight: 25 },
  chipLabel: { color: C.sub, fontSize: 13, lineHeight: 21, fontWeight: '600', marginTop: 2 },
  chipLabelActive: { color: C.text },
  chipSub: { color: C.faint, fontSize: 11, lineHeight: 18 },

  /* price */
  priceInputRow: { flexDirection: 'row', alignItems: 'baseline' },
  priceInput: {
    color: C.gold,
    fontSize: 34,
    lineHeight: 46,
    fontWeight: '700',
    padding: 0,
    minWidth: 130,
  },
  priceUnit: { color: C.gold, fontSize: 18, lineHeight: 28, fontWeight: '600', marginLeft: 8 },
  priceHint: { color: C.faint, fontSize: 12, lineHeight: 20, marginTop: 2 },
  priceBig: { color: C.gold, fontSize: 19, lineHeight: 29, fontWeight: '700' },
  priceHuge: { color: C.gold, fontSize: 30, lineHeight: 44, fontWeight: '700' },
  diff: { fontSize: 11.5, lineHeight: 18, fontWeight: '600', marginTop: 2 },
  diffLabel: { color: C.faint, fontSize: 11, lineHeight: 18, marginTop: 2 },

  /* inputs */
  noteInput: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R,
    padding: 14,
    color: C.text,
    fontSize: 14,
    lineHeight: 22,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  counterLabel: { color: C.faint, fontSize: 12, lineHeight: 20, marginTop: 14, marginBottom: 7 },
  counterInput: {
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: C.text,
    fontSize: 15,
    lineHeight: 22,
  },
  search: {
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: C.text,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },

  /* buttons */
  btn: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSmall: { paddingVertical: 10, paddingHorizontal: 10 },
  btnText: { fontSize: 15, lineHeight: 23, fontWeight: '700' },
  btnTextSmall: { fontSize: 13, lineHeight: 20 },

  /* people */
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: C.gold, fontSize: 17, lineHeight: 26, fontWeight: '700' },
  cardName: { color: C.text, fontSize: 15.5, lineHeight: 24, fontWeight: '700' },
  cardMeta: { color: C.sub, fontSize: 12, lineHeight: 20, marginTop: 2 },
  mineTag: { color: C.teal, fontSize: 11, lineHeight: 18, marginTop: 3 },
  note: {
    color: C.sub,
    fontSize: 13,
    lineHeight: 21,
    fontStyle: 'italic',
    marginTop: 12,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: C.goldSoft,
  },

  /* trip progress */
  rail: { flex: 1, height: 2, backgroundColor: C.line },
  railOn: { backgroundColor: C.gold },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: C.line,
    backgroundColor: C.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotOn: { backgroundColor: C.gold, borderColor: C.gold },
  stepDotText: { color: C.faint, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  stepLabel: {
    color: C.faint,
    fontSize: 10.5,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 7,
    paddingHorizontal: 2,
  },

  /* driver */
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card2,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  toggleOn: { borderColor: C.gold },
  toggleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.faint, marginRight: 8 },
  toggleDotOn: { backgroundColor: C.gold },
  toggleText: { color: C.sub, fontSize: 13, lineHeight: 21, fontWeight: '700' },

  stateBox: {
    marginTop: 14,
    backgroundColor: C.card2,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: C.line,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  stateText: { color: C.text, fontSize: 13.5, lineHeight: 22, fontWeight: '600' },
  stateSub: { color: C.faint, fontSize: 11.5, lineHeight: 19, marginTop: 2 },

  /* modal */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: C.line,
    padding: 18,
    paddingBottom: 34,
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: { color: C.text, fontSize: 18, lineHeight: 28, fontWeight: '700' },
  modalClose: { color: C.sub, fontSize: 17, lineHeight: 26, paddingHorizontal: 6 },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderRadius: 11,
  },
  placeName: { color: C.text, fontSize: 15, lineHeight: 23, fontWeight: '600' },
  placeDistrict: { color: C.faint, fontSize: 11.5, lineHeight: 19 },

  emptyText: { color: C.faint, fontSize: 13, lineHeight: 21, textAlign: 'center' },
  warn: { color: C.red, fontSize: 12, lineHeight: 20, marginTop: 8, textAlign: 'center' },
});

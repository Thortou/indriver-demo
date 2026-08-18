# Prompt: Build a ride-hailing demo app (inDriver-style) in React Native

Copy everything below into Claude Code / Cursor / your AI coding tool.

---

Build a React Native (Expo) demo app called **LaoGo** — a ride-hailing app for Laos where **passengers propose their own fare and drivers accept or counter-offer** (inDriver model). Two roles in one app, switchable from a role picker on launch: Passenger and Driver. All UI text is Lao first with small English subtitles. Currency is Lao Kip, formatted `₭ 45,000`. Use mock data and mock timers — no backend; simulate driver responses with setTimeout.

## Tech
- Expo + React Native, TypeScript, React Navigation (native stack + bottom tabs).
- `react-native-maps` (or a styled placeholder map view if maps aren't available).
- Fonts: **Noto Sans Lao** (400–800) for all text, **Space Grotesk** (500–700) for prices/numbers only.
- State: Zustand or Context; keep it simple.

## Design language (direction: "Fresh Lime")
- Background `#eef0ea` / surfaces `#ffffff`, text `#111111`, muted `#888888`.
- Accent: lime `#d4f24b` (primary buttons, selected tabs, highlights), dark green `#84a824` for status dots/success.
- Primary CTA: black `#111` pill (radius 14) with lime text. Secondary: white with 2px lime border.
- Cards: white, radius 16, soft shadow. Inputs: `#f4f5f0`, radius 12.
- Bottom sheets with 24px top radius and a drag handle. Generous padding, min touch target 44px.
- Prices always in Space Grotesk bold, larger than surrounding text.

(Alt directions if asked: "Night Amber" — dark `#101216` surfaces `#1b1e24`, amber `#ffb930` accent; "Mekong Teal" — light `#e8f1f0`, teal `#0e746e` + orange accent, pill shapes.)

## Passenger flow
1. **Home / Request** — full-screen map, segmented service picker at top (ລົດເກັງ Car / ລົດຈັກ Moto / ສົ່ງເຄື່ອງ Delivery), bottom sheet with:
   - Pickup + destination fields (mock place search: Morning Market ຕະຫຼາດເຊົ້າ, Wattay Airport ສະໜາມບິນວັດໄຕ, Patuxay, That Luang…).
   - **"Your fare" stepper**: big price with − / + buttons stepping ₭5,000, editable by tap.
   - CTA: ຊອກຫາຄົນຂັບ · Find a driver.
2. **Finding drivers** — radar/pulse animation; after 2–4s, driver offers appear as cards: driver name, ★ rating, car, ETA, and either "accepts ₭45,000" or a counter-offer (e.g. ₭50,000). Passenger can Accept / Decline each, or raise their fare.
3. **Ride in progress** — map with driver approaching (animated marker), driver card (name, plate, car, call/chat buttons), status timeline: driver on the way → arrived → in trip → completed.
4. **Trip complete** — fare summary, payment method (Cash default, QR mock), 5-star rating + tip chips.
5. Tabs: ໜ້າຫຼັກ Home · ປະຫວັດ History (mock past trips) · ໂປຣໄຟລ໌ Profile.

## Driver flow
1. **Requests** — header with avatar, name (ສົມສັກ · Somsak), ★ 4.9, online/offline toggle (green pill), today's earnings. List of nearby request cards: passenger name + rating, offered fare (big), pickup with distance-from-you, destination with trip distance, two buttons: **ຕໍ່ລອງ Counter** (opens a stepper modal to send e.g. ₭50,000) and **ຮັບວຽກ Accept ✓**.
2. **Active ride** — navigate-to-pickup view, then trip view, Complete button → earnings toast.
3. **Earnings** — ລາຍຮັບ: today/week totals, simple bar chart, trip list.
4. Tabs: ວຽກ Jobs · ລາຍຮັບ Earnings · ໂປຣໄຟລ໌ Profile.

## Mock data
Seed 5–6 requests/offers around Vientiane (Morning Market, Wattay Airport, Phonthong, Khua Din Market, That Luang) with realistic km distances and fares ₭20,000–₭80,000. Simulate negotiation: after passenger posts a fare, push 2–3 driver offers over a few seconds; accepting one starts the ride simulation.

## Quality bar
Polished spacing, smooth sheet/press animations (Reanimated), haptics on accept, loading/empty states, works on iPhone-size screens. No login — role picker only.

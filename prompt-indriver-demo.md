# Prompts — inDriver-style Ride Bidding Demo App

ໄຟລ໌ນີ້ມີ 4 ພາກ:
1. Prompt ຫຼັກ (ເຕັມຮູບແບບ) — ໃຊ້ສ້າງແອັບຕັ້ງແຕ່ຕົ້ນ
2. Prompt ສັ້ນ — ໃຊ້ເມື່ອຢາກໄວ
3. Prompt ຕໍ່ຍອດ — ໃຊ້ຫຼັງຈາກມີແອັບແລ້ວ
4. ເຄັດລັບການຂຽນ prompt

---

## 1. Prompt ຫຼັກ (copy ທັງໝົດໄປວາງ)

```
Build a working demo of an inDriver-style ride-hailing app where passengers name
their own price and drivers counter-offer.

## Stack
- React Native with Expo (blank template), JavaScript
- Single file App.js, no external dependencies beyond React Native core
- All data is mock/in-memory. No backend, no API calls, no database.
- Must run with `npx expo start` and work in Expo Go on a real phone

## Core concept
Unlike Uber, the passenger sets the price first. Nearby drivers see the request
and either accept that price or send a counter-offer. The passenger picks which
driver to ride with based on price, rating, and ETA.

## Two roles in one app
Put a tab switcher at the top so a single device can demo both sides:
"Passenger" and "Driver". A ride created in the Passenger tab must appear as a
real, biddable request in the Driver tab.

## Passenger flow
1. Booking form: pick-up and drop-off chosen from a searchable modal list of
   real locations, a swap button, vehicle type selector (car / motorbike / van
   with different base + per-km rates), price input pre-filled with a suggested
   fare, quick +/- buttons to adjust price, and a note field for the driver.
2. Calculate distance from real lat/lng using the haversine formula, multiplied
   by ~1.35 as a road-distance factor. Suggested fare = base + perKm * distance,
   with a minimum, rounded to the nearest 1000.
3. After submitting, show a waiting screen. 4 simulated drivers send bids one by
   one over 2-8 seconds, each priced randomly between about 0.92x and 1.27x of
   the passenger's offer.
4. Each bid card shows driver name, star rating, vehicle, ETA in minutes, total
   trips, the bid price, and how much above or below the passenger's offer it is
   (green when cheaper, red when more expensive). Sort bids cheapest first.
   Buttons: Accept / Decline.
5. After accepting: trip screen with driver details, a 3-step progress indicator
   (driver on the way -> driver arrived -> on trip) that advances automatically
   on timers, plus mock call and message buttons, and cancel (disabled once the
   trip has started).
6. On completion: receipt screen with fare, route, and a 5-star rating selector,
   then a button back to booking.

## Driver flow
1. Online/offline toggle plus today's earnings total.
2. List of open requests. Each card shows passenger name, route, distance,
   offered price, and note.
3. Two actions per card: "Accept passenger's price" (one tap) or type a custom
   counter-offer amount and submit it.
4. After bidding, that card switches to a waiting state showing the submitted
   price.
5. Seed 2 requests from simulated passengers at startup so the driver tab is
   never empty. When the driver bids on one, the simulated passenger replies in
   4-8 seconds: accept, or "passenger chose another driver" and the card
   disappears.
6. When a bid is accepted, show an active job panel with manual step buttons:
   "I've arrived" -> "Passenger on board, start trip" -> "Arrived, finish trip".

## Content / localisation
- Full Lao language UI (Lao script for all labels, buttons, and status text)
- Currency: Lao kip, formatted with thousands separators, e.g. "25,000 ກີບ"
- Locations: 12 real places in Vientiane with accurate coordinates, each with a
  name and district (Talat Sao, Patuxai, Pha That Luang, Wattay Airport,
  National University Dongdok, Mahosot Hospital, Khua Din Market, Wat Si Muang,
  Chao Anouvong Park, ITECC, Vientiane Railway Station, Thong Khan Kham Market)
- Driver and passenger names should be realistic Lao names

## Visual design
- Dark theme, warm near-black background (#12100E), cards a shade lighter
- Single gold accent (#E8B04B) referencing Lao temple gilding, plus a muted teal
  (#3FA796) for secondary actions and a soft red for destructive ones
- Do NOT use the generic acid-green-on-black or purple-gradient look
- Cards with 1px borders and 14px radius, generous padding, clear type hierarchy
- Route display: a small coloured dot for origin and destination joined by a
  vertical connector line
- Price is always the most prominent number on any card

## Code quality requirements
- Clean component split: Chip, Btn, Stars, RouteLine, PlacePicker,
  PassengerScreen, DriverScreen, App
- All state lifted to App so both tabs share one source of truth
- Store setTimeout ids in a ref and clear them on unmount
- Handle Android status bar padding on SafeAreaView
- Do not use localStorage, AsyncStorage, or any persistence
- Comment section headers so the file is easy to navigate

Output the complete App.js file, ready to paste and run.
```

---

## 2. Prompt ສັ້ນ

```
Build a single-file React Native (Expo) demo of an inDriver-style ride app with
mock data only. Passenger sets their own price, simulated drivers send
counter-offers over a few seconds, passenger picks one and watches the trip
progress, then rates the driver. Include a Driver tab in the same app where I
can see open requests and bid on them, so a ride I create as passenger shows up
on the driver side. Lao language UI, Lao kip currency, real Vientiane locations
with coordinates for haversine distance, dark theme with a gold accent. No
backend, no extra dependencies, must run in Expo Go.
```

---

## 3. Prompt ຕໍ່ຍອດ (ໃຊ້ຫຼັງມີແອັບແລ້ວ)

ໃຊ້ເທື່ອລະຢ່າງ ຢ່າຂໍພ້ອມກັນຫຼາຍຢ່າງ:

```
Add react-native-maps to the passenger flow. Show the pick-up and drop-off as
markers with a polyline between them, and animate a car marker along the route
while the trip is in progress. Keep everything else unchanged.
```

```
Split App.js into a proper project structure: src/screens, src/components,
src/data, src/utils, with React Navigation (bottom tabs + native stack).
Keep the exact same features and visual design. Show me every file.
```

```
Add a trip history screen for both roles, backed by AsyncStorage so it survives
app restarts. Include a filter by date and a total earnings summary for drivers.
```

```
Replace the mock data layer with a real Firebase Firestore backend. Keep the
same component structure, but move ride creation, bidding, and status updates to
Firestore with real-time listeners so two phones can actually match with each
other.
```

```
Add phone number login with an OTP screen (mock the OTP as 123456), a profile
screen, and role selection on first launch so a user is either a passenger or a
driver, not both.
```

---

## 4. ເຄັດລັບການຂຽນ prompt

**ບອກ stack ໃຫ້ຈະແຈ້ງ** — "React Native with Expo, JavaScript, single file, no
extra dependencies" ດີກວ່າ "make a mobile app" ຫຼາຍ. ຖ້າບໍ່ບອກ AI ຈະເລືອກ
library ທີ່ທ່ານຕິດຕັ້ງບໍ່ໄດ້.

**ອະທິບາຍ flow ເປັນຂັ້ນຕອນເລກ** — ຂຽນເປັນ 1, 2, 3 ວ່າຜູ້ໃຊ້ເຫັນຫຍັງ ແລະ ກົດຫຍັງຕໍ່.
ນີ້ໃຫ້ຜົນດີກວ່າການລິສ feature ລ້ວນໆ.

**ໃສ່ຕົວເລກຈິງ** — "bids arrive over 2-8 seconds", "0.92x to 1.27x of the offer",
"round to nearest 1000". ຖ້າບໍ່ໃສ່ AI ຈະເດົາເອງ ແລະ ມັກຈະບໍ່ຄືທີ່ຢາກໄດ້.

**ບອກສີເປັນ hex ແລະ ບອກສິ່ງທີ່ບໍ່ຢາກໄດ້** — ບັນທັດ "do NOT use the generic
acid-green-on-black look" ຊ່ວຍໄດ້ຫຼາຍ ເພາະ AI ມີ default ທີ່ຊ້ຳກັນ.

**ບອກພາສາ ແລະ ສະກຸນເງິນຕັ້ງແຕ່ຕົ້ນ** — ຖ້າບອກທີຫຼັງ ຈະຕ້ອງແກ້ທຸກ string ຄືນ ເຊິ່ງເສຍເວລາ.

**ຕໍ່ຍອດເທື່ອລະຢ່າງ** — ຂໍ 5 feature ພ້ອມກັນ ມັກຈະໄດ້ຄຸນນະພາບຕ່ຳລົງທຸກຢ່າງ.
ຂໍເທື່ອລະຢ່າງ ພ້ອມກັບຄຳວ່າ "keep everything else unchanged".

**ຖ້າມີໂຄດຢູ່ແລ້ວ ໃຫ້ວາງໃສ່ກ່ອນ** — ແລ້ວຄ່ອຍພິມສິ່ງທີ່ຢາກແກ້ ຫຼື ບອກຊື່ໄຟລ໌
ຖ້າໃຊ້ Claude Code / Cursor.

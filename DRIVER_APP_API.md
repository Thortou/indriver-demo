# inseeDrive Driver App: build brief and local API contract

> ເອກະສານນີ້ແມ່ນສຳລັບໃຫ້ AI/app generator ສ້າງ **ແອັບຄົນຂັບ (Driver app)** ທີ່ເຊື່ອມຕໍ່ API ໃນເຄື່ອງ (local). ມັນລວມທຸກຢ່າງທີ່ backend ເຮັດໄດ້ໃນປະຈຸບັນ, ລວມທັງການແຈ້ງເຕືອນ (push) ແລະ realtime (WebSocket).
>
> This brief is for an app generator building the **driver app only**. Everything below exists in the backend today. Build nothing the backend does not have.

---

## 0. What to build

A mobile app (Android first; iOS-compatible) for **drivers** of the inseeDrive ride-hailing service in Laos. It lets a driver:

1. **Sign up** with documents, then **wait for approval**, with the review status and any rejection reason on screen.
2. **Log in / log out**, and keep the session alive with refresh tokens.
3. See their **profile and document status** (valid, expiring soon, expired, missing), and **replace documents**.
4. **Go online / offline**, and **send GPS location** continuously while online.
5. See **nearby ride requests live**; **accept** the rider's price or **counter-offer**; **skip** a request; **withdraw** an offer.
6. Learn at once when they are **selected** (or not).
7. Run the trip: **Arrived → Start → Complete**; **cancel** with a reason.
8. **Rate the passenger** after a completed trip.
9. See **earnings** (per day), the **wallet** (commission owed), and **trip history**.
10. Receive **push notifications** (Firebase Cloud Messaging), and **realtime updates** over WebSocket while the app is open.

**App language:** Lao (default) and English. Send the user's choice on every request (see §1.3).
**Currency:** LAK, whole numbers only (no decimals). Format with thousands separators, e.g. `25,000 ₭`.

---

## 1. Connecting to the local API

### 1.1 Base URL

The backend runs on the developer's machine, port **8080** (listening on all interfaces).

| Where the app runs | Base URL |
| --- | --- |
| Android emulator | `http://10.0.2.2:8080` |
| iOS simulator | `http://localhost:8080` |
| Physical phone on the same Wi-Fi | `http://<computer's LAN IP>:8080`, e.g. `http://192.168.1.20:8080` |

- WebSocket URLs use the same host, with `ws://` in place of `http://`.
- Local development is plain HTTP. On Android, allow cleartext traffic for this host (`network_security_config`); on iOS, add an ATS exception for local development.
- Make the base URL a **setting** (a dev screen or a build config), never hard-coded.
- **No `/api/v1` prefix.** Paths are exactly as written below.

### 1.2 Backend switches the developer must turn on

| Feature | Backend setting needed | Without it |
| --- | --- | --- |
| Presence, ride requests, offers | `REDIS_URL` | These routes return **404** |
| Realtime (WebSocket) | `REALTIME_ENABLED=true`, `REALTIME_REDIS_CHANNEL_PREFIX=insee:development:rt`, `REDIS_URL` | Realtime routes return 404. The app must still work by polling (§8.6) |
| Sign-up with documents, uploads, document replacement | S3 object storage (5 `AWS_*` settings) | Those routes return 404. Show "Sign-up is not available right now" |
| Real push to phones | `PUSH_PROVIDER=fcm` plus the Firebase service account (worker) | With `PUSH_PROVIDER=log`, pushes are only written to the server log |

The app must **treat 404 on these routes as "feature not available"** and never crash.

### 1.3 Headers on every request

```
Content-Type: application/json          (except uploads: multipart/form-data)
Authorization: Bearer <access_token>    (every route except the public ones)
Lang: lo                                 (or "en"; controls the language of messages and errors)
```

### 1.4 Response format

**Success** (2xx) is always wrapped:

```json
{ "status_code": 200, "message": "ດຳເນີນການສຳເລັດ.", "data": { } }
```

- `data` is `{}` or `[]` when empty, and never missing. Some routes return `"data": null`, meaning "nothing now" (e.g. no current ride).
- Paged lists add `pagination`:
  - page style: `{ "total": 11, "total_pages": 6, "limit": 2, "page": 1 }` (query `?page=1&limit=20`, max 100);
  - cursor style, for history only: `{ "has_more": true, "next_cursor": "v1.…" }` (query `?limit=20&cursor=…`; `next_cursor` is absent on the last page).
- `204` has no body at all.

**Failure** (4xx/5xx) is **not** wrapped. It is a problem document:

```json
{ "type": "…", "title": "…", "status": 409, "code": "driver.not_available",
  "detail": "Human-readable text in the requested language",
  "requestId": "…", "retryable": false,
  "errors": [ { "path": "reason", "code": "ON_RIDE", "message": "…" } ] }
```

- **Branch on the HTTP status, then on `code`.** Show `detail` to the user. Use `errors[].path` to highlight form fields.
- `retryable: true` means the same request may succeed later.
- A `429` or `409` may carry a `Retry-After` header (seconds).

### 1.5 Formats

- Timestamps in responses: RFC 3339, UTC (`2026-09-26T06:05:27.77Z`). Show them in **Asia/Vientiane** time.
- Plain dates:
  - **registration** sends `YYYY-MM-DD`;
  - **document replacement** sends and `/driver/me` returns **`DD-MM-YYYY`**;
  - **earnings and history filters** use `YYYY-MM-DD`.
- Money: integer LAK.
- IDs: integers.
- `device_id`: a **UUID generated once per app install** and stored permanently. Always send it **lowercase** (iOS generates uppercase: lowercase it).

---

## 2. Authentication and session

### 2.1 Driver sign-up (3 steps; needs S3)

**Step 1: get a registration ticket (public).**

```
POST /auth/drivers/registration-ticket
{ "phone_number": "+8562055512345" }
→ 201 data: { "ticket": "<jwt>", "expires_in": 1800, "max_uploads": 10 }
```

Errors:
- `409 identity.already_drives`: this number already has a driver account. Offer "Log in".
- `429 identity.too_many_tickets` (+ `Retry-After`).

**Step 2: upload the 7 files with the ticket** (one request per file).

```
POST /upload        Authorization: Bearer <ticket>
multipart/form-data: file=<bytes>, purpose=<one of below>
→ data: { "key": "driver-documents/registration/…/licence.jpg", "url": "https://…" }
```

- `purpose` must be one of: `profile_photo`, `license_photo`, `license_selfie`, `id_card_photo`, `vehicle_photo`, `registration_doc`, `insurance_doc`.
- Allowed types: JPEG, PNG, WebP, PDF. **`profile_photo` must be an image.** Max **5 MB**.
- **Downscale photos to about 2000 px on the long edge, JPEG, before uploading** (roughly 400–800 KB).
- Keep each returned `key`.

**Step 3: register with the ticket.**

```
POST /auth/drivers/register     Authorization: Bearer <ticket>
{
  "password": "min 8 characters",
  "full_name": "Somchai Phommavong",
  "email": null,
  "language_pref": "lo",
  "profile_photo_key": "<key>",
  "license_number": "LA-123456",
  "license_expiry": "2030-12-31",
  "license_photo_key": "<key>",
  "license_selfie_key": "<key>",
  "id_card_number": "1234567890",
  "id_card_expiry": "2032-02-22",
  "id_card_photo_key": "<key>",
  "vehicle": {
    "vehicle_type": "economy",
    "plate_number": "ກຂ 1234",
    "make": "Toyota", "model": "Vios", "color": "white", "year": 2020,
    "vehicle_photo_key": "<key>",
    "registration_doc_key": "<key>", "registration_expires_at": "2027-06-30",
    "insurance_doc_key": "<key>",   "insurance_expires_at": "2027-06-30"
  }
}
→ 201: the account; the driver is now "under_review"
```

Rules:
- **Do not send `phone_number` or `device_id` here.** They are refused.
- Expiry dates must not be in the past.
- `make`, `model` and `color` are required.
- Errors are `409` naming the field (`identity.phone_taken`, `driver.license_taken`, `driver.plate_taken`) or `400/422` with `errors[]` pointing at the field.
- After success, go straight to **Login**. Registration creates no session.

### 2.2 Login

```
POST /auth/login
{ "phone_number": "+8562055512345", "password": "…", "audience": "driver", "device_id": "<install uuid>" }
→ 200 data: {
    "tokens": { "access_token": "…", "refresh_token": "…", "expires_in": 900 },
    "account": { "id": 42, "phone_number": "…", "email": null, "full_name": "…", "role": "driver",
                 "status": "active", "language_pref": "lo", "phone_verified_at": null, "last_login_at": "…" }
  }
```

- `audience` is always `"driver"` in this app.
- A wrong password or unknown number returns one generic `401`. Show "Phone number or password is incorrect".
- **Store tokens in secure storage** (Android Keystore / iOS Keychain).

### 2.3 Refresh, logout, me

```
POST /auth/refresh   { "refresh_token": "…", "device_id": "<install uuid>" }   → same shape as login
POST /auth/logout    (bearer) { "refresh_token": "…" }
GET  /auth/me        (bearer) → account + "profile_photo_url"
```

- The access token lasts about **15 minutes** (`expires_in` seconds). On any `401` from a bearer route:
  1. call `/auth/refresh` **once**;
  2. retry the original request;
  3. if the refresh fails, clear the tokens and go to Login.
- Serialize refreshes: one refresh in flight at a time.
- **Refresh tokens rotate**: always store the new one. Reusing an old refresh token ends the session.
- On logout, also close the WebSocket (§8) and stop location updates.

---

## 3. Profile and documents

### 3.1 `GET /driver/me`

```json
{ "verification_status": "under_review",
  "rejection_reason": null, "submitted_at": "…", "verified_at": null,
  "license_number": "…", "id_card_number": "…",
  "documents": [ { "document": "license_photo", "present": true, "expires_on": "04-10-2026",
                   "state": "expiring_soon", "days_until_expiry": 10 } ],
  "vehicles": [ { "vehicle_id": 12, "type": "economy", "plate_number": "…",
                  "documents": [ { "document": "vehicle_photo", "present": true, "expires_on": null,
                                   "state": "valid", "days_until_expiry": null } ] } ],
  "average_rating": null, "total_rides": 0, "total_earnings": "0.00",
  "complete": true, "missing": [] }
```

- `verification_status`: `pending` | `under_review` | `approved` | `rejected`.
  - **Rejected:** show `rejection_reason` prominently, with a "Replace documents" button.
- Document `state`: `valid` | `expiring_soon` | `expired` | `missing`.
  - Show a coloured badge per document.
  - `expiring_soon` means fewer than 30 days remain; show "N days left".
  - **This is the only expiry warning**: no push is sent before expiry.
- `average_rating` is `null` until the driver has at least 3 ratings. Show "New driver".
- `missing` lists what keeps the document set incomplete.

### 3.2 Replace documents (needs S3)

1. Upload with the **driver's own access token**:

   ```
   POST /upload   multipart: file, purpose
   ```

   - `purpose` is one of: `license_photo`, `license_selfie`, `id_card_photo`, `vehicle_photo`, `registration_doc`, `insurance_doc`.
   - `profile_photo` is **not** allowed here.
   - The limit is 20 uploads per hour: `429 driver.too_many_uploads` with `Retry-After`.

2. Submit only what changed. Every field is optional. **Dates are `DD-MM-YYYY`.**

   ```
   POST /driver/verification/documents
   { "license_selfie_key": "<key>", "license_expiry": "31-12-2030",
     "vehicle": { "vehicle_id": 12, "insurance_doc_key": "<key>", "insurance_expires_at": "31-12-2030" } }
   → data: { "verification_status": "under_review", "submitted_at": "…", "complete": true }
   ```

   - `409 driver.submission_under_review`: a review is already in progress; changes are not possible now. Show the `detail` text.
   - Replacing a document on an **approved** driver sends them back to `under_review`. **Warn before submitting.**

---

## 4. Going online and sending location

### 4.1 Online / offline

```
POST /driver/status   { "status": "ONLINE" }     (or "OFFLINE")
→ data: { "driver_id": 42, "online_intent": "ONLINE", "available": false, "availability_reason": "NO_LOCATION" }
```

### 4.2 Location (while ONLINE, in the foreground and background)

```
POST /driver/location
{ "lat": 17.9757, "lng": 102.6331, "accuracy": 8.5,
  "device_time": "2026-09-26T13:05:20+07:00", "seq": 15231 }
→ data: { "accepted": true, "latest_seq": 15231, "received_at": "…",
          "available": true, "availability_reason": "AVAILABLE", "reason": "" }
```

- Send a fix **every 5 seconds** while online, and at least every 30 seconds.
  - A location older than **45 s** makes the driver unavailable (`LOCATION_STALE`).
  - During a trip, frequent fixes feed the rider's live map (the server forwards at most one per 3 s).
- `seq` must **strictly increase** for the whole install. Use a persisted counter or epoch milliseconds.
  - A lower or equal `seq` is ignored (`accepted: false`, `reason: "SEQUENCE_NOT_NEWER"`).
- A fix worse than 100 m accuracy returns `accepted: false` with `reason: "ACCURACY_TOO_POOR"`. This is normal indoors; keep sending.
- `lat`, `lng` and `seq` are required.
- Use a **foreground service** (Android) or background location mode (iOS) with a persistent "You are online" notification.
- Stop sending on OFFLINE or logout.

### 4.3 `availability_reason` → what to show

| Reason | Meaning | UI |
| --- | --- | --- |
| `AVAILABLE` | Receiving requests | Green "Online – waiting for requests" |
| `NOT_ELIGIBLE` | Not approved, or documents incomplete | "Your account is not approved yet" → Profile |
| `DOCUMENT_EXPIRED` | A required document expired | "A document has expired" → Profile (`/driver/me` names it) |
| `OFFLINE` | Driver chose offline | Grey "Offline" and a Go-online button |
| `COMMISSION_OWED` | Commission debt reached the limit | "Please pay the commission you owe at the office" → Wallet |
| `STANDING_UNKNOWN` | Server could not check the wallet | "Temporarily unavailable, retrying…" |
| `ON_RIDE` | Has an active trip | Show the trip screen |
| `NO_LOCATION` | No GPS fix yet | "Waiting for GPS…" |
| `LOCATION_STALE` | Fixes stopped arriving | "Location not updating: check GPS/Internet" |
| `LOCATION_UNKNOWN` | Server's location store is down | "Temporarily unavailable" |

Handle **unknown values** gracefully: treat them as unavailable and show the raw reason.

---

## 5. Ride requests and offers (negotiation)

### 5.1 The request list

```
GET /driver/ride-requests
→ data: [ { "id": 7, "pickup": { "address": "Patuxai", "lat": 17.97, "lng": 102.61 },
            "destination": { "address": "Airport", "lat": 17.98, "lng": 102.56 },
            "vehicle_type": "economy", "proposed_price": 25000, "currency": "LAK",
            "expires_at": "…", "distance_m": 300 } ]
```

- Only an **available** driver can list. Otherwise it returns `409 driver.not_available` with `errors[0].code` = the reason; show §4.3.
- The list holds open requests within about 3 km that the driver has not answered. The passenger's identity is **never** shown before selection.
- Show a countdown to `expires_at` (requests last about 5 minutes).
- Refresh on the realtime `ride.requested` frame (§8), or poll every 5 s when realtime is off.

### 5.2 Make an offer

```
POST /driver/ride-requests/{id}/offers   { "price": 25000 }
→ 201 data: { "id": 31, "ride_id": 7, "status": "pending", "price": 25000, "revision": 0, "expires_at": "…" }
```

- **Price = `proposed_price`** means accept: status `pending`.
- **Price higher** means a counter-offer: status `counter_offered`. It must be a **multiple of 1,000** and at most **3×** the proposal.
- Calling again on the same request with a new price **revises** the offer (`200`). At most **2 revisions**: `409 offer.revision_limit`.
- **One open offer at a time across all requests**: `409 offer.open_elsewhere`. Withdraw the first offer, or wait for it to expire.
- An offer is open about **90 s**. Show a countdown to `expires_at`.
- Other errors:
  - `404 ride.not_found`: the request is gone or out of range;
  - `409 offer.expired`;
  - `409 driver.no_matching_vehicle`;
  - `400 offer.invalid` (bad price; `errors[].code` e.g. `not_a_step`).

### 5.3 Skip and withdraw

```
POST /driver/ride-requests/{id}/skip       → the request disappears from this driver's list for good
POST /driver/ride-offers/{offerId}/withdraw
```

- **Skip** returns `409 offer.open` while the driver has an offer on that request; withdraw first.
- **Withdraw** returns `409 offer.already_selected` if the passenger already picked it.

### 5.4 Learning the outcome

- **Selected:**
  - realtime frame `ride.driver_selected`;
  - push "You got the ride";
  - `GET /driver/rides/current` now returns the trip.
- **Not selected:**
  - realtime frame `offer.not_selected`;
  - push "Ride taken".
  - Over REST, a lost offer simply disappears.

---

## 6. The trip

### 6.1 Current trip

```
GET /driver/rides/current
→ data: null   (no trip)
→ data: { "id": 7, "status": "driver_assigned", "active": true,
          "pickup": {…}, "destination": {…}, "vehicle_type": "economy",
          "proposed_price": 25000, "agreed_price": 25000, "currency": "LAK",
          "requested_at": "…", "driver_assigned_at": "…", "driver_arrived_at": null,
          "started_at": null, "completed_at": null, "cancelled_at": null,
          "cancelled_by": null, "cancellation_reason": null,
          "can_rate": false,
          "passenger": { "name": "Noy", "profile_photo_url": null, "average_rating": 4.8, "phone_number": "+856…" } }
```

- `status`: `driver_assigned` → `driver_arrived` → `in_progress` → `completed`, or `cancelled`.
- `passenger.phone_number` appears **only while the trip is active**. Show a **Call** button.
- For about 10 minutes after the trip ends, this still returns the ended trip:
  - use it to show "Trip completed / cancelled by … (reason)";
  - offer **Rate passenger** if `can_rate` is true.
- Open the pickup and destination in Google Maps for navigation.
- **On app start and on every WebSocket reconnect, call this first** to restore the screen.

### 6.2 Trip buttons

```
POST /driver/rides/{id}/arrive     → data: { "id": 7, "status": "driver_arrived" }
POST /driver/rides/{id}/start      → data: { "id": 7, "status": "in_progress" }
POST /driver/rides/{id}/complete   → data: { "id": 7, "status": "completed" }
```

- Repeating the same command is safe (`200`, unchanged); use this for network retries.
- A wrong order returns `409 ride.invalid_state`: re-read `/driver/rides/current`.
- On **Complete**, show "Collect **{agreed_price} LAK in cash**". Payment is cash only; the app records nothing else.

### 6.3 Cancel

```
POST /driver/rides/{id}/cancel   { "reason": "vehicle_issue", "note": "optional, ≤500 chars" }
```

Allowed reasons by state:

| State | Driver may choose |
| --- | --- |
| `driver_assigned` | `vehicle_issue`, `safety_concern`, `other` |
| `driver_arrived` | `passenger_no_show`, `vehicle_issue`, `safety_concern`, `other` |
| `in_progress` | none: `409 ride.not_cancellable` (contact support) |

- `passenger_no_show` needs **5 minutes** of waiting after "Arrived". Too early gives `409 ride.no_show_too_early` with `Retry-After` (seconds).
  - Show a timer, and enable the button when it ends.
- There is no fee or penalty.
- The driver can take new requests immediately after a cancellation.

---

## 7. After the trip

### 7.1 Rate the passenger

```
POST /driver/rides/{id}/rating   { "stars": 5, "comment": "optional, ≤500", "tags": ["polite", "on_time"] }
→ 201 data: { "ride_id": 7, "stars": 5, "tags": ["polite","on_time"], "created_at": "…" }
```

- `stars` is an integer from 1 to 5.
- `tags` holds at most 3, from: `polite`, `on_time`, `respectful`, `rude`, `late`, `left_mess`.
- The comment has no line breaks.
- Only for a **completed** ride, within **7 days**, once.
  - `409 rating.already_rated`: treat as done.
  - `409 rating.not_rateable` / `rating.window_closed`: hide the button.

### 7.2 Earnings

```
GET /driver/earnings?from=2026-09-01&to=2026-09-26&page=1&limit=20     (≤ 31 days)
→ data: { "days":  [ { "date": "2026-09-26", "rides": 3, "fare": 75000, "commission": 7500, "net_earning": 67500 } ],
          "rides": [ { "id": 1, "ride_id": 7, "fare": 25000, "commission": 2500, "commission_rate_bp": 1000,
                       "net_earning": 22500, "currency": "LAK", "method": "cash", "paid_at": "…" } ],
          "pagination": { … } }
```

- The commission is 10% (`commission_rate_bp` 1000 = 10%).

### 7.3 Wallet (commission owed)

```
GET /driver/wallet
→ data: { "driver_id": 42, "owed": 2500, "balance": -2500, "currency": "LAK",
          "limit": 200000, "blocks_availability": false }
GET /driver/wallet/entries?page=1&limit=20
→ data: [ { "id": 5, "type": "commission", "amount": -2500, "balance_after": -2500,
            "ride_id": 7, "description": "…", "created_at": "…" } ]
```

- Show "You owe **{owed} LAK**" and a progress bar to `limit`.
- When `blocks_availability` is true, say: "You cannot receive rides until you pay at the office."
- Entry `type` values include `commission`, `settlement` (paid at the office) and `adjustment`.

### 7.4 Trip history

```
GET /driver/rides?limit=20&cursor=<next_cursor>&status=completed&from=2026-09-01&to=2026-09-26
GET /driver/rides/{id}
```

Each item carries:
- the trip fields from §6.1;
- `"outcome"`, `"can_rate"`;
- `"passenger": { "name", "profile_photo_url" }` (never a phone);
- `"earning": { "status", "fare", "commission", "commission_rate_bp", "net_earning", "currency" }`, which is null while the ride has not ended.

Notes:
- Newest first. Use **infinite scroll** with `next_cursor`.
- `status` filter: `completed` | `cancelled`.

---

## 8. Realtime (WebSocket)

Realtime makes the app instant while it is open. **REST stays the truth**: frames are hints to refresh. The app must work without realtime (§8.6).

### 8.1 Connect

1. Get a ticket (single use, valid **30 s**):

   ```
   POST /driver/realtime/ticket   (bearer)   { "device_id": "<install uuid, lowercase>" }
   → data: { "ticket": "…", "expires_in": 30 }
   ```

2. Open the socket **immediately**, with the same `device_id`:

   ```
   ws://<host>:8080/driver/realtime?ticket=<ticket>&device_id=<install uuid>
   ```

   - **Never put the access token in the URL.**
   - A refused upgrade is a normal HTTP error:
     - `401 realtime.invalid_ticket` (get a new ticket);
     - `403 realtime.no_session` (log in again);
     - `503 realtime.unavailable` (retry later).

### 8.2 Rules

- **Answer pings.** The server pings every 25 s, and closes after 60 s without a pong. Most WebSocket libraries answer automatically.
- **Never send data.** Any text or binary message closes the socket (`1008`).
- **Reconnect** with a fresh ticket after a close, using backoff (1 s, 2 s, 4 s … up to 30 s). **Exception:** `4003` means log in again.
- **On every (re)connect**, re-read `GET /driver/rides/current` and `GET /driver/ride-requests`. Nothing missed is replayed.
- **Drop a repeated `id`**: a frame may arrive twice.
- **Ignore unknown `type` values, or `v` other than 1**, and refresh from REST.
- Connect when the app is in the foreground **and** the driver is logged in. Disconnect in the background (push covers that).

### 8.3 Frame format

```json
{ "v": 1, "id": "e123", "type": "ride.driver_selected",
  "occurred_at": "2026-09-26T06:05:27Z", "data": { "ride_id": 7 } }
```

### 8.4 Frames a driver receives

| `type` | When | `data` | App action |
| --- | --- | --- | --- |
| `ride.requested` | A new nearby request the driver can see | `ride_id` | Refresh `/driver/ride-requests`; sound or vibrate |
| `ride.driver_selected` | The passenger picked this driver | `ride_id` | Open the trip screen (`/driver/rides/current`) |
| `offer.not_selected` | The passenger picked someone else | `ride_id` | Remove the offer; toast "Passenger chose another driver" |
| `ride.cancelled` | The passenger or support cancelled the trip | `ride_id`, `status`, `cancelled_by` (`passenger`/`admin`), `reason` | Show "Trip cancelled" with the reason; refresh current |
| `driver.position` | The driver's own position echo during a trip | `ride_id`, `lat`, `lng`, `recorded_at` | Optional: confirm the map |

Frames never contain phone numbers or names. Fetch details from REST.

### 8.5 Close codes

| Code | Meaning | Action |
| --- | --- | --- |
| `4001` | Session window reached (about 15 min) | Refresh the token if needed, get a new ticket, reconnect |
| `4002` | Replaced by a newer connection (max 3 per account) | Do **not** reconnect this one |
| `4003` | Session ended (logout, or account suspended) | Go to Login |
| `1001` | Idle timeout, or server restarting | Reconnect with backoff |
| `1008` / `1009` | The client sent data / too large | Bug: do not send anything |
| `1013` | The client was too slow | Reconnect |

### 8.6 Fallback without realtime

If the ticket route returns `404` (realtime off) or `503`, poll:
- `GET /driver/ride-requests` every 5 s while online and without a trip;
- `GET /driver/rides/current` every 5 s during a trip, or after making an offer.

---

## 9. Push notifications (Firebase Cloud Messaging)

### 9.1 Setup

- Add Firebase to the app with the project's **`google-services.json`** (Android) / **`GoogleService-Info.plist`** (iOS), from the dev Firebase project **`inseedrive-2e130`**, **driver app** registration.
- Never put a server key or service-account file in the app.
- Android: create two notification channels:
  - **`ride_requests`**, high importance, with sound: new ride requests;
  - **`ride_updates`**, default importance: everything else.
- Ask for notification permission (Android 13+ and iOS).

### 9.2 Register the device

Call after every login, on every app start, and whenever FCM gives a new token:

```
PUT /driver/devices
{ "device_id": "<install uuid>", "platform": "android", "push_token": "<FCM token>",
  "app_version": "1.0.0", "locale": "lo" }
→ data: { "device_id": "…", "platform": "android", "registered_at": "…" }
```

- `platform` is `android` or `ios`.
- `404 notification.session_not_found` means the device has no live session. Log in again.
- Logout ends the session, and the server stops pushing to that device by itself.

### 9.3 What arrives

- **Android** gets a **data message**. The app must build the notification itself from `data`:

  ```
  data: { "event": "RideRequested", "ride_id": "7", "schema_version": "1",
          "title": "New ride request", "body": "25,000 LAK. Open the app…", "channel": "ride_requests" }
  ```

- **iOS** gets a visible alert (title and body), plus the same `event` and `ride_id` in the data.

Driver events:

| `event` | Title (en) | On tap |
| --- | --- | --- |
| `RideRequested` | New ride request | Open the request list (it expires in about 90 s) |
| `DriverSelected` | You got the ride / Ride taken | Open the trip / the request list |
| `RideCancelled` | Ride cancelled | Open the current trip (shows who cancelled) |

- Titles arrive already in the driver's language (Lao or English).
- On receiving a push while the app is open, just refresh from REST. The WebSocket frame usually arrived first.

---

## 10. Screens (suggested)

1. **Splash:**
   - no tokens → Login;
   - otherwise refresh → `/driver/me` → (approved → Home; else → Status);
   - register the push device.
2. **Login** · **Sign-up wizard** (phone → ticket → 7 photo steps with camera, downscaled → details and vehicle form → submit → "Under review").
3. **Account status:** verification status, rejection reason, per-document badges, "Replace documents".
4. **Home:**
   - an online/offline toggle;
   - the availability message (§4.3);
   - a map with own position;
   - the live request list (cards: pickup, destination, distance, price, countdown; buttons **Accept**, **Counter**, **Skip**).
5. **Counter-offer sheet:** a price stepper in 1,000 steps, capped at 3× the proposal, showing revisions left.
6. **Waiting for passenger:** the offer countdown; a Withdraw button.
7. **Trip:**
   - the passenger's name, photo and rating; **Call**; navigation to pickup;
   - buttons Arrived → Start → Complete (with a "Collect X LAK cash" confirmation);
   - Cancel (reasons per §6.3; a no-show timer).
8. **Trip finished:** a summary, and **Rate passenger** (stars, tags, comment).
9. **Earnings** (date range, daily totals, trip list) · **Wallet** (owed, limit, entries) · **History** (infinite list, then detail).
10. **Settings:** language (lo/en), the API base URL (dev), logout.

---

## 11. Error codes worth handling

| Code | Where | Show / do |
| --- | --- | --- |
| `identity.unauthenticated` (401) | anywhere | refresh once, then Login |
| `driver.not_available` (409) | list, offer | the §4.3 message from `errors[0].code` |
| `offer.open_elsewhere` (409) | offer | "You already have an open offer" |
| `offer.revision_limit` (409) | offer | "You can't change this offer again" |
| `offer.expired` (409) | offer | "This offer expired" |
| `offer.already_selected` (409) | withdraw | open the trip |
| `offer.open` (409) | skip | "Withdraw your offer first" |
| `ride.not_found` (404) | any ride action | "This request is no longer available"; refresh |
| `ride.invalid_state` (409) | trip buttons | re-read the current trip |
| `ride.not_cancellable` (409) | cancel | "This trip can no longer be cancelled; contact support" |
| `ride.no_show_too_early` (409) | cancel | wait for `Retry-After` |
| `rating.already_rated` (409) | rating | treat as done |
| `driver.submission_under_review` (409) | documents | show `detail` |
| `driver.too_many_uploads` (429) | upload | wait for `Retry-After` |
| `realtime.*` | realtime | see §8.1 |
| any 5xx / network error | anywhere | "Something went wrong, try again" with retry |

Show `detail` from the server when unsure: it is already translated.

---

## 12. Test accounts for local development

- **Driver sign-up needs S3.** Without it, the developer creates an approved test driver directly in the database, as the project's Postman and smoke scripts do. The developer then gives you the phone and password.
- **To see requests,** a passenger must create one (Postman collection `docs/postman/insee-drive-api.postman_collection.json`, folder *Passenger 1*) near the driver's GPS position (within about 3 km).
- **To watch realtime frames** from a terminal:

  ```sh
  WS_LISTEN_PASSWORD='…' go run ./scripts/ws-listen -base http://localhost:8080 -audience driver -phone <phone> -device <device uuid>
  ```

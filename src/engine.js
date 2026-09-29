/* =============================================================================
   engine.js — everything the driver app does against the API, plus the hook
   that keeps state fresh (realtime frames, 5 s polling fallback, push, app
   foreground/background).

   REST is the truth (§8): frames and pushes only trigger a re-read.
   ========================================================================== */

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Haptics from 'expo-haptics';

import {
  ApiError,
  get,
  post,
  saveTokens,
  loadTokens,
  getRefreshToken,
  hasSession,
  onSessionEnded,
  firstErrorCode,
  isUnavailable,
  errorText,
  refreshSession,
} from './api';
import { getDeviceId, loadConfig, loadOnlineIntent, saveOnlineIntent, saveLang } from './config';
import { money, setLang, t, tOr } from './i18n';
import { startLocation, stopLocation, peekPosition } from './location';
import { registerPushDevice, listenPush, popup } from './push';
import { Realtime } from './realtime';
import { useApp, initialDriverState, toast } from './store';

const set = (patch) => useApp.setState(patch);
const state = () => useApp.getState();

/* ================================================================ session */

export async function boot() {
  const cfg = await loadConfig();
  setLang(cfg.lang);
  set({ lang: cfg.lang });
  await loadTokens();
  if (hasSession()) {
    try {
      await refreshSession(); // also proves the session is still alive
      await afterLogin();
    } catch (e) {
      // offline at start: keep the tokens and try the screens anyway
      if (e instanceof ApiError && e.status === 0) await afterLogin().catch(() => {});
      else await saveTokens(null);
    }
  }
  set({ booted: true, session: hasSession() });
}

async function afterLogin() {
  set({ session: true });
  await Promise.all([loadAccount(), loadMe().catch(() => {}), refreshCurrent().catch(() => {})]);
  registerPushDevice().catch(() => {});
  if (await loadOnlineIntent()) setOnline(true).catch(() => {});
  else peekPosition();
}

export async function login(phone, password) {
  const data = await post(
    '/auth/login',
    { phone_number: phone, password, audience: 'driver', device_id: getDeviceId() },
    { auth: false }
  );
  await saveTokens(data.tokens);
  if (data.account && data.account.language_pref) await changeLang(data.account.language_pref);
  set({ account: data.account });
  await afterLogin();
}

async function clearSession() {
  resetPopupMemory();
  realtimeClient && realtimeClient.stop();
  await stopLocation().catch(() => {});
  await saveTokens(null);
  set({ ...initialDriverState, session: false });
}

export async function logout() {
  const refresh = getRefreshToken();
  try {
    if (state().online) await post('/driver/status', { status: 'OFFLINE' });
  } catch {}
  try {
    await post('/auth/logout', { refresh_token: refresh });
  } catch {}
  await saveOnlineIntent(false).catch(() => {});
  await clearSession();
}

// a failed refresh (api.js) or WebSocket 4003 lands here
onSessionEnded(() => {
  clearSession();
});

export async function changeLang(lang) {
  setLang(lang);
  await saveLang(lang);
  set({ lang });
}

export async function loadAccount() {
  const account = await get('/auth/me');
  set({ account });
  return account;
}

export async function loadMe() {
  const me = await get('/driver/me');
  set({ me });
  return me;
}

/* ======================================================= online / offline */

export async function setOnline(on) {
  if (on) await startLocation(); // throws if location permission is refused
  let r;
  try {
    r = await post('/driver/status', { status: on ? 'ONLINE' : 'OFFLINE' });
  } catch (e) {
    if (on) await stopLocation();
    throw e;
  }
  if (!on) {
    await stopLocation();
    resetPopupMemory();
  }
  await saveOnlineIntent(on);
  set({
    online: r.online_intent === 'ONLINE',
    availability: { available: r.available, reason: r.availability_reason },
    ...(on ? null : { requests: [], requestsLoaded: false }),
  });
  if (on) refreshRequests();
}

/* ================================================================ popups */

// Popups come from state changes, not frames, so they also work while
// realtime is off and the app is polling. The first load after going online
// (or starting) only primes the memory: requests already on screen, or a trip
// already running, are not news.
let seenRequestIds = new Set();
let requestsPrimed = false;
let currentPrimed = false;

function resetPopupMemory() {
  seenRequestIds = new Set();
  requestsPrimed = false;
  currentPrimed = false;
}

const appOpen = () => AppState.currentState === 'active';

function popupNewRequests(list) {
  const fresh = list.filter((r) => !seenRequestIds.has(r.id));
  list.forEach((r) => seenRequestIds.add(r.id));
  const primed = requestsPrimed;
  requestsPrimed = true;
  if (!primed || !fresh.length || !appOpen()) return;
  const r = fresh[0];
  popup({
    event: 'RideRequested',
    rideId: r.id,
    channel: 'ride_requests',
    title: t('newRequest'),
    body:
      fresh.length === 1
        ? t('popNewRequestBody', {
            price: money(r.proposed_price),
            from: (r.pickup && r.pickup.address) || '—',
            to: (r.destination && r.destination.address) || '—',
          })
        : t('popNewRequests', { n: fresh.length }),
  });
}

function popupRideChange(prev, ride) {
  const primed = currentPrimed;
  currentPrimed = true;
  if (!primed || !ride || !appOpen()) return;
  if (ride.active && (!prev || prev.id !== ride.id)) {
    popup({
      event: 'DriverSelected',
      rideId: ride.id,
      title: t('youGotRide'),
      body: t('popGotRideBody', { from: (ride.pickup && ride.pickup.address) || '—' }),
    });
  } else if (
    prev &&
    prev.id === ride.id &&
    prev.active &&
    ride.status === 'cancelled' &&
    ride.cancelled_by !== 'driver'
  ) {
    popup({
      event: 'RideCancelled',
      rideId: ride.id,
      title: t('tripCancelled'),
      body: t('popCancelledBody', { who: tOr(`by_${ride.cancelled_by}`, ride.cancelled_by || '—') }),
    });
  }
}

/* ================================================== requests and offers */

let requestsBusy = false;

export async function refreshRequests() {
  const st = state();
  if (!st.online || requestsBusy) return;
  requestsBusy = true;
  try {
    const list = await get('/driver/ride-requests');
    popupNewRequests(list || []);
    set({ requests: list || [], requestsLoaded: true, availability: { available: true, reason: 'AVAILABLE' } });
  } catch (e) {
    if (e instanceof ApiError && e.code === 'driver.not_available') {
      set({ requests: [], requestsLoaded: true, availability: { available: false, reason: firstErrorCode(e) } });
    } else if (isUnavailable(e)) {
      set({ requests: [], requestsLoaded: true, availability: { available: false, reason: 'LOCATION_UNKNOWN' } });
    }
  } finally {
    requestsBusy = false;
  }
}

/** Accept (price === proposed) or counter / revise. */
export async function makeOffer(req, price) {
  try {
    const offer = await post(`/driver/ride-requests/${req.id}/offers`, { price });
    set({ offer: { ...offer, request: req } });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    return offer;
  } catch (e) {
    if (e instanceof ApiError && (e.code === 'ride.not_found' || e.code === 'offer.expired')) {
      if (state().offer && state().offer.ride_id === req.id) set({ offer: null });
      refreshRequests();
    }
    if (e instanceof ApiError && e.code === 'driver.not_available') {
      set({ availability: { available: false, reason: firstErrorCode(e) } });
    }
    throw e;
  }
}

export async function withdrawOffer() {
  const offer = state().offer;
  if (!offer) return;
  try {
    await post(`/driver/ride-offers/${offer.id}/withdraw`);
    set({ offer: null });
    refreshRequests();
  } catch (e) {
    if (e instanceof ApiError && e.code === 'offer.already_selected') {
      set({ offer: null });
      await refreshCurrent();
      return;
    }
    if (e instanceof ApiError && (e.status === 404 || e.code === 'offer.expired')) {
      set({ offer: null });
      refreshRequests();
      return;
    }
    throw e;
  }
}

export async function skipRequest(req) {
  await post(`/driver/ride-requests/${req.id}/skip`);
  set({ requests: state().requests.filter((r) => r.id !== req.id) });
}

/** Called by the countdown when the open offer reaches expires_at. */
export function offerTimedOut() {
  if (!state().offer) return;
  set({ offer: null });
  toast(t('offerExpired'));
  refreshCurrent(); // it may have been selected at the last moment
  refreshRequests();
}

/* ================================================================== trip */

let currentBusy = null;

export function refreshCurrent() {
  if (!currentBusy) {
    currentBusy = (async () => {
      const ride = await get('/driver/rides/current');
      const prev = state().ride;
      popupRideChange(prev, ride);
      const patch = { ride: ride || null };
      if (ride && ride.active) {
        patch.offer = null; // selected: the open offer became this trip
        if (!prev || prev.id !== ride.id) {
          toast(t('youGotRide'));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      }
      set(patch);
      return ride;
    })().finally(() => {
      currentBusy = null;
    });
  }
  return currentBusy;
}

export async function tripAction(ride, action) {
  try {
    await post(`/driver/rides/${ride.id}/${action}`);
  } catch (e) {
    if (e instanceof ApiError && e.code === 'ride.invalid_state') {
      await refreshCurrent();
      return;
    }
    throw e;
  }
  await refreshCurrent();
}

export async function cancelRide(ride, reason, note) {
  const body = { reason };
  if (note && note.trim()) body.note = note.trim().slice(0, 500);
  await post(`/driver/rides/${ride.id}/cancel`, body);
  await refreshCurrent();
}

export function dismissRide() {
  const ride = state().ride;
  set({ dismissedRideId: ride ? ride.id : null });
  refreshRequests();
}

export async function ratePassenger(rideId, stars, tags, comment) {
  const body = { stars, tags };
  const c = (comment || '').replace(/[\r\n]+/g, ' ').trim();
  if (c) body.comment = c.slice(0, 500);
  try {
    await post(`/driver/rides/${rideId}/rating`, body);
  } catch (e) {
    if (!(e instanceof ApiError && e.code === 'rating.already_rated')) throw e;
  }
  const ride = state().ride;
  if (ride && ride.id === rideId) set({ ride: { ...ride, can_rate: false } });
}

/* ============================================================ the engine */

let realtimeClient = null;

function onFrame(frame) {
  const st = state();
  const rideId = frame.data && frame.data.ride_id;
  switch (frame.type) {
    case 'ride.requested':
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      refreshRequests();
      break;
    case 'ride.driver_selected':
      set({ offer: null, dismissedRideId: null });
      refreshCurrent();
      break;
    case 'offer.not_selected':
      if (st.offer && st.offer.ride_id === rideId) {
        set({ offer: null });
        toast(t('notSelected'));
        popup({ event: 'DriverSelected', rideId, title: t('notSelected'), body: '' });
      }
      refreshRequests();
      break;
    case 'ride.cancelled':
      refreshCurrent();
      break;
    case 'driver.position':
      break;
    default:
      refreshCurrent().catch(() => {});
      refreshRequests();
  }
}

/** Mount once inside the logged-in shell. `onOpenHome` switches to the Rides tab. */
export function useDriverEngine({ onOpenHome }) {
  const session = useApp((s) => s.session);
  const openHome = useRef(onOpenHome);
  openHome.current = onOpenHome;

  // realtime while in the foreground
  useEffect(() => {
    if (!session) return undefined;
    realtimeClient = new Realtime({
      onStatus: (realtime) => set({ realtime }),
      onConnected: () => {
        refreshCurrent().catch(() => {});
        refreshRequests();
      },
      onFrame,
      onSessionEnded: () => clearSession(),
    });
    if (AppState.currentState === 'active') realtimeClient.start();

    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        realtimeClient.start();
        refreshCurrent().catch(() => {});
        refreshRequests();
        loadMe().catch(() => {});
      } else if (next === 'background') {
        realtimeClient.stop(); // push covers the background
      }
    });
    return () => {
      sub.remove();
      realtimeClient.stop();
      realtimeClient = null;
    };
  }, [session]);

  // 5 s polling of the request list when realtime is not live (§8.6)
  useEffect(() => {
    if (!session) return undefined;
    const id = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      const st = state();
      const activeRide = st.ride && st.ride.active;
      if (st.realtime !== 'live' && st.online && !activeRide) refreshRequests();
      // even with a live socket: a lost frame must not leave the driver waiting
      // on an offer that was already selected, or on a trip already cancelled
      if (activeRide || st.offer) refreshCurrent().catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [session]);

  // wallet / document changes can flip availability: re-read /driver/me now and then
  useEffect(() => {
    if (!session) return undefined;
    const id = setInterval(() => {
      if (AppState.currentState === 'active') loadMe().catch(() => {});
    }, 60000);
    return () => clearInterval(id);
  }, [session]);

  // pushes
  useEffect(() => {
    if (!session) return undefined;
    return listenPush({
      onReceive: () => {
        refreshCurrent().catch(() => {});
        refreshRequests();
      },
      onTap: () => {
        set({ dismissedRideId: null });
        refreshCurrent().catch(() => {});
        refreshRequests();
        if (openHome.current) openHome.current();
      },
    });
  }, [session]);
}

export { errorText };

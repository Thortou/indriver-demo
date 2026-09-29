/* =============================================================================
   location.js — sends GPS fixes while ONLINE (DRIVER_APP_API.md §4.2).

   Foreground: watch the position and post the latest fix every 5 s.
   Background (development builds only): a TaskManager task fed by an Android
   foreground service / iOS background mode, showing "You are online". Expo Go
   cannot run background location, so there the app sends only while open.
   ========================================================================== */

import { AppState } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { post, hasSession, loadTokens } from './api';
import { IS_EXPO_GO, getDeviceId, loadConfig, nextLocationSeq } from './config';
import { t } from './i18n';
import { useApp } from './store';

const BG_TASK = 'driver-location';
const SEND_EVERY_MS = 5000;

let watchSub = null;
let timer = null;
let latest = null; // last expo-location object
let sending = false;

async function sendFix(loc) {
  const { latitude, longitude, accuracy } = loc.coords;
  const body = {
    lat: latitude,
    lng: longitude,
    device_time: new Date(loc.timestamp || Date.now()).toISOString(),
    seq: await nextLocationSeq(),
  };
  if (accuracy > 0) body.accuracy = accuracy;
  return post('/driver/location', body);
}

async function tick() {
  if (!latest || sending || AppState.currentState !== 'active') return;
  sending = true;
  try {
    const r = await sendFix(latest);
    // ACCURACY_TOO_POOR / SEQUENCE_NOT_NEWER are normal; keep sending (§4.2)
    useApp.setState({ availability: { available: r.available, reason: r.availability_reason } });
  } catch {
    // network blips: the next tick retries; LOCATION_STALE shows if it lasts
  } finally {
    sending = false;
  }
}

/** Ask for permission and start sending. Throws if permission is refused. */
export async function startLocation() {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') throw new Error(t('locationDenied'));

  if (!watchSub) {
    watchSub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: SEND_EVERY_MS, distanceInterval: 0 },
      (loc) => {
        const first = !latest;
        latest = loc;
        useApp.setState({
          fix: { lat: loc.coords.latitude, lng: loc.coords.longitude, accuracy: loc.coords.accuracy },
        });
        if (first) tick();
      }
    );
  }
  if (!timer) timer = setInterval(tick, SEND_EVERY_MS);

  let background = false;
  if (!IS_EXPO_GO) {
    try {
      const bg = await Location.requestBackgroundPermissionsAsync();
      if (bg.status === 'granted') {
        const running = await Location.hasStartedLocationUpdatesAsync(BG_TASK).catch(() => false);
        if (!running) {
          await Location.startLocationUpdatesAsync(BG_TASK, {
            accuracy: Location.Accuracy.High,
            timeInterval: SEND_EVERY_MS,
            distanceInterval: 0,
            pausesUpdatesAutomatically: false,
            showsBackgroundLocationIndicator: true,
            foregroundService: {
              notificationTitle: t('onlineNotifTitle'),
              notificationBody: t('onlineNotifBody'),
              color: '#A7E92F',
            },
          });
        }
        background = true;
      }
    } catch {
      background = false;
    }
  }
  useApp.setState({ backgroundLocation: background });
}

export async function stopLocation() {
  if (watchSub) watchSub.remove();
  watchSub = null;
  clearInterval(timer);
  timer = null;
  latest = null;
  if (!IS_EXPO_GO) {
    const running = await Location.hasStartedLocationUpdatesAsync(BG_TASK).catch(() => false);
    if (running) await Location.stopLocationUpdatesAsync(BG_TASK).catch(() => {});
  }
  useApp.setState({ backgroundLocation: false });
}

/** A one-off fix for the map while offline (no sending). */
export async function peekPosition() {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const loc = (await Location.getLastKnownPositionAsync()) || (await Location.getCurrentPositionAsync({}));
    if (loc) useApp.setState({ fix: { lat: loc.coords.latitude, lng: loc.coords.longitude } });
    return loc;
  } catch {
    return null;
  }
}

/* Background task: must be defined at module load (index.js imports this file).
   It may run headless, before App mounts, so it loads config and tokens itself.
   While the app is open the foreground loop is sending, so skip. */
if (!IS_EXPO_GO) {
  TaskManager.defineTask(BG_TASK, async ({ data, error }) => {
    if (error || !data || !data.locations || !data.locations.length) return;
    if (AppState.currentState === 'active') return;
    try {
      if (!getDeviceId()) await loadConfig();
      if (!hasSession()) await loadTokens();
      if (!hasSession()) return;
      await sendFix(data.locations[data.locations.length - 1]);
    } catch {}
  });
}

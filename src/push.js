/* =============================================================================
   push.js — Firebase Cloud Messaging via expo-notifications (§9).

   - Android receives DATA messages: the app builds the notification itself,
     on the channel the server names (ride_requests / ride_updates).
   - iOS receives a visible alert.
   - Remote push needs a development build with google-services.json. In Expo
     Go, expo-notifications throws on Android as soon as it is imported (its
     auto-registration side effect), so it is required lazily, and only in a
     build that can use it; everywhere else push is a no-op.
   - iOS: getDevicePushTokenAsync returns an APNs token, not an FCM one, so
     registering iOS needs the Firebase Messaging SDK; not done here.
   ========================================================================== */

import { AppState, Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import Constants from 'expo-constants';

import { put, isUnavailable } from './api';
import { IS_EXPO_GO, getDeviceId } from './config';
import { getLang } from './i18n';

const PUSH_TASK = 'driver-push';

/** Whether this build can receive FCM pushes at all. */
export const PUSH_SUPPORTED = !IS_EXPO_GO && Platform.OS === 'android';

// Never evaluated in Expo Go: see the header.
const Notifications = PUSH_SUPPORTED ? require('expo-notifications') : null;

// While the app is open, a remote push is only a hint to refresh: the app
// raises its own popup (see popup() below) from the state change, so remote
// ones stay hidden to avoid showing the same event twice.
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const local = !!(n.request.content.data && n.request.content.data.local);
      return {
        shouldShowBanner: local,
        shouldShowList: local,
        shouldPlaySound: local,
        shouldSetBadge: false,
      };
    },
  });
}

/** Pull { event, ride_id, title, body, channel } out of any payload shape. */
export function pushData(payload) {
  if (!payload) return {};
  let d = payload.data || payload;
  if (typeof d.dataString === 'string') {
    try {
      d = { ...d, ...JSON.parse(d.dataString) };
    } catch {}
  }
  return d;
}

/* Background handler for Android data messages: show the notification the
   server described. Defined at module load, like every TaskManager task. */
if (PUSH_SUPPORTED) {
  TaskManager.defineTask(PUSH_TASK, async ({ data, error }) => {
    if (error || !data || 'actionIdentifier' in data) return;
    if (AppState.currentState === 'active') return;
    const d = pushData(data);
    if (!d.title && !d.body) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: d.title,
        body: d.body,
        data: { event: d.event, ride_id: d.ride_id },
        sound: d.channel === 'ride_requests' ? 'default' : undefined,
      },
      trigger: { channelId: d.channel === 'ride_requests' ? 'ride_requests' : 'ride_updates' },
    });
  });
}

let setupDone = false;
let tokenSub = null;

async function setup() {
  if (setupDone || !Notifications) return;
  setupDone = true;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('ride_requests', {
      name: 'Ride requests',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
    await Notifications.setNotificationChannelAsync('ride_updates', {
      name: 'Ride updates',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  await Notifications.registerTaskAsync(PUSH_TASK).catch(() => {});
}

/**
 * Heads-up popup while the app is open (development builds only; Expo Go
 * cannot load expo-notifications). channel: 'ride_requests' rings, the rest
 * use 'ride_updates'. Tapping it goes through listenPush's onTap.
 */
export async function popup({ event, rideId, title, body, channel = 'ride_updates' }) {
  if (!Notifications) return;
  try {
    await setup();
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { event, ride_id: rideId != null ? String(rideId) : undefined, local: true },
        sound: channel === 'ride_requests' ? 'default' : undefined,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: { channelId: channel },
    });
  } catch {}
}

async function sendToken(token) {
  try {
    await put('/driver/devices', {
      device_id: getDeviceId(),
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      push_token: token,
      app_version: (Constants.expoConfig && Constants.expoConfig.version) || '1.0.0',
      locale: getLang(),
    });
  } catch (e) {
    // 404 notification.session_not_found: no live session; the next login fixes it
    if (!isUnavailable(e)) throw e;
  }
}

/**
 * Call after login and on every app start (§9.2). Returns false when push is
 * not possible in this build or permission was refused.
 */
export async function registerPushDevice() {
  await setup().catch(() => {});
  if (!PUSH_SUPPORTED) return false;
  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return false;
  const { data: token } = await Notifications.getDevicePushTokenAsync();
  await sendToken(token);
  if (!tokenSub) tokenSub = Notifications.addPushTokenListener((next) => sendToken(next.data).catch(() => {}));
  return true;
}

/**
 * Listen for pushes while open (refresh) and for taps (open the right screen).
 * Returns an unsubscribe function.
 */
export function listenPush({ onReceive, onTap }) {
  if (!Notifications) return () => {};
  const a = Notifications.addNotificationReceivedListener((n) => onReceive(pushData(n.request.content)));
  const b = Notifications.addNotificationResponseReceivedListener((r) =>
    onTap(pushData(r.notification.request.content))
  );
  // a tap that launched the app from cold
  Notifications.getLastNotificationResponseAsync()
    .then((r) => r && onTap(pushData(r.notification.request.content)))
    .catch(() => {});
  return () => {
    a.remove();
    b.remove();
  };
}

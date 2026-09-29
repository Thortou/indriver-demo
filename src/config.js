/* =============================================================================
   config.js — persisted settings: API base URL, install device id, language.

   Everything lives in SecureStore (Keystore / Keychain). Values are tiny, and
   it saves adding a second storage module.
   ========================================================================== */

import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const KEYS = {
  baseUrl: 'cfg_base_url',
  deviceId: 'cfg_device_id',
  lang: 'cfg_lang',
  onlineIntent: 'cfg_online_intent',
  locSeq: 'cfg_loc_seq',
};

export const API_PORT = 8080;

/** True inside the Expo Go app, where push and background location are off. */
export const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** From .env; Metro inlines EXPO_PUBLIC_* at bundle time. */
const ENV_API_URL = process.env.EXPO_PUBLIC_API_URL || `http://localhost:${API_PORT}`;

const LOOPBACK = /^(localhost|127\.0\.0\.1)$/;

/**
 * "localhost" means the computer running the backend (DRIVER_APP_API.md §1.1),
 * but on a phone it would mean the phone. That computer also serves the JS
 * bundle, so swap in its LAN host from Expo's hostUri; failing that, use the
 * Android emulator's alias for the host machine.
 */
function resolveUrl(url) {
  const m = url.match(/^(https?:\/\/)([^/:]+)(.*)$/);
  if (!m || !LOOPBACK.test(m[2])) return url;
  const hostUri = Constants.expoConfig && Constants.expoConfig.hostUri;
  const devHost = hostUri ? hostUri.split(':')[0] : null;
  if (devHost && !LOOPBACK.test(devHost)) return `${m[1]}${devHost}${m[3]}`;
  return Platform.OS === 'android' ? `${m[1]}10.0.2.2${m[3]}` : url;
}

const state = { baseUrl: null, deviceId: null, lang: 'lo' };

export async function loadConfig() {
  const [baseUrl, deviceId, lang] = await Promise.all([
    SecureStore.getItemAsync(KEYS.baseUrl),
    SecureStore.getItemAsync(KEYS.deviceId),
    SecureStore.getItemAsync(KEYS.lang),
  ]);
  // a URL saved in Settings wins over .env
  state.baseUrl = baseUrl || ENV_API_URL;
  state.lang = lang === 'en' ? 'en' : 'lo';
  // one UUID per install, stored for good; iOS makes uppercase ones (§1.5)
  state.deviceId = (deviceId || Crypto.randomUUID()).toLowerCase();
  if (!deviceId) await SecureStore.setItemAsync(KEYS.deviceId, state.deviceId);
  return { ...state };
}

/** As configured (.env or Settings) — shown in Settings. */
export const getConfiguredBaseUrl = () => state.baseUrl || ENV_API_URL;
/** What requests actually use, with localhost resolved for this device. */
export const getBaseUrl = () => resolveUrl(getConfiguredBaseUrl());
export const getDeviceId = () => state.deviceId;
export const getWsBase = () => getBaseUrl().replace(/^http/, 'ws');

export async function setBaseUrl(url) {
  state.baseUrl = url.trim().replace(/\/+$/, '');
  await SecureStore.setItemAsync(KEYS.baseUrl, state.baseUrl);
}

export async function saveLang(lang) {
  state.lang = lang;
  await SecureStore.setItemAsync(KEYS.lang, lang);
}

/** The driver's last online choice, so a restart resumes it. */
export const loadOnlineIntent = async () =>
  (await SecureStore.getItemAsync(KEYS.onlineIntent)) === 'ONLINE';
export const saveOnlineIntent = (online) =>
  SecureStore.setItemAsync(KEYS.onlineIntent, online ? 'ONLINE' : 'OFFLINE');

/**
 * Location `seq` must strictly increase for the whole install (§4.2). Epoch ms
 * already does, but the persisted floor also survives a clock going backwards.
 */
let lastSeq = 0;
export async function nextLocationSeq() {
  if (!lastSeq) lastSeq = Number(await SecureStore.getItemAsync(KEYS.locSeq)) || 0;
  lastSeq = Math.max(lastSeq + 1, Date.now());
  SecureStore.setItemAsync(KEYS.locSeq, String(lastSeq)).catch(() => {});
  return lastSeq;
}

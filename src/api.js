/* =============================================================================
   api.js — HTTP client for the inseeDrive backend (DRIVER_APP_API.md §1–2).

   - Success is wrapped: { status_code, message, data, pagination? }.
   - Failure is a problem document; it becomes an ApiError.
   - A 401 on a bearer route refreshes once (serialized) and retries; if the
     refresh fails the session ends and the app returns to Login.
   ========================================================================== */

import * as SecureStore from 'expo-secure-store';

import { getBaseUrl, getDeviceId } from './config';
import { getLang, t } from './i18n';

const TOKENS_KEY = 'auth_tokens';

export class ApiError extends Error {
  constructor({ status, code, detail, errors, retryable, retryAfter }) {
    super(detail || code || `HTTP ${status}`);
    this.status = status;
    this.code = code || '';
    this.detail = detail || '';
    this.errors = errors || [];
    this.retryable = !!retryable;
    this.retryAfter = retryAfter; // seconds, from the Retry-After header
  }
}

/** A switched-off backend feature answers a plain 404 `http.not_found` (§1.2). */
export const isUnavailable = (e) => e instanceof ApiError && e.status === 404 && e.code === 'http.not_found';

/** First field-level error code, e.g. the availability reason in driver.not_available. */
export const firstErrorCode = (e) => (e && e.errors && e.errors[0] && e.errors[0].code) || '';

/* ------------------------------------------------------------------ session */

let tokens = null; // { access_token, refresh_token, expires_in }
let sessionEndedHandler = () => {};

export const onSessionEnded = (fn) => {
  sessionEndedHandler = fn;
};

export async function loadTokens() {
  try {
    const raw = await SecureStore.getItemAsync(TOKENS_KEY);
    tokens = raw ? JSON.parse(raw) : null;
  } catch {
    tokens = null;
  }
  return tokens;
}

export async function saveTokens(next) {
  tokens = next;
  if (next) await SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify(next));
  else await SecureStore.deleteItemAsync(TOKENS_KEY);
}

export const hasSession = () => !!(tokens && tokens.refresh_token);
export const getRefreshToken = () => tokens && tokens.refresh_token;

/* ------------------------------------------------------------------ request */

/**
 * Multipart uploads go through XMLHttpRequest: since SDK 57 the global fetch
 * is expo/fetch, which cannot send React Native's { uri, type, name } file
 * parts. Resolves to the subset of Response that send() reads.
 */
function xhrSend(method, url, headers, form) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.timeout = 60000;
    xhr.onload = () =>
      resolve({
        status: xhr.status,
        ok: xhr.status >= 200 && xhr.status < 300,
        headers: { get: (name) => xhr.getResponseHeader(name) },
        text: async () => xhr.responseText,
      });
    xhr.onerror = () => reject(new Error('network'));
    xhr.ontimeout = () => reject(new Error('timeout'));
    xhr.send(form);
  });
}

async function send(method, path, { body, form, bearer, signal } = {}) {
  const headers = { Lang: getLang(), Accept: 'application/json' };
  if (!form) headers['Content-Type'] = 'application/json';
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  let res;
  try {
    res = form
      ? await xhrSend(method, getBaseUrl() + path, headers, form)
      : await fetch(getBaseUrl() + path, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal,
        });
  } catch (e) {
    if (e && e.name === 'AbortError') throw e;
    throw new ApiError({ status: 0, code: 'network', detail: t('network'), retryable: true });
  }

  if (res.status === 204) return { data: null };

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}

  if (res.ok) return json || { data: null };

  const retryAfter = Number(res.headers.get('Retry-After')) || undefined;
  throw new ApiError({
    status: res.status,
    code: json && json.code,
    detail: (json && json.detail) || (res.status >= 500 ? t('somethingWrong') : ''),
    errors: json && json.errors,
    retryable: json ? json.retryable : res.status >= 500,
    retryAfter,
  });
}

let refreshing = null;

/** One refresh in flight at a time; refresh tokens rotate, so always store the new pair. */
export function refreshSession() {
  if (!refreshing) {
    refreshing = (async () => {
      if (!tokens || !tokens.refresh_token) throw new ApiError({ status: 401, code: 'identity.unauthenticated' });
      const out = await send('POST', '/auth/refresh', {
        body: { refresh_token: tokens.refresh_token, device_id: getDeviceId() },
      });
      await saveTokens(out.data.tokens);
      return out.data;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

/**
 * Full envelope: { data, pagination, message }.
 * opts.auth = false for public routes; opts.bearer overrides the token
 * (the sign-up ticket).
 */
export async function requestFull(method, path, opts = {}) {
  const useSession = opts.auth !== false && !opts.bearer;
  try {
    return await send(method, path, { ...opts, bearer: opts.bearer || (useSession && tokens ? tokens.access_token : null) });
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401 || !useSession) throw e;
    try {
      await refreshSession();
    } catch (refreshError) {
      // a network failure is not a lost session — keep the tokens
      if (refreshError instanceof ApiError && refreshError.status === 0) throw refreshError;
      await saveTokens(null);
      sessionEndedHandler();
      throw e;
    }
    return send(method, path, { ...opts, bearer: tokens.access_token });
  }
}

export const request = async (method, path, opts) => (await requestFull(method, path, opts)).data;

export const get = (path, opts) => request('GET', path, opts);
export const post = (path, body, opts) => request('POST', path, { ...opts, body });
export const put = (path, body, opts) => request('PUT', path, { ...opts, body });

/** multipart upload (§2.1 step 2, §3.2). Returns { key, url }. */
export function upload({ uri, purpose, mimeType = 'image/jpeg', name = 'photo.jpg', bearer }) {
  const form = new FormData();
  form.append('purpose', purpose);
  form.append('file', { uri, type: mimeType, name });
  return request('POST', '/upload', { form, bearer });
}

/** Query string from an object, skipping empty values. */
export function qs(params) {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

/** Message to show for an error: the server's translated detail when it has one. */
export function errorText(e) {
  if (!e) return t('somethingWrong');
  if (e instanceof ApiError) {
    const own = `err_${e.code.replace(/\./g, '_')}`;
    const mine = t(own);
    if (mine !== own) return mine;
    return e.detail || t('somethingWrong');
  }
  return t('somethingWrong');
}

/* =============================================================================
   realtime.js — driver WebSocket (DRIVER_APP_API.md §8).

   Frames are hints: the owner re-reads REST on every connect and frame. The
   app never sends data on the socket; React Native's WebSocket answers the
   server's pings itself.
   ========================================================================== */

import { post, isUnavailable, ApiError } from './api';
import { getDeviceId, getWsBase } from './config';

const KNOWN = new Set([
  'ride.requested',
  'ride.driver_selected',
  'offer.not_selected',
  'ride.cancelled',
  'driver.position',
]);

/**
 * new Realtime({ onStatus, onConnected, onFrame, onSessionEnded })
 *   onStatus('live' | 'polling' | 'off')
 *   onConnected()        — re-read current ride and requests
 *   onFrame(frame)       — a new, known, v1 frame
 *   onFrame({ type: 'refresh' }) — an unknown frame: just refresh
 *   onSessionEnded()     — close 4003 or 403 realtime.no_session
 */
export class Realtime {
  constructor(handlers) {
    this.h = handlers;
    this.ws = null;
    this.wanted = false;
    this.backoff = 1000;
    this.timer = null;
    this.seen = [];
  }

  start() {
    if (this.wanted) return;
    this.wanted = true;
    this.backoff = 1000;
    this.connect();
  }

  stop() {
    this.wanted = false;
    clearTimeout(this.timer);
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      ws.onclose = null;
      ws.close(1000);
    }
    this.h.onStatus('off');
  }

  schedule(delay) {
    clearTimeout(this.timer);
    if (!this.wanted) return;
    this.timer = setTimeout(() => this.connect(), delay);
  }

  retryLater() {
    this.h.onStatus('polling'); // REST polling covers the gap (§8.6)
    const delay = this.backoff;
    this.backoff = Math.min(this.backoff * 2, 30000);
    this.schedule(delay);
  }

  async connect() {
    if (!this.wanted) return;
    let ticket;
    try {
      ticket = (await post('/driver/realtime/ticket', { device_id: getDeviceId() })).ticket;
    } catch (e) {
      if (!this.wanted) return;
      if (isUnavailable(e)) {
        // realtime is switched off on the server: poll, and look again later
        this.h.onStatus('polling');
        this.schedule(60000);
        return;
      }
      if (e instanceof ApiError && e.status === 401) return; // session ended; api.js handles it
      this.retryLater();
      return;
    }
    if (!this.wanted) return;

    const url =
      `${getWsBase()}/driver/realtime?ticket=${encodeURIComponent(ticket)}` +
      `&device_id=${encodeURIComponent(getDeviceId())}`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.backoff = 1000;
      this.h.onStatus('live');
      this.h.onConnected();
    };

    ws.onmessage = (ev) => {
      let frame;
      try {
        frame = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (frame.id) {
        if (this.seen.includes(frame.id)) return; // frames may arrive twice
        this.seen.push(frame.id);
        if (this.seen.length > 200) this.seen.shift();
      }
      if (frame.v !== 1 || !KNOWN.has(frame.type)) {
        this.h.onFrame({ type: 'refresh' });
        return;
      }
      this.h.onFrame(frame);
    };

    ws.onerror = () => {};

    ws.onclose = (ev) => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (!this.wanted) return;
      switch (ev.code) {
        case 4002: // replaced by a newer connection: leave it
          this.wanted = false;
          this.h.onStatus('polling');
          return;
        case 4003: // session ended
          this.wanted = false;
          this.h.onStatus('off');
          this.h.onSessionEnded();
          return;
        case 4001: // session window reached: new ticket right away
          this.backoff = 1000;
          this.schedule(0);
          return;
        default:
          this.retryLater();
      }
    };
  }
}

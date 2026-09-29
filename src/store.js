/* =============================================================================
   store.js — app state (zustand). Actions that talk to the API live in
   engine.js; this file is state only, so every other module can import it.
   ========================================================================== */

import { create } from 'zustand';

export const initialDriverState = {
  account: null, //        /auth/me
  me: null, //             /driver/me
  online: false, //        the driver's ONLINE / OFFLINE intent
  availability: null, //   { available, reason } from status / location replies
  fix: null, //            { lat, lng, accuracy } — own GPS
  backgroundLocation: false,
  requests: [], //         /driver/ride-requests
  requestsLoaded: false,
  offer: null, //          the one open offer: { ...offer, request }
  ride: null, //           /driver/rides/current (null = none)
  dismissedRideId: null, //ended trip the driver already closed
  realtime: 'off', //      'live' | 'polling' | 'off'
};

export const useApp = create((set) => ({
  booted: false,
  session: false, // tokens present and valid
  lang: 'lo',
  toast: null,
  ...initialDriverState,

  showToast: (text) => {
    set({ toast: text });
    clearTimeout(useApp._toastTimer);
    useApp._toastTimer = setTimeout(() => set({ toast: null }), 3200);
  },
}));

export const toast = (text) => useApp.getState().showToast(text);

/** The ride the Home tab should show: active, or ended and not yet dismissed. */
export function visibleRide(state) {
  const r = state.ride;
  if (!r) return null;
  if (r.active) return r;
  return r.id === state.dismissedRideId ? null : r;
}

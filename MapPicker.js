/* =============================================================================
   Map module — WebView + Leaflet + OpenStreetMap raster tiles.
   No API key, no native map module, so it runs unchanged in Expo Go.

   Exports
     MapPicker (default) — interactive tap-to-place pick-up / drop-off picker
     LiveMap             — static map: route, pins, drifting nearby cars, and
                           a driver car that follows the route during a trip
     fetchRoute          — OSRM road distance + polyline
     reverseGeocode      — Nominatim place name

   Networking lives on the React Native side rather than inside the WebView so
   that we can set a User-Agent (Nominatim requires one) and keep the distance
   that drives the fare in a single place. Both services are free public
   infrastructure with rate limits and no SLA; every call fails soft.
   ========================================================================== */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
  StyleSheet,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';

import { C as TOKENS, theme } from './theme';

/* The LaoRide tokens, plus the legacy aliases this file was written against.
   theme.js imports nothing from here or from App.js, so there is no cycle. */
const C = {
  ...TOKENS,
  gold: TOKENS.lime,       // lime accent — FILLS only, never text on a light bg
  goldSoft: TOKENS.limeSoft,
  teal: TOKENS.green,      // origin dot / "from" pin
};

const UA = 'LaoRideDemo/1.0 (Expo demo app; OSM public services)';

export const NEARBY_CARS = 6;

let placeSeq = 0;
const placeId = () => `map_${Date.now().toString(36)}_${++placeSeq}`;

/* =============================================================================
   NETWORK
   ========================================================================== */

/**
 * Real driving distance and route geometry from the OSRM demo server.
 * Returns { km, min, coords } with coords already flipped to Leaflet's
 * [lat, lng] order, or null on any failure.
 */
export async function fetchRoute(a, b, signal, opts) {
  if (!a || !b) return null;
  const wantSteps = !!(opts && opts.steps);
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${a.lng},${a.lat};${b.lng},${b.lat}` +
      `?overview=full&geometries=geojson` +
      (wantSteps ? '&steps=true' : '');

    const res = await fetch(url, { signal });
    if (!res.ok) return null;

    const json = await res.json();
    const route = json && json.routes && json.routes[0];
    if (json.code !== 'Ok' || !route) return null;

    const leg = route.legs && route.legs[0];
    const steps =
      wantSteps && leg && leg.steps
        ? leg.steps.map((st) => ({
            distance: st.distance,
            name: st.name || '',
            type: st.maneuver ? st.maneuver.type : '',
            modifier: st.maneuver ? st.maneuver.modifier : '',
          }))
        : null;

    return {
      km: route.distance / 1000, // already road distance — never apply the 1.35 factor
      min: route.duration / 60,
      coords: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      steps,
    };
  } catch {
    return null;
  }
}

/** OSRM maneuver -> Lao instruction, English sub-line, and an arrow glyph. */
export function laoManeuver(step) {
  if (!step) return null;
  const m = step.modifier || '';
  const byType = {
    depart: { lo: 'ອອກເດີນທາງ', en: 'Head out', icon: '↑' },
    arrive: { lo: 'ຮອດຈຸດໝາຍ', en: 'Arrive', icon: '🏁' },
    roundabout: { lo: 'ເຂົ້າວົງວຽນ', en: 'Enter roundabout', icon: '↻' },
    rotary: { lo: 'ເຂົ້າວົງວຽນ', en: 'Enter roundabout', icon: '↻' },
    merge: { lo: 'ລວມເສັ້ນທາງ', en: 'Merge', icon: '⤳' },
    fork: { lo: 'ແຍກທາງ', en: 'Keep at the fork', icon: '⑂' },
  };
  const byModifier = {
    left: { lo: 'ລ້ຽວຊ້າຍ', en: 'Turn left', icon: '↰' },
    right: { lo: 'ລ້ຽວຂວາ', en: 'Turn right', icon: '↱' },
    'slight left': { lo: 'ບ່ຽງຊ້າຍ', en: 'Slight left', icon: '↰' },
    'slight right': { lo: 'ບ່ຽງຂວາ', en: 'Slight right', icon: '↱' },
    'sharp left': { lo: 'ລ້ຽວຊ້າຍແຮງ', en: 'Sharp left', icon: '↰' },
    'sharp right': { lo: 'ລ້ຽວຂວາແຮງ', en: 'Sharp right', icon: '↱' },
    uturn: { lo: 'ກັບລົດ', en: 'Make a U-turn', icon: '↺' },
    straight: { lo: 'ຊື່ໄປ', en: 'Continue straight', icon: '↑' },
  };

  const base =
    byType[step.type] ||
    byModifier[m] ||
    { lo: 'ຊື່ໄປ', en: 'Continue', icon: '↑' };

  // a turn's direction is more useful than the generic "turn"
  const chosen = step.type === 'turn' && byModifier[m] ? byModifier[m] : base;

  const dist =
    step.distance >= 1000
      ? `${(step.distance / 1000).toFixed(1)} km`
      : `${Math.round(step.distance / 10) * 10} m`;

  return {
    lo: `${chosen.lo} ${dist}`,
    en: step.name ? `${chosen.en} onto ${step.name}` : chosen.en,
    icon: chosen.icon,
  };
}

const unnamed = (lat, lng) => ({
  name: 'ຈຸດທີ່ເລືອກເທິງແຜນທີ່',
  district: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
});

// Nominatim's usage policy is one request per second, enforced here.
let lastLookup = 0;

/**
 * Reverse geocode to a Lao place name. Always resolves — falls back to
 * coordinates rather than rejecting, so a pin can never end up nameless.
 */
export async function reverseGeocode(lat, lng, signal) {
  const wait = Math.max(0, 1100 - (Date.now() - lastLookup));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  if (signal && signal.aborted) return unnamed(lat, lng);
  lastLookup = Date.now();

  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
      `&lat=${lat}&lon=${lng}&zoom=17&accept-language=lo,en`;

    const res = await fetch(url, {
      signal,
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (!res.ok) return unnamed(lat, lng);

    const json = await res.json();
    const addr = json.address || {};

    const name =
      json.name ||
      addr.amenity ||
      addr.building ||
      addr.road ||
      (json.display_name || '').split(',')[0] ||
      null;

    // county is the Lao district ("ເມືອງ…"), matching the preset PLACES shape
    const district =
      addr.county || addr.village || addr.suburb || addr.city_district || addr.city || '';

    if (!name) return unnamed(lat, lng);
    return { name: String(name).trim(), district: String(district).trim() };
  } catch {
    return unnamed(lat, lng);
  }
}

/* =============================================================================
   DEVICE LOCATION
   ========================================================================== */

/**
 * Ask for foreground location permission and read the current position.
 * Resolves to { status, lat, lng } where status is one of:
 *   'granted' | 'denied' | 'failed'   (lat/lng only present when granted)
 * Never throws — a demo must survive a refused prompt or a dead GPS.
 */
export async function getCurrentCoords() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { status: 'denied' };

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { status: 'granted', lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return { status: 'failed' };
  }
}

/** getCurrentCoords plus a reverse-geocoded Lao name, as a Place object. */
export async function getCurrentPlace(signal) {
  const fix = await getCurrentCoords();
  if (fix.status !== 'granted') return { status: fix.status, place: null };

  const { name, district } = await reverseGeocode(fix.lat, fix.lng, signal);
  return {
    status: 'granted',
    place: {
      id: placeId(),
      name,
      district,
      alias: '',
      lat: fix.lat,
      lng: fix.lng,
      isCurrent: true,
    },
  };
}

/* =============================================================================
   SHARED LEAFLET DOCUMENT PIECES
   ========================================================================== */

const HEAD = `
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #map { height: 100%; margin: 0; background: ${C.bg}; }

  .pin {
    width: 20px; height: 20px; border-radius: 50%;
    border: 3px solid #ffffff;
    box-shadow: 0 0 0 1px rgba(17,17,17,.18), 0 2px 6px rgba(17,17,17,.28);
  }
  .pin.from { background: ${C.teal}; }
  .pin.to   { background: ${C.text}; border-radius: 4px; }

  /* the device's own position — distinct from the chosen pick-up */
  .mePin {
    width: 15px; height: 15px; border-radius: 50%;
    background: #2f6fe0;
    border: 3px solid #ffffff;
    box-shadow: 0 0 0 9px rgba(47,111,224,.22), 0 2px 5px rgba(17,17,17,.3);
  }

  /* home: pick-up as a green ring, no destination yet */
  body.homeMode .pin.from {
    width: 16px; height: 16px;
    background: #ffffff;
    border: 5px solid #3f9a4f;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(17,17,17,.3);
  }

  /* searching for drivers: rider as a dark blob, destination as a green ring */
  body.radarMode .pin.from {
    width: 26px; height: 22px;
    background: #1d2415;
    border: none;
    border-radius: 13px 13px 4px 4px;
    box-shadow: 0 2px 6px rgba(17,17,17,.35);
  }
  body.radarMode .pin.to {
    width: 20px; height: 20px;
    background: #ffffff;
    border: 5px solid #2f8f5f;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(17,17,17,.3);
  }
  @keyframes sonar { 0% { stroke-opacity: .10 } 50% { stroke-opacity: .85 } 100% { stroke-opacity: .10 } }
  .sonar { animation: sonar 2.6s ease-in-out infinite; }
  .sonar2 { animation-delay: .5s; }
  .sonar3 { animation-delay: 1s; }
  .sonar4 { animation-delay: 1.5s; }

  /* waiting-for-pickup: the rider's own position, not a destination square */
  body.haloDest .pin.to {
    background: ${C.gold};
    border-radius: 50%;
    box-shadow: 0 0 0 3px #ffffff, 0 0 0 13px rgba(200,240,75,.30);
  }

  /* vehicle marker: top-down artwork, rotated to its heading */
  .vRot {
    line-height: 0;
    transform-origin: 50% 50%;
    filter: drop-shadow(0 2px 4px rgba(17,17,17,.38));
  }

  /* glide between position ticks; enabled after first paint so markers
     do not fly in from the top-left corner */
  body.glide .leaflet-marker-icon.vehIcon { transition: transform .9s linear; }

  .leaflet-control-attribution {
    background: rgba(255,255,255,.88); color: ${C.faint}; font-size: 9px;
  }
  .leaflet-control-attribution a { color: ${C.accentText}; }
  .leaflet-bar a {
    background: ${C.card}; color: ${C.text}; border-bottom-color: ${C.line};
  }
</style>`;

/** Map creation, icons, and the nearby-car simulation — shared by both docs. */
const CORE_JS = `
var post = function (o) {
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(o));
};

/* ---- base layers ----
   Street: OpenStreetMap raster.
   Satellite: Esri World Imagery, with the Esri reference overlay on top so
   roads and place names stay readable over the photography. Note Esri's tile
   path is {z}/{y}/{x} — the y and x are swapped relative to OSM. */
var LAYERS = {
  street: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }),
  satellite: L.layerGroup([
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics'
    }),
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19
    })
  ])
};

var activeLayer = null;

function setLayer(name) {
  var next = LAYERS[name] || LAYERS.street;
  if (next === activeLayer) return;
  if (activeLayer) map.removeLayer(activeLayer);
  activeLayer = next;
  activeLayer.addTo(map);
}

setLayer('street');

var ICON = {
  from: L.divIcon({ className: '', html: '<div class="pin from"></div>', iconSize: [20,20], iconAnchor: [10,10] }),
  to:   L.divIcon({ className: '', html: '<div class="pin to"></div>',   iconSize: [20,20], iconAnchor: [10,10] })
};

/* Top-down vehicle artwork. Drawn as inline SVG so it stays crisp at any
   density and can be rotated to the heading — an emoji cannot. */
var INK = '#22261c';
var GLASS = '#2f3a44';
var LAMP = '#fff6d0';

var VEH_ART = {
  car: {
    w: 24, h: 44,
    svg: function (fill) {
      return '<svg viewBox="0 0 24 44" width="24" height="44" xmlns="http://www.w3.org/2000/svg">'
        + '<rect x="0.4" y="8" width="4.2" height="9" rx="1.7" fill="' + INK + '"/>'
        + '<rect x="19.4" y="8" width="4.2" height="9" rx="1.7" fill="' + INK + '"/>'
        + '<rect x="0.4" y="27" width="4.2" height="9" rx="1.7" fill="' + INK + '"/>'
        + '<rect x="19.4" y="27" width="4.2" height="9" rx="1.7" fill="' + INK + '"/>'
        + '<rect x="2.4" y="1.4" width="19.2" height="41.2" rx="6.6" fill="' + fill + '" stroke="' + INK + '" stroke-width="1.4"/>'
        + '<path d="M6 12.4 L18 12.4 L16.3 7.3 Q12 5.7 7.7 7.3 Z" fill="' + GLASS + '"/>'
        + '<rect x="6.2" y="14.4" width="11.6" height="13.6" rx="3" fill="#ffffff" opacity="0.20"/>'
        + '<path d="M6.7 30.2 L17.3 30.2 L18.3 35.4 Q12 37.1 5.7 35.4 Z" fill="' + GLASS + '" opacity="0.9"/>'
        + '<rect x="4.6" y="2.3" width="4.2" height="2.3" rx="1.1" fill="' + LAMP + '"/>'
        + '<rect x="15.2" y="2.3" width="4.2" height="2.3" rx="1.1" fill="' + LAMP + '"/>'
        + '</svg>';
    }
  },
  moto: {
    w: 18, h: 38,
    svg: function (fill) {
      return '<svg viewBox="0 0 18 38" width="18" height="38" xmlns="http://www.w3.org/2000/svg">'
        + '<rect x="6.6" y="2.6" width="4.8" height="6.2" rx="2.2" fill="' + INK + '"/>'
        + '<rect x="6.6" y="29" width="4.8" height="6.8" rx="2.2" fill="' + INK + '"/>'
        + '<rect x="1.6" y="10.2" width="14.8" height="2.4" rx="1.2" fill="' + INK + '"/>'
        + '<rect x="4.9" y="9" width="8.2" height="22" rx="3.6" fill="' + fill + '" stroke="' + INK + '" stroke-width="1.3"/>'
        + '<rect x="6.1" y="12.6" width="5.8" height="5" rx="1.8" fill="' + GLASS + '" opacity="0.55"/>'
        + '<rect x="6.1" y="19.4" width="5.8" height="7.6" rx="2.6" fill="' + GLASS + '"/>'
        + '<rect x="7.2" y="6.2" width="3.6" height="2.1" rx="1" fill="' + LAMP + '"/>'
        + '</svg>';
    }
  },
  deliv: {
    w: 24, h: 44,
    svg: function (fill) {
      return '<svg viewBox="0 0 24 44" width="24" height="44" xmlns="http://www.w3.org/2000/svg">'
        + '<rect x="0.4" y="9" width="4.2" height="9" rx="1.7" fill="' + INK + '"/>'
        + '<rect x="19.4" y="9" width="4.2" height="9" rx="1.7" fill="' + INK + '"/>'
        + '<rect x="0.4" y="28" width="4.2" height="9" rx="1.7" fill="' + INK + '"/>'
        + '<rect x="19.4" y="28" width="4.2" height="9" rx="1.7" fill="' + INK + '"/>'
        + '<rect x="2.2" y="1.4" width="19.6" height="41.2" rx="3.4" fill="' + fill + '" stroke="' + INK + '" stroke-width="1.4"/>'
        + '<path d="M6 12 L18 12 L16.4 7 Q12 5.5 7.6 7 Z" fill="' + GLASS + '"/>'
        + '<rect x="4.8" y="15.6" width="14.4" height="23.6" rx="2.2" fill="' + INK + '" opacity="0.12"/>'
        + '<rect x="4.8" y="15.6" width="14.4" height="23.6" rx="2.2" fill="none" stroke="' + INK + '" stroke-width="1.2" opacity="0.75"/>'
        + '<rect x="4.8" y="26.8" width="14.4" height="1.3" fill="' + INK + '" opacity="0.7"/>'
        + '<rect x="4.6" y="2.3" width="4.2" height="2.3" rx="1.1" fill="' + LAMP + '"/>'
        + '<rect x="15.2" y="2.3" width="4.2" height="2.3" rx="1.1" fill="' + LAMP + '"/>'
        + '</svg>';
    }
  }
};

var vehKind = 'car';

function vehIcon(hero) {
  var art = VEH_ART[vehKind] || VEH_ART.car;
  return L.divIcon({
    className: 'vehIcon',
    html: '<div class="vRot">' + art.svg(hero ? '${C.gold}' : '#f7f8f4') + '</div>',
    iconSize: [art.w, art.h],
    iconAnchor: [art.w / 2, art.h / 2]
  });
}

function setRot(m, deg) {
  var el = m.getElement();
  if (!el) return;
  var r = el.querySelector('.vRot');
  if (r) r.style.transform = 'rotate(' + deg + 'deg)';
}

function bearing(a, b) {
  return Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
}

/* ---- idle cars drifting around the pick-up ---- */
var cars = [], carTimer = null, carHome = null;

function clearCars() {
  if (carTimer) { clearInterval(carTimer); carTimer = null; }
  for (var i = 0; i < cars.length; i++) map.removeLayer(cars[i].m);
  cars = [];
}

function spawnCars(lat, lng, n) {
  clearCars();
  carHome = { lat: lat, lng: lng };
  for (var i = 0; i < n; i++) {
    var a = Math.random() * Math.PI * 2;
    var r = 0.003 + Math.random() * 0.009;           // roughly 300m - 1.2km
    var c = {
      lat: lat + Math.sin(a) * r,
      lng: lng + Math.cos(a) * r,
      hd: Math.random() * 360
    };
    c.m = L.marker([c.lat, c.lng], { icon: vehIcon(false), interactive: false, zIndexOffset: -400 }).addTo(map);
    setRot(c.m, c.hd);
    cars.push(c);
  }
  carTimer = setInterval(tickCars, 900);
  setTimeout(function () { document.body.classList.add('glide'); }, 150);
}

function tickCars() {
  for (var i = 0; i < cars.length; i++) {
    var c = cars[i];
    c.hd += (Math.random() - 0.5) * 34;
    var step = 0.00022 + Math.random() * 0.00026;
    c.lat += Math.cos(c.hd * Math.PI / 180) * step;
    c.lng += Math.sin(c.hd * Math.PI / 180) * step;

    // turn back once it has wandered too far from where it started
    var dy = c.lat - carHome.lat, dx = c.lng - carHome.lng;
    if (Math.sqrt(dx * dx + dy * dy) > 0.014) c.hd = bearing([c.lat, c.lng], [carHome.lat, carHome.lng]);

    c.m.setLatLng([c.lat, c.lng]);
    setRot(c.m, c.hd);
  }
}`;

/* ---------------------------------------------------- interactive picker doc */

const PICKER_HTML = `<!DOCTYPE html><html><head>${HEAD}</head><body><div id="map"></div>
<script>
(function () {
  var map = L.map('map', { zoomControl: false }).setView([17.9668, 102.6135], 13);
  ${CORE_JS}

  var pins = { from: null, to: null };
  var line = null;

  function place(which, lat, lng) {
    if (pins[which]) { pins[which].setLatLng([lat, lng]); return; }
    var m = L.marker([lat, lng], { icon: ICON[which], draggable: true, zIndexOffset: 500 }).addTo(map);
    // fire only on release, never during the drag
    m.on('dragend', function (e) {
      var p = e.target.getLatLng();
      post({ t: 'drag', which: which, lat: p.lat, lng: p.lng });
    });
    pins[which] = m;
  }

  map.on('click', function (e) { post({ t: 'tap', lat: e.latlng.lat, lng: e.latlng.lng }); });

  window.LG = {
    setPin: function (which, lat, lng) { place(which, lat, lng); },
    layer: function (n) { setLayer(n); },
    zoom: function (d) { if (d > 0) map.zoomIn(); else map.zoomOut(); },
    vehicle: function (kind) {
      if (!VEH_ART[kind] || kind === vehKind) return;
      vehKind = kind;
      for (var i = 0; i < cars.length; i++) {
        cars[i].m.setIcon(vehIcon(false));
        setRot(cars[i].m, cars[i].hd);
      }
    },
    cars: function (lat, lng, n) { spawnCars(lat, lng, n); },
    route: function (coords) {
      if (line) map.removeLayer(line);
      line = L.polyline(coords, { color: '${C.text}', weight: 5, opacity: .85 }).addTo(map);
    },
    clearRoute: function () { if (line) { map.removeLayer(line); line = null; } },
    center: function (lat, lng, z) { map.setView([lat, lng], z || 16); },
    fit: function () {
      var pts = [];
      if (pins.from) pts.push(pins.from.getLatLng());
      if (pins.to) pts.push(pins.to.getLatLng());
      if (pts.length === 2) map.fitBounds(L.latLngBounds(pts), { padding: [60,60], maxZoom: 16 });
      else if (pts.length === 1) map.setView(pts[0], 15);
    }
  };

  post({ t: 'ready' });
}());
</script></body></html>`;

/* ------------------------------------------------------------- static doc */

const LIVE_HTML = `<!DOCTYPE html><html><head>${HEAD}</head><body><div id="map"></div>
<script>
(function () {
  // pan and pinch are on; we draw our own zoom buttons in React Native so they
  // match the app rather than Leaflet's default chrome
  var map = L.map('map', {
    zoomControl: false, dragging: true, touchZoom: true, doubleClickZoom: true,
    scrollWheelZoom: false, boxZoom: false, keyboard: false
  }).setView([17.9668, 102.6135], 13);
  ${CORE_JS}

  var line = null, pinA = null, pinB = null;
  var coords = [], cum = [], total = 0;
  var hero = null, approach = null, raf = null;
  var lineColor = '${C.text}', lineDash = null;

  function measure() {
    cum = [0]; total = 0;
    for (var i = 1; i < coords.length; i++) {
      var dy = coords[i][0] - coords[i-1][0], dx = coords[i][1] - coords[i-1][1];
      total += Math.sqrt(dy*dy + dx*dx);
      cum.push(total);
    }
  }

  /** Position and heading at fraction t (0..1) along the route. */
  function at(t) {
    if (coords.length < 2) return { pos: coords[0] || [17.9668,102.6135], deg: 0 };
    var d = Math.max(0, Math.min(1, t)) * total;
    var i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    var seg = cum[i] - cum[i-1] || 1;
    var k = (d - cum[i-1]) / seg;
    var a = coords[i-1], b = coords[i];
    return { pos: [a[0] + (b[0]-a[0])*k, a[1] + (b[1]-a[1])*k], deg: bearing(a, b) };
  }

  function setHero(pos, deg) {
    if (!hero) hero = L.marker(pos, { icon: vehIcon(true), interactive: false, zIndexOffset: 900 }).addTo(map);
    else hero.setLatLng(pos);
    if (deg != null) setRot(hero, deg);
  }

  function tween(dur, fn) {
    if (raf) cancelAnimationFrame(raf);
    var t0 = Date.now();
    (function step() {
      var k = Math.min(1, (Date.now() - t0) / dur);
      fn(k);
      if (k < 1) raf = requestAnimationFrame(step);
    }());
  }

  var rings = [];

  function clearRings() {
    for (var i = 0; i < rings.length; i++) map.removeLayer(rings[i]);
    rings = [];
  }

  var mePin = null;

  window.LG = {
    layer: function (n) { setLayer(n); },
    zoom: function (d) { if (d > 0) map.zoomIn(); else map.zoomOut(); },

    /** moto / car / delivery — changes every vehicle marker on the map */
    vehicle: function (kind) {
      if (!VEH_ART[kind] || kind === vehKind) return;
      vehKind = kind;
      for (var i = 0; i < cars.length; i++) {
        cars[i].m.setIcon(vehIcon(false));
        setRot(cars[i].m, cars[i].hd);
      }
      if (hero) hero.setIcon(vehIcon(true));
    },

    /** the device's own position, shown alongside the chosen pick-up */
    me: function (lat, lng) {
      if (lat == null) { if (mePin) { map.removeLayer(mePin); mePin = null; } return; }
      var icon = L.divIcon({ className: '', html: '<div class="mePin"></div>', iconSize: [15,15], iconAnchor: [7,7] });
      if (mePin) { mePin.setLatLng([lat, lng]); mePin.setIcon(icon); }
      else mePin = L.marker([lat, lng], { icon: icon, interactive: false, zIndexOffset: 300 }).addTo(map);
    },

    /** home screen: just the pick-up, no destination and no route */
    solo: function (lat, lng, showCars, n) {
      document.body.classList.add('homeMode');
      if (line) { map.removeLayer(line); line = null; }
      if (pinB) { map.removeLayer(pinB); pinB = null; }
      if (hero) { map.removeLayer(hero); hero = null; }
      if (raf) cancelAnimationFrame(raf);
      coords = [];
      if (pinA) map.removeLayer(pinA);
      pinA = L.marker([lat, lng], { icon: ICON.from, interactive: false, zIndexOffset: 500 }).addTo(map);
      map.setView([lat, lng], 15);
      if (showCars) spawnCars(lat, lng, n); else clearCars();
    },

    /** sonar rings around the rider while drivers are being found */
    radar: function (lat, lng, on) {
      clearRings();
      document.body.classList[on ? 'add' : 'remove']('radarMode');
      if (!on) return;
      var radii = [300, 620, 980, 1400];
      for (var i = 0; i < radii.length; i++) {
        var c = L.circle([lat, lng], {
          radius: radii[i],
          color: '#ffffff',
          weight: 3,
          opacity: 0.75,
          fill: false,
          interactive: false,
          className: 'sonar' + (i ? ' sonar' + (i + 1) : '')
        }).addTo(map);
        rings.push(c);
      }
    },

    setLine: function (color, dash) {
      lineColor = color;
      lineDash = dash || null;
      if (line) line.setStyle({ color: lineColor, dashArray: lineDash });
    },

    destHalo: function (on) {
      document.body.classList[on ? 'add' : 'remove']('haloDest');
    },

    setRoute: function (a, b, cs, showCars, n) {
      document.body.classList.remove('homeMode');
      coords = (cs && cs.length > 1) ? cs : [[a.lat, a.lng], [b.lat, b.lng]];
      measure();

      if (line) map.removeLayer(line);
      line = L.polyline(coords, {
        color: lineColor, weight: 5, opacity: .9,
        dashArray: lineDash, lineCap: 'round'
      }).addTo(map);

      if (pinA) map.removeLayer(pinA);
      if (pinB) map.removeLayer(pinB);
      pinA = L.marker([a.lat, a.lng], { icon: ICON.from, interactive: false, zIndexOffset: 500 }).addTo(map);
      pinB = L.marker([b.lat, b.lng], { icon: ICON.to,   interactive: false, zIndexOffset: 500 }).addTo(map);

      map.fitBounds(L.latLngBounds(coords), { padding: [34,34], maxZoom: 16 });

      // where the driver comes from before pick-up
      var ang = Math.random() * Math.PI * 2;
      approach = [a.lat + Math.sin(ang) * 0.007, a.lng + Math.cos(ang) * 0.007];

      if (showCars) spawnCars(a.lat, a.lng, n);
      else clearCars();
    },

    /** 0 = driver approaching, 1 = waiting at pick-up, 2 = driving the route */
    phase: function (p) {
      if (!coords.length) return;
      clearCars();                       // the assigned driver is the only car now
      document.body.classList.add('glide');

      if (p === 0) {
        var start = approach || coords[0], end = coords[0];
        var deg = bearing(start, end);
        setHero(start, deg);
        tween(4800, function (k) {
          setHero([start[0] + (end[0]-start[0])*k, start[1] + (end[1]-start[1])*k], deg);
        });
      } else if (p === 1) {
        if (raf) cancelAnimationFrame(raf);
        var s0 = at(0);
        setHero(s0.pos, s0.deg);
      } else {
        tween(8800, function (k) {
          var st = at(k);
          setHero(st.pos, st.deg);
        });
      }
    }
  };

  post({ t: 'ready' });
}());
</script></body></html>`;

/* =============================================================================
   LiveMap — static map used by the booking preview and the trip screen
   ========================================================================== */

export function LiveMap({
  from,
  to,
  coords,
  cars,
  phase,
  layer = 'street',
  onToggleLayer,
  lineColor,
  dashed,
  destHalo,
  radar,
  soloOrigin,
  vehicle,
  myLocation,
  onLocate,
  locating,
  switchStyle,
  height,
  style,
}) {
  const webRef = useRef(null);
  const [ready, setReady] = useState(false);

  const inject = useCallback((js) => {
    if (webRef.current) webRef.current.injectJavaScript(`${js} true;`);
  }, []);

  const key = `${from && from.lat},${from && from.lng},${to && to.lat},${to && to.lng},${
    coords ? coords.length : 0
  }`;

  useEffect(() => {
    if (!ready || !from) return;

    inject(`LG.vehicle('${vehicle || 'car'}');`);

    if (soloOrigin) {
      // home: pick-up only, no destination and no route line
      inject(`LG.solo(${from.lat},${from.lng},${cars ? 'true' : 'false'},${NEARBY_CARS});`);
      return;
    }
    if (!to) return;

    inject(
      `LG.setLine('${lineColor || '#111111'}', ${dashed ? "'2,9'" : 'null'});` +
        `LG.destHalo(${destHalo ? 'true' : 'false'});` +
        `LG.radar(${from.lat},${from.lng},${radar ? 'true' : 'false'});` +
        `LG.setRoute(${JSON.stringify({ lat: from.lat, lng: from.lng })},` +
        `${JSON.stringify({ lat: to.lat, lng: to.lng })},` +
        `${JSON.stringify(coords || null)},${cars ? 'true' : 'false'},${NEARBY_CARS});`
    );
    if (phase != null) inject(`LG.phase(${phase});`);
  }, [ready, key, lineColor, dashed, destHalo, radar, soloOrigin, vehicle]); // eslint-disable-line react-hooks/exhaustive-deps

  // the device's own position, independent of the chosen pick-up
  useEffect(() => {
    if (!ready) return;
    inject(
      myLocation
        ? `LG.me(${myLocation.lat},${myLocation.lng});`
        : 'LG.me(null);'
    );
  }, [ready, myLocation && myLocation.lat, myLocation && myLocation.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready || phase == null) return;
    inject(`LG.phase(${phase});`);
  }, [ready, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready) return;
    inject(`LG.layer('${layer}');`);
  }, [ready, layer]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View
      style={[
        { backgroundColor: C.card, overflow: 'hidden' },
        height != null ? { height } : { flex: 1 },
        style,
      ]}>
      <WebView
        ref={webRef}
        source={{ html: LIVE_HTML, baseUrl: 'https://tile.openstreetmap.org' }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        onMessage={(e) => {
          try {
            if (JSON.parse(e.nativeEvent.data).t === 'ready') setReady(true);
          } catch {}
        }}
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
        style={{ flex: 1, backgroundColor: C.bg }}
      />
      {!ready && (
        <View style={s.overlay} pointerEvents="none">
          <ActivityIndicator color={C.accentText} />
        </View>
      )}

      <MapControls
        layer={layer}
        onLayer={onToggleLayer}
        onZoom={(d) => inject(`LG.zoom(${d});`)}
        onFit={soloOrigin ? null : () => inject('LG.fit();')}
        onLocate={onLocate}
        locating={locating}
        /* every screen using LiveMap floats a card at the top, so the stack
           starts below it rather than underneath it */
        style={switchStyle || { top: 96 }}
      />
    </View>
  );
}

/**
 * Round map buttons, stacked on the right edge — locate, layers, zoom, re-fit.
 * Drawn in React Native rather than with Leaflet's own control so they match the
 * app and stay tappable over the WebView on both platforms.
 */
export function MapControls({ layer, onLayer, onZoom, onFit, onLocate, locating, style }) {
  const sat = layer === 'satellite';
  return (
    <View style={[s.mapCtl, style]}>
      {!!onLocate && (
        <Pressable onPress={onLocate} disabled={locating} style={s.ctlBtn}>
          {locating ? (
            <ActivityIndicator size="small" color={C.accentText} />
          ) : (
            <Text style={s.ctlIcon}>◎</Text>
          )}
        </Pressable>
      )}

      {!!onLayer && (
        <Pressable
          onPress={() => onLayer(sat ? 'street' : 'satellite')}
          style={[s.ctlBtn, sat && s.ctlBtnOn]}>
          <Text style={s.ctlIcon}>▤</Text>
        </Pressable>
      )}

      {!!onZoom && (
        <View style={s.ctlPair}>
          <Pressable onPress={() => onZoom(1)} style={s.ctlHalf}>
            <Text style={s.ctlSign}>＋</Text>
          </Pressable>
          <View style={s.ctlDivider} />
          <Pressable onPress={() => onZoom(-1)} style={s.ctlHalf}>
            <Text style={s.ctlSign}>－</Text>
          </Pressable>
        </View>
      )}

      {!!onFit && (
        <Pressable onPress={onFit} style={s.ctlBtn}>
          <Text style={s.ctlIcon}>⤢</Text>
        </Pressable>
      )}
    </View>
  );
}

/* =============================================================================
   MapPicker — interactive
   ========================================================================== */

export default function MapPicker({
  visible,
  mode: initialMode,
  from,
  to,
  layer = 'street',
  onLayerChange,
  onConfirm,
  onCancel,
  onUsePresetList,
}) {
  const webRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState('from');
  const [pins, setPins] = useState({ from: null, to: null });
  const [busy, setBusy] = useState({ from: false, to: false });
  const [route, setRoute] = useState(null);
  const [routing, setRouting] = useState(false);
  const [routeFailed, setRouteFailed] = useState(false);

  const geoAbort = useRef(null);

  const inject = useCallback((js) => {
    if (webRef.current) webRef.current.injectJavaScript(`${js} true;`);
  }, []);

  /* ---- seed from the caller's current selection each time it opens ---- */
  useEffect(() => {
    if (!visible) return;
    setReady(false);
    setMode(initialMode === 'to' ? 'to' : 'from');
    setPins({ from: from || null, to: to || null });
    setRoute(null);
    setRouteFailed(false);
    setBusy({ from: false, to: false });
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- push the seeded pins into the map once Leaflet reports ready ---- */
  useEffect(() => {
    if (!ready) return;
    let js = '';
    if (pins.from) js += `LG.setPin('from',${pins.from.lat},${pins.from.lng});`;
    if (pins.to) js += `LG.setPin('to',${pins.to.lat},${pins.to.lng});`;
    js += 'LG.fit();';
    if (pins.from) js += `LG.cars(${pins.from.lat},${pins.from.lng},${NEARBY_CARS});`;
    js += `LG.layer('${layer}');`;
    inject(js);
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready) return;
    inject(`LG.layer('${layer}');`);
  }, [ready, layer]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- route whenever either endpoint moves ---- */
  const fromLat = pins.from ? pins.from.lat : null;
  const fromLng = pins.from ? pins.from.lng : null;
  const toLat = pins.to ? pins.to.lat : null;
  const toLng = pins.to ? pins.to.lng : null;

  useEffect(() => {
    if (!visible) return;
    if (fromLat == null || toLat == null) {
      setRoute(null);
      setRouteFailed(false);
      inject('LG.clearRoute();');
      return;
    }

    const ctl = new AbortController();
    setRouting(true);

    fetchRoute({ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng }, ctl.signal).then(
      (r) => {
        if (ctl.signal.aborted) return;
        setRouting(false);
        setRoute(r);
        setRouteFailed(r == null);
        if (r) inject(`LG.route(${JSON.stringify(r.coords)});LG.fit();`);
        else inject('LG.clearRoute();');
      }
    );

    return () => ctl.abort();
  }, [visible, fromLat, fromLng, toLat, toLng]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- abort any in-flight lookup on unmount ---- */
  useEffect(
    () => () => {
      if (geoAbort.current) geoAbort.current.abort();
    },
    []
  );

  /* ---- drop or move a pin, then resolve its name ---- */
  const placePin = useCallback(
    (which, lat, lng, advance) => {
      inject(`LG.setPin('${which}',${lat},${lng});`);

      setPins((p) => ({
        ...p,
        [which]: {
          id: p[which] && p[which].id ? p[which].id : placeId(),
          name: 'ກຳລັງຊອກຫາຊື່ສະຖານທີ່...',
          district: '',
          alias: '', // PlacePicker's filter calls .includes() on this unguarded
          lat,
          lng,
        },
      }));

      if (advance && which === 'from') setMode('to');
      setBusy((b) => ({ ...b, [which]: true }));

      if (geoAbort.current) geoAbort.current.abort();
      const ctl = new AbortController();
      geoAbort.current = ctl;

      reverseGeocode(lat, lng, ctl.signal).then(({ name, district }) => {
        if (ctl.signal.aborted) return;
        setBusy((b) => ({ ...b, [which]: false }));
        setPins((p) => {
          const cur = p[which];
          // ignore a stale reply if the pin has since moved
          if (!cur || cur.lat !== lat || cur.lng !== lng) return p;
          return { ...p, [which]: { ...cur, name, district } };
        });
      });
    },
    [inject]
  );

  const onMessage = useCallback(
    (e) => {
      let m;
      try {
        m = JSON.parse(e.nativeEvent.data);
      } catch {
        return;
      }
      if (m.t === 'ready') setReady(true);
      else if (m.t === 'tap') placePin(mode, m.lat, m.lng, true);
      else if (m.t === 'drag') placePin(m.which, m.lat, m.lng, false);
    },
    [mode, placePin]
  );

  /* ---- drop the active pin on the device's current position ---- */
  const [locating, setLocating] = useState(false);

  const useMyLocation = useCallback(async () => {
    setLocating(true);
    const fix = await getCurrentCoords();
    setLocating(false);
    if (fix.status !== 'granted') return;
    inject(`LG.center(${fix.lat},${fix.lng},16);`);
    placePin(mode, fix.lat, fix.lng, false);
  }, [inject, mode, placePin]);

  const bothSet = !!pins.from && !!pins.to;
  const naming = busy.from || busy.to;

  const confirm = () => {
    if (!bothSet) return;
    onConfirm({ from: pins.from, to: pins.to, route });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

        {/* ---- header ---- */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>ເລືອກຈຸດເທິງແຜນທີ່</Text>
            <Text style={s.subtitle}>ແຕະເພື່ອປັກໝຸດ ຫຼື ລາກໝຸດເພື່ອຍ້າຍ</Text>
          </View>
          <Pressable onPress={onCancel} hitSlop={12} style={s.close}>
            <Text style={s.closeText}>✕</Text>
          </Pressable>
        </View>

        {/* ---- pick-up / drop-off tabs ---- */}
        <View style={s.tabs}>
          <Tab
            active={mode === 'from'}
            dot={C.teal}
            label="ຈຸດຮັບ"
            value={pins.from ? pins.from.name : 'ຍັງບໍ່ໄດ້ເລືອກ'}
            loading={busy.from}
            onPress={() => setMode('from')}
          />
          <Tab
            active={mode === 'to'}
            dot={C.gold}
            label="ຈຸດສົ່ງ"
            value={pins.to ? pins.to.name : 'ຍັງບໍ່ໄດ້ເລືອກ'}
            loading={busy.to}
            onPress={() => setMode('to')}
          />
        </View>

        {/* ---- map ---- */}
        <View style={s.mapWrap}>
          <WebView
            ref={webRef}
            source={{ html: PICKER_HTML, baseUrl: 'https://tile.openstreetmap.org' }}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            onMessage={onMessage}
            mixedContentMode="always"
            setSupportMultipleWindows={false}
            androidLayerType="hardware"
            style={{ flex: 1, backgroundColor: C.bg }}
          />

          {!ready && (
            <View style={s.overlay} pointerEvents="none">
              <ActivityIndicator color={C.accentText} />
              <Text style={s.overlayText}>ກຳລັງໂຫຼດແຜນທີ່...</Text>
            </View>
          )}

          {ready && !bothSet && (
            <View style={s.hint} pointerEvents="none">
              <Text style={s.hintText}>
                {mode === 'from' ? 'ແຕະເພື່ອປັກໝຸດຈຸດຮັບ' : 'ແຕະເພື່ອປັກໝຸດຈຸດສົ່ງ'}
              </Text>
            </View>
          )}

          <MapControls
            layer={layer}
            onLayer={onLayerChange}
            onZoom={(d) => inject(`LG.zoom(${d});`)}
            onFit={() => inject('LG.fit();')}
            onLocate={useMyLocation}
            locating={locating}
            style={{ top: 10 }}
          />
        </View>

        {/* ---- footer ---- */}
        <View style={s.footer}>
          <View style={s.distRow}>
            {routing ? (
              <>
                <ActivityIndicator size="small" color={C.accentText} />
                <Text style={s.distLabel}>ກຳລັງຄິດໄລ່ເສັ້ນທາງ...</Text>
              </>
            ) : route ? (
              <>
                <Text style={s.distLabel}>ໄລຍະທາງຕາມເສັ້ນທາງ</Text>
                <Text style={s.distValue}>
                  {route.km.toFixed(1)} ກມ · {Math.round(route.min)} ນາທີ
                </Text>
              </>
            ) : routeFailed ? (
              <Text style={s.warn}>ຕໍ່ເສັ້ນທາງບໍ່ໄດ້ — ຈະໃຊ້ໄລຍະທາງໂດຍປະມານ</Text>
            ) : (
              <Text style={s.distLabel}>ເລືອກທັງສອງຈຸດເພື່ອເບິ່ງໄລຍະທາງ</Text>
            )}
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => onUsePresetList && onUsePresetList(mode)}
              style={({ pressed }) => [s.btn, s.btnGhost, pressed && { opacity: 0.7 }]}>
              <Text style={s.btnGhostText}>ໃຊ້ລາຍຊື່ສະຖານທີ່</Text>
            </Pressable>

            <Pressable
              onPress={confirm}
              disabled={!bothSet || naming}
              style={({ pressed }) => [
                s.btn,
                s.btnPrimary,
                { flex: 1.4 },
                (!bothSet || naming) && { opacity: 0.35 },
                pressed && bothSet && !naming && { opacity: 0.75 },
              ]}>
              <Text style={s.btnPrimaryText}>
                {naming ? 'ກຳລັງຊອກຫາຊື່...' : 'ຢືນຢັນຈຸດທີ່ເລືອກ'}
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function Tab({ active, dot, label, value, loading, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.tab, active && s.tabActive, pressed && { opacity: 0.8 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={[s.tabDot, { backgroundColor: dot }]} />
        <Text style={[s.tabLabel, active && { color: C.text }]}>{label}</Text>
        {loading && <ActivityIndicator size="small" color={C.faint} style={{ marginLeft: 6 }} />}
      </View>
      <Text style={[s.tabValue, active && { color: C.text }]} numberOfLines={1}>
        {value}
      </Text>
    </Pressable>
  );
}

/* =============================================================================
   STYLES
   ========================================================================== */

// Every label in this file mixes Lao with its numbers ("6.8 ກມ · 12 ນາທີ"), so
// none of them may use Space Grotesk — it has no Lao glyphs. All Noto Sans Lao.
const s = theme({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
  },
  title: { color: C.text, fontSize: 19, lineHeight: 30, fontWeight: '700' },
  subtitle: { color: C.faint, fontSize: 11.5, lineHeight: 19 },
  close: { width: 34, height: 34, alignItems: 'flex-end' },
  closeText: { color: C.sub, fontSize: 17, lineHeight: 26 },

  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingBottom: 12 },
  tab: {
    flex: 1,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  tabActive: { borderColor: C.gold, backgroundColor: C.card2 },
  tabDot: { width: 8, height: 8, borderRadius: 4, marginRight: 7 },
  tabLabel: { color: C.sub, fontSize: 12, lineHeight: 20, fontWeight: '700' },
  tabValue: { color: C.sub, fontSize: 12, lineHeight: 19, marginTop: 1 },

  mapWrap: { flex: 1, backgroundColor: C.card, overflow: 'hidden' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bg,
  },
  overlayText: { color: C.faint, fontSize: 12, lineHeight: 20, marginTop: 10 },

  mapCtl: { position: 'absolute', right: 12, gap: 8, alignItems: 'center' },
  ctlBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111',
    shadowOpacity: 0.12,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  ctlBtnOn: { backgroundColor: C.gold, borderColor: C.gold },
  ctlIcon: { color: C.text, fontSize: 18, lineHeight: 24 },
  ctlPair: {
    width: 46,
    borderRadius: 23,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    overflow: 'hidden',
    shadowColor: '#111',
    shadowOpacity: 0.12,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  ctlHalf: { height: 42, alignItems: 'center', justifyContent: 'center' },
  ctlDivider: { height: 1, backgroundColor: C.line },
  ctlSign: { color: C.text, fontSize: 17, lineHeight: 22, fontWeight: '700' },

  hint: { position: 'absolute', left: 0, right: 0, top: 12, alignItems: 'center' },
  hintText: {
    color: C.text,
    fontSize: 12,
    lineHeight: 20,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    overflow: 'hidden',
  },

  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: C.line,
    backgroundColor: C.bg,
  },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  distLabel: { color: C.sub, fontSize: 12.5, lineHeight: 21 },
  distValue: { color: C.text, fontSize: 15, lineHeight: 24, fontWeight: '700', marginLeft: 'auto' },
  warn: { color: C.red, fontSize: 12, lineHeight: 20 },

  btn: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: { backgroundColor: 'transparent', borderColor: C.line, flex: 1 },
  btnGhostText: { color: C.sub, fontSize: 13, lineHeight: 21, fontWeight: '700' },
  btnPrimary: { backgroundColor: C.gold, borderColor: C.gold },
  btnPrimaryText: { color: C.ink, fontSize: 14.5, lineHeight: 23, fontWeight: '700' },
});

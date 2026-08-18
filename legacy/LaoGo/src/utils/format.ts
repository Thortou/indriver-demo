import type { Place, Service, ServiceId } from '../types';
import { SERVICES } from '../data/services';

/* ------------------------------------------------------------------ money */

export const groupDigits = (n: number) =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Lao Kip, e.g. "₭ 45,000" */
export const kip = (n: number) => `₭ ${groupDigits(n)}`;

export const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/* --------------------------------------------------------------- distance */

const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in km. */
export function haversine(a: Place, b: Place) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Straight line inflated by a road-network factor. */
export const roadKm = (a: Place, b: Place) => haversine(a, b) * 1.35;

export const km = (v: number) => `${v.toFixed(1)} km`;

/* ------------------------------------------------------------------- fare */

export const serviceById = (id: ServiceId): Service =>
  SERVICES.find((s) => s.id === id) ?? SERVICES[0];

/** Suggested fare, floored at the service minimum, rounded to ₭1,000. */
export function suggestFare(distance: number, id: ServiceId) {
  const s = serviceById(id);
  return roundTo(Math.max(s.base + s.perKm * distance, s.min), 1000);
}

/* ----------------------------------------------------------------- random */

export const rnd = (min: number, max: number) => min + Math.random() * (max - min);
export const rndInt = (min: number, max: number) => Math.floor(rnd(min, max + 1));
export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

let seq = 0;
export const uid = (p: string) => `${p}_${++seq}`;

/* ------------------------------------------------------------------- date */

const LAO_MONTHS = [
  'ມັງກອນ', 'ກຸມພາ', 'ມີນາ', 'ເມສາ', 'ພຶດສະພາ', 'ມິຖຸນາ',
  'ກໍລະກົດ', 'ສິງຫາ', 'ກັນຍາ', 'ຕຸລາ', 'ພະຈິກ', 'ທັນວາ',
];

export function laoDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${LAO_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function clockTime(iso: string) {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
}

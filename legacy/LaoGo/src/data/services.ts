import type { Service } from '../types';

/** Base fare + per-km rate in Lao Kip. */
export const SERVICES: Service[] = [
  { id: 'car',      lo: 'ລົດເກັງ',   en: 'Car',      icon: '🚗', base: 8000,  perKm: 3500, min: 15000 },
  { id: 'moto',     lo: 'ລົດຈັກ',    en: 'Moto',     icon: '🛵', base: 5000,  perKm: 2000, min: 8000  },
  { id: 'delivery', lo: 'ສົ່ງເຄື່ອງ', en: 'Delivery', icon: '📦', base: 6000,  perKm: 2500, min: 10000 },
];

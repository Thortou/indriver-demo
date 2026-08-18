export type Role = 'passenger' | 'driver';

export type ServiceId = 'car' | 'moto' | 'delivery';

export interface Service {
  id: ServiceId;
  lo: string;
  en: string;
  icon: string;
  base: number;
  perKm: number;
  min: number;
}

export interface Place {
  id: string;
  lo: string;
  en: string;
  lat: number;
  lng: number;
}

export interface Person {
  id: string;
  lo: string;
  en: string;
  rating: number;
  car?: string;
  plate?: string;
  trips?: number;
}

/** A driver's response to the passenger's proposed fare. */
export interface Offer {
  id: string;
  driver: Person;
  fare: number;
  etaMin: number;
  /** true when the driver countered instead of accepting the proposed fare */
  isCounter: boolean;
}

/** A passenger request as seen on the driver side. */
export interface RideRequest {
  id: string;
  passenger: Person;
  service: ServiceId;
  pickup: Place;
  dropoff: Place;
  fare: number;
  tripKm: number;
  pickupKm: number;
  note?: string;
  /** set once the driver has countered and is awaiting a reply */
  countered?: number;
  state: 'open' | 'waiting' | 'lost';
}

export type RideStage = 'onway' | 'arrived' | 'intrip' | 'completed';

export const STAGES: RideStage[] = ['onway', 'arrived', 'intrip', 'completed'];

export interface Trip {
  id: string;
  /** ISO date string */
  date: string;
  pickup: Place;
  dropoff: Place;
  fare: number;
  service: ServiceId;
  counterpartLo: string;
  counterpartEn: string;
  rating?: number;
}

export type PaymentMethod = 'cash' | 'qr';

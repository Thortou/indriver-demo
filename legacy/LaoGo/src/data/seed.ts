import type { RideRequest, ServiceId, Trip } from '../types';
import { PLACES } from './places';
import { PASSENGERS, DRIVERS, NOTES } from './people';
import { pick, rnd, rndInt, roadKm, roundTo, suggestFare, uid } from '../utils/format';

const SERVICE_IDS: ServiceId[] = ['car', 'moto', 'delivery'];

/** One open request from a nearby passenger, fare ₭20,000–₭80,000. */
export function makeRequest(): RideRequest {
  const pickup = pick(PLACES);
  let dropoff = pick(PLACES);
  while (dropoff.id === pickup.id) dropoff = pick(PLACES);

  const service = pick(SERVICE_IDS);
  const tripKm = roadKm(pickup, dropoff);

  // passengers name their own price, so it drifts around the suggestion
  const raw = suggestFare(tripKm, service) * rnd(0.85, 1.1);
  const fare = Math.min(80000, Math.max(20000, roundTo(raw, 1000)));

  return {
    id: uid('req'),
    passenger: pick(PASSENGERS),
    service,
    pickup,
    dropoff,
    fare,
    tripKm,
    pickupKm: rnd(0.4, 3.8),
    note: pick(NOTES),
    state: 'open',
  };
}

export const seedRequests = (n = 6): RideRequest[] =>
  Array.from({ length: n }, makeRequest);

/* ------------------------------------------------------------ past trips */

const daysAgo = (n: number, hour: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, rndInt(0, 59), 0, 0);
  return d.toISOString();
};

function makeTrip(dayOffset: number, hour: number, forDriver = false): Trip {
  const pickup = pick(PLACES);
  let dropoff = pick(PLACES);
  while (dropoff.id === pickup.id) dropoff = pick(PLACES);

  const service = pick(SERVICE_IDS);
  const counterpart = forDriver ? pick(PASSENGERS) : pick(DRIVERS);

  return {
    id: uid('trip'),
    date: daysAgo(dayOffset, hour),
    pickup,
    dropoff,
    fare: roundTo(suggestFare(roadKm(pickup, dropoff), service) * rnd(0.9, 1.1), 1000),
    service,
    counterpartLo: counterpart.lo,
    counterpartEn: counterpart.en,
    rating: rndInt(4, 5),
  };
}

/** Passenger history: a handful of trips over the past two weeks. */
export const seedPassengerHistory = (): Trip[] =>
  [
    makeTrip(0, 9),
    makeTrip(1, 18),
    makeTrip(3, 12),
    makeTrip(6, 8),
    makeTrip(11, 20),
  ].sort((a, b) => +new Date(b.date) - +new Date(a.date));

/** Driver history: busier, several per day across the week. */
export const seedDriverHistory = (): Trip[] => {
  const out: Trip[] = [];
  for (let day = 0; day < 7; day++) {
    for (let i = 0; i < rndInt(2, 5); i++) {
      out.push(makeTrip(day, rndInt(7, 21), true));
    }
  }
  return out.sort((a, b) => +new Date(b.date) - +new Date(a.date));
};

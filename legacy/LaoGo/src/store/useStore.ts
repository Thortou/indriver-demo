import { create } from 'zustand';
import type {
  Offer,
  PaymentMethod,
  Place,
  RideRequest,
  RideStage,
  Role,
  ServiceId,
  Trip,
} from '../types';
import { PLACES, placeById } from '../data/places';
import { DRIVERS, ME_DRIVER } from '../data/people';
import { makeRequest, seedDriverHistory, seedPassengerHistory, seedRequests } from '../data/seed';
import { kip, pick, rnd, rndInt, roadKm, roundTo, suggestFare, uid } from '../utils/format';

/* ---------------------------------------------------------------- timers --
   Every simulated response runs on a setTimeout. Ids are collected here so a
   role switch or an unmount can cancel them all — no callback ever lands on
   state that has already moved on.                                          */

let timers: ReturnType<typeof setTimeout>[] = [];

const later = (fn: () => void, ms: number) => {
  const id = setTimeout(() => {
    timers = timers.filter((t) => t !== id);
    fn();
  }, ms);
  timers.push(id);
  return id;
};

const killTimers = () => {
  timers.forEach(clearTimeout);
  timers = [];
};

/* ------------------------------------------------------------------ state */

const FARE_STEP = 5000;

const isToday = (iso: string) => {
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getDate() === n.getDate() &&
    d.getMonth() === n.getMonth() &&
    d.getFullYear() === n.getFullYear()
  );
};

const sumToday = (trips: Trip[]) =>
  trips.filter((t) => isToday(t.date)).reduce((acc, t) => acc + t.fare, 0);

interface Store {
  /* role */
  role: Role | null;
  setRole: (r: Role) => void;
  switchRole: () => void;

  /* ---- passenger: request composition */
  service: ServiceId;
  pickup: Place;
  dropoff: Place;
  fare: number;
  setService: (id: ServiceId) => void;
  setPickup: (p: Place) => void;
  setDropoff: (p: Place) => void;
  setFare: (n: number) => void;
  stepFare: (dir: 1 | -1) => void;
  swapEnds: () => void;
  resyncFare: () => void;

  /* ---- passenger: ride lifecycle */
  pStatus: 'idle' | 'finding' | 'riding' | 'done';
  offers: Offer[];
  accepted: Offer | null;
  stage: RideStage;
  payment: PaymentMethod;
  rating: number;
  tip: number;
  history: Trip[];

  findDrivers: () => void;
  cancelSearch: () => void;
  raiseFare: () => void;
  declineOffer: (id: string) => void;
  acceptOffer: (o: Offer) => void;
  setPayment: (m: PaymentMethod) => void;
  setRating: (n: number) => void;
  setTip: (n: number) => void;
  closeTrip: () => void;

  /* ---- driver */
  online: boolean;
  toggleOnline: () => void;
  requests: RideRequest[];
  activeJob: (RideRequest & { agreedFare: number }) | null;
  jobStage: 'topickup' | 'arrived' | 'intrip';
  driverHistory: Trip[];
  toast: string | null;

  acceptRequest: (r: RideRequest) => void;
  counterRequest: (r: RideRequest, amount: number) => void;
  advanceJob: () => void;
  clearToast: () => void;

  /* housekeeping */
  reset: () => void;
}

const defaultPickup = placeById('morning-market');
const defaultDropoff = placeById('wattay');

export const useStore = create<Store>((set, get) => ({
  /* ------------------------------------------------------------------ role */
  role: null,
  setRole: (r) => set({ role: r }),
  switchRole: () => {
    killTimers();
    set({ role: null, pStatus: 'idle', offers: [], accepted: null, activeJob: null });
  },

  /* --------------------------------------------------- request composition */
  service: 'car',
  pickup: defaultPickup,
  dropoff: defaultDropoff,
  fare: suggestFare(roadKm(defaultPickup, defaultDropoff), 'car'),

  resyncFare: () => {
    const { pickup, dropoff, service } = get();
    set({ fare: suggestFare(roadKm(pickup, dropoff), service) });
  },

  setService: (id) => {
    set({ service: id });
    get().resyncFare();
  },
  setPickup: (p) => {
    set({ pickup: p });
    get().resyncFare();
  },
  setDropoff: (p) => {
    set({ dropoff: p });
    get().resyncFare();
  },
  swapEnds: () => {
    const { pickup, dropoff } = get();
    set({ pickup: dropoff, dropoff: pickup });
    get().resyncFare();
  },

  setFare: (n) => set({ fare: Math.max(1000, Math.round(n)) }),
  stepFare: (dir) =>
    set((s) => ({ fare: Math.max(FARE_STEP, roundTo(s.fare + dir * FARE_STEP, 1000)) })),

  /* ------------------------------------------------------ ride lifecycle */
  pStatus: 'idle',
  offers: [],
  accepted: null,
  stage: 'onway',
  payment: 'cash',
  rating: 0,
  tip: 0,
  history: seedPassengerHistory(),

  findDrivers: () => {
    killTimers();
    set({ pStatus: 'finding', offers: [], accepted: null, rating: 0, tip: 0, payment: 'cash' });

    const asked = get().fare;
    const pool = [...DRIVERS].sort(() => Math.random() - 0.5).slice(0, 3);

    // first offer lands 2–4s in, the rest trickle after it
    let t = rndInt(2000, 4000);
    pool.forEach((driver) => {
      later(() => {
        if (get().pStatus !== 'finding') return;
        // roughly half accept the asking price outright, half counter upward
        const counters = Math.random() < 0.55;
        const fare = counters ? roundTo(asked * rnd(1.06, 1.3), 1000) : asked;
        set((s) => ({
          offers: [
            ...s.offers,
            {
              id: uid('offer'),
              driver,
              fare,
              etaMin: rndInt(2, 11),
              isCounter: counters,
            },
          ],
        }));
      }, t);
      t += rndInt(1100, 2200);
    });
  },

  cancelSearch: () => {
    killTimers();
    set({ pStatus: 'idle', offers: [] });
  },

  /** Raise the offer by ₭5,000 — a driver bites on the better price. */
  raiseFare: () => {
    const next = get().fare + FARE_STEP;
    set({ fare: next });

    later(() => {
      if (get().pStatus !== 'finding') return;
      const taken = new Set(get().offers.map((o) => o.driver.id));
      const driver = DRIVERS.find((d) => !taken.has(d.id)) ?? pick(DRIVERS);
      set((s) => ({
        offers: [
          ...s.offers,
          { id: uid('offer'), driver, fare: next, etaMin: rndInt(2, 9), isCounter: false },
        ],
      }));
    }, rndInt(1200, 2200));
  },

  declineOffer: (id) => set((s) => ({ offers: s.offers.filter((o) => o.id !== id) })),

  acceptOffer: (o) => {
    killTimers();
    set({ accepted: o, pStatus: 'riding', stage: 'onway' });

    later(() => set({ stage: 'arrived' }), 5000);
    later(() => set({ stage: 'intrip' }), 10000);
    later(() => set({ stage: 'completed', pStatus: 'done' }), 19000);
  },

  setPayment: (m) => set({ payment: m }),
  setRating: (n) => set({ rating: n }),
  setTip: (n) => set({ tip: n }),

  closeTrip: () => {
    const { accepted, pickup, dropoff, service, rating, tip, history } = get();
    if (accepted) {
      const trip: Trip = {
        id: uid('trip'),
        date: new Date().toISOString(),
        pickup,
        dropoff,
        fare: accepted.fare + tip,
        service,
        counterpartLo: accepted.driver.lo,
        counterpartEn: accepted.driver.en,
        rating: rating || undefined,
      };
      set({ history: [trip, ...history] });
    }
    killTimers();
    set({ pStatus: 'idle', offers: [], accepted: null, rating: 0, tip: 0 });
    get().resyncFare();
  },

  /* ---------------------------------------------------------------- driver */
  online: true,
  toggleOnline: () => set((s) => ({ online: !s.online })),
  requests: seedRequests(6),
  activeJob: null,
  jobStage: 'topickup',
  driverHistory: seedDriverHistory(),
  toast: null,

  acceptRequest: (r) => {
    set((s) => ({
      requests: s.requests.filter((x) => x.id !== r.id),
      activeJob: { ...r, agreedFare: r.fare },
      jobStage: 'topickup',
    }));
  },

  counterRequest: (r, amount) => {
    set((s) => ({
      requests: s.requests.map((x) =>
        x.id === r.id ? { ...x, countered: amount, state: 'waiting' as const } : x
      ),
    }));

    later(() => {
      const still = get().requests.find((x) => x.id === r.id);
      if (!still || get().activeJob) return;

      if (Math.random() < 0.6) {
        set((s) => ({
          requests: s.requests.filter((x) => x.id !== r.id),
          activeJob: { ...r, agreedFare: amount },
          jobStage: 'topickup',
        }));
      } else {
        set((s) => ({
          requests: s.requests.map((x) =>
            x.id === r.id ? { ...x, state: 'lost' as const } : x
          ),
        }));
        later(() => {
          set((s) => ({
            requests: [...s.requests.filter((x) => x.id !== r.id), makeRequest()],
          }));
        }, 2500);
      }
    }, rndInt(4000, 8000));
  },

  advanceJob: () => {
    const job = get().activeJob;
    if (!job) return;
    const stage = get().jobStage;

    if (stage === 'topickup') return set({ jobStage: 'arrived' });
    if (stage === 'arrived') return set({ jobStage: 'intrip' });

    // finished
    const trip: Trip = {
      id: uid('trip'),
      date: new Date().toISOString(),
      pickup: job.pickup,
      dropoff: job.dropoff,
      fare: job.agreedFare,
      service: job.service,
      counterpartLo: job.passenger.lo,
      counterpartEn: job.passenger.en,
    };

    set((s) => ({
      activeJob: null,
      jobStage: 'topickup',
      driverHistory: [trip, ...s.driverHistory],
      toast: `+ ${kip(job.agreedFare)}`,
    }));

    later(() => set((s) => ({ requests: [...s.requests, makeRequest()] })), 3000);
    later(() => set({ toast: null }), 2600);
  },

  clearToast: () => set({ toast: null }),

  reset: () => {
    killTimers();
    set({ pStatus: 'idle', offers: [], accepted: null, activeJob: null });
  },
}));

/** Completed jobs are written into driverHistory, so today's total derives from it. */
export const selectEarningsToday = (s: Store) => sumToday(s.driverHistory);

export const selectEarningsWeek = (s: Store) =>
  s.driverHistory.reduce((a, t) => a + t.fare, 0);

/** Rolling 7-day totals, oldest first — used by the Earnings bar chart. */
export function selectWeekBars(trips: Trip[]) {
  const days: { label: string; total: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const total = trips
      .filter((t) => {
        const td = new Date(t.date);
        return (
          td.getDate() === d.getDate() &&
          td.getMonth() === d.getMonth() &&
          td.getFullYear() === d.getFullYear()
        );
      })
      .reduce((a, t) => a + t.fare, 0);
    days.push({ label: ['ອາ', 'ຈ', 'ອ', 'ພ', 'ພຫ', 'ສຸ', 'ສ'][d.getDay()], total });
  }
  return days;
}

export { killTimers, PLACES, ME_DRIVER, FARE_STEP };

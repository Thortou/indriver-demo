/* =============================================================================
   theme.js — LaoRide design tokens, font plumbing and formatters.

   Single source of truth for App.js and MapPicker.js. Every value here is
   lifted straight from the "LaoRide Mockups" design file, so if the mockups
   move, this is the only file that has to.
   ========================================================================== */

import { StyleSheet } from 'react-native';

/* -----------------------------------------------------------------------------
   1. PALETTE
   Cool neutral greys + a lime accent. `ink` is the near-black green used for
   text ON the lime — plain black reads muddy against it.
   -------------------------------------------------------------------------- */

export const C = {
  /* surfaces */
  bg: '#F4F5F7',        // screen background
  canvas: '#E7EAEE',    // the surface a phone frame sits on
  card: '#FFFFFF',      // raised card
  card2: '#F1F3F6',     // inputs, muted fills, secondary buttons
  line: '#E3E7EC',      // borders
  hair: '#EEF1F4',      // list separators — lighter than `line`

  /* type */
  text: '#14171A',
  sub: '#707A85',
  faint: '#98A1AB',

  /* accent */
  lime: '#A7E92F',       // primary fill
  limeDeep: '#94D81C',   // splash gradient end
  limeDark: '#8FD416',   // earnings gradient end
  limeSoft: '#EAF7D8',   // tinted chip / pill background
  limeWash: '#F8FBEF',   // barely-there row highlight
  accentText: '#5FA80F', // lime-family text that still passes on white
  ink: '#17240A',        // text on lime, and the dark nav banner

  /* semantic */
  green: '#3DBE7B',      // success, origin dot, earnings delta
  red: '#E8604C',        // cancel, destructive, expiring
  blue: '#2D7FF9',       // route polyline, live user location
  amber: '#F59E0B',      // idle nearby-driver marker ring

  /* map */
  mapBg: '#E9EDF1',
  road: '#E3E7EC',
  roadThin: '#E0E5EA',
  water: '#CBE0EC',
};

/* -----------------------------------------------------------------------------
   2. RADII — the mockups use a strict ladder, not arbitrary values.
   -------------------------------------------------------------------------- */

export const R = {
  sheet: 24,   // bottom-sheet top corners
  card: 18,    // content cards
  btn: 16,     // primary CTA
  input: 14,   // inputs, tiles, secondary buttons
  sm: 12,      // small buttons inside a card
  xs: 10,      // plate badge, tiny pills
  pill: 999,
};

/* -----------------------------------------------------------------------------
   3. FONTS

   React Native has no font cascade — every Text needs an explicit fontFamily,
   and on Android a numeric `fontWeight` alongside a weighted font file causes
   synthetic bolding. So `theme(...)` below rewrites a raw style object once at
   module load: it resolves fontWeight to the matching font FILE and drops the
   fontWeight property.

   Noto Sans Lao Looped carries Lao + Latin + digits, so it is the default and
   safe for mixed strings. Space Grotesk is Latin-only, so it is opt-in for
   digit-only styles (see `groteskKeys`) — never for text containing Lao.
   -------------------------------------------------------------------------- */

import {
  NotoSansLaoLooped_400Regular,
  NotoSansLaoLooped_500Medium,
  NotoSansLaoLooped_600SemiBold,
  NotoSansLaoLooped_700Bold,
  NotoSansLaoLooped_800ExtraBold,
} from '@expo-google-fonts/noto-sans-lao-looped';

import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';

/** Passed straight to useFonts() in App.js. */
export const FONTS = {
  NotoSansLaoLooped_400Regular,
  NotoSansLaoLooped_500Medium,
  NotoSansLaoLooped_600SemiBold,
  NotoSansLaoLooped_700Bold,
  NotoSansLaoLooped_800ExtraBold,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
};

const LAO_BY_WEIGHT = {
  400: 'NotoSansLaoLooped_400Regular',
  500: 'NotoSansLaoLooped_500Medium',
  600: 'NotoSansLaoLooped_600SemiBold',
  700: 'NotoSansLaoLooped_700Bold',
  800: 'NotoSansLaoLooped_800ExtraBold',
};

// Space Grotesk ships no 800 — anything heavier than 700 clamps to Bold.
const GROTESK_BY_WEIGHT = {
  400: 'SpaceGrotesk_400Regular',
  500: 'SpaceGrotesk_500Medium',
  600: 'SpaceGrotesk_600SemiBold',
  700: 'SpaceGrotesk_700Bold',
  800: 'SpaceGrotesk_700Bold',
};

function normalizeWeight(w) {
  if (w == null || w === 'normal') return 400;
  if (w === 'bold') return 700;
  const n = parseInt(w, 10);
  if (Number.isNaN(n)) return 400;
  // round to the nearest weight we actually ship
  return [400, 500, 600, 700, 800].reduce((best, cand) =>
    Math.abs(cand - n) < Math.abs(best - n) ? cand : best
  );
}

/** Font pair for a one-off inline style. */
export const lao = (weight = 400) => ({ fontFamily: LAO_BY_WEIGHT[normalizeWeight(weight)] });
export const grotesk = (weight = 700) => ({
  fontFamily: GROTESK_BY_WEIGHT[normalizeWeight(weight)],
});

/**
 * Build a StyleSheet with fonts resolved.
 *
 * @param raw          plain object of style rules
 * @param groteskKeys  style names whose text is digits/Latin only, and so may
 *                     use Space Grotesk. Anything containing Lao must NOT be
 *                     listed — Space Grotesk has no Lao glyphs.
 */
export function theme(raw, groteskKeys = []) {
  const numeric = new Set(groteskKeys);
  const out = {};

  for (const [key, rule] of Object.entries(raw)) {
    // A rule is text-bearing if it sets any typographic property.
    const isText =
      rule && (rule.fontSize != null || rule.fontWeight != null || rule.lineHeight != null);

    if (!isText || rule.fontFamily) {
      out[key] = rule;
      continue;
    }

    const { fontWeight, ...rest } = rule;
    const table = numeric.has(key) ? GROTESK_BY_WEIGHT : LAO_BY_WEIGHT;
    out[key] = { ...rest, fontFamily: table[normalizeWeight(fontWeight)] };
  }

  return StyleSheet.create(out);
}

/* -----------------------------------------------------------------------------
   4. FORMATTERS — the mockups write money as "45,000 ₭", never "45,000 ກີບ".
   -------------------------------------------------------------------------- */

const group = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** "45,000" — digits only, safe for Space Grotesk. */
export const fmtNum = group;

/** "45,000 ₭" — for plain strings. Prefer the <Kip> component where the number
 *  should be set in Space Grotesk and the ₭ in the Lao face. */
export const fmtKip = (n) => `${group(n)} ₭`;

export const fmtKm = (km) => `${km.toFixed(1)} km`;

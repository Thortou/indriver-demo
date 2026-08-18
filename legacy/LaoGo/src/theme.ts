/**
 * LaoGo design tokens — direction: "Fresh Lime"
 */

export const colors = {
  bg: '#eef0ea',
  surface: '#ffffff',
  text: '#111111',
  muted: '#888888',
  lime: '#d4f24b',
  green: '#84a824',
  input: '#f4f5f0',
  border: '#e2e5dc',
  danger: '#c9453f',
  dangerBg: '#fbe6e4',
  black: '#111111',
  white: '#ffffff',
} as const;

export const radius = {
  sheet: 24,
  card: 16,
  pill: 14,
  input: 12,
  round: 999,
} as const;

export const space = (n: number) => n * 4;

/** Noto Sans Lao for all text; Space Grotesk for numbers/prices only. */
export const font = {
  lao: 'NotoSansLao_400Regular',
  laoMedium: 'NotoSansLao_500Medium',
  laoSemi: 'NotoSansLao_600SemiBold',
  laoBold: 'NotoSansLao_700Bold',
  laoBlack: 'NotoSansLao_800ExtraBold',
  num: 'SpaceGrotesk_500Medium',
  numSemi: 'SpaceGrotesk_600SemiBold',
  numBold: 'SpaceGrotesk_700Bold',
} as const;

/** Lao script stacks diacritics — every text style needs generous line height. */
export const laoLine = (size: number) => Math.round(size * 1.55);

export const shadow = {
  card: {
    shadowColor: '#2a3018',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sheet: {
    shadowColor: '#2a3018',
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
} as const;

/** Minimum touch target per the spec. */
export const HIT = 44;

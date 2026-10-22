import { Dimensions } from 'react-native';

// Everything is designed on a 1920x1080 canvas and scaled to the real window (a 1080p Fire TV is 960x540 dp).
const { width, height } = Dimensions.get('window');
const SCALE = Math.min(width / 1920, height / 1080);
export const s = (px: number) => Math.round(px * SCALE * 100) / 100;

// Monochrome: black canvas, a zinc grey scale, white. Colour is never decoration; meaning is carried by
// fill vs outline, inversion (white fill, black text), weight and glyphs (✓ ★ ●/○).
export const zinc = {
  50: '#FAFAFA',
  100: '#F4F4F5',
  200: '#E4E4E7',
  300: '#D4D4D8',
  400: '#A1A1AA',
  500: '#71717A',
  600: '#52525B',
  700: '#3F3F46',
  800: '#27272A',
  900: '#18181B',
  950: '#09090B',
};

// Existing keys are kept (all now greys/white) so every screen and the Vega port compile unchanged.
export const colors = {
  bg: '#000000',
  bgDeep: '#000000', // video / skeleton wells
  card: zinc[950], // resting surface
  cardHi: zinc[900], // raised / selected surface
  text: zinc[50],
  textDim: zinc[400],
  textMute: zinc[500],
  focus: '#FFFFFF', // focused item: white fill...
  onFocus: '#000000', // ...black text
  teacher: zinc[400],
  you: zinc[200],
  good: '#FFFFFF',
  almost: zinc[200],
  warn: '#FFFFFF',
  line: zinc[800], // 1px hairline borders
  lineStrong: zinc[600],
};

// Thin borders: 2 canvas px = 1 dp on a 1080p TV, 1 px on a 1080p browser window at 50% scale.
export const hair = Math.max(1, s(2));

// Packs used to be colour-coded; they are now told apart by their icon and name only.
export const packColors: Record<string, string> = {
  mealtime: colors.text,
  bedtime: colors.text,
  bath: colors.text,
  family: colors.text,
};

export const type = {
  hero: s(96),
  title: s(68),
  h2: s(48),
  body: s(38),
  small: s(30),
  tiny: s(24),
};

// Large type gets a slightly tighter track, like Geist / Inter display cuts.
export const track = { hero: -s(3), title: -s(2), h2: -s(1.2), label: s(0.6) };

// Type is the platform system sans (Segoe UI / Roboto / SF): no font loading, so it behaves the same on web,
// Fire TV and Vega. Hierarchy comes from size and weight contrast (900 / 700 / 400) and the tracking above.

// TV overscan safe area: keep content ~5% in from the edges.
export const safe = { h: s(96), v: s(54) };

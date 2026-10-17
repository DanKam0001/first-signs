import { Dimensions } from 'react-native';

// Everything is designed on a 1920x1080 canvas and scaled to the real window (a 1080p Fire TV is 960x540 dp).
const { width, height } = Dimensions.get('window');
const SCALE = Math.min(width / 1920, height / 1080);
export const s = (px: number) => Math.round(px * SCALE * 100) / 100;

export const colors = {
  bg: '#1E1A2E',
  bgDeep: '#16131F',
  card: '#2C2642',
  cardHi: '#3A3356',
  text: '#FFF7E8',
  textDim: '#CFC6E0',
  focus: '#FFB547',
  onFocus: '#1E1A2E',
  teacher: '#FFB547',
  you: '#4FD1C5',
  good: '#7BE495',
  almost: '#FFD166',
  warn: '#FF8A80',
  line: '#4A4266',
};

export const packColors: Record<string, string> = {
  mealtime: '#FF8A5B',
  bedtime: '#8EA8FF',
  bath: '#4FD1C5',
  family: '#FF7EB6',
};

export const type = {
  hero: s(96),
  title: s(64),
  h2: s(48),
  body: s(38),
  small: s(30),
  tiny: s(24),
};

// TV overscan safe area: keep content ~5% in from the edges.
export const safe = { h: s(96), v: s(54) };

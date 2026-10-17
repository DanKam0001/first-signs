import { IS_FIXTURE, REFS, SIGNS_RAW, THRESHOLDS, VIDEOS } from '../generated/model';

export type Sign = {
  id: string;
  label: string;
  packs: string[];
  description: string;
  credit?: string;
  verified?: boolean;
};

/** Compact reference frame (see scripts/sync-model.js): unmirrored image coords, pose 11..24, hands x/y. */
export type CFrame = { p: number[] | null; l: number[] | null; r: number[] | null; /** live only: pose 0..10 (head) */ f?: number[] | null };
/** aspect = camera width/height (PROTOCOL.md section 2); absent means the 0.75 default. */
export type RefData = { fps: number; aspect?: number; frames: CFrame[] };

export type Pack = { id: string; name: string; blurb: string };

export const PACKS: Pack[] = [
  { id: 'mealtime', name: 'Mealtime', blurb: 'Signs for the high chair and the table' },
  { id: 'bedtime', name: 'Bedtime', blurb: 'Wind down with sleepy signs' },
  { id: 'bath', name: 'Bath', blurb: 'Splashy signs for bath time' },
  { id: 'family', name: 'Family', blurb: 'The people who love them' },
];

export const DATA_IS_PLACEHOLDER: boolean = IS_FIXTURE;
export const SIGNS: Sign[] = SIGNS_RAW.filter((s) => s && s.id).map((s) => ({
  ...s,
  label: s.label || s.id,
  packs: Array.isArray(s.packs) ? s.packs : [],
  description: s.description || '',
}));
export const thresholds = { top: 3, minProb: 0.25, minHandFrac: 0.4, ...(THRESHOLDS || {}) };

export const CREDIT_REAL = 'Recorded by Deaf signers - GISLR (D-PAN / Google), CC BY 4.0';
export const CREDIT_VIDEO = 'Sign videos: PopSign ASL v1.0 (Georgia Tech & DPAN), performed by Deaf signers, CC BY 4.0';
export const CREDIT_PLACEHOLDER = 'Placeholder motion, not a real sign (real recordings not bundled yet)';

export function signsInPack(packId: string): Sign[] {
  return SIGNS.filter((s) => s.packs.includes(packId));
}
export function signById(id: string): Sign | undefined {
  return SIGNS.find((s) => s.id === id);
}

const refCache: Record<string, RefData | null> = {};
export function refFor(id: string): RefData | null {
  if (id in refCache) return refCache[id];
  const load = REFS[id];
  let data: RefData | null = null;
  try {
    data = load ? (load() as RefData) : null;
  } catch (e) {
    console.warn('ref load failed', id, e);
  }
  refCache[id] = data;
  return data;
}

export type SignVideoData = { video: any; poster: any | null; credit: string | null; note: string | null; aspect: number };
/** The real sign video for a sign (bundled asset modules), or null if this sign has none. */
export function videoFor(id: string): SignVideoData | null {
  const v = VIDEOS[id];
  if (!v) return null;
  try {
    return { video: v.video(), poster: v.poster ? v.poster() : null, credit: v.credit, note: v.note, aspect: v.w / v.h };
  } catch (e) {
    console.warn('video load failed', id, e);
    return null;
  }
}

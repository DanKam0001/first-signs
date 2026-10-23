import { createStore } from './store';

export type SignProgress = { ok: number; tries: number; last: number };
type ProgressState = { signs: Record<string, SignProgress> };

export const progress = createStore<ProgressState>('fs.progress.v1', { signs: {} });

/** A sign counts as learned once it has been signed right at least once. */
export const isLearned = (p?: SignProgress) => !!p && p.ok >= 1;

export function recordAttempt(signId: string, ok: boolean) {
  progress.set((s) => {
    const cur = s.signs[signId] || { ok: 0, tries: 0, last: 0 };
    return {
      signs: { ...s.signs, [signId]: { ok: cur.ok + (ok ? 1 : 0), tries: cur.tries + 1, last: Date.now() } },
    };
  });
}

export function resetProgress() {
  progress.set({ signs: {} });
}

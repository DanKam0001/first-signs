import AsyncStorage from '@amazon-devices/react-native-async-storage__async-storage';
import { useSyncExternalStore } from 'react';

/** A tiny persisted store: synchronous reads, async write-through to AsyncStorage (localStorage on web). */
export function createStore<T extends object>(key: string, initial: T) {
  let state: T = initial;
  const subs = new Set<() => void>();
  let loaded = false;
  const emit = () => subs.forEach((f) => f());

  // Vega: AsyncStorage occasionally never settles (seen on the VVD after an app restart), which left the app on
  // its blank "not ready" view. Give it 2.5 s, then carry on with defaults.
  const ready = Promise.race([
    AsyncStorage.getItem(key),
    new Promise<null>((r) => setTimeout(() => { console.warn('store load timed out', key); r(null); }, 2500)),
  ])
    .then((raw) => {
      if (raw && !loaded) state = { ...initial, ...JSON.parse(raw) };
    })
    .catch((e) => console.warn('store load failed', key, e))
    .finally(() => {
      loaded = true;
      emit();
    });

  return {
    ready,
    isLoaded: () => loaded,
    get: () => state,
    set(patch: Partial<T> | ((s: T) => Partial<T>)) {
      const p = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...p };
      emit();
      AsyncStorage.setItem(key, JSON.stringify(state)).catch((e) => console.warn('store save failed', key, e));
    },
    subscribe(f: () => void) {
      subs.add(f);
      return () => {
        subs.delete(f);
      };
    },
    use(): T {
      return useSyncExternalStore(this.subscribe, this.get, this.get);
    },
  };
}

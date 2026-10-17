import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

/** A tiny persisted store: synchronous reads, async write-through to AsyncStorage (localStorage on web). */
export function createStore<T extends object>(key: string, initial: T) {
  let state: T = initial;
  const subs = new Set<() => void>();
  let loaded = false;
  const emit = () => subs.forEach((f) => f());

  const ready = AsyncStorage.getItem(key)
    .then((raw) => {
      if (raw) state = { ...initial, ...JSON.parse(raw) };
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

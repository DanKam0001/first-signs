import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { setBackHandler } from '../remote/back';

export type Route =
  | { name: 'pair' }
  | { name: 'home' }
  | { name: 'pack'; packId: string }
  | { name: 'lesson'; packId: string; signId: string }
  | { name: 'gameSetup' }
  | { name: 'game'; players: string[]; packId: string; turnsEach: number }
  | { name: 'duoSetup' }
  | { name: 'duo'; leftName: string; rightName: string; packId: string; rounds: number }
  | { name: 'talk' }
  | { name: 'progress' }
  | { name: 'about' }
  | { name: 'settings' };

type Router = {
  stack: Route[];
  top: Route;
  push: (r: Route) => void;
  pop: () => void;
  replace: (r: Route) => void;
  reset: (r: Route) => void;
  overrides: React.MutableRefObject<(() => boolean)[]>;
};

const Ctx = createContext<Router | null>(null);

let seq = 0;
const routeKeys = new WeakMap<Route, number>();
const tag = (r: Route) => {
  routeKeys.set(r, ++seq);
  return r;
};
/** Unique key per navigation, so replacing a screen with the same name still remounts it. */
export const routeKey = (r: Route) => routeKeys.get(r) ?? 0;

export function RouterProvider({ initial, children }: { initial: Route; children: React.ReactNode }) {
  const [stack, setStack] = useState<Route[]>(() => [tag({ ...initial })]);
  const stackRef = useRef(stack);
  stackRef.current = stack;
  const overrides = useRef<(() => boolean)[]>([]);

  const push = useCallback((r: Route) => setStack((s) => [...s, tag({ ...r })]), []);
  const pop = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  const replace = useCallback((r: Route) => setStack((s) => [...s.slice(0, -1), tag({ ...r })]), []);
  const reset = useCallback((r: Route) => setStack([tag({ ...r })]), []);

  useEffect(() => {
    setBackHandler(() => {
      const o = overrides.current[overrides.current.length - 1];
      if (o && o()) return true;
      if (stackRef.current.length > 1) {
        setStack((s) => s.slice(0, -1));
        return true;
      }
      return false; // root screen: let Android leave the app
    });
  }, []);

  const value = useMemo(
    () => ({ stack, top: stack[stack.length - 1], push, pop, replace, reset, overrides }),
    [stack, push, pop, replace, reset]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRouter(): Router {
  const r = useContext(Ctx);
  if (!r) throw new Error('useRouter outside RouterProvider');
  return r;
}

/** A screen can intercept Back (e.g. to cancel an attempt). Return true when handled. */
export function useBackOverride(fn: () => boolean) {
  const { overrides } = useRouter();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const wrapper = () => ref.current();
    overrides.current.push(wrapper);
    return () => {
      overrides.current = overrides.current.filter((w) => w !== wrapper);
    };
  }, [overrides]);
}

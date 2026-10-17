// One "Your turn" attempt (PROTOCOL.md section 1): TV sends `attempt`, shows the countdown and the
// recording window locally, then waits for the phone's `pred`. Back cancels with `cancel`.
import { useCallback, useEffect, useRef, useState } from 'react';
import { conn, newId, Pred } from './connection';

export const COUNTDOWN_MS = 3000;
export const WINDOW_MS = 2500;
const PRED_TIMEOUT_MS = 9000; // after the window closes

export type AttemptPhase = 'idle' | 'countdown' | 'recording' | 'thinking' | 'done' | 'timeout' | 'offline';

export function useAttempt() {
  const [phase, setPhase] = useState<AttemptPhase>('idle');
  const [count, setCount] = useState(3);
  const [pred, setPred] = useState<Pred | null>(null);
  const idRef = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => {
    const onPred = (p: Pred) => {
      if (!idRef.current || p.id !== idRef.current) return;
      idRef.current = null;
      clear();
      setPred(p);
      setPhase('done');
    };
    conn.events.on('pred', onPred);
    return () => {
      conn.events.off('pred', onPred);
      clear();
      if (idRef.current) conn.send({ type: 'cancel', id: idRef.current });
    };
  }, []);

  const start = useCallback((target: string, pack: string) => {
    clear();
    setPred(null);
    const id = newId();
    const sent = conn.send({ type: 'attempt', id, target, pack, countdownMs: COUNTDOWN_MS, windowMs: WINDOW_MS });
    if (!sent || !conn.snap.paired) {
      setPhase('offline');
      return;
    }
    idRef.current = id;
    setPhase('countdown');
    setCount(3);
    const step = COUNTDOWN_MS / 3;
    timers.current.push(setTimeout(() => setCount(2), step));
    timers.current.push(setTimeout(() => setCount(1), step * 2));
    timers.current.push(setTimeout(() => setPhase('recording'), COUNTDOWN_MS));
    timers.current.push(setTimeout(() => setPhase('thinking'), COUNTDOWN_MS + WINDOW_MS));
    timers.current.push(
      setTimeout(() => {
        if (idRef.current === id) {
          conn.send({ type: 'cancel', id });
          idRef.current = null;
          setPhase('timeout');
        }
      }, COUNTDOWN_MS + WINDOW_MS + PRED_TIMEOUT_MS)
    );
  }, []);

  /** Returns true if an attempt was in flight and has been cancelled. */
  const cancel = useCallback(() => {
    clear();
    const id = idRef.current;
    idRef.current = null;
    if (id) conn.send({ type: 'cancel', id });
    setPhase('idle');
    return !!id;
  }, []);

  const reset = useCallback(() => {
    clear();
    idRef.current = null;
    setPred(null);
    setPhase('idle');
  }, []);

  const busy = phase === 'countdown' || phase === 'recording' || phase === 'thinking';
  return { phase, count, pred, start, cancel, reset, busy, windowMs: WINDOW_MS };
}

// WebSocket client for PROTOCOL.md section 1. One connection for the whole app.
import mitt from 'mitt';
import { useSyncExternalStore } from 'react';

export type Frame = {
  type: 'frame';
  t: number;
  pose: number[][] | null;
  left: number[][] | null;
  right: number[][] | null;
  /** optional camera width/height (PROTOCOL.md section 1) */
  aspect?: number;
  /** duo mode (PROTOCOL.md 1b): one entry per person, side L/R = camera image left/right */
  people?: { side: 'L' | 'R'; pose: number[][] | null; left: number[][] | null; right: number[][] | null }[];
};
export type DuoResult = { side: 'L' | 'R'; top: [string, number][]; ok: boolean; present?: boolean };
export type Pred = {
  type: 'pred';
  id: string;
  target: string;
  top: [string, number][];
  ok: boolean;
  mode?: 'solo' | 'duo';
  people?: DuoResult[];
};
export type PhoneState = 'ready' | 'no_hands' | 'need_two' | 'countdown' | 'recording' | 'thinking';

export type ConnSnapshot = {
  url: string;
  status: 'idle' | 'connecting' | 'open' | 'closed';
  code: string | null;
  phoneUrl: string | null;
  paired: boolean;
  phoneState: PhoneState | null;
  lastError: string | null;
  lastFrameAt: number;
};

type Events = {
  frame: Frame;
  pred: Pred;
  paired: void;
  peer_left: string;
  message: any;
};

let uid = 0;
export const newId = () => `${Date.now().toString(36)}-${(uid++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

class Connection {
  events = mitt<Events>();
  private ws: WebSocket | null = null;
  private retry = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  /** Room code to ask for again after a reconnect, so a paired phone stays paired (server/ supports `code` on TV hello). */
  private lastCode: string | null = null;
  private subs = new Set<() => void>();
  private pending = new Map<string, { resolve: (m: any) => void; reject: (e: Error) => void; timer: any }>();
  snap: ConnSnapshot = {
    url: '',
    status: 'idle',
    code: null,
    phoneUrl: null,
    paired: false,
    phoneState: null,
    lastError: null,
    lastFrameAt: 0,
  };

  private update(p: Partial<ConnSnapshot>) {
    this.snap = { ...this.snap, ...p };
    this.subs.forEach((f) => f());
  }
  subscribe = (f: () => void) => {
    this.subs.add(f);
    return () => {
      this.subs.delete(f);
    };
  };
  getSnapshot = () => this.snap;

  connect(url: string) {
    if (url !== this.snap.url) this.lastCode = null;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const old = this.ws;
    this.ws = null;
    if (old) {
      old.onclose = null;
      old.onmessage = null;
      try {
        old.close();
      } catch {}
    }
    this.update({ url, status: 'connecting', code: null, phoneUrl: null, paired: false, phoneState: null });
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (e: any) {
      this.update({ status: 'closed', lastError: String(e?.message || e) });
      this.scheduleRetry();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.retry = 0;
      this.update({ status: 'open', lastError: null });
      this.send(this.lastCode ? { type: 'hello', role: 'tv', code: this.lastCode } : { type: 'hello', role: 'tv' });
    };
    ws.onmessage = (ev) => {
      if (this.ws !== ws) return;
      let msg: any;
      try {
        msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data));
      } catch {
        return;
      }
      this.handle(msg);
    };
    ws.onerror = () => {
      if (this.ws !== ws) return;
      this.update({ lastError: `Could not reach ${url}` });
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.update({ status: 'closed', paired: false, phoneState: null });
      this.scheduleRetry();
    };
  }

  private scheduleRetry() {
    const delay = Math.min(5000, 1000 * 2 ** this.retry++);
    this.retryTimer = setTimeout(() => this.connect(this.snap.url), delay);
  }

  private handle(msg: any) {
    switch (msg.type) {
      case 'room':
        this.lastCode = msg.code != null ? String(msg.code) : null;
        this.update({ code: this.lastCode, phoneUrl: msg.phoneUrl ?? null, paired: false });
        break;
      case 'paired':
        this.update({ paired: true });
        this.events.emit('paired');
        break;
      case 'peer_left':
        if (msg.role === 'phone') this.update({ paired: false, phoneState: null });
        this.events.emit('peer_left', msg.role);
        break;
      case 'frame':
        this.snap.lastFrameAt = Date.now(); // no re-render per frame
        this.events.emit('frame', msg);
        break;
      case 'pred':
        this.events.emit('pred', msg);
        break;
      case 'phone_state':
        this.update({ phoneState: msg.state });
        break;
      case 'error':
        this.update({ lastError: String(msg.error || 'error') });
        break;
    }
    if (msg.id && this.pending.has(msg.id) && (msg.type === 'audio' || msg.type === 'coach_text')) {
      const p = this.pending.get(msg.id)!;
      clearTimeout(p.timer);
      this.pending.delete(msg.id);
      p.resolve(msg);
    }
    this.events.emit('message', msg);
  }

  send(obj: object): boolean {
    const ws = this.ws;
    if (!ws || ws.readyState !== 1) return false;
    ws.send(JSON.stringify(obj));
    return true;
  }

  /** Request/response for speak->audio and coach->coach_text. */
  request<T = any>(obj: { type: string; [k: string]: any }, timeoutMs = 8000): Promise<T> {
    const id = newId();
    return new Promise<T>((resolve, reject) => {
      if (!this.send({ ...obj, id })) {
        reject(new Error('not connected'));
        return;
      }
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('timeout'));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
    });
  }

  /** http(s) base of the server, derived from the ws URL (ws://h:p/ws -> http://h:p). */
  httpBase(): string {
    const u = this.snap.url;
    const m = /^(wss?):\/\/([^/]+)/i.exec(u);
    if (!m) return '';
    return `${m[1].toLowerCase() === 'wss' ? 'https' : 'http'}://${m[2]}`;
  }
}

export const conn = new Connection();

export function useConn(): ConnSnapshot {
  return useSyncExternalStore(conn.subscribe, conn.getSnapshot, conn.getSnapshot);
}

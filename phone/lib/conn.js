// WebSocket to the relay with automatic reconnect. Re-sends hello on every (re)connect.
export class Conn {
  constructor({ url, code, onMessage, onStatus }) {
    this.url = url;
    this.code = code;
    this.onMessage = onMessage;
    this.onStatus = onStatus || (() => {});
    this.ws = null;
    this.backoff = 500;
    this.stopped = false;
    this.pending = []; // important messages (preds) kept while offline; frames are never queued
    this.connect();
  }

  connect() {
    if (this.stopped) return;
    this.onStatus("connecting");
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.backoff = 500;
      ws.send(JSON.stringify({ type: "hello", role: "phone", code: this.code }));
      this.onStatus("connected");
      while (this.pending.length) ws.send(this.pending.shift());
    };
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      this.onMessage(m);
    };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (e.code === 4000) { this.stopped = true; this.onStatus("replaced"); return; } // another phone took over
      this.onStatus("offline");
      setTimeout(() => this.connect(), this.backoff);
      this.backoff = Math.min(this.backoff * 2, 5000);
    };
    ws.onerror = () => {};
  }

  get open() {
    return this.ws && this.ws.readyState === 1;
  }

  // Frames: dropped if offline or if the socket is backed up (keeps latency low on a slow link).
  sendFrame(str) {
    if (!this.open || this.ws.bufferedAmount > 64 * 1024) return false;
    this.ws.send(str);
    return true;
  }

  send(obj, { queue = false } = {}) {
    const s = JSON.stringify(obj);
    if (this.open) this.ws.send(s);
    else if (queue) this.pending.push(s);
  }

  stop() {
    this.stopped = true;
    if (this.ws) this.ws.close();
  }
}

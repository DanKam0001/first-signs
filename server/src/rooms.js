// Pairing rooms. Pure logic with an injectable clock so it can be unit-tested without sockets.
import { randomInt } from "node:crypto";

export class Rooms {
  constructor({ idleMs = 30 * 60 * 1000, now = () => Date.now() } = {}) {
    this.idleMs = idleMs;
    this.now = now;
    this.byCode = new Map();
  }

  newCode() {
    for (let i = 0; i < 1000; i++) {
      const code = String(randomInt(1000, 10000));
      if (!this.byCode.has(code)) return code;
    }
    throw new Error("no free room codes");
  }

  create() {
    const room = { code: this.newCode(), tv: null, phone: null, lastActive: this.now() };
    this.byCode.set(room.code, room);
    return room;
  }

  // Returns the room only if it exists and has not gone idle.
  get(code) {
    const room = this.byCode.get(String(code ?? ""));
    if (!room) return null;
    if (this.now() - room.lastActive > this.idleMs) return null;
    return room;
  }

  touch(room) {
    if (room) room.lastActive = this.now();
  }

  delete(room) {
    if (room && this.byCode.get(room.code) === room) this.byCode.delete(room.code);
  }

  // Rooms idle for longer than idleMs. The caller decides what to tell connected sockets.
  expired() {
    const t = this.now();
    return [...this.byCode.values()].filter((r) => t - r.lastActive > this.idleMs);
  }

  get size() {
    return this.byCode.size;
  }
}

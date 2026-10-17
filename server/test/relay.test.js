import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import WebSocket from "ws";
import { loadConfig } from "../src/config.js";
import { createServer } from "../src/server.js";
import { Rooms } from "../src/rooms.js";

let app, base, cfg;
const quiet = { log() {}, warn() {}, error() {} };

before(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fs-test-"));
  cfg = loadConfig({
    DISABLE_AWS: "1", CACHE_DIR: tmp, PUBLIC_URL: "https://example.trycloudflare.com",
    MODEL_DIR: path.join(tmp, "no-model"), // forces the stub fixture
  });
  app = createServer(cfg, quiet);
  const port = await app.listen(0, "127.0.0.1");
  base = `ws://127.0.0.1:${port}/ws`;
});
after(async () => { await app.close(); });

// A client that queues every message so tests can await them in order.
function client() {
  const ws = new WebSocket(base);
  const queue = [];
  const waiters = [];
  ws.on("message", (d) => {
    const m = JSON.parse(d.toString());
    const w = waiters.findIndex((x) => x.pred(m));
    if (w >= 0) waiters.splice(w, 1)[0].resolve(m); else queue.push(m);
  });
  const opened = new Promise((r) => ws.on("open", r));
  return {
    ws,
    opened,
    send: (o) => ws.send(typeof o === "string" ? o : JSON.stringify(o)),
    next(type, ms = 2000) {
      const pred = (m) => !type || m.type === type;
      const i = queue.findIndex(pred);
      if (i >= 0) return Promise.resolve(queue.splice(i, 1)[0]);
      return new Promise((resolve, reject) => {
        const w = { pred, resolve };
        waiters.push(w);
        setTimeout(() => { const k = waiters.indexOf(w); if (k >= 0) { waiters.splice(k, 1); reject(new Error(`timeout waiting for ${type}`)); } }, ms);
      });
    },
    none(type, ms = 200) {
      return new Promise((resolve, reject) => setTimeout(() => {
        queue.some((m) => m.type === type) ? reject(new Error(`unexpected ${type}`)) : resolve();
      }, ms));
    },
    close: () => new Promise((r) => { ws.once("close", r); ws.close(); }),
  };
}

async function pair() {
  const tv = client(); await tv.opened;
  tv.send({ type: "hello", role: "tv" });
  const room = await tv.next("room");
  const phone = client(); await phone.opened;
  phone.send({ type: "hello", role: "phone", code: room.code });
  await tv.next("paired");
  await phone.next("paired");
  return { tv, phone, room };
}

test("TV gets a 4-digit room code and a phoneUrl built from PUBLIC_URL", async () => {
  const tv = client(); await tv.opened;
  tv.send({ type: "hello", role: "tv" });
  const room = await tv.next("room");
  assert.match(room.code, /^\d{4}$/);
  assert.equal(room.phoneUrl, `https://example.trycloudflare.com/p/${room.code}`);
  await tv.close();
});

test("phone pairs with the code and both sides get paired", async () => {
  const { tv, phone } = await pair();
  await tv.close(); await phone.close();
});

test("bad code -> error bad_code", async () => {
  const phone = client(); await phone.opened;
  phone.send({ type: "hello", role: "phone", code: "0000" });
  assert.deepEqual(await phone.next("error"), { type: "error", error: "bad_code" });
  await phone.close();
});

test("frame, pred and phone_state relay phone -> TV byte-for-byte", async () => {
  const { tv, phone } = await pair();
  const frame = '{"type":"frame","t":1700000000000,"pose":null,"left":[[0.1,0.2,0.3]],"right":null}';
  phone.send(frame);
  const got = await tv.next("frame");
  assert.equal(JSON.stringify(got), frame);
  phone.send({ type: "pred", id: "a1", target: "milk", top: [["milk", 0.8]], ok: true });
  assert.equal((await tv.next("pred")).id, "a1");
  phone.send({ type: "phone_state", state: "ready" });
  assert.equal((await tv.next("phone_state")).state, "ready");
  await tv.close(); await phone.close();
});

test("attempt and cancel relay TV -> phone; TV-only types are not relayed back", async () => {
  const { tv, phone } = await pair();
  const attempt = { type: "attempt", id: "u1", target: "milk", pack: "mealtime", countdownMs: 3000, windowMs: 2500 };
  tv.send(attempt);
  assert.deepEqual(await phone.next("attempt"), attempt);
  tv.send({ type: "cancel", id: "u1" });
  assert.equal((await phone.next("cancel")).id, "u1");
  // A phone must not be able to send attempts to the TV.
  phone.send(attempt);
  await tv.none("attempt");
  await tv.close(); await phone.close();
});

test("peer_left when either side disconnects; phone can rejoin the same code", async () => {
  const { tv, phone, room } = await pair();
  await phone.close();
  assert.deepEqual(await tv.next("peer_left"), { type: "peer_left", role: "phone" });
  const phone2 = client(); await phone2.opened;
  phone2.send({ type: "hello", role: "phone", code: room.code });
  await phone2.next("paired");
  await tv.next("paired");
  await tv.close();
  assert.deepEqual(await phone2.next("peer_left"), { type: "peer_left", role: "tv" });
  await phone2.close();
});

test("TV can reclaim its room after a reconnect by sending its code", async () => {
  const { tv, phone, room } = await pair();
  await tv.close();
  await phone.next("peer_left");
  const tv2 = client(); await tv2.opened;
  tv2.send({ type: "hello", role: "tv", code: room.code });
  assert.equal((await tv2.next("room")).code, room.code);
  await tv2.next("paired");
  await phone.next("paired");
  await tv2.close(); await phone.close();
});

test("a second phone replaces the first", async () => {
  const { tv, phone, room } = await pair();
  const closed = new Promise((r) => phone.ws.once("close", (code) => r(code)));
  const phone2 = client(); await phone2.opened;
  phone2.send({ type: "hello", role: "phone", code: room.code });
  await phone2.next("paired");
  assert.equal(await closed, 4000);
  phone2.send({ type: "phone_state", state: "ready" });
  assert.equal((await tv.next("phone_state")).state, "ready");
  await tv.close(); await phone2.close();
});

test("speak falls back to url:null when Polly is unavailable", async () => {
  const tv = client(); await tv.opened;
  tv.send({ type: "hello", role: "tv" }); await tv.next("room");
  tv.send({ type: "speak", id: "s1", text: "Your turn. Sign milk." });
  const a = await tv.next("audio");
  assert.equal(a.id, "s1");
  assert.equal(a.url, null);
  await tv.close();
});

test("coach: canned tip, and only from verified descriptions", async () => {
  const tv = client(); await tv.opened;
  tv.send({ type: "hello", role: "tv" }); await tv.next("room");
  // The fixture's descriptions are all "verified": false, so the tip must not quote them.
  tv.send({ type: "coach", id: "c1", target: "milk", top: [["more", 0.5], ["milk", 0.2]], attempts: 2 });
  const c = await tv.next("coach_text");
  assert.equal(c.id, "c1");
  assert.ok(!c.text.includes("FIXTURE"), c.text);
  // A verified description is restated in the canned tip.
  const sign = app.signs.get().byId.get("milk");
  const saved = { ...sign };
  Object.assign(sign, { verified: true, description: "Test description" });
  tv.send({ type: "coach", id: "c2", target: "milk", top: [], attempts: 1 });
  const c2 = await tv.next("coach_text");
  Object.assign(sign, saved);
  assert.equal(c2.text, "Nice try! Test description.");
  await tv.close();
});

test("speak/coach are TV-only", async () => {
  const { tv, phone } = await pair();
  phone.send({ type: "speak", id: "x", text: "hi" });
  assert.equal((await phone.next("error")).error, "tv_only");
  await tv.close(); await phone.close();
});

test("invalid JSON -> bad_message; ping -> pong", async () => {
  const c = client(); await c.opened;
  c.send("not json");
  assert.equal((await c.next("error")).error, "bad_message");
  c.send({ type: "ping", t0: 5 });
  const p = await c.next("pong");
  assert.equal(p.t0, 5);
  assert.ok(p.ts > 0);
  await c.close();
});

test("rooms expire after the idle time; a waiting TV gets a fresh code", async () => {
  const tv = client(); await tv.opened;
  tv.send({ type: "hello", role: "tv" });
  const first = await tv.next("room");
  const room = app.rooms.get(first.code);
  room.lastActive = Date.now() - cfg.roomIdleMs - 1;
  const phone = client(); await phone.opened;
  phone.send({ type: "hello", role: "phone", code: first.code });
  assert.equal((await phone.next("error")).error, "bad_code");
  app.sweep();
  const fresh = await tv.next("room");
  assert.notEqual(fresh.code, first.code);
  await tv.close(); await phone.close();
});

test("Rooms unit: codes are unique and idle rooms are reported", () => {
  let t = 0;
  const r = new Rooms({ idleMs: 1000, now: () => t });
  const codes = new Set();
  for (let i = 0; i < 500; i++) codes.add(r.create().code);
  assert.equal(codes.size, 500);
  t = 500; r.touch(r.get([...codes][0]));
  t = 1200;
  assert.equal(r.expired().length, 499);
  assert.equal(r.get([...codes][1]), null);
  assert.ok(r.get([...codes][0]));
});

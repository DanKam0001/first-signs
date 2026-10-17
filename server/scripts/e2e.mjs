// End-to-end check: a Node "TV" pairs over the relay, Chrome opens the phone page (real webcam by default) through the
// public URL, frames are measured at the TV, then one attempt is sent and the pred awaited.
//
//   node scripts/e2e.mjs                       # uses server/.public_url (from `npm run tunnel`) or localhost
//   node scripts/e2e.mjs --base http://localhost:8788 --seconds 15
//   node scripts/e2e.mjs --video clip.y4m      # Chrome's fake camera plays a file instead of the webcam
//   node scripts/e2e.mjs --headful             # show the browser window
//   node scripts/e2e.mjs --tv-base http://localhost:8788   # TV on the LAN, phone through the tunnel
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
import puppeteer from "puppeteer-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : dflt; };
const flag = (name) => process.argv.includes(`--${name}`);
let base = arg("base", "");
if (!base) { try { base = fs.readFileSync(path.join(here, "..", ".public_url"), "utf8").trim(); } catch { base = "http://localhost:8788"; } }
const seconds = Number(arg("seconds", 10));
const video = arg("video", "");
const chrome = arg("chrome", process.env.CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe");
const target = arg("target", "milk"), pack = arg("pack", "mealtime");
const mode = arg("mode", "solo"); // duo = Sign Together (PROTOCOL §1b): starts the page in duo and sends a duo attempt
let extra = arg("query", "");
if (mode === "duo") extra = [extra, "mode=duo"].filter(Boolean).join("&");

// --tv-base lets the TV side connect differently from the phone, e.g. over the LAN like the real Fire TV.
const tvBase = arg("tv-base", base);
const wsUrl = tvBase.replace(/^http/, "ws") + "/ws";
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : null; };

// ---- TV side ----
const tv = new WebSocket(wsUrl);
const frames = [];
const events = [];
let room, onPred;
tv.on("message", (d) => {
  const recvAt = Date.now();
  const m = JSON.parse(d.toString());
  if (m.type === "frame") { frames.push({ recvAt, t: m.t, left: !!m.left, right: !!m.right, pose: !!m.pose, aspect: m.aspect, people: (m.people || []).map((p) => p.side).join(""), bytes: d.length }); return; }
  events.push({ at: recvAt, ...m });
  if (m.type === "room") room = m;
  if (m.type === "pred" && onPred) onPred(m);
});
await new Promise((r, j) => { tv.once("open", r); tv.once("error", j); });
tv.send(JSON.stringify({ type: "hello", role: "tv" }));
while (!room) await new Promise((r) => setTimeout(r, 20));
console.log(`[e2e] room ${room.code} -> ${room.phoneUrl}`);

// ---- Phone side (Chrome) ----
const args = ["--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required",
  ...(arg("chrome-args", "") ? arg("chrome-args", "").split(" ") : [])];
if (video) args.push("--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${path.resolve(video)}`);
const browser = await puppeteer.launch({ executablePath: chrome, headless: !flag("headful"), args });
const page = await browser.newPage();
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
const phoneUrl = room.phoneUrl.replace(/^https?:\/\/[^/]+/, base); // same path, through the base we were given
const t0 = Date.now();
await page.goto(`${phoneUrl}?autostart=1&debug=1${extra ? "&" + extra : ""}`, { waitUntil: "domcontentloaded", timeout: 60000 });

const firstFrame = await (async () => {
  const deadline = Date.now() + 90000;
  while (!frames.length && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
  return frames.length ? frames[0].recvAt - t0 : null;
})();
if (firstFrame === null) {
  console.log("[e2e] no frames arrived. Page state:", await page.evaluate(() => JSON.stringify(window.__firstSigns)).catch(() => "?"));
  console.log(logs.join("\n"));
  await browser.close(); tv.close(); process.exit(1);
}
console.log(`[e2e] first frame ${firstFrame} ms after page open; measuring ${seconds}s...`);
const measureFrom = frames.length;
await new Promise((r) => setTimeout(r, seconds * 1000));
const win = frames.slice(measureFrom);
const lat = win.map((f) => f.recvAt - f.t);
const gaps = win.slice(1).map((f, i) => f.recvAt - win[i].recvAt);

// ---- Optional: drop the phone's socket and check it re-pairs and frames resume ----
let reconnect = null;
if (flag("reconnect")) {
  const before = frames.length, dropAt = Date.now();
  await page.evaluate(() => window.__firstSignsConn.ws.close());
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline && !(events.some((e) => e.type === "paired" && e.at > dropAt) && frames.length > before + 5)) await new Promise((r) => setTimeout(r, 50));
  const re = events.find((e) => e.type === "paired" && e.at > dropAt);
  reconnect = {
    peerLeftSeen: events.some((e) => e.type === "peer_left" && e.at >= dropAt),
    repairedAfterMs: re ? re.at - dropAt : null,
    framesResumed: frames.length > before + 5,
  };
}

// ---- Attempt ----
const id = `e2e-${Date.now()}`;
const predP = new Promise((r) => { onPred = (m) => m.id === id && r(m); });
const sentAt = Date.now();
tv.send(JSON.stringify({ type: "attempt", id, target, pack, countdownMs: 1500, windowMs: 2000, ...(mode === "duo" ? { mode } : {}) }));
const pred = await Promise.race([predP, new Promise((r) => setTimeout(() => r(null), 15000))]);
const states = events.filter((e) => e.type === "phone_state" && e.at >= sentAt).map((e) => e.state);
const phone = await page.evaluate(() => JSON.parse(JSON.stringify(window.__firstSigns)));

const summary = {
  base, tvBase, mode, room: room.code,
  framesMeasured: win.length,
  fps: +(win.length / seconds).toFixed(1),
  latencyMs: { p50: pct(lat, 0.5), p95: pct(lat, 0.95), max: Math.max(...lat) },
  gapMs: { p50: pct(gaps, 0.5), p95: pct(gaps, 0.95) },
  avgFrameBytes: Math.round(win.reduce((s, f) => s + f.bytes, 0) / Math.max(1, win.length)),
  withHands: win.filter((f) => f.left || f.right).length,
  withPose: win.filter((f) => f.pose).length,
  aspects: [...new Set(win.map((f) => f.aspect))],
  statesBeforeAttempt: [...new Set(events.filter((e) => e.type === "phone_state" && e.at < sentAt).map((e) => e.state))],
  peopleSeen: win.reduce((m, f) => { m[f.people || "-"] = (m[f.people || "-"] || 0) + 1; return m; }, {}),
  phone: { detectMs: +phone.detectMs.toFixed(1), handMs: +(phone.handMs || 0).toFixed(1), poseMs: +(phone.poseMs || 0).toFixed(1), fpsOnPhone: phone.fps, delegate: phone.delegate, camera: phone.camera, stub: phone.stub, methods: phone.methods, handedness: phone.handedness, sides: phone.sides, handFramesOnPhone: phone.handFrames, error: phone.error },
  reconnect,
  attempt: { statesSeen: states, pred, predAfterMs: pred ? Date.now() - sentAt : null, expectedMs: 3500 },
};
console.log(JSON.stringify(summary, null, 2));
if (flag("logs")) console.log(logs.join("\n"));
await browser.close();
tv.close();
process.exit(pred ? 0 : 2);

// HTTP + WebSocket server. Implements PROTOCOL.md §1 (pairing, relay, speak, coach) and §4 (routes).
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { WebSocketServer } from "ws";
import { Rooms } from "./rooms.js";
import { Tts } from "./tts.js";
import { Coach } from "./coach.js";
import { SignsStore } from "./signs.js";
import { readPublicUrl } from "./config.js";
import { resolveIn, sendFile, sendJson, notFound } from "./static.js";

const PHONE_TO_TV = new Set(["frame", "pred", "phone_state"]);
const TV_TO_PHONE = new Set(["attempt", "cancel"]);
const MAX_MSG_BYTES = 256 * 1024;
const TV_BUFFER_LIMIT = 512 * 1024; // drop frames (never preds) if the TV link is this far behind
const MODEL_FILES = ["model.onnx", "preprocess.js", "signs.json", "labels.json", "metrics.json"];

function originOf(req) {
  const proto = String(req.headers["x-forwarded-proto"] || (req.socket.encrypted ? "https" : "http")).split(",")[0].trim();
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  return `${proto}://${host}`;
}

export function createServer(cfg, log = console) {
  const rooms = new Rooms({ idleMs: cfg.roomIdleMs });
  const signs = new SignsStore(cfg, log);
  const tts = new Tts(cfg, log);
  const coach = new Coach(cfg, signs, log);
  const stats = { started: Date.now(), framesRelayed: 0, framesDropped: 0, messages: 0, connections: 0 };
  // Requests per rolling hour across all rooms. Cached answers are still counted, which keeps the cap simple and safe.
  const budget = {
    caps: { speak: cfg.maxSpeakPerHour, coach: cfg.maxCoachPerHour },
    hits: { speak: [], coach: [] },
    take(kind) {
      const now = Date.now(), list = this.hits[kind];
      while (list.length && now - list[0] > 3600e3) list.shift();
      if (list.length >= this.caps[kind]) return false;
      list.push(now);
      return true;
    },
  };

  const send = (ws, obj) => {
    if (ws && ws.readyState === 1) ws.send(typeof obj === "string" ? obj : JSON.stringify(obj));
  };

  function phoneUrlFor(ws, code) {
    return `${readPublicUrl(cfg) || ws.origin}/p/${code}`;
  }

  function sendRoom(ws, room) {
    send(ws, { type: "room", code: room.code, phoneUrl: phoneUrlFor(ws, room.code) });
  }

  function attachTv(ws, code) {
    let room = code ? rooms.get(code) : null;
    if (room && room.tv && room.tv !== ws) room = null; // someone else owns it: give this TV a fresh room
    if (!room) room = rooms.create();
    if (ws.room && ws.room !== room) detach(ws);
    room.tv = ws;
    ws.room = room;
    ws.role = "tv";
    rooms.touch(room);
    sendRoom(ws, room);
    if (room.phone) { send(room.tv, { type: "paired" }); send(room.phone, { type: "paired" }); }
  }

  function attachPhone(ws, code) {
    const room = rooms.get(code);
    if (!room) { send(ws, { type: "error", error: "bad_code" }); return; }
    if (ws.room && ws.room !== room) detach(ws);
    if (room.phone && room.phone !== ws) {
      // Newest phone wins (a reload or reconnect while the old socket has not timed out yet).
      const old = room.phone;
      old.room = null;
      try { old.close(4000, "replaced"); } catch {}
    }
    room.phone = ws;
    ws.room = room;
    ws.role = "phone";
    rooms.touch(room);
    if (room.tv) { send(room.tv, { type: "paired" }); send(room.phone, { type: "paired" }); }
  }

  function detach(ws) {
    const room = ws.room;
    if (!room) return;
    ws.room = null;
    if (ws.role === "tv" && room.tv === ws) { room.tv = null; send(room.phone, { type: "peer_left", role: "tv" }); }
    if (ws.role === "phone" && room.phone === ws) { room.phone = null; send(room.tv, { type: "peer_left", role: "phone" }); }
  }

  async function handleSpeak(ws, msg) {
    try {
      const key = await tts.synth(msg.text);
      send(ws, { type: "audio", id: msg.id, url: `${ws.origin}/tts/${key}.mp3` });
    } catch (err) {
      log.warn(`[tts] failed: ${err.name}: ${err.message}`);
      // Not in PROTOCOL's happy path: url null + error lets the TV fall back to showing the text only.
      send(ws, { type: "audio", id: msg.id, url: null, error: "tts_failed" });
    }
  }

  async function handleCoach(ws, msg, allowAws = true) {
    const r = await coach.tip(msg, { allowAws }).catch((err) => ({ text: "Watch the example once more, then give it another go.", source: "error", err }));
    log.log(`[coach] ${msg.target} attempt ${msg.attempts}: ${r.source}${r.modelId ? " " + r.modelId : ""}`);
    send(ws, { type: "coach_text", id: msg.id, text: r.text });
  }

  function onMessage(ws, data, isBinary) {
    if (isBinary || data.length > MAX_MSG_BYTES) return send(ws, { type: "error", error: "bad_message" });
    const raw = data.toString("utf8");
    let msg;
    try { msg = JSON.parse(raw); } catch { return send(ws, { type: "error", error: "bad_message" }); }
    if (!msg || typeof msg.type !== "string") return send(ws, { type: "error", error: "bad_message" });
    stats.messages++;
    const room = ws.room;
    if (room) rooms.touch(room);

    switch (msg.type) {
      case "hello":
        if (msg.role === "tv") return attachTv(ws, msg.code);
        if (msg.role === "phone") return attachPhone(ws, msg.code);
        return send(ws, { type: "error", error: "bad_role" });
      case "speak":
      case "coach":
        // Only a paired-up TV may spend AWS calls, and only within the hourly budget (the key is shared).
        if (ws.role !== "tv") return send(ws, { type: "error", error: "tv_only" });
        {
          const allowAws = budget.take(msg.type);
          if (!allowAws) log.warn(`[budget] ${msg.type} over the hourly cap, answering without AWS`);
          if (msg.type === "speak") {
            if (!allowAws) return send(ws, { type: "audio", id: msg.id, url: null, error: "rate_limited" });
            return void handleSpeak(ws, msg);
          }
          return void handleCoach(ws, msg, allowAws);
        }
      case "ping": // extension for clock sync / latency checks: echoes t0 with the server's clock
        return send(ws, { type: "pong", t0: msg.t0, ts: Date.now() });
    }
    if (ws.role === "phone" && PHONE_TO_TV.has(msg.type)) {
      if (!room || !room.tv) return;
      if (msg.type === "frame") {
        if (room.tv.bufferedAmount > TV_BUFFER_LIMIT) { stats.framesDropped++; return; }
        stats.framesRelayed++;
      }
      return send(room.tv, raw); // forwarded unchanged
    }
    if (ws.role === "tv" && TV_TO_PHONE.has(msg.type)) {
      if (room && room.phone) send(room.phone, raw);
      return;
    }
    send(ws, { type: "error", error: "unexpected_type", got: msg.type });
  }

  // ---------------- HTTP ----------------
  function modelFile(rel) {
    return resolveIn(cfg.modelDir, rel) || resolveIn(cfg.stubDir, rel);
  }

  function handleHttp(req, res) {
    const url = new URL(req.url, "http://x");
    const p = url.pathname;
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }

    if (p === "/healthz") {
      const s = signs.get();
      return sendJson(res, 200, {
        ok: true,
        uptimeS: Math.round((Date.now() - stats.started) / 1000),
        rooms: rooms.size,
        publicUrl: readPublicUrl(cfg) || null,
        signs: { count: s.signs.length, fixture: s.fixture },
        model: Object.fromEntries(MODEL_FILES.map((f) => [f, resolveIn(cfg.modelDir, f) ? "real" : resolveIn(cfg.stubDir, f) ? "stub" : "missing"])),
        polly: { voice: tts.voice, calls: tts.calls, cacheHits: tts.hits, lastError: tts.lastError },
        bedrock: { modelId: coach.modelId, calls: coach.calls, lastError: coach.lastError },
        relay: { framesRelayed: stats.framesRelayed, framesDropped: stats.framesDropped, messages: stats.messages },
      });
    }
    if (p === "/" ) { res.writeHead(302, { Location: "/tools/fake_tv.html" }); return res.end(); }

    let m;
    if ((m = p.match(/^\/p\/(\d{4})\/?$/))) {
      const f = resolveIn(cfg.phoneDir, "index.html");
      return f ? sendFile(req, res, f) : notFound(res);
    }
    if ((m = p.match(/^\/phone\/(.+)$/))) {
      const f = resolveIn(cfg.phoneDir, m[1]);
      return f ? sendFile(req, res, f) : notFound(res);
    }
    if ((m = p.match(/^\/model\/(.+)$/))) {
      const f = modelFile(m[1]);
      return f ? sendFile(req, res, f) : notFound(res);
    }
    if ((m = p.match(/^\/tts\/([0-9a-f]{40})\.mp3$/))) {
      const f = resolveIn(path.join(cfg.cacheDir, "tts"), `${m[1]}.mp3`);
      return f ? sendFile(req, res, f, { cache: "public, max-age=31536000, immutable" }) : notFound(res);
    }
    if ((m = p.match(/^\/tools\/(.+)$/))) {
      const f = resolveIn(cfg.toolsDir, m[1]);
      return f ? sendFile(req, res, f) : notFound(res);
    }
    if (p === "/favicon.ico") { res.writeHead(204); return res.end(); }
    return notFound(res);
  }

  const server = http.createServer(handleHttp);
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MSG_BYTES, perMessageDeflate: false });

  server.on("upgrade", (req, socket, head) => {
    if (new URL(req.url, "http://x").pathname !== "/ws") { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.origin = originOf(req);
      ws.isAlive = true;
      stats.connections++;
      ws.on("pong", () => { ws.isAlive = true; });
      ws.on("message", (data, isBinary) => onMessage(ws, data, isBinary));
      ws.on("close", () => detach(ws));
      ws.on("error", () => {});
    });
  });

  // Heartbeat (cloudflared drops silent sockets) and idle-room expiry.
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      try { ws.ping(); } catch {}
    }
  }, 15000);
  const sweeper = setInterval(() => sweep(), cfg.sweepMs);

  function sweep() {
    for (const room of rooms.expired()) {
      rooms.delete(room);
      const { tv, phone } = room;
      if (phone) { phone.room = null; send(phone, { type: "error", error: "bad_code" }); }
      if (tv) {
        tv.room = null;
        if (phone) send(tv, { type: "peer_left", role: "phone" });
        attachTv(tv, null); // a TV still on the pairing screen just gets a fresh code
      }
      log.log(`[rooms] expired ${room.code}`);
    }
  }

  return {
    server, wss, rooms, tts, coach, signs, stats, sweep,
    listen(port = cfg.port, host = cfg.host) {
      return new Promise((resolve) => server.listen(port, host, () => resolve(server.address().port)));
    },
    async close() {
      clearInterval(heartbeat);
      clearInterval(sweeper);
      for (const ws of wss.clients) ws.terminate();
      await new Promise((r) => server.close(r));
    },
  };
}

export function ensureDirs(cfg) {
  fs.mkdirSync(path.join(cfg.cacheDir, "tts"), { recursive: true });
}

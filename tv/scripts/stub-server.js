#!/usr/bin/env node
// Tiny stand-in for server/ so the TV app can be tested before the real server exists.
// Implements PROTOCOL.md section 1 for one or more TVs:
//   node scripts/stub-server.js                  # port 8790, relays a real phone if one joins
//   node scripts/stub-server.js --fake-phone     # also pretends a phone paired: streams frames, answers attempts
//   options: --port N  --ok-rate 0.6  --pair-delay 2500
// speak -> serves a short chime WAV (no Polly); coach -> a canned tip (no Bedrock).
const http = require('http');
const crypto = require('crypto');
const os = require('os');
const { WebSocketServer } = require('ws');
const { syntheticRef } = require('./sync-model');

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
const PORT = Number(arg('port', process.env.PORT || 8790));
const FAKE = !!arg('fake-phone', false);
const OK_RATE = Number(arg('ok-rate', 0.6));
const PAIR_DELAY = Number(arg('pair-delay', 2500));

function lanIp() {
  for (const addrs of Object.values(os.networkInterfaces()))
    for (const a of addrs || []) if (a.family === 'IPv4' && !a.internal && a.address.startsWith('192.168.')) return a.address;
  return 'localhost';
}

// ---- chime WAV (served for every speak request) ----
function chime() {
  const rate = 16000;
  const dur = 0.35;
  const n = Math.floor(rate * dur);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const f = t < dur / 2 ? 660 : 880;
    const env = Math.min(1, t * 40) * Math.max(0, 1 - t / dur);
    buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * f * t) * env * 9000), 44 + i * 2);
  }
  return buf;
}
const CHIME = chime();
const spoken = [];

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/tts/')) {
    res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': CHIME.length, 'Access-Control-Allow-Origin': '*' });
    res.end(CHIME);
    return;
  }
  if (req.url === '/spoken') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(spoken.slice(-50), null, 1));
    return;
  }
  if (req.url.startsWith('/p/')) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>First Signs stub</h1><p>This is the stub server. The real phone page lives in phone/ + server/.</p>');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('first-signs stub server\n');
});

const wss = new WebSocketServer({ server, path: '/ws' });
const rooms = new Map(); // code -> { tv, phone, fake }
const send = (ws, obj) => ws && ws.readyState === 1 && ws.send(JSON.stringify(obj));

function newCode() {
  let c;
  do c = String(1000 + Math.floor(Math.random() * 9000));
  while (rooms.has(c));
  return c;
}

// ---- fake phone ----
function toFrame(f, t, jitter) {
  const j = (v) => v + (Math.random() - 0.5) * jitter;
  // fake head landmarks 0..10 (nose, eyes, ears, mouth) above the shoulders, like a live phone frame has
  const [lsx, lsy] = f.pose[11];
  const [rsx] = f.pose[12];
  const cx = (lsx + rsx) / 2;
  const sw = Math.abs(lsx - rsx);
  const top = lsy - sw * 1.0;
  const face = [
    [cx, top + sw * 0.32], // 0 nose
    [cx + sw * 0.08, top + sw * 0.2], [cx + sw * 0.12, top + sw * 0.2], [cx + sw * 0.16, top + sw * 0.2], // 1-3 left eye
    [cx - sw * 0.08, top + sw * 0.2], [cx - sw * 0.12, top + sw * 0.2], [cx - sw * 0.16, top + sw * 0.2], // 4-6 right eye
    [cx + sw * 0.26, top + sw * 0.25], [cx - sw * 0.26, top + sw * 0.25], // 7-8 ears
    [cx + sw * 0.08, top + sw * 0.45], [cx - sw * 0.08, top + sw * 0.45], // 9-10 mouth
  ];
  f = { ...f, pose: f.pose.map((pt, i) => (i <= 10 ? [face[i][0], face[i][1], 0, 0.99] : pt)) };
  return {
    type: 'frame',
    t,
    aspect: 0.75,
    pose: f.pose.map(([x, y, z, v]) => [j(x), j(y), z, v]),
    left: f.left ? f.left.map(([x, y, z]) => [j(x), j(y), z]) : null,
    right: f.right ? f.right.map(([x, y, z]) => [j(x), j(y), z]) : null,
  };
}
// Duo mode (PROTOCOL.md 1b): the same synthetic person, shrunk and shifted to the camera's left (L) / right (R).
function placePerson(f, dx, scale) {
  const tx = ([x, y, ...rest]) => [0.5 + (x - 0.5) * scale + dx, 0.55 + (y - 0.55) * scale, ...rest];
  return { pose: f.pose.map(tx), left: f.left ? f.left.map(tx) : null, right: f.right ? f.right.map(tx) : null };
}
function duoFrame(fL, fR, t, jitter) {
  const L = toFrame(placePerson(fL, -0.21, 0.62), t, jitter);
  const R = toFrame(placePerson(fR, 0.21, 0.62), t, jitter);
  return {
    ...L,
    people: [
      { side: 'L', pose: L.pose, left: L.left, right: L.right },
      { side: 'R', pose: R.pose, left: R.left, right: R.right },
    ],
  };
}
function startFake(room) {
  const idle = syntheticRef('idle-wave').frames;
  const fake = { attempt: null, tries: {}, k: 0 };
  room.fake = fake;
  fake.timer = setInterval(() => {
    const a = fake.attempt;
    let frames = idle;
    if (a && a.stage === 'recording') frames = syntheticRef(a.target).frames;
    const k = fake.k++;
    const f = frames[k % frames.length];
    const jitter = a && a.stage === 'recording' ? 0.004 : 0.002;
    if (fake.duo) send(room.tv, duoFrame(f, frames[(k + 7) % frames.length], Date.now(), jitter));
    else send(room.tv, toFrame(f, Date.now(), jitter));
  }, 1000 / 15);
  send(room.tv, { type: 'paired' });
  send(room.tv, { type: 'phone_state', state: 'ready' });
  console.log(`[stub] room ${room.code}: fake phone paired`);
}
function fakeAttempt(room, msg) {
  const fake = room.fake;
  const a = { id: msg.id, target: msg.target, stage: 'countdown', timers: [] };
  fake.attempt = a;
  const duo = msg.mode === 'duo';
  fake.duo = duo;
  if (duo && !fake.sawDuo) {
    // first duo attempt: pretend only one person was in view for a moment
    fake.sawDuo = true;
    send(room.tv, { type: 'phone_state', state: 'need_two' });
    a.timers.push(setTimeout(() => send(room.tv, { type: 'phone_state', state: 'countdown' }), 1800));
  } else send(room.tv, { type: 'phone_state', state: 'countdown' });
  a.timers.push(
    setTimeout(() => {
      a.stage = 'recording';
      send(room.tv, { type: 'phone_state', state: 'recording' });
    }, msg.countdownMs || 3000)
  );
  a.timers.push(
    setTimeout(() => {
      a.stage = 'thinking';
      send(room.tv, { type: 'phone_state', state: 'thinking' });
    }, (msg.countdownMs || 3000) + (msg.windowMs || 2500))
  );
  a.timers.push(
    setTimeout(() => {
      const n = (fake.tries[msg.target] = (fake.tries[msg.target] || 0) + 1);
      const ok = n >= 2 || Math.random() < OK_RATE; // a miss is always followed by a success
      const others = ['more', 'drink', 'water', 'bed', 'mom'].filter((x) => x !== msg.target);
      const p = ok ? 0.7 + Math.random() * 0.25 : 0.1 + Math.random() * 0.1;
      const top = ok
        ? [[msg.target, p], [others[0], (1 - p) * 0.6], [others[1], (1 - p) * 0.3]]
        : [[others[0], 0.55], [msg.target, p], [others[1], 0.12]];
      const round3 = top.map(([a2, b]) => [a2, Math.round(b * 1000) / 1000]);
      if (duo) {
        // scripted so a test sees every case: 1 = L ok / R miss, 2 = both ok, 3 = R out of view, then random
        const d = (fake.duoN = (fake.duoN || 0) + 1);
        const okL = d === 3 ? true : d <= 2 ? true : Math.random() < OK_RATE;
        const okR = d === 1 ? false : d === 2 ? true : d === 3 ? false : Math.random() < OK_RATE;
        const missTop = [[others[0], 0.55], [msg.target, 0.15], [others[1], 0.12]];
        const okTop = [[msg.target, 0.82], [others[0], 0.1], [others[1], 0.04]];
        send(room.tv, {
          type: 'pred',
          id: msg.id,
          target: msg.target,
          mode: 'duo',
          top: okL ? okTop : missTop,
          ok: okL,
          people: [
            { side: 'L', top: okL ? okTop : missTop, ok: okL, present: true },
            { side: 'R', top: okR ? okTop : missTop, ok: okR, present: d !== 3 },
          ],
        });
        send(room.tv, { type: 'phone_state', state: 'ready' });
        fake.attempt = null;
        console.log(`[stub] room ${room.code}: duo pred ${msg.target} L=${okL} R=${okR}${d === 3 ? ' (R not present)' : ''}`);
        return;
      }
      send(room.tv, { type: 'pred', id: msg.id, target: msg.target, top: round3, ok });
      send(room.tv, { type: 'phone_state', state: 'ready' });
      fake.attempt = null;
      console.log(`[stub] room ${room.code}: pred ${msg.target} ok=${ok}`);
    }, (msg.countdownMs || 3000) + (msg.windowMs || 2500) + 700)
  );
}

wss.on('connection', (ws, req) => {
  let room = null;
  let role = null;
  const host = req.headers.host && !req.headers.host.startsWith('localhost') ? req.headers.host : `${lanIp()}:${PORT}`;
  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(String(data));
    } catch {
      return;
    }
    if (msg.type === 'hello' && msg.role === 'tv') {
      role = 'tv';
      const code = newCode();
      room = { code, tv: ws, phone: null, fake: null };
      rooms.set(code, room);
      send(ws, { type: 'room', code, phoneUrl: `http://${host}/p/${code}` });
      console.log(`[stub] tv joined, room ${code}`);
      if (FAKE) setTimeout(() => rooms.get(code) === room && startFake(room), PAIR_DELAY);
      return;
    }
    if (msg.type === 'hello' && msg.role === 'phone') {
      const r = rooms.get(String(msg.code));
      if (!r) return send(ws, { type: 'error', error: 'bad_code' });
      role = 'phone';
      room = r;
      r.phone = ws;
      send(r.tv, { type: 'paired' });
      send(ws, { type: 'paired' });
      return;
    }
    if (!room) return;
    if (role === 'tv') {
      if (msg.type === 'speak') {
        spoken.push(msg.text);
        console.log(`[stub] speak: ${msg.text}`);
        const sha = crypto.createHash('sha1').update(`stub|${msg.text}`).digest('hex');
        return send(ws, { type: 'audio', id: msg.id, url: `/tts/${sha}.wav` });
      }
      if (msg.type === 'coach') {
        return setTimeout(
          () =>
            send(ws, {
              type: 'coach_text',
              id: msg.id,
              text: 'Keep your hand in front of your chest where the camera can see it, and make the movement a little bigger.',
            }),
          700
        );
      }
      if (msg.type === 'attempt' && room.fake) return fakeAttempt(room, msg);
      if (msg.type === 'cancel' && room.fake) {
        const a = room.fake.attempt;
        if (a && a.id === msg.id) {
          a.timers.forEach(clearTimeout);
          room.fake.attempt = null;
          send(ws, { type: 'phone_state', state: 'ready' });
        }
        return;
      }
      if (msg.type === 'attempt' || msg.type === 'cancel') return send(room.phone, msg);
    }
    if (role === 'phone' && ['frame', 'pred', 'phone_state'].includes(msg.type)) send(room.tv, msg);
  });
  ws.on('close', () => {
    if (!room) return;
    if (role === 'tv') {
      if (room.fake) clearInterval(room.fake.timer);
      send(room.phone, { type: 'peer_left', role: 'tv' });
      rooms.delete(room.code);
    } else if (role === 'phone') {
      room.phone = null;
      send(room.tv, { type: 'peer_left', role: 'phone' });
    }
  });
});

server.listen(PORT, () => console.log(`[stub] ws://localhost:${PORT}/ws  (LAN ws://${lanIp()}:${PORT}/ws)  fake-phone=${FAKE}`));

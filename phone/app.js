// First Signs phone page: camera -> MediaPipe hands + pose -> `frame` messages to the TV, and attempts -> `pred`.
// Video never leaves the phone; only landmarks are sent. Protocol: PROTOCOL.md §1 and §3.
import { FilesetResolver, HandLandmarker, PoseLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";
import { Conn } from "./lib/conn.js";
import { buildFrame, wireFrame } from "./lib/frame.js";
import { buildDuoFrame, SideTracker } from "./lib/duo.js";
import { assignHands } from "./lib/hands.js";
import { drawFrame } from "./lib/draw.js";
import { loadModel } from "./lib/model.js";

const MP_VERSION = "0.10.14";
const HAND_MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const POSE_MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const FPS = Math.min(30, Math.max(5, Number(params.get("fps")) || 18));
const code = (location.pathname.match(/\/p\/(\d{4})/) || [])[1] || params.get("code") || "";
const wsUrl = params.get("ws") || `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
if (params.get("debug") === "1") $("debug").hidden = false;

// Sign Together (PROTOCOL §1b). The mode comes from each `attempt` and stays until an attempt says otherwise.
// Solo runs 2 hands + 1 pose; duo runs 4 hands + 2 poses, so solo keeps its speed. `?mode=duo` starts in duo (testing).
let mode = params.get("mode") === "duo" ? "duo" : "solo";
let switching = false;
const tracker = new SideTracker();
let lastTwoAt = 0;

// Shared stats, also read by server/scripts/e2e.mjs.
const stats = window.__firstSigns = {
  code, framesSent: 0, framesDropped: 0, detectMs: 0, fps: 0, methods: { pose: 0, label: 0, none: 0 },
  mode, people: 0, handFrames: 0, handedness: { agree: 0, disagree: 0 }, sides: { left: 0, right: 0, both: 0, rightOnImageLeft: 0 }, preds: [], state: null, paired: false, stub: null, camera: null, error: null,
};

// ---------------- UI helpers ----------------
function card(headline, subline = "", tone = "") {
  $("headline").textContent = headline;
  $("subline").textContent = subline;
  $("card").className = "card " + tone;
}
function pill(text, tone = "") {
  $("connPill").textContent = text;
  $("connPill").className = "pill " + tone;
}

// ---------------- Connection ----------------
let conn = null;
if (!/^\d{4}$/.test(code)) {
  card("No pairing code", "Scan the QR code on your TV to open this page.", "bad");
} else {
  conn = new Conn({ url: wsUrl, code, onMessage, onStatus });
  window.__firstSignsConn = conn; // for server/scripts/e2e.mjs --reconnect
}

function onStatus(s) {
  if (s === "connecting") pill("Connecting...");
  if (s === "connected") pill("Waiting for TV");
  if (s === "offline") { pill("Reconnecting...", "bad"); stats.paired = false; }
  if (s === "replaced") { pill("Disconnected", "bad"); card("Another phone took over", "Only one camera can be paired with the TV. Reload this page to use this phone again.", "bad"); }
}

function onMessage(m) {
  switch (m.type) {
    case "paired":
      stats.paired = true;
      pill("Paired with TV", "on");
      sendState(true);
      if (cameraOn) idleCard();
      break;
    case "peer_left":
      if (m.role === "tv") { stats.paired = false; pill("TV disconnected", "bad"); }
      break;
    case "error":
      if (m.error === "bad_code") {
        conn.stop();
        pill("Code expired", "bad");
        card("This code has expired", "Scan the new QR code on your TV.", "bad");
      }
      break;
    case "attempt":
      runAttempt(m);
      break;
    case "cancel":
      if (attempt && attempt.id === m.id) endAttempt();
      break;
  }
}

// ---------------- phone_state ----------------
let lastSentState = null;
let lastHandAt = 0;
function presenceState() {
  const now = performance.now();
  if (mode === "duo" && cameraOn && now - lastTwoAt > 2000) return "need_two"; // only one person for 2 s
  return now - lastHandAt < 1000 ? "ready" : "no_hands";
}
// The big card when no attempt is running.
let lastCard = "";
const cardKey = () => `${mode}:${stats.state === "need_two"}:${stats.paired}`;
function idleCard() {
  const key = cardKey();
  if (key === lastCard) return;
  lastCard = key;
  if (mode === "duo" && stats.state === "need_two") card("We can only see one person", "Stand side by side, both fully in view.", "bad");
  else if (mode === "duo") card("Sign Together", "Stand side by side, both fully in view, and look at the TV.", "good");
  else if (stats.paired) card("Look at the TV", "Your TV will tell you when to sign.", "good");
  else card("Camera is on", "Waiting for the TV to connect...");
}
function currentState() {
  return attempt ? attempt.phase : presenceState();
}
function sendState(force = false) {
  const s = currentState();
  stats.state = s;
  if (!attempt && cameraOn) idleCard();
  if (!conn || (!force && s === lastSentState)) return;
  lastSentState = s;
  conn.send({ type: "phone_state", state: s });
}
setInterval(() => sendState(true), 5000); // re-sync in case the TV missed a change

// ---------------- Model ----------------
const modelReady = loadModel({ forceStub: params.get("stub") === "1" }).then((m) => {
  stats.stub = m.stub;
  if (m.stub) $("stubBadge").hidden = false;
  else if (m.stubPreprocess) { $("stubBadge").hidden = false; $("stubBadge").textContent = "STUB preprocess"; }
  console.log(`[model] ${m.stub ? "STUB" : "real"} model, T=${m.T} F=${m.F}, ${m.labels.length} labels`);
  return m;
}).catch((err) => {
  console.error("[model] failed to load", err);
  stats.error = "model: " + err.message;
  return null;
});

// ---------------- MediaPipe ----------------
let hands = null, pose = null;
async function makeLandmarkers() {
  const fileset = await FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`);
  const make = async (delegate) => Promise.all([
    HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: HAND_MODEL, delegate },
      runningMode: "VIDEO", numHands: mode === "duo" ? 4 : 2,
      minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
    }),
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: POSE_MODEL, delegate },
      runningMode: "VIDEO", ...poseOptions(),
    }),
  ]);
  try { [hands, pose] = await make("GPU"); stats.delegate = "GPU"; }
  catch (err) { console.warn("[mp] GPU delegate failed, using CPU", err); [hands, pose] = await make("CPU"); stats.delegate = "CPU"; }
}

const mpReady = makeLandmarkers().then(() => {
  if (!conn) return;
  card("Set up your phone", "Stand it up facing you, about 1.5 to 2 metres away, so your hands and shoulders are in view.");
  $("startBtn").hidden = false;
  if (params.get("autostart") === "1") startCamera();
}).catch((err) => {
  stats.error = "mediapipe: " + err.message;
  card("Could not load the hand tracker", "Check your internet connection, then reload this page.", "bad");
  console.error(err);
});

// Duo: 2 poses, with lower confidence thresholds (two smaller people in frame are found less confidently).
function poseOptions() {
  return mode === "duo"
    ? { numPoses: 2, minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5 }
    : { numPoses: 1, minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5 };
}

async function setMode(next) {
  next = next === "duo" ? "duo" : "solo";
  if (next === mode) return;
  mode = stats.mode = next;
  lastPoseRes = null;
  tracker.reset();
  lastTwoAt = performance.now(); // 2 s grace before "need_two"
  lastCard = "";
  if (!hands) return; // makeLandmarkers() will read `mode`
  switching = true;
  try {
    await Promise.all([hands.setOptions({ numHands: mode === "duo" ? 4 : 2 }), pose.setOptions(poseOptions())]);
  } catch (err) { console.error("[mp] could not switch mode", err); }
  switching = false;
}

// ---------------- Camera ----------------
const video = $("video");
const overlay = $("overlay");
const octx = overlay.getContext("2d");
let stream = null;
let facing = params.get("camera") === "back" ? "environment" : "user";
let cameraOn = false;
let wakeLock = null;

async function startCamera() {
  $("startBtn").hidden = true;
  stopCamera();
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: facing }, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
    });
  } catch (err) {
    stats.error = "camera: " + err.name;
    const denied = err.name === "NotAllowedError" || err.name === "SecurityError";
    card(denied ? "Camera access is off" : "Camera not available",
      denied ? "Allow camera access for this site in your browser settings, then tap Start camera again."
             : `Your browser said: ${err.message || err.name}.`, "bad");
    $("startBtn").hidden = false;
    $("startBtn").textContent = "Try again";
    return;
  }
  video.srcObject = stream;
  await video.play().catch(() => {});
  if (!video.videoWidth) await new Promise((r) => video.addEventListener("loadedmetadata", r, { once: true }));
  overlay.width = video.videoWidth;
  overlay.height = video.videoHeight;
  const settings = stream.getVideoTracks()[0].getSettings();
  // Desktop webcams usually report no facingMode: treat them as front cameras.
  const actualFacing = settings.facingMode || (facing === "environment" ? "environment" : "user");
  $("stage").classList.toggle("mirror", actualFacing !== "environment"); // the self-view is mirrored, frames are not
  stats.camera = { width: video.videoWidth, height: video.videoHeight, fps: settings.frameRate, facing: actualFacing, label: stream.getVideoTracks()[0].label };
  cameraOn = true;
  $("viewWrap").hidden = false;
  lastCard = "";
  if (mode === "duo") lastTwoAt = performance.now();
  idleCard();
  keepAwake();
  scheduleNext();
}

function stopCamera() {
  cameraOn = false;
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
}

async function keepAwake() {
  try { if ("wakeLock" in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); } } catch {}
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && cameraOn) keepAwake(); });

$("startBtn").onclick = () => startCamera();
$("flipBtn").onclick = () => { facing = facing === "user" ? "environment" : "user"; startCamera(); };
$("previewBtn").onclick = () => {
  const hidden = $("stage").classList.toggle("hiddenPreview"); // the skeleton stays visible either way
  $("previewBtn").textContent = hidden ? "Show preview" : "Hide preview";
};

// ---------------- Frame loop ----------------
let nextDue = 0, lastTs = 0, fpsWindow = [], frameNo = 0, lastPoseRes = null;
function scheduleNext() {
  if (!cameraOn) return;
  if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(tick);
  else requestAnimationFrame(tick);
}

function tick() {
  if (!cameraOn) return;
  scheduleNext();
  const now = performance.now();
  // Pace to FPS on average: a camera frame is processed if it is no more than half a camera frame early.
  if (video.readyState < 2 || !hands || switching || now < nextDue - 16) return;
  nextDue = Math.max(nextDue + 1000 / FPS, now - 1000 / FPS);
  const t = Date.now();
  const ts = Math.max(now, lastTs + 1); // MediaPipe needs strictly increasing timestamps
  lastTs = ts;
  let handRes, poseRes, tHand;
  try {
    handRes = hands.detectForVideo(video, ts);
    tHand = performance.now();
    // Duo costs about twice solo, so pose runs on every other frame there and hands reuse the previous pose
    // (people move little in 1/18 s; hands are still tracked every frame). Solo is unchanged.
    frameNo++;
    if (mode === "duo" && frameNo % 2 === 0 && lastPoseRes) poseRes = lastPoseRes;
    else poseRes = lastPoseRes = pose.detectForVideo(video, ts);
  } catch (err) { console.error(err); return; }
  const ema = (old, v) => (old ? old * 0.9 + v * 0.1 : v);
  stats.handMs = ema(stats.handMs, tHand - now);
  stats.poseMs = ema(stats.poseMs, performance.now() - tHand);
  stats.detectMs = ema(stats.detectMs, performance.now() - now);

  // Read the decoded frame size every time, so a camera switch or phone rotation updates `aspect` straight away.
  const vw = video.videoWidth, vh = video.videoHeight;
  if (vw && vh && (overlay.width !== vw || overlay.height !== vh)) { overlay.width = vw; overlay.height = vh; stats.camera && Object.assign(stats.camera, { width: vw, height: vh }); }
  const aspect = vw && vh ? vw / vh : undefined;
  if (mode === "duo") {
    const { frame, count } = buildDuoFrame(t, handRes, poseRes, aspect, tracker, now);
    stats.people = count;
    if (count >= 2) lastTwoAt = now;
    return afterFrame(frame, now, "duo");
  }
  const { frame, method, hands: found, assigned } = buildFrame(t, handRes, poseRes, aspect);
  stats.methods[method]++;
  if (frame.left) stats.sides.left++;
  if (frame.right) stats.sides.right++;
  if (frame.left && frame.right) { stats.sides.both++; if (frame.right[0][0] < frame.left[0][0]) stats.sides.rightOnImageLeft++; }
  if (method === "pose") {
    // Self-check of the handedness rule: does the (unswapped) MediaPipe label agree with the pose-wrist match?
    const byLabel = assignHands(found, null);
    for (const side of ["left", "right"]) {
      if (!assigned[side] || found.length < 1) continue;
      const k = byLabel[side] === assigned[side] ? "agree" : "disagree";
      stats.handedness[k]++;
    }
  }
  afterFrame(frame, now, method);
}

function afterFrame(frame, now, method) {
  const anyHand = frame.left || frame.right || (frame.people || []).some((p) => p.left || p.right);
  if (anyHand) { lastHandAt = now; stats.handFrames++; }
  if (conn && stats.paired) { if (conn.sendFrame(wireFrame(frame))) stats.framesSent++; else stats.framesDropped++; }
  if (attempt && attempt.phase === "recording") attempt.frames.push(frame);

  drawFrame(octx, frame, { lineWidth: Math.max(2, overlay.width / 160) });
  $("frameHint").hidden = !!(anyHand || frame.pose);
  if (!attempt) sendState();

  fpsWindow.push(now);
  while (fpsWindow.length && now - fpsWindow[0] > 1000) fpsWindow.shift();
  stats.fps = fpsWindow.length;
  if (!$("debug").hidden) {
    $("debug").textContent = `${mode} · ${stats.fps} fps · detect ${stats.detectMs.toFixed(0)} ms · ${stats.delegate} · sent ${stats.framesSent} · ${mode === "duo" ? stats.people + " people" : "hands via " + method}`;
  }
}

// ---------------- Attempts ----------------
let attempt = null;
const cd = $("countdown");

function setPhase(phase) {
  attempt.phase = phase;
  sendState();
}

function endAttempt() {
  if (!attempt) return;
  attempt.timers.forEach(clearTimeout);
  cancelAnimationFrame(attempt.raf);
  attempt = null;
  tracker.locked = false;
  cd.hidden = true;
  cd.classList.remove("rec");
  sendState(true);
}

async function runAttempt(m) {
  endAttempt();
  const a = attempt = { ...m, mode: m.mode === "duo" ? "duo" : "solo", phase: "countdown", frames: [], timers: [], raf: 0 };
  setMode(a.mode); // switches the landmarkers during the countdown
  tracker.locked = a.mode === "duo"; // sides never swap mid-attempt
  const countdownMs = Math.max(0, Number(m.countdownMs) || 3000);
  const windowMs = Math.max(300, Number(m.windowMs) || 2500);
  sendState(true);
  clearTimeout(verdictTimer);
  cd.hidden = false;
  cd.classList.remove("rec", "verdictOk", "verdictMiss");
  $("barWrap").hidden = true;
  $("countLabel").textContent = !cameraOn ? "Tap Start camera first"
    : a.mode === "duo" ? `Get ready to sign "${m.target}" together` : `Get ready to sign "${m.target}"`;
  const start = performance.now();
  const step = () => {
    if (attempt !== a) return;
    const el = performance.now() - start;
    if (a.phase === "countdown") {
      $("countNum").textContent = String(Math.max(1, Math.ceil((countdownMs - el) / 1000)));
    } else if (a.phase === "recording") {
      $("bar").style.width = `${Math.min(100, ((el - countdownMs) / windowMs) * 100)}%`;
    }
    a.raf = requestAnimationFrame(step);
  };
  step();
  a.timers.push(setTimeout(() => {
    if (attempt !== a) return;
    setPhase("recording");
    cd.classList.add("rec");
    $("countNum").textContent = "Sign now";
    $("countLabel").textContent = m.target;
    $("barWrap").hidden = false;
  }, countdownMs));
  a.timers.push(setTimeout(async () => {
    if (attempt !== a) return;
    setPhase("thinking");
    cancelAnimationFrame(a.raf);
    $("countNum").textContent = "...";
    $("countLabel").textContent = "Checking";
    $("barWrap").hidden = true;
    const model = await modelReady;
    let pred;
    if (model) pred = a.mode === "duo" ? await model.predictDuo(a, a.frames) : await model.predict(a, a.frames);
    else if (a.mode === "duo") pred = { type: "pred", id: a.id, target: a.target, mode: "duo", people: ["L", "R"].map((side) => ({ side, top: [], ok: false, present: false })) };
    else pred = { type: "pred", id: a.id, target: a.target, top: [], ok: false };
    if (attempt !== a) return; // cancelled while thinking
    stats.preds.push({ ...pred, frames: a.frames.length });
    conn && conn.send(pred, { queue: true });
    endAttempt();
    showVerdict(pred);
    card("Look at the TV", "Your result is on the TV.", "good");
    lastCard = cardKey(); // keep this card until something changes
  }, countdownMs + windowMs));
}

// brief result flash on the phone too, so a screen recording of the phone tells the whole story
let verdictTimer = 0;
function showVerdict(pred) {
  const people = pred.mode === "duo" ? pred.people : [pred];
  const ok = people.some((p) => p.ok);
  const guess = (p) => (p.top && p.top[0] ? p.top[0][0] : "");
  const g = guess(people[0]);
  cd.hidden = false;
  cd.classList.remove("rec");
  cd.classList.toggle("verdictOk", ok);
  cd.classList.toggle("verdictMiss", !ok);
  $("barWrap").hidden = true;
  $("countNum").textContent = ok ? "✓" : "Almost!";
  $("countLabel").textContent = ok ? `You signed "${pred.target}"`
    : g && g !== pred.target ? `That looked a bit like "${g}"` : "Try it again";
  clearTimeout(verdictTimer);
  verdictTimer = setTimeout(() => { cd.hidden = true; cd.classList.remove("verdictOk", "verdictMiss"); }, 2500);
}

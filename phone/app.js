// First Signs phone page: camera -> MediaPipe hands + pose -> `frame` messages to the TV, and attempts -> `pred`.
// Video never leaves the phone; only landmarks are sent. Protocol: PROTOCOL.md §1 and §3.
import { FilesetResolver, HandLandmarker, PoseLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";
import { Conn } from "./lib/conn.js";
import { buildFrame, wireFrame } from "./lib/frame.js";
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

// Shared stats, also read by server/scripts/e2e.mjs.
const stats = window.__firstSigns = {
  code, framesSent: 0, framesDropped: 0, detectMs: 0, fps: 0, methods: { pose: 0, label: 0, none: 0 },
  handFrames: 0, handedness: { agree: 0, disagree: 0 }, sides: { left: 0, right: 0, both: 0, rightOnImageLeft: 0 }, preds: [], state: null, paired: false, stub: null, camera: null, error: null,
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
      if (cameraOn) card("Look at the TV", "Your TV will tell you when to sign.", "good");
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
  return performance.now() - lastHandAt < 1000 ? "ready" : "no_hands";
}
function currentState() {
  return attempt ? attempt.phase : presenceState();
}
function sendState(force = false) {
  const s = currentState();
  stats.state = s;
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
      runningMode: "VIDEO", numHands: 2,
      minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
    }),
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: POSE_MODEL, delegate },
      runningMode: "VIDEO", numPoses: 1,
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
  card(stats.paired ? "Look at the TV" : "Camera is on", stats.paired ? "Your TV will tell you when to sign." : "Waiting for the TV to connect...", stats.paired ? "good" : "");
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
let nextDue = 0, lastTs = 0, fpsWindow = [];
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
  if (video.readyState < 2 || !hands || now < nextDue - 16) return;
  nextDue = Math.max(nextDue + 1000 / FPS, now - 1000 / FPS);
  const t = Date.now();
  const ts = Math.max(now, lastTs + 1); // MediaPipe needs strictly increasing timestamps
  lastTs = ts;
  let handRes, poseRes, tHand;
  try {
    handRes = hands.detectForVideo(video, ts);
    tHand = performance.now();
    poseRes = pose.detectForVideo(video, ts);
  } catch (err) { console.error(err); return; }
  const ema = (old, v) => (old ? old * 0.9 + v * 0.1 : v);
  stats.handMs = ema(stats.handMs, tHand - now);
  stats.poseMs = ema(stats.poseMs, performance.now() - tHand);
  stats.detectMs = ema(stats.detectMs, performance.now() - now);

  // Read the decoded frame size every time, so a camera switch or phone rotation updates `aspect` straight away.
  const vw = video.videoWidth, vh = video.videoHeight;
  if (vw && vh && (overlay.width !== vw || overlay.height !== vh)) { overlay.width = vw; overlay.height = vh; stats.camera && Object.assign(stats.camera, { width: vw, height: vh }); }
  const { frame, method, hands: found, assigned } = buildFrame(t, handRes, poseRes, vw && vh ? vw / vh : undefined);
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
  if (frame.left || frame.right) { lastHandAt = now; stats.handFrames++; }
  if (conn && stats.paired) { if (conn.sendFrame(wireFrame(frame))) stats.framesSent++; else stats.framesDropped++; }
  if (attempt && attempt.phase === "recording") attempt.frames.push(frame);

  drawFrame(octx, frame, { lineWidth: Math.max(2, overlay.width / 160) });
  $("frameHint").hidden = !!(frame.left || frame.right || frame.pose);
  if (!attempt) sendState();

  fpsWindow.push(now);
  while (fpsWindow.length && now - fpsWindow[0] > 1000) fpsWindow.shift();
  stats.fps = fpsWindow.length;
  if (!$("debug").hidden) {
    $("debug").textContent = `${stats.fps} fps · detect ${stats.detectMs.toFixed(0)} ms · ${stats.delegate} · sent ${stats.framesSent} · hands via ${method}`;
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
  cd.hidden = true;
  cd.classList.remove("rec");
  sendState(true);
}

async function runAttempt(m) {
  endAttempt();
  const a = attempt = { ...m, phase: "countdown", frames: [], timers: [], raf: 0 };
  const countdownMs = Math.max(0, Number(m.countdownMs) || 3000);
  const windowMs = Math.max(300, Number(m.windowMs) || 2500);
  sendState(true);
  cd.hidden = false;
  cd.classList.remove("rec");
  $("barWrap").hidden = true;
  $("countLabel").textContent = cameraOn ? `Get ready to sign "${m.target}"` : "Tap Start camera first";
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
    if (model) pred = await model.predict(a, a.frames);
    else pred = { type: "pred", id: a.id, target: a.target, top: [], ok: false };
    if (attempt !== a) return; // cancelled while thinking
    stats.preds.push({ ...pred, frames: a.frames.length });
    conn && conn.send(pred, { queue: true });
    endAttempt();
    card("Look at the TV", "Your result is on the TV.", "good");
  }, countdownMs + windowMs));
}

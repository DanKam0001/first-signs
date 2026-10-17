// Sign Together (PROTOCOL §1b) tests. The two-person fixture is two real single-person reference performances from
// model/export/refs (GISLR), squeezed into the left and right halves of one image, as MediaPipe results would report them.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SideTracker, handsToPeople, buildDuoFrame, personFrames, personInfo, buildDuoPred } from "../lib/duo.js";
import { buildFrame, wireFrame } from "../lib/frame.js";
import { DEFAULT_THRESHOLDS } from "../lib/signs.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..");
const refsDir = path.join(repo, "model", "export", "refs");

// ---------- fixture helpers ----------
// A synthetic single-person stream (used when model/export/refs is not there): wrists move, right hand only.
function syntheticRef(seed) {
  return Array.from({ length: 40 }, (_, i) => {
    const pose = Array.from({ length: 25 }, () => [0.5, 0.5, 0, 0.9]);
    pose[11] = [0.65, 0.45, 0, 0.9]; pose[12] = [0.35, 0.45, 0, 0.9];
    pose[15] = [0.7, 0.8, 0, 0.9]; pose[16] = [0.3 + 0.1 * Math.sin(i / 5 + seed), 0.55, 0, 0.9];
    const right = Array.from({ length: 21 }, (_, k) => [pose[16][0] + k * 0.002, pose[16][1] - k * 0.004, 0]);
    return { pose, left: null, right };
  });
}
function loadRef(id, seed) {
  try { return JSON.parse(fs.readFileSync(path.join(refsDir, `${id}.json`), "utf8")).frames; } catch { return syntheticRef(seed); }
}
// x' = x * scale + offset (y unchanged): puts a person into one half of a shared image.
const mapPts = (pts, sx, ox) => (pts ? pts.map((p) => [p[0] * sx + ox, p[1], p[2] ?? 0, p[3]]) : null);
function place(frame, sx, ox) {
  return { pose: mapPts(frame.pose, sx, ox), left: mapPts(frame.left, sx, ox), right: mapPts(frame.right, sx, ox) };
}
// MediaPipe-shaped results for one image holding these people. Order is shuffled on purpose.
function toResults(people, { swapOrder = false } = {}) {
  const obj = (p) => ({ x: p[0], y: p[1], z: p[2], visibility: p[3] ?? 0.9 });
  let list = people.filter(Boolean);
  if (swapOrder) list = [...list].reverse();
  const poseRes = { landmarks: list.filter((p) => p.pose).map((p) => p.pose.map(obj)) };
  const landmarks = [], handedness = [];
  for (const p of list) {
    for (const side of ["right", "left"]) {
      if (!p[side]) continue;
      landmarks.push(p[side].map(obj));
      handedness.push([{ categoryName: side === "left" ? "Left" : "Right", score: 0.9 }]);
    }
  }
  return { handRes: { landmarks, handedness }, poseRes };
}
const close = (a, b) => a && b && a.length === b.length && a.every((p, i) => Math.abs(p[0] - b[i][0]) < 1e-9 && Math.abs(p[1] - b[i][1]) < 1e-9);
const P = (x, y = 0.5, half = 0.07) => { // a minimal pose: shoulders around x (width 2*half), wrists below them
  const pose = Array.from({ length: 25 }, () => ({ x, y, z: 0, visibility: 0.9 }));
  pose[11] = { x: x + half, y, z: 0, visibility: 0.9 }; pose[12] = { x: x - half, y, z: 0, visibility: 0.9 };
  pose[15] = { x: x + 0.1, y: y + 0.25, z: 0, visibility: 0.9 }; pose[16] = { x: x - 0.1, y: y + 0.25, z: 0, visibility: 0.9 };
  return pose;
};
const H = (x, y, label = "Right") => ({ lms: Array.from({ length: 21 }, (_, k) => ({ x: x + k * 0.001, y: y - k * 0.002, z: 0 })), label, score: 0.9 });

// ---------- side tracking ----------
test("sides: unlocked = image left/right by shoulder midpoint", () => {
  const tr = new SideTracker();
  assert.deepEqual(tr.assign([personInfo(P(0.7)), personInfo(P(0.3))], 0), ["R", "L"]);
  assert.deepEqual(tr.assign([personInfo(P(0.2)), personInfo(P(0.8))], 50), ["L", "R"]);
});

test("sides: locked tracking never swaps, even when the two people cross", () => {
  const tr = new SideTracker();
  // A is a smaller adult standing a little higher in the image, B a bigger one; real pairs always differ somewhat.
  const a = (x) => personInfo(P(x, 0.45, 0.06)), b = (x) => personInfo(P(x, 0.5, 0.08));
  tr.assign([a(0.3), b(0.7)], 0);
  tr.locked = true;
  // A (starts left) walks right, B walks left, in small steps, passing through the same x; detection order flips every frame.
  for (let i = 1; i <= 20; i++) {
    const ax = 0.3 + i * 0.02, bx = 0.7 - i * 0.02;
    const order = i % 2 ? ["a", "b"] : ["b", "a"];
    const sides = tr.assign(order.map((k) => (k === "a" ? a(ax) : b(bx))), i * 50);
    const order2 = order.map((k) => (k === "a" ? ax : bx));
    assert.equal(sides[order.indexOf("a")], "L", `frame ${i}: A must stay L (x ${order2})`);
    assert.equal(sides[order.indexOf("b")], "R", `frame ${i}: B must stay R`);
  }
});

test("sides: one person alone keeps their side; the other re-enters on theirs", () => {
  const tr = new SideTracker();
  tr.assign([personInfo(P(0.3)), personInfo(P(0.7))], 0);
  // R steps out; L drifts to the middle-right of the image but is still L (nearest track).
  assert.deepEqual(tr.assign([personInfo(P(0.45))], 100), ["L"]);
  assert.deepEqual(tr.assign([personInfo(P(0.55))], 200), ["L"]);
  // R comes back on the right: unlocked, so sides follow image position again.
  assert.deepEqual(tr.assign([personInfo(P(0.85)), personInfo(P(0.5))], 300), ["R", "L"]);
  // With no history, a lone person is placed by image half.
  const fresh = new SideTracker();
  assert.deepEqual(fresh.assign([personInfo(P(0.8))], 0), ["R"]);
});

// ---------- hand to person ----------
test("hands go to the person with the nearest pose wrist, at most 2 each", () => {
  const poses = [P(0.3), P(0.7)];
  // 4 hands, given in mixed order; labels are irrelevant to which person they belong to.
  const hands = [H(0.61, 0.75, "Left"), H(0.19, 0.75, "Left"), H(0.81, 0.75), H(0.41, 0.75)];
  const g = handsToPeople(hands, poses);
  assert.deepEqual(g[0].map((h) => h.lms[0].x).sort(), [0.19, 0.41]);
  assert.deepEqual(g[1].map((h) => h.lms[0].x).sort(), [0.61, 0.81]);
  // Three hands near person 0: only the 2 nearest are kept.
  const g2 = handsToPeople([H(0.2, 0.75), H(0.4, 0.75), H(0.3, 0.3)], poses);
  assert.equal(g2[0].length, 2);
  assert.equal(g2[1].length, 0);
});

// ---------- full fixture ----------
test("two real reference signers side by side -> people L/R with the right hands, top level = larger person", async () => {
  const A = loadRef("milk", 1), B = loadRef("more", 2);
  const n = Math.min(A.length, B.length);
  const tr = new SideTracker();
  const frames = [];
  for (let i = 0; i < n; i++) {
    const a = place(A[i], 0.5, 0), b = place(B[i], 0.6, 0.45); // B a bit wider = "nearer"
    const { handRes, poseRes } = toResults([a, b], { swapOrder: i % 2 === 1 });
    const { frame, count } = buildDuoFrame(1000 + i * 33, handRes, poseRes, 1.7778, tr, i * 33);
    frames.push(frame);
    if (!(a.pose && b.pose)) continue;
    assert.equal(count, 2);
    assert.deepEqual(frame.people.map((p) => p.side), ["L", "R"]);
    const [L, R] = frame.people;
    if (a.right) assert.ok(close(L.right, a.right), `frame ${i}: L.right is A's right hand`);
    if (a.left) assert.ok(close(L.left, a.left), `frame ${i}: L.left is A's left hand`);
    if (b.right) assert.ok(close(R.right, b.right), `frame ${i}: R.right is B's right hand`);
    const sizeA = personInfo(poseRes.landmarks[i % 2 ? 1 : 0]).size, sizeB = personInfo(poseRes.landmarks[i % 2 ? 0 : 1]).size;
    assert.ok(close(frame.pose, sizeB >= sizeA ? R.pose : L.pose), "top-level pose = larger person");
    assert.equal(frame.aspect, 1.7778);
  }
  // Wire format keeps people, rounded.
  const w = JSON.parse(wireFrame(frames[5]));
  assert.deepEqual(Object.keys(w), ["type", "t", "pose", "left", "right", "aspect", "people"]);
  assert.deepEqual(w.people.map((p) => Object.keys(p)), [["side", "pose", "left", "right"], ["side", "pose", "left", "right"]]);

  // Per-person windows are exactly that person's stream, so the real preprocess sees one signer at a time.
  const pre = await import(fs.existsSync(path.join(repo, "model/export/preprocess.js"))
    ? "../../model/export/preprocess.js" : "../stub/preprocess.js");
  const onlyA = personFrames(frames, "L");
  const expectA = A.slice(0, n).map((f) => ({ type: "frame", ...place(f, 0.5, 0) }));
  const fa = pre.toFeatures(onlyA), fe = pre.toFeatures(expectA);
  let maxDiff = 0;
  for (let k = 0; k < fa.length; k++) maxDiff = Math.max(maxDiff, Math.abs(fa[k] - fe[k]));
  assert.ok(maxDiff < 1e-4, `per-person features match the single-person stream (max diff ${maxDiff})`);

  // Duo pred: per-person ranking, §3 verdict and `present`.
  const rank = async (_a, pf) => (pf === undefined ? [] : [["milk", 0.6], ["more", 0.3], ["eat", 0.1]]);
  const pred = await buildDuoPred({ id: "d1", target: "milk", pack: "mealtime" }, frames, rank, DEFAULT_THRESHOLDS);
  assert.equal(pred.mode, "duo");
  assert.deepEqual(pred.people.map((p) => [p.side, p.ok, p.present]), [["L", true, true], ["R", true, true]]);
});

test("duo pred: a person who never shows hands is present:false and not ok", async () => {
  const tr = new SideTracker();
  const frames = [];
  for (let i = 0; i < 20; i++) {
    const handRes = { landmarks: [H(0.21, 0.75).lms], handedness: [[{ categoryName: "Left", score: 0.9 }]] };
    frames.push(buildDuoFrame(i, handRes, { landmarks: [P(0.3), P(0.7)] }, 1.33, tr, i * 50).frame);
  }
  const calls = [];
  const rank = async (_a, pf) => { calls.push(pf.length); return [["milk", 0.9], ["more", 0.1]]; };
  const pred = await buildDuoPred({ id: "d2", target: "milk" }, frames, rank, DEFAULT_THRESHOLDS);
  assert.deepEqual(pred.people[0], { side: "L", top: [["milk", 0.9], ["more", 0.1]], ok: true, present: true });
  assert.deepEqual(pred.people[1], { side: "R", top: [], ok: false, present: false });
  assert.equal(calls.length, 1, "the absent person is not run through the model");
});

test("solo frames are unchanged by duo support (byte-compatible wire format)", () => {
  const pose = P(0.5);
  const handRes = { landmarks: [H(0.4, 0.75).lms], handedness: [[{ categoryName: "Right", score: 0.9 }]] };
  const { frame } = buildFrame(42, handRes, { landmarks: [pose] }, 0.75);
  const s = wireFrame(frame);
  assert.ok(!s.includes("people"));
  assert.deepEqual(Object.keys(JSON.parse(s)), ["type", "t", "pose", "left", "right", "aspect"]);
});

test("a person PoseLandmarker drops for a moment keeps their hands (1 s hold), then is released", () => {
  const tr = new SideTracker();
  const handsAt = (xs) => ({ landmarks: xs.map((x) => H(x, 0.75).lms), handedness: xs.map(() => [{ categoryName: "Right", score: 0.9 }]) });
  buildDuoFrame(0, handsAt([0.21, 0.61]), { landmarks: [P(0.3), P(0.7)] }, 1.33, tr, 0);
  // Next frame: only R's pose is found, but both people's hands are.
  const { frame, count } = buildDuoFrame(1, handsAt([0.21, 0.61]), { landmarks: [P(0.7)] }, 1.33, tr, 300);
  assert.equal(count, 2);
  assert.deepEqual(frame.people.map((p) => p.side), ["L", "R"]);
  assert.ok(frame.people[0].left || frame.people[0].right, "L keeps its hand");
  // After the hold, L is gone and its hand is not given to R (R's wrists are far from it).
  const later = buildDuoFrame(2, handsAt([0.21, 0.61]), { landmarks: [P(0.7)] }, 1.33, tr, 1500);
  assert.deepEqual(later.frame.people.map((p) => p.side), ["R"]);
  assert.equal([later.frame.people[0].left, later.frame.people[0].right].filter(Boolean).length, 1);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { assignHands, labelToSide } from "../lib/hands.js";
import { buildFrame, wireFrame } from "../lib/frame.js";
import { maskedSoftmax, handFraction, verdict, buildPred } from "../lib/verdict.js";
import { parseSigns, DEFAULT_THRESHOLDS } from "../lib/signs.js";
import * as stub from "../stub/preprocess.js";

// A fake hand: 21 points clustered around a wrist position.
const hand = (x, y) => Array.from({ length: 21 }, (_, i) => ({ x: x + i * 0.001, y: y - i * 0.002, z: 0 }));
// A fake pose for a signer facing an UNMIRRORED camera: their left wrist (15) appears on the image's right (bigger x).
function pose({ lx = 0.7, ly = 0.6, rx = 0.3, ry = 0.6, vis = 0.9 } = {}) {
  const p = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));
  p[15] = { x: lx, y: ly, z: 0, visibility: vis };
  p[16] = { x: rx, y: ry, z: 0, visibility: vis };
  return p;
}

test("label fallback uses tasks-vision labels unswapped (measured, see hands.js)", () => {
  assert.equal(labelToSide("Left"), "left");
  assert.equal(labelToSide("Right"), "right");
  assert.equal(labelToSide("Left", true), "right");
  // Raw camera image, signer facing it: their RIGHT hand is on the image's left, and tasks-vision calls it "Right".
  const r = hand(0.3, 0.6), l = hand(0.7, 0.6);
  const a = assignHands([{ lms: r, label: "Right", score: 0.9 }, { lms: l, label: "Left", score: 0.9 }], null);
  assert.equal(a.method, "label");
  assert.equal(a.right, r);
  assert.equal(a.left, l);
});

test("pose wrists win over labels (two hands)", () => {
  const r = hand(0.3, 0.6), l = hand(0.7, 0.6);
  // Labels deliberately wrong: pose must still assign anatomically.
  const a = assignHands([{ lms: l, label: "Right", score: 0.9 }, { lms: r, label: "Left", score: 0.9 }], pose());
  assert.equal(a.method, "pose");
  assert.equal(a.left, l);
  assert.equal(a.right, r);
});

test("pose handles crossed arms (left hand on the image's left)", () => {
  const l = hand(0.3, 0.5), r = hand(0.7, 0.5);
  const a = assignHands([{ lms: l, label: "Right", score: 0.9 }, { lms: r, label: "Left", score: 0.9 }],
    pose({ lx: 0.3, ly: 0.5, rx: 0.7, ry: 0.5 }));
  assert.equal(a.method, "pose");
  assert.equal(a.left, l);
  assert.equal(a.right, r);
});

test("one hand: nearest pose wrist, else label", () => {
  const r = hand(0.31, 0.61);
  const a = assignHands([{ lms: r, label: "Right", score: 0.9 }], pose());
  assert.equal(a.method, "pose");
  assert.equal(a.right, r);
  assert.equal(a.left, null);
  // Hand far from both wrists: falls back to the label.
  const b = assignHands([{ lms: hand(0.5, 0.1), label: "Left", score: 0.9 }], pose());
  assert.equal(b.method, "label");
  assert.ok(b.left && !b.right);
  // Invisible wrists: label.
  const c = assignHands([{ lms: r, label: "Right", score: 0.9 }], pose({ vis: 0.01 }));
  assert.equal(c.method, "label");
  assert.equal(c.right, r);
});

test("two hands with the same label: higher score keeps it", () => {
  const h1 = hand(0.3, 0.6), h2 = hand(0.7, 0.6);
  const a = assignHands([{ lms: h1, label: "Left", score: 0.6 }, { lms: h2, label: "Left", score: 0.9 }], null);
  assert.equal(a.left, h2);
  assert.equal(a.right, h1);
});

test("buildFrame: 25 pose points with visibility, 21x3 hands, wire frame is valid JSON", () => {
  const handRes = { landmarks: [hand(0.3, 0.6)], handedness: [[{ categoryName: "Left", score: 0.95 }]] };
  const poseRes = { landmarks: [pose()] };
  const { frame, method } = buildFrame(123, handRes, poseRes);
  assert.equal(method, "pose");
  assert.equal(frame.type, "frame");
  assert.equal(frame.pose.length, 25);
  assert.equal(frame.pose[0].length, 4);
  assert.equal(frame.right.length, 21);
  assert.equal(frame.right[0].length, 3);
  assert.equal(frame.left, null);
  const w = JSON.parse(wireFrame(frame));
  assert.deepEqual(Object.keys(w), ["type", "t", "pose", "left", "right"]);
  assert.equal(w.t, 123);
  // Optional aspect (PROTOCOL §1): included when known, rounded on the wire, omitted otherwise.
  const portrait = buildFrame(7, handRes, poseRes, 720 / 1280).frame;
  assert.equal(portrait.aspect, 0.5625);
  assert.equal(JSON.parse(wireFrame(portrait)).aspect, 0.5625);
  assert.equal(JSON.parse(wireFrame(buildFrame(8, handRes, poseRes, 640 / 480).frame)).aspect, 1.3333);
  assert.ok(!("aspect" in buildFrame(9, handRes, poseRes, NaN).frame));
  const empty = buildFrame(5, { landmarks: [], handedness: [] }, { landmarks: [] }).frame;
  assert.deepEqual(empty, { type: "frame", t: 5, pose: null, left: null, right: null });
});

test("maskedSoftmax only ranks the pack's signs", () => {
  const labels = ["milk", "sleep", "more", "eat"];
  const ranked = maskedSoftmax([1, 10, 2, 0], labels, new Set(["milk", "more", "eat"]));
  assert.deepEqual(ranked.map((r) => r[0]), ["more", "milk", "eat"]);
  const sum = ranked.reduce((s, r) => s + r[1], 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
});

test("verdict follows PROTOCOL §3", () => {
  const th = DEFAULT_THRESHOLDS;
  const ranked = [["more", 0.4], ["milk", 0.3], ["eat", 0.2], ["drink", 0.1]];
  assert.equal(verdict({ ranked, target: "milk", handFrac: 0.5, thresholds: th }), true);
  assert.equal(verdict({ ranked, target: "milk", handFrac: 0.39, thresholds: th }), false); // too few hand frames
  assert.equal(verdict({ ranked, target: "eat", handFrac: 1, thresholds: th }), false); // p < 0.25
  assert.equal(verdict({ ranked, target: "drink", handFrac: 1, thresholds: { ...th, minProb: 0 } }), false); // not top-3
  const p = buildPred({ id: "x", target: "milk", ranked, handFrac: 1, thresholds: th });
  assert.deepEqual(p, { type: "pred", id: "x", target: "milk", top: [["more", 0.4], ["milk", 0.3], ["eat", 0.2]], ok: true });
  assert.equal(handFraction([{ left: [] }, { right: [] }, {}, {}, {}]), 0.4);
});

test("parseSigns accepts the array and object shapes and threshold aliases", () => {
  const a = parseSigns([{ id: "milk", packs: ["mealtime"] }, { _thresholds: { top_k: 5, min_prob: 0.3, min_hand_frac: 0.5 } }]);
  assert.equal(a.signs.length, 1);
  assert.deepEqual(a.thresholds, { topK: 5, minProb: 0.3, minHandFrac: 0.5 });
  assert.deepEqual(a.packs, ["mealtime"]);
  const b = parseSigns({ _thresholds: { minProb: 0.2 }, signs: [{ id: "a" }, { id: "b" }] });
  assert.equal(b.signs.length, 2);
  assert.equal(b.thresholds.minProb, 0.2);
  assert.equal(b.thresholds.topK, 3);
  const c = parseSigns({ milk: { packs: ["x"] } });
  assert.equal(c.byId.get("milk").id, "milk");
});

test("stub preprocess follows the §2 contract", () => {
  const out = stub.toFeatures([{ pose: null, left: null, right: [[0.1, 0.2, 0.3]] }]);
  assert.ok(out instanceof Float32Array);
  assert.equal(out.length, stub.T * stub.F);
});

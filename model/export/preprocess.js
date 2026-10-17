// First Signs feature extraction (PROTOCOL.md §2). ES module, no dependencies.
// This file and model/preprocess.py are the SAME algorithm, line for line; model/tests/test_parity.py
// checks they agree to 1e-4 on the same fixture. Change both or neither.
//
// Input: frames = [{pose: [[x,y,z,v] x 25] | null, left: [[x,y,z] x 21] | null, right: ... | null}, ...]
//   MediaPipe normalised image coordinates, NOT mirrored; left/right are the signer's anatomical hands.
//   z and the pose visibility v are ignored (the GISLR training data has no visibility, and its
//   z comes from a different MediaPipe build).
// Output: Float32Array of length T*F, row-major [t][f].
//
// Steps:
//  1. Trim to the frames between the first and last frame where any hand is present, then to the
//     span holding the middle 90% of hand movement (wrist + fingertips), plus a margin.
//  2. Body frame from the pose, averaged over the trimmed frames: centre = shoulder midpoint,
//     x unit = shoulder width, y unit = vertical nose-to-shoulder-line distance. Using separate
//     x and y units cancels the camera's aspect ratio (the frame has no pixel size).
//  3. If the left hand is present in more frames than the right (ties: whichever wrist moved more),
//     mirror everything so the dominant hand is always "right". Left-handed signers then look
//     right-handed to the model.
//  4. Resample to T frames: linear interpolation where both neighbours exist, otherwise the
//     neighbour that exists, otherwise missing (zeros + presence flag 0).
//  5. Per frame: dominant hand (21x2, body units), other hand (21x2), dominant hand shape
//     (21x2, relative to wrist, scaled by wrist->middle-knuckle length), other hand shape (21x2),
//     13 upper-body pose points (x2), presence flags (2). Values clipped to +-CLIP.

export const T = 32;
export const POSE_IDX = [0, 2, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
// mirror partner of each POSE_IDX entry (MediaPipe pose numbering)
const POSE_MIRROR = { 0: 0, 2: 5, 5: 2, 7: 8, 8: 7, 9: 10, 10: 9, 11: 12, 12: 11, 13: 14, 14: 13, 15: 16, 16: 15 };
export const F = 21 * 2 * 4 + POSE_IDX.length * 2 + 2; // 196
const CLIP = 8.0;
const EPS = 1e-3;
const MOTION_LO = 0.05;
const MOTION_HI = 0.95;

function finitePts(pts, n) {
  if (!Array.isArray(pts) || pts.length < n) return null;
  const out = new Array(n);
  for (let k = 0; k < n; k++) {
    const p = pts[k];
    if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return null;
    out[k] = [p[0], p[1]];
  }
  return out;
}

function pick(A, i0, i1, w) {
  const a = A[i0];
  const b = A[i1];
  if (a && b) {
    const out = new Array(a.length);
    for (let k = 0; k < a.length; k++) {
      out[k] = [a[k][0] * (1 - w) + b[k][0] * w, a[k][1] * (1 - w) + b[k][1] * w];
    }
    return out;
  }
  if (a && (w < 0.5 || !b)) return a;
  if (b) return b;
  return a;
}

function motion(H, lo, hi) {
  let m = 0;
  let prev = null;
  for (let i = lo; i <= hi; i++) {
    if (H[i]) {
      if (prev) m += Math.abs(H[i][0][0] - prev[0][0]) + Math.abs(H[i][0][1] - prev[0][1]);
      prev = H[i];
    }
  }
  return m;
}

const MOTION_PTS = [0, 4, 8, 12, 16, 20];

export function motionTrim(L, R, lo, hi) {
  const span = hi - lo;
  if (span < 4) return [lo, hi];
  const cum = new Array(span + 1).fill(0);
  let total = 0;
  for (let i = lo + 1; i <= hi; i++) {
    let m = 0;
    for (const H of [L, R]) {
      const a = H[i - 1];
      const b = H[i];
      if (a && b) {
        for (const k of MOTION_PTS) m += Math.abs(b[k][0] - a[k][0]) + Math.abs(b[k][1] - a[k][1]);
      }
    }
    total += m;
    cum[i - lo] = total;
  }
  if (total < 1e-6) return [lo, hi];
  let s0 = -1;
  let e0 = -1;
  for (let j = 1; j <= span; j++) {
    if (s0 < 0 && cum[j] >= MOTION_LO * total) s0 = lo + j - 1;
    if (e0 < 0 && cum[j] >= MOTION_HI * total) e0 = lo + j;
  }
  const margin = 2 + Math.floor(0.1 * (e0 - s0));
  return [Math.max(lo, s0 - margin), Math.min(hi, e0 + margin)];
}

function clip(v) {
  return v > CLIP ? CLIP : v < -CLIP ? -CLIP : v;
}

export function toFeatures(frames) {
  const out = new Float32Array(T * F);
  const n = frames ? frames.length : 0;
  if (n === 0) return out;

  const P = new Array(n);
  const L = new Array(n);
  const R = new Array(n);
  for (let i = 0; i < n; i++) {
    const fr = frames[i] || {};
    P[i] = finitePts(fr.pose, 25);
    L[i] = finitePts(fr.left, 21);
    R[i] = finitePts(fr.right, 21);
  }

  // 1. trim
  let lo = -1;
  let hi = -1;
  for (let i = 0; i < n; i++) {
    if (L[i] || R[i]) {
      if (lo < 0) lo = i;
      hi = i;
    }
  }
  if (lo < 0) {
    lo = 0;
    hi = n - 1;
  }
  // 1b. motion trim: keep the span holding the middle 90% of hand movement (+ margin), so idle
  // holds before/after the sign (the phone window is longer than a GISLR clip) are dropped.
  [lo, hi] = motionTrim(L, R, lo, hi);

  // 2. body frame
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let np = 0;
  for (let i = lo; i <= hi; i++) {
    const p = P[i];
    if (!p) continue;
    const mx = (p[11][0] + p[12][0]) / 2;
    const my = (p[11][1] + p[12][1]) / 2;
    cx += mx;
    cy += my;
    sx += Math.abs(p[11][0] - p[12][0]);
    sy += my - p[0][1];
    np += 1;
  }
  if (np > 0) {
    cx /= np;
    cy /= np;
    sx /= np;
    sy /= np;
  } else {
    cx = 0.5;
    cy = 0.6;
    sx = 0.3;
    sy = 0.15;
  }
  if (sx < EPS) sx = EPS;
  if (sy < EPS) sy = EPS;

  // 3. handedness
  let nL = 0;
  let nR = 0;
  for (let i = lo; i <= hi; i++) {
    if (L[i]) nL += 1;
    if (R[i]) nR += 1;
  }
  let mirror = nL > nR;
  if (nL === nR && nL > 0) mirror = motion(L, lo, hi) > motion(R, lo, hi);

  // 4-5. resample, normalise, featurise
  const span = hi - lo;
  for (let j = 0; j < T; j++) {
    const s = span > 0 ? lo + (j * span) / (T - 1) : lo;
    let i0 = Math.floor(s);
    if (i0 > hi) i0 = hi;
    const i1 = i0 + 1 <= hi ? i0 + 1 : hi;
    const w = s - i0;
    const p = pick(P, i0, i1, w);
    let l = pick(L, i0, i1, w);
    let r = pick(R, i0, i1, w);
    const sg = mirror ? -1 : 1;
    const nx = (x) => (sg * (x - cx)) / sx;
    const ny = (y) => (y - cy) / sy;
    if (mirror) {
      const tmp = l;
      l = r;
      r = tmp;
    }
    const base = j * F;
    let o = 0;
    const hands = [r, l];
    // global hand coordinates
    for (let h = 0; h < 2; h++) {
      const H = hands[h];
      for (let k = 0; k < 21; k++) {
        out[base + o] = H ? clip(nx(H[k][0])) : 0;
        out[base + o + 1] = H ? clip(ny(H[k][1])) : 0;
        o += 2;
      }
    }
    // hand shape relative to the wrist
    for (let h = 0; h < 2; h++) {
      const H = hands[h];
      let size = 0;
      if (H) {
        const dx = nx(H[9][0]) - nx(H[0][0]);
        const dy = ny(H[9][1]) - ny(H[0][1]);
        size = Math.sqrt(dx * dx + dy * dy);
        if (size < EPS) size = EPS;
      }
      for (let k = 0; k < 21; k++) {
        out[base + o] = H ? clip((nx(H[k][0]) - nx(H[0][0])) / size) : 0;
        out[base + o + 1] = H ? clip((ny(H[k][1]) - ny(H[0][1])) / size) : 0;
        o += 2;
      }
    }
    // upper body
    for (let q = 0; q < POSE_IDX.length; q++) {
      const idx = mirror ? POSE_MIRROR[POSE_IDX[q]] : POSE_IDX[q];
      out[base + o] = p ? clip(nx(p[idx][0])) : 0;
      out[base + o + 1] = p ? clip(ny(p[idx][1])) : 0;
      o += 2;
    }
    out[base + o] = r ? 1 : 0;
    out[base + o + 1] = l ? 1 : 0;
  }
  return out;
}

// Fraction of frames with at least one hand (PROTOCOL §3 verdict input).
export function handPresence(frames) {
  if (!frames || frames.length === 0) return 0;
  let c = 0;
  for (const fr of frames) {
    if ((fr && finitePts(fr.left, 21)) || (fr && finitePts(fr.right, 21))) c += 1;
  }
  return c / frames.length;
}

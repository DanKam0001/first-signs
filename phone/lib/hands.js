// Which detected hand is the signer's anatomical LEFT and which is their RIGHT. See phone/README.md, "Handedness".
//
// Rule 1 (preferred, used whenever the pose wrists are usable): match each hand's wrist (hand landmark 0) to the pose
//   wrists. Pose landmark 15 is the signer's left wrist and 16 their right wrist. This is the same way MediaPipe
//   Holistic (which produced the GISLR training landmarks) decides left_hand/right_hand, so the phone and the
//   training data agree by construction.
// Rule 2 (fallback, no usable pose): use tasks-vision's handedness label AS IS, no swap. MediaPipe's docs say labels
//   assume a mirrored selfie image, but measured on @mediapipe/tasks-vision 0.10.14 fed raw, unmirrored frames, the
//   raw label matched the pose-wrist assignment in 624 of 630 hand-frames (99%), while the swapped label matched in
//   6 of 630. (Run: server/scripts/e2e.mjs on a public-domain ASL clip; stats.handedness on the phone page.)
//   If a future tasks-vision version flips this, set LABEL_SWAP = true and re-run that check.

export const LABEL_SWAP = false;

export const POSE_LEFT_WRIST = 15;
export const POSE_RIGHT_WRIST = 16;

// MediaPipe category name ("Left"/"Right") -> the signer's anatomical side ("left"/"right") for unmirrored input.
export function labelToSide(category, swap = LABEL_SWAP) {
  const side = category === "Left" ? "left" : category === "Right" ? "right" : null;
  if (!side || !swap) return side;
  return side === "left" ? "right" : "left";
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * @param hands  [{ lms: [{x,y,z}] x21, label: "Left"|"Right", score: number }]
 * @param pose   pose landmarks [{x,y,z,visibility}] (33 or 25 of them), or null
 * @returns { left: lms|null, right: lms|null, method: "none"|"pose"|"label" }
 */
export function assignHands(hands, pose, { minVis = 0.2, maxWristDist = 0.25, margin = 0.02 } = {}) {
  const out = { left: null, right: null, method: "none" };
  if (!hands || !hands.length) return out;
  hands = hands.slice(0, 2);

  const lw = pose && pose[POSE_LEFT_WRIST];
  const rw = pose && pose[POSE_RIGHT_WRIST];
  const lwOk = lw && (lw.visibility ?? 1) >= minVis;
  const rwOk = rw && (rw.visibility ?? 1) >= minVis;

  if (hands.length === 2 && lwOk && rwOk) {
    const [a, b] = hands;
    const straight = dist(a.lms[0], lw) + dist(b.lms[0], rw); // a=left, b=right
    const crossed = dist(a.lms[0], rw) + dist(b.lms[0], lw); // a=right, b=left
    if (Math.abs(straight - crossed) > margin) {
      out.method = "pose";
      if (straight < crossed) { out.left = a.lms; out.right = b.lms; } else { out.left = b.lms; out.right = a.lms; }
      return out;
    }
  } else if (hands.length === 1 && (lwOk || rwOk)) {
    const w = hands[0].lms[0];
    const dL = lwOk ? dist(w, lw) : Infinity;
    const dR = rwOk ? dist(w, rw) : Infinity;
    const near = Math.min(dL, dR);
    const far = Math.max(dL, dR);
    // Trust the pose only if the hand is clearly at one wrist and clearly not at the other.
    if (near <= maxWristDist && (far === Infinity ? near <= maxWristDist / 2 : near < 0.6 * far)) {
      out.method = "pose";
      if (dL < dR) out.left = hands[0].lms; else out.right = hands[0].lms;
      return out;
    }
  }

  // Fallback: handedness labels. If both hands got the same side, the more confident one keeps it.
  out.method = "label";
  const sorted = [...hands].sort((x, y) => (y.score ?? 0) - (x.score ?? 0));
  for (const h of sorted) {
    let side = labelToSide(h.label) || "right";
    if (out[side]) side = side === "left" ? "right" : "left";
    if (!out[side]) out[side] = h.lms;
  }
  return out;
}

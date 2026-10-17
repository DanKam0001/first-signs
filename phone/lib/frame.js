// Builds PROTOCOL §1 `frame` objects from MediaPipe results.
import { assignHands } from "./hands.js";

export const POSE_POINTS = 25; // pose landmarks 0..24 (upper body)

const r4 = (x) => Math.round(x * 1e4) / 1e4;

/**
 * @param t        ms since epoch when the camera frame was captured
 * @param handRes  HandLandmarker result ({landmarks, handedness|handednesses})
 * @param poseRes  PoseLandmarker result ({landmarks}) or null
 * @param aspect   camera frame width / height (optional PROTOCOL field; omitted if not a positive number)
 * @returns { frame, method } where frame is full precision (used for on-phone inference)
 */
export function buildFrame(t, handRes, poseRes, aspect) {
  const poseLms = poseRes && poseRes.landmarks && poseRes.landmarks[0] ? poseRes.landmarks[0] : null;
  const cats = (handRes && (handRes.handedness || handRes.handednesses)) || [];
  const hands = ((handRes && handRes.landmarks) || []).map((lms, i) => ({
    lms,
    label: cats[i] && cats[i][0] ? cats[i][0].categoryName : null,
    score: cats[i] && cats[i][0] ? cats[i][0].score : 0,
  }));
  const a = assignHands(hands, poseLms);
  const hand = (lms) => (lms ? lms.map((p) => [p.x, p.y, p.z]) : null);
  const extra = Number.isFinite(aspect) && aspect > 0 ? { aspect } : {};
  return {
    method: a.method,
    hands,
    assigned: a,
    frame: {
      type: "frame",
      t,
      pose: poseLms ? poseLms.slice(0, POSE_POINTS).map((p) => [p.x, p.y, p.z, p.visibility ?? 0]) : null,
      left: hand(a.left),
      right: hand(a.right),
      ...extra,
    },
  };
}

// Rounded copy for the wire (about 40% smaller JSON). Inference on the phone uses the unrounded frame.
export function wireFrame(f) {
  const pts = (arr) => (arr ? arr.map((p) => p.map(r4)) : null);
  const out = { type: "frame", t: f.t, pose: pts(f.pose), left: pts(f.left), right: pts(f.right) };
  if (f.aspect) out.aspect = r4(f.aspect);
  if (f.people) out.people = f.people.map((p) => ({ side: p.side, pose: pts(p.pose), left: pts(p.left), right: pts(p.right) })); // duo only
  return JSON.stringify(out);
}

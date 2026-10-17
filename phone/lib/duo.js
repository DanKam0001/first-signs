// Sign Together (duo mode, PROTOCOL §1b): two people in one camera frame. Pure logic, unit-tested in phone/test/.
//
// - People are identified by side: "L" = the person on the camera image's left (smaller shoulder-midpoint x), "R" = right.
// - SideTracker keeps sides stable across frames by nearest shoulder midpoint, and never swaps while locked (an attempt).
// - Each hand goes to the person whose pose wrist (15 or 16) is nearest, then is labelled anatomically by the solo rule.
// - The frame's top-level pose/left/right carry the larger (nearer) person, so solo consumers keep working.
import { assignHands } from "./hands.js";
import { handFraction, buildPred } from "./verdict.js";

const SH_L = 11, SH_R = 12, WRISTS = [15, 16];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// Identity distance for tracking: shoulder-midpoint position plus a shoulder-width (body size) term, so two people
// who cross at the same x are still told apart by height and size.
const idDist = (a, b) => dist(a, b) + 2 * Math.abs((a.size ?? 0) - (b.size ?? 0));

export function personInfo(pose) {
  const a = pose[SH_L], b = pose[SH_R];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, size: Math.hypot(a.x - b.x, a.y - b.y) };
}

export class SideTracker {
  constructor({ maxAgeMs = 1500 } = {}) {
    this.maxAgeMs = maxAgeMs;
    this.tracks = { L: null, R: null }; // {x, y, at}
    this.locked = false;
  }

  reset() { this.tracks = { L: null, R: null }; this.locked = false; }

  /** @param infos personInfo() of each detected pose. @returns sides ("L"/"R"), parallel to infos. */
  assign(infos, now) {
    if (!this.locked) {
      for (const s of ["L", "R"]) if (this.tracks[s] && now - this.tracks[s].at > this.maxAgeMs) this.tracks[s] = null;
    }
    const live = ["L", "R"].filter((s) => this.tracks[s]);
    let sides;
    if (infos.length === 0) sides = [];
    else if (infos.length >= 2 && !this.locked) {
      // Both visible and no attempt running: sides are simply image left/right.
      sides = infos[0].x <= infos[1].x ? ["L", "R"] : ["R", "L"];
    } else if (infos.length >= 2) {
      // Locked: keep identities by nearest tracked position (a missing track sits at its default quarter of the image).
      const pos = (s) => this.tracks[s] || { x: s === "L" ? 0.25 : 0.75, y: infos[0].y, size: infos[0].size };
      const straight = idDist(infos[0], pos("L")) + idDist(infos[1], pos("R"));
      const crossed = idDist(infos[0], pos("R")) + idDist(infos[1], pos("L"));
      sides = straight <= crossed ? ["L", "R"] : ["R", "L"];
    } else if (live.length) {
      // One person: whichever tracked side they are nearest to.
      const best = live.reduce((a, b) => (idDist(infos[0], this.tracks[a]) <= idDist(infos[0], this.tracks[b]) ? a : b));
      sides = [best];
    } else {
      sides = [infos[0].x < 0.5 ? "L" : "R"];
    }
    sides = sides.slice(0, 2);
    sides.forEach((s, i) => { this.tracks[s] = { x: infos[i].x, y: infos[i].y, size: infos[i].size, at: now }; });
    return sides;
  }
}

/**
 * @param hands [{lms, label, score}]   @param poses [pose landmarks]
 * @returns array parallel to poses, each a list of at most 2 hands (the 2 nearest to that person's wrists).
 *   Hands more than maxDist (normalized image units) from every wrist are dropped.
 */
export function handsToPeople(hands, poses, { minVis = 0.2, maxDist = 0.3 } = {}) {
  const groups = poses.map(() => []);
  if (!poses.length) return groups;
  for (const h of hands) {
    let best = -1, bestD = Infinity;
    poses.forEach((p, i) => {
      for (const w of WRISTS) {
        const pt = p[w];
        if (!pt || (pt.visibility ?? 1) < minVis) continue;
        const d = dist(h.lms[0], pt);
        if (d < bestD) { bestD = d; best = i; }
      }
    });
    if (best < 0) { // no visible wrist anywhere: nearest shoulder midpoint
      poses.forEach((p, i) => { const d = dist(h.lms[0], personInfo(p)); if (d < bestD) { bestD = d; best = i; } });
    }
    if (bestD > maxDist) continue; // a hand far from everyone (e.g. its person's pose was lost) belongs to nobody
    groups[best].push({ ...h, d: bestD });
  }
  return groups.map((g) => g.sort((a, b) => a.d - b.d).slice(0, 2));
}

const handArr = (lms) => (lms ? lms.map((p) => [p.x, p.y, p.z]) : null);
const poseArr = (lms) => lms.slice(0, 25).map((p) => [p.x, p.y, p.z, p.visibility ?? 0]);

/**
 * Builds a duo `frame`. handRes/poseRes are MediaPipe results (up to 4 hands, 2 poses).
 * @returns { frame, count } where count = number of people detected
 */
export function buildDuoFrame(t, handRes, poseRes, aspect, tracker, now = t, { holdMs = 1000 } = {}) {
  const cats = (handRes && (handRes.handedness || handRes.handednesses)) || [];
  const hands = ((handRes && handRes.landmarks) || []).map((lms, i) => ({
    lms,
    label: cats[i] && cats[i][0] ? cats[i][0].categoryName : null,
    score: cats[i] && cats[i][0] ? cats[i][0].score : 0,
  }));
  const poses = ((poseRes && poseRes.landmarks) || []).slice(0, 2);
  const infos = poses.map(personInfo);
  const sides = tracker.assign(infos, now);
  sides.forEach((s, i) => { tracker.tracks[s].pose = poses[i]; });
  // PoseLandmarker with numPoses 2 often drops one of two people for a few frames. Hold a missing person's last pose
  // for up to holdMs (1 s), so their hands (still detected every frame) keep a person to belong to.
  for (const s of ["L", "R"]) {
    const tr = tracker.tracks[s];
    if (sides.includes(s) || !tr || !tr.pose || now - tr.at > holdMs) continue;
    poses.push(tr.pose); infos.push({ x: tr.x, y: tr.y, size: tr.size }); sides.push(s);
  }
  const groups = handsToPeople(hands, poses);

  const people = poses.map((p, i) => {
    const a = assignHands(groups[i], p);
    return { side: sides[i], size: infos[i].size, pose: poseArr(p), left: handArr(a.left), right: handArr(a.right) };
  });
  // Same side twice can only happen with >2 poses; keep the larger one.
  const bySide = {};
  for (const p of people) if (!bySide[p.side] || p.size > bySide[p.side].size) bySide[p.side] = p;
  const list = ["L", "R"].filter((s) => bySide[s]).map((s) => bySide[s]);

  let top;
  if (list.length) top = list.reduce((a, b) => (b.size > a.size ? b : a));
  else {
    const a = assignHands(hands.slice(0, 2), null); // no pose at all: behave like solo
    top = { pose: null, left: handArr(a.left), right: handArr(a.right) };
  }
  const frame = { type: "frame", t, pose: top.pose, left: top.left, right: top.right };
  if (Number.isFinite(aspect) && aspect > 0) frame.aspect = aspect;
  frame.people = list.map(({ side, pose, left, right }) => ({ side, pose, left, right }));
  return { frame, count: list.length };
}

// One person's view of a duo window, as solo-shaped frames for preprocess.js.
export function personFrames(frames, side) {
  return frames.map((f) => {
    const p = (f.people || []).find((x) => x.side === side);
    const out = { type: "frame", t: f.t, pose: p ? p.pose : null, left: p ? p.left : null, right: p ? p.right : null };
    if (f.aspect) out.aspect = f.aspect;
    return out;
  });
}

/**
 * The duo `pred` (PROTOCOL §1b): each side's window is classified on its own with the same pack mask and §3 verdict.
 * @param rank async (attempt, soloShapedFrames) => [[label, p], ...] (masked softmax, highest first)
 */
export async function buildDuoPred(attempt, frames, rank, thresholds) {
  const people = [];
  for (const side of ["L", "R"]) {
    const pf = personFrames(frames, side);
    const handFrac = handFraction(pf);
    const ranked = handFrac > 0 ? await rank(attempt, pf) : [];
    const p = buildPred({ id: attempt.id, target: attempt.target, ranked, handFrac, thresholds });
    people.push({ side, top: p.top, ok: p.ok, present: handFrac >= thresholds.minHandFrac });
  }
  return { type: "pred", id: attempt.id, target: attempt.target, mode: "duo", people };
}

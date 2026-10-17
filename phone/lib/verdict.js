// Turning model logits into a `pred` (PROTOCOL §3). Pure functions, unit-tested in phone/test/.

// Softmax over the pack's signs only: every label not in `allowed` is masked out before the softmax.
// Returns [[label, p], ...] sorted by p, highest first, for allowed labels only.
export function maskedSoftmax(logits, labels, allowed) {
  const keep = [];
  for (let i = 0; i < labels.length; i++) if (allowed.has(labels[i]) && Number.isFinite(logits[i])) keep.push(i);
  if (!keep.length) return [];
  let max = -Infinity;
  for (const i of keep) if (logits[i] > max) max = logits[i];
  let sum = 0;
  const e = keep.map((i) => { const v = Math.exp(logits[i] - max); sum += v; return v; });
  return keep.map((i, k) => [labels[i], e[k] / sum]).sort((a, b) => b[1] - a[1]);
}

// Fraction of frames where at least one hand was detected.
export function handFraction(frames) {
  if (!frames || !frames.length) return 0;
  let n = 0;
  for (const f of frames) if (f.left || f.right) n++;
  return n / frames.length;
}

// ok = target in top-K AND p(target) >= minProb AND hand present in >= minHandFrac of the window frames.
export function verdict({ ranked, target, handFrac, thresholds }) {
  const { topK, minProb, minHandFrac } = thresholds;
  const idx = ranked.findIndex(([l]) => l === target);
  const p = idx >= 0 ? ranked[idx][1] : 0;
  return idx >= 0 && idx < topK && p >= minProb && handFrac >= minHandFrac;
}

const round3 = (x) => Math.round(x * 1000) / 1000;

export function buildPred({ id, target, ranked, handFrac, thresholds }) {
  return {
    type: "pred",
    id,
    target,
    top: ranked.slice(0, 3).map(([l, p]) => [l, round3(p)]),
    ok: verdict({ ranked, target, handFrac, thresholds }),
  };
}

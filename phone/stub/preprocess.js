// STUB preprocess.js. Only used while model/export/preprocess.js does not exist yet.
// It follows the PROTOCOL §2 contract (exports T, F and toFeatures(frames) -> Float32Array of length T*F),
// so the real file from model/ drops in with no code change: the server serves model/export/<file> first.
export const STUB = true;
export const T = 32;
export const F = (21 + 21 + 25) * 3;

function put(out, off, pts, n) {
  for (let i = 0; i < n; i++) {
    const p = pts ? pts[i] : null;
    out[off + i * 3] = p ? p[0] : 0;
    out[off + i * 3 + 1] = p ? p[1] : 0;
    out[off + i * 3 + 2] = p ? p[2] : 0;
  }
}

export function toFeatures(frames) {
  const out = new Float32Array(T * F);
  if (!frames || !frames.length) return out;
  for (let t = 0; t < T; t++) {
    const f = frames[Math.min(frames.length - 1, Math.floor((t * frames.length) / T))];
    const o = t * F;
    put(out, o, f.left, 21);
    put(out, o + 63, f.right, 21);
    put(out, o + 126, f.pose, 25);
  }
  return out;
}

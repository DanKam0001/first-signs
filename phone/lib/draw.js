// Draws a PROTOCOL `frame` (normalized image coords) as a skeleton. Used by the phone self-view and tools/fake_tv.html.
export const HAND_EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];
// Upper-body pose edges: shoulders, arms, hands, hips.
export const POSE_EDGES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [15, 17], [15, 19], [15, 21], [16, 18], [16, 20], [16, 22], [11, 23], [12, 24], [23, 24]];

export const COLORS = { left: "#ffb547", right: "#5ec8ff", pose: "rgba(255,255,255,0.55)" };

/**
 * @param mirror  true draws it flipped left-right (so it reads like a mirror). Frames themselves are never mirrored.
 */
export function drawFrame(ctx, frame, { mirror = false, width = ctx.canvas.width, height = ctx.canvas.height, lineWidth = 4 } = {}) {
  ctx.clearRect(0, 0, width, height);
  if (!frame) return;
  const X = (p) => (mirror ? 1 - p[0] : p[0]) * width;
  const Y = (p) => p[1] * height;
  ctx.lineCap = "round";
  const edges = (pts, list, color, lw, minVis = 0) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (const [a, b] of list) {
      const p = pts[a], q = pts[b];
      if (!p || !q) continue;
      if (minVis && ((p[3] ?? 1) < minVis || (q[3] ?? 1) < minVis)) continue;
      ctx.moveTo(X(p), Y(p));
      ctx.lineTo(X(q), Y(q));
    }
    ctx.stroke();
  };
  if (frame.pose) edges(frame.pose, POSE_EDGES, COLORS.pose, lineWidth, 0.3);
  for (const side of ["left", "right"]) {
    const h = frame[side];
    if (!h) continue;
    edges(h, HAND_EDGES, COLORS[side], lineWidth);
    ctx.fillStyle = COLORS[side];
    for (const p of h) { ctx.beginPath(); ctx.arc(X(p), Y(p), lineWidth * 0.8, 0, Math.PI * 2); ctx.fill(); }
  }
}

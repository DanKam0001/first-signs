// Cheap hand + arm skeleton renderer: ONE <Svg> with three <Path>s (arms, hand bones, joints) and a head guide.
// Fire TV sticks are weak, so updates are capped at ~15 fps and nothing else re-renders per frame.
import React, { memo, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { CFrame, RefData } from '../data/signs';
import { conn, Frame } from '../net/connection';
import { colors, s, type } from '../theme';

const POSE0 = 11; // compact pose holds landmarks 11..24
const ARM_LINKS: [number, number][] = [
  [11, 12],
  [11, 13],
  [12, 14],
  [11, 23],
  [12, 24],
  [23, 24],
];
const HAND_LINKS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];
/** Assumed camera width/height when a source does not say (PROTOCOL.md has no aspect field yet). */
export const DEFAULT_ASPECT = 0.75;

export type Xform = { cx: number; cy: number; sw: number };

function poseXY(p: number[] | null, i: number): [number, number] | null {
  if (!p) return null;
  const k = (i - POSE0) * 2;
  const x = p[k];
  const y = p[k + 1];
  if (x === undefined || x < 0 || y < 0) return null;
  return [x, y];
}

/** Body-anchored transform: centre on the shoulders, scale by shoulder width. */
export function measure(f: CFrame): Xform | null {
  const ls = poseXY(f.p, 11);
  const rs = poseXY(f.p, 12);
  if (ls && rs) {
    const sw = Math.abs(ls[0] - rs[0]);
    if (sw > 0.03) return { cx: (ls[0] + rs[0]) / 2, cy: (ls[1] + rs[1]) / 2, sw };
  }
  return null;
}

export function refXform(ref: RefData): Xform {
  const ms = ref.frames.map(measure).filter(Boolean) as Xform[];
  if (!ms.length) return { cx: 0.5, cy: 0.5, sw: 0.25 };
  const med = (a: number[]) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
  return { cx: med(ms.map((m) => m.cx)), cy: med(ms.map((m) => m.cy)), sw: med(ms.map((m) => m.sw)) };
}

export function compactLive(f: Frame): CFrame {
  const p: number[] = [];
  for (let i = 11; i <= 24; i++) {
    const pt = f.pose?.[i];
    if (pt && (pt[3] === undefined || pt[3] >= 0.5)) p.push(pt[0], pt[1]);
    else p.push(-1, -1);
  }
  const hand = (h: number[][] | null) => {
    if (!h || h.length < 21) return null;
    const out: number[] = [];
    for (let i = 0; i < 21; i++) out.push(h[i][0], h[i][1]);
    return out;
  };
  // Live mirror only: keep pose 0..10 so the head can be drawn (reference data never carries face points).
  let face: number[] | null = null;
  if (f.pose) {
    face = [];
    for (let i = 0; i <= 10; i++) {
      const pt = f.pose[i];
      if (pt && (pt[3] === undefined || pt[3] >= 0.5)) face.push(pt[0], pt[1]);
      else face.push(-1, -1);
    }
  }
  return { p: f.pose ? p : null, l: hand(f.left), r: hand(f.right), f: face };
}

/** Close-up framing for the dominant hand: centre + size in pixel-consistent units (y / aspect). */
export type HandInset = { side: 'l' | 'r'; cx: number; cy: number; size: number };

const FINGERS: { color: string; idx: number[] }[] = [
  { color: '#FF8A5B', idx: [1, 2, 3, 4] },
  { color: '#FFB547', idx: [5, 6, 7, 8] },
  { color: '#7BE495', idx: [9, 10, 11, 12] },
  { color: '#8EA8FF', idx: [13, 14, 15, 16] },
  { color: '#FF7EB6', idx: [17, 18, 19, 20] },
];

type ViewProps = {
  frame: CFrame | null;
  xf: Xform;
  width: number;
  height: number;
  color: string;
  mirror: boolean;
  aspect?: number;
  inset?: HandInset | null;
};

export const SkeletonView = memo(function SkeletonView({ frame, xf, width, height, color, mirror, aspect = DEFAULT_ASPECT, inset }: ViewProps) {
  // Vertical budget: ~1.4 shoulder-widths of head room above the shoulders, ~1.7 below (hips).
  const scale = Math.min(width * 0.28, height * 0.3);
  const ox = width / 2;
  const oy = height * 0.45;
  const sx = mirror ? -1 : 1;
  const map = (x: number, y: number): [number, number] => [
    ox + sx * ((x - xf.cx) / xf.sw) * scale,
    oy + ((y - xf.cy) / (xf.sw * aspect)) * scale,
  ];
  const f2 = (n: number) => n.toFixed(1);

  let arms = '';
  let bones = '';
  let joints = '';
  if (frame) {
    const P = (i: number) => {
      const q = poseXY(frame.p, i);
      return q ? map(q[0], q[1]) : null;
    };
    for (const [a, b] of ARM_LINKS) {
      const A = P(a);
      const B = P(b);
      if (A && B) arms += `M${f2(A[0])} ${f2(A[1])}L${f2(B[0])} ${f2(B[1])}`;
    }
    // forearms run elbow -> hand wrist when the hand is tracked, else to the pose wrist
    const forearm = (elbow: number, poseWrist: number, hand: number[] | null) => {
      const E = P(elbow);
      const W = hand ? map(hand[0], hand[1]) : P(poseWrist);
      if (E && W) arms += `M${f2(E[0])} ${f2(E[1])}L${f2(W[0])} ${f2(W[1])}`;
    };
    forearm(13, 15, frame.l);
    forearm(14, 16, frame.r);
    for (const h of [frame.l, frame.r]) {
      if (!h) continue;
      const H = (i: number) => map(h[i * 2], h[i * 2 + 1]);
      for (const [a, b] of HAND_LINKS) {
        const A = H(a);
        const B = H(b);
        bones += `M${f2(A[0])} ${f2(A[1])}L${f2(B[0])} ${f2(B[1])}`;
      }
      for (let i = 0; i < 21; i++) {
        const A = H(i);
        joints += `M${f2(A[0])} ${f2(A[1])}h0.01`;
      }
    }
  }
  const unit = scale / 10;

  // Head: an ellipse fitted to pose landmarks 0-10 (nose, eyes, ears, mouth) when the live frame has them,
  // with mouth and chin markers (mom, dad, water... are placed at the chin). Otherwise a guide circle.
  let headEl: React.ReactNode = null;
  const F = (i: number): [number, number] | null => {
    const fa = frame?.f;
    if (!fa || fa[i * 2] < 0) return null;
    return [fa[i * 2], fa[i * 2 + 1]];
  };
  const eyes = [1, 2, 3, 4, 5, 6].map(F).filter(Boolean) as [number, number][];
  const ml = F(9);
  const mr = F(10);
  const earL = F(7);
  const earR = F(8);
  if (frame?.f && eyes.length >= 2 && ml && mr) {
    const eye = [eyes.reduce((a, q) => a + q[0], 0) / eyes.length, eyes.reduce((a, q) => a + q[1], 0) / eyes.length];
    const mouth = [(ml[0] + mr[0]) / 2, (ml[1] + mr[1]) / 2];
    const faceW = earL && earR ? Math.abs(earL[0] - earR[0]) * 1.15 : Math.abs(ml[0] - mr[0]) * 3.2;
    const rx = (faceW / xf.sw) * scale * 0.5;
    const c = map(eye[0], eye[1] + (mouth[1] - eye[1]) * 0.35);
    const M1 = map(ml[0], ml[1]);
    const M2 = map(mr[0], mr[1]);
    const chin = map(mouth[0] + (mouth[0] - eye[0]) * 0.8, mouth[1] + (mouth[1] - eye[1]) * 0.8);
    headEl = (
      <>
        <Ellipse cx={c[0]} cy={c[1]} rx={rx} ry={rx * 1.3} stroke={color} strokeOpacity={0.7} strokeWidth={unit * 0.5} fill={color} fillOpacity={0.08} />
        <Path d={`M${f2(M1[0])} ${f2(M1[1])}L${f2(M2[0])} ${f2(M2[1])}`} stroke={colors.text} strokeWidth={unit * 0.45} strokeLinecap="round" />
        <Circle cx={chin[0]} cy={chin[1]} r={unit * 0.4} fill={colors.text} fillOpacity={0.8} />
      </>
    );
  } else {
    const head = map(xf.cx, xf.cy - xf.sw * aspect * 0.95);
    headEl = <Circle cx={head[0]} cy={head[1]} r={scale * 0.32} stroke={color} strokeOpacity={0.3} strokeWidth={unit * 0.5} fill="none" />;
  }

  // Dominant-hand close-up (about 35% of the pane, bottom-left), fingers colour-coded so the handshape reads from the couch.
  let insetEl: React.ReactNode = null;
  const hand = inset && frame ? frame[inset.side] : null;
  if (inset && hand) {
    const box = Math.min(width * 0.35, height * 0.82);
    const bx = unit * 1.2;
    const by = height - box - unit * 1.2;
    const k = (box * 0.8) / inset.size;
    const Hm = (i: number): [number, number] => {
      const x = hand[i * 2];
      const y = hand[i * 2 + 1] / aspect;
      return [bx + box / 2 + (mirror ? -1 : 1) * (x - inset.cx) * k, by + box / 2 + (y - inset.cy) * k];
    };
    const seg = (a: number, b: number) => {
      const A = Hm(a);
      const B = Hm(b);
      return `M${f2(A[0])} ${f2(A[1])}L${f2(B[0])} ${f2(B[1])}`;
    };
    const palm = seg(0, 1) + seg(0, 5) + seg(5, 9) + seg(9, 13) + seg(13, 17) + seg(0, 17);
    let dots = '';
    for (let i = 0; i < 21; i++) {
      const A = Hm(i);
      dots += `M${f2(A[0])} ${f2(A[1])}h0.01`;
    }
    const iu = box / 40;
    insetEl = (
      <G>
        <Rect x={bx} y={by} width={box} height={box} rx={unit * 1.5} fill="#000" fillOpacity={0.55} stroke={color} strokeOpacity={0.6} strokeWidth={unit * 0.3} />
        <Path d={palm} stroke={colors.text} strokeOpacity={0.6} strokeWidth={iu * 1.2} strokeLinecap="round" fill="none" />
        {FINGERS.map((fg) => (
          <Path
            key={fg.color}
            d={seg(fg.idx[0], fg.idx[1]) + seg(fg.idx[1], fg.idx[2]) + seg(fg.idx[2], fg.idx[3])}
            stroke={fg.color}
            strokeWidth={iu * 1.6}
            strokeLinecap="round"
            fill="none"
          />
        ))}
        <Path d={dots} stroke={colors.text} strokeWidth={iu * 1.9} strokeLinecap="round" fill="none" />
      </G>
    );
  }

  return (
    <Svg width={width} height={height}>
      {headEl}
      {arms ? <Path d={arms} stroke={color} strokeOpacity={0.6} strokeWidth={unit * 1.3} strokeLinecap="round" fill="none" /> : null}
      {bones ? <Path d={bones} stroke={color} strokeWidth={unit * 0.7} strokeLinecap="round" fill="none" /> : null}
      {joints ? <Path d={joints} stroke={colors.text} strokeWidth={unit * 1.1} strokeLinecap="round" fill="none" /> : null}
      {insetEl}
    </Svg>
  );
});

/** Plays a reference performance in a loop at ~15 fps. */
export function RefSkeleton({
  data,
  width,
  height,
  mirror,
  speed = 1,
  playing = true,
}: {
  data: RefData | null;
  width: number;
  height: number;
  mirror: boolean;
  speed?: number;
  playing?: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const xf = useRef<Xform>({ cx: 0.5, cy: 0.5, sw: 0.25 });
  const start = useRef(Date.now());
  useEffect(() => {
    if (data) xf.current = refXform(data);
    start.current = Date.now();
    setIdx(0);
  }, [data]);
  useEffect(() => {
    if (!data || !playing || data.frames.length < 2) return;
    start.current = Date.now() - (idx / data.fps / speed) * 1000;
    const n = data.frames.length;
    const hold = Math.round(data.fps * 0.6); // short pause on the last frame before looping
    const timer = setInterval(() => {
      const k = Math.floor(((Date.now() - start.current) / 1000) * data.fps * speed) % (n + hold);
      setIdx(Math.min(k, n - 1));
    }, 1000 / 15);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, playing, speed]);
  if (!data) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={styles.emptyText}>No reference recording for this sign yet</Text>
      </View>
    );
  }
  return (
    <SkeletonView
      frame={data.frames[idx] || null}
      xf={xf.current}
      width={width}
      height={height}
      color={colors.teacher}
      mirror={mirror}
      aspect={data.aspect && data.aspect > 0 ? data.aspect : DEFAULT_ASPECT}
    />
  );
}

/** Draws the family member's live skeleton from incoming `frame` messages, mirrored like a mirror. */
export function LiveSkeleton({ width, height }: { width: number; height: number }) {
  const latest = useRef<CFrame | null>(null);
  const fresh = useRef(false);
  const lastAt = useRef(0);
  const xf = useRef<Xform>({ cx: 0.5, cy: 0.45, sw: 0.25 });
  const [frame, setFrame] = useState<CFrame | null>(null);
  const [stale, setStale] = useState(true);
  const aspect = useRef(DEFAULT_ASPECT);
  const inset = useRef<HandInset | null>(null);
  useEffect(() => {
    const onFrame = (f: Frame) => {
      latest.current = compactLive(f);
      if (typeof f.aspect === 'number' && f.aspect > 0) aspect.current = f.aspect;
      fresh.current = true;
      lastAt.current = Date.now();
    };
    conn.events.on('frame', onFrame);
    const timer = setInterval(() => {
      const isStale = Date.now() - lastAt.current > 1200;
      setStale((prev) => (prev !== isStale ? isStale : prev));
      if (!fresh.current) return;
      fresh.current = false;
      const f = latest.current!;
      const m = measure(f);
      if (m) {
        const a = 0.2;
        const c = xf.current;
        xf.current = { cx: c.cx + (m.cx - c.cx) * a, cy: c.cy + (m.cy - c.cy) * a, sw: c.sw + (m.sw - c.sw) * a };
      }
      inset.current = pickInset(f, aspect.current, inset.current);
      setFrame(f);
    }, 1000 / 15);
    return () => {
      conn.events.off('frame', onFrame);
      clearInterval(timer);
    };
  }, []);
  return (
    <View style={{ width, height }}>
      <SkeletonView frame={stale ? null : frame} xf={xf.current} width={width} height={height} color={colors.you} mirror aspect={aspect.current} inset={inset.current} />
      {stale ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Text style={styles.emptyText}>Waiting for the phone camera...</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textDim, fontSize: type.small, textAlign: 'center', paddingHorizontal: s(40) },
});

/**
 * The signing (dominant) hand: the only hand present, or the higher wrist when both are up.
 * Sticky (switches only on a clear difference), with eased framing so the close-up doesn't jump.
 */
function pickInset(f: CFrame, aspect: number, prev: HandInset | null): HandInset | null {
  let side: 'l' | 'r' | null = null;
  if (f.l && f.r) {
    const yl = f.l[1];
    const yr = f.r[1];
    if (prev && Math.abs(yl - yr) < 0.06) side = prev.side;
    else side = yl < yr ? 'l' : 'r';
  } else side = f.r ? 'r' : f.l ? 'l' : null;
  if (!side) return null;
  const h = f[side]!;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < 21; i++) {
    sx += h[i * 2];
    sy += h[i * 2 + 1] / aspect;
  }
  const cx = sx / 21;
  const cy = sy / 21;
  // size from the wrist -> middle-finger knuckle length, which doesn't change when the fingers curl
  const dx = h[9 * 2] - h[0];
  const dy = (h[9 * 2 + 1] - h[1]) / aspect;
  const size = Math.max(0.02, Math.hypot(dx, dy) * 2.4);
  if (!prev || prev.side !== side) return { side, cx, cy, size };
  const a = 0.35;
  return { side, cx: prev.cx + (cx - prev.cx) * a, cy: prev.cy + (cy - prev.cy) * a, size: prev.size + (size - prev.size) * 0.15 };
}

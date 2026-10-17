// Cheap hand + arm skeleton renderer: ONE <Svg> with three <Path>s (arms, hand bones, joints) and a head guide.
// Fire TV sticks are weak, so updates are capped at ~15 fps and nothing else re-renders per frame.
import React, { memo, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
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
  return { p: f.pose ? p : null, l: hand(f.left), r: hand(f.right) };
}

type ViewProps = {
  frame: CFrame | null;
  xf: Xform;
  width: number;
  height: number;
  color: string;
  mirror: boolean;
  aspect?: number;
};

export const SkeletonView = memo(function SkeletonView({ frame, xf, width, height, color, mirror, aspect = DEFAULT_ASPECT }: ViewProps) {
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
  const head = map(xf.cx, xf.cy - xf.sw * aspect * 0.95);
  const unit = scale / 10;
  return (
    <Svg width={width} height={height}>
      <Circle cx={head[0]} cy={head[1]} r={scale * 0.32} stroke={color} strokeOpacity={0.25} strokeWidth={unit * 0.4} fill="none" />
      {arms ? <Path d={arms} stroke={color} strokeOpacity={0.55} strokeWidth={unit * 0.9} strokeLinecap="round" fill="none" /> : null}
      {bones ? <Path d={bones} stroke={color} strokeWidth={unit * 0.45} strokeLinecap="round" fill="none" /> : null}
      {joints ? <Path d={joints} stroke={colors.text} strokeWidth={unit * 0.75} strokeLinecap="round" fill="none" /> : null}
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
      setFrame(f);
    }, 1000 / 15);
    return () => {
      conn.events.off('frame', onFrame);
      clearInterval(timer);
    };
  }, []);
  return (
    <View style={{ width, height }}>
      <SkeletonView frame={stale ? null : frame} xf={xf.current} width={width} height={height} color={colors.you} mirror aspect={aspect.current} />
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

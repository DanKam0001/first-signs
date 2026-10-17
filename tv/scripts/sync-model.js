#!/usr/bin/env node
// Copies the model bundle (../model/export/signs.json + refs/<id>.json) into src/generated/ in the compact
// form the TV renders, and writes src/generated/model.ts. If the export does not exist yet, it falls back to
// scripts/fixture-signs.json plus SYNTHETIC placeholder motions (flagged IS_FIXTURE so the UI never claims
// they are real recordings).
//
// Compact ref frame: { p: [x,y]*14 for pose 11..24 (-1 = not visible), l: [x,y]*21 | null, r: [x,y]*21 | null }
// in unmirrored image coordinates, resampled to 15 fps, 4 decimals. Face landmarks are never copied.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXPORT = process.env.FS_MODEL_EXPORT || path.resolve(ROOT, '..', 'model', 'export');
const OUT = path.join(ROOT, 'src', 'generated');
const OUT_REFS = path.join(OUT, 'refs');
const FPS_OUT = 15;
const POSE_IDX = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];

const r4 = (v) => Math.round(v * 10000) / 10000;

function compactPose(pose) {
  if (!Array.isArray(pose)) return null;
  const out = [];
  for (const i of POSE_IDX) {
    const pt = pose[i];
    const vis = pt && (pt.length < 4 || pt[3] == null || pt[3] >= 0.5);
    if (pt && vis && Number.isFinite(pt[0]) && Number.isFinite(pt[1])) out.push(r4(pt[0]), r4(pt[1]));
    else out.push(-1, -1);
  }
  return out;
}
function compactHand(h) {
  if (!Array.isArray(h) || h.length < 21) return null;
  const out = [];
  for (let i = 0; i < 21; i++) {
    const pt = h[i];
    if (!pt || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) return null;
    out.push(r4(pt[0]), r4(pt[1]));
  }
  return out;
}
function compactRef(ref) {
  const fps = ref.fps || 30;
  const frames = ref.frames || [];
  const n = Math.max(1, Math.round((frames.length * FPS_OUT) / fps));
  const out = [];
  for (let k = 0; k < n; k++) {
    const f = frames[Math.min(frames.length - 1, Math.round((k * fps) / FPS_OUT))] || {};
    out.push({ p: compactPose(f.pose), l: compactHand(f.left), r: compactHand(f.right) });
  }
  const aspect = Number(ref.aspect);
  return { fps: FPS_OUT, ...(aspect > 0 ? { aspect } : {}), frames: out };
}

function parseSigns(raw) {
  let signs = [];
  let thresholds = null;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && item._thresholds) thresholds = item._thresholds;
      else if (item && item.id) signs.push(item);
    }
  } else if (raw && typeof raw === 'object') {
    thresholds = raw._thresholds || null;
    if (Array.isArray(raw.signs)) signs = raw.signs;
    else
      for (const [k, v] of Object.entries(raw))
        if (!k.startsWith('_') && v && typeof v === 'object') signs.push({ id: k, ...v });
  }
  return { signs, thresholds };
}

// ---------- synthetic placeholder motion (fixture only) ----------
function hash(str) {
  let h = 2166136261;
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}
const HAND = [
  [0, 0], [0.025, -0.02], [0.045, -0.04], [0.06, -0.06], [0.07, -0.08],
  [0.02, -0.07], [0.022, -0.1], [0.023, -0.12], [0.024, -0.14],
  [0, -0.075], [0, -0.107], [0, -0.13], [0, -0.15],
  [-0.018, -0.07], [-0.02, -0.1], [-0.021, -0.12], [-0.022, -0.137],
  [-0.034, -0.06], [-0.038, -0.083], [-0.04, -0.098], [-0.042, -0.112],
];
function handAt(wx, wy, curl, angle, mirror) {
  return HAND.map(([x, y], i) => {
    let px = x;
    let py = y;
    if (i > 1 && (i - 1) % 4 !== 0) {
      const mcp = HAND[i - ((i - 1) % 4)];
      const j = (i - 1) % 4;
      px = mcp[0] + (x - mcp[0]) * (1 - 0.75 * curl);
      py = mcp[1] + (y - mcp[1]) * (1 - 0.75 * curl) + (0.03 * curl * j) / 3;
    }
    if (mirror) px = -px;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [wx + px * c - py * s, wy + px * s + py * c];
  });
}
function syntheticRef(id) {
  const kind = hash(id) % 4; // 0 tap, 1 circle, 2 squeeze, 3 sweep
  const n = 30;
  const frames = [];
  for (let k = 0; k < n; k++) {
    const t = (k / n) * Math.PI * 2;
    const pose = new Array(25).fill(null).map(() => [0, 0, 0, 0]);
    // the signer's right shoulder (12) is on the image's left (camera view, not mirrored)
    pose[12] = [0.4, 0.5, 0, 0.99];
    pose[11] = [0.6, 0.5, 0, 0.99];
    pose[24] = [0.43, 0.95, 0, 0.9];
    pose[23] = [0.57, 0.95, 0, 0.9];
    let rx = 0.45;
    let ry = 0.42;
    let curl = 0.1;
    let ang = 0;
    if (kind === 0) ry = 0.4 + 0.03 * Math.abs(Math.sin(t * 2));
    if (kind === 1) {
      rx = 0.48 + 0.04 * Math.cos(t);
      ry = 0.55 + 0.04 * Math.sin(t);
    }
    if (kind === 2) curl = 0.5 + 0.5 * Math.sin(t * 2);
    if (kind === 3) {
      rx = 0.44 + 0.08 * Math.sin(t);
      ang = 0.2 * Math.sin(t);
    }
    const lx = 0.6;
    const ly = 0.7;
    pose[16] = [rx, ry + 0.02, 0, 0.95];
    pose[14] = [(0.4 + rx) / 2 - 0.05, (0.5 + ry) / 2 + 0.1, 0, 0.95];
    pose[15] = [lx, ly, 0, 0.95];
    pose[13] = [0.64, 0.62, 0, 0.95];
    frames.push({
      pose,
      right: handAt(rx, ry, curl, ang, false).map(([x, y]) => [x, y, 0]),
      left: kind === 1 || kind === 3 ? handAt(lx, ly, 0.2, 0.4, true).map(([x, y]) => [x, y, 0]) : null,
    });
  }
  return { fps: 15, frames };
}
module.exports = { syntheticRef };

// ---------- main ----------
if (require.main === module) {
  fs.rmSync(OUT_REFS, { recursive: true, force: true });
  fs.mkdirSync(OUT_REFS, { recursive: true });

  let isFixture = false;
  let raw;
  const signsPath = path.join(EXPORT, 'signs.json');
  if (fs.existsSync(signsPath)) {
    raw = JSON.parse(fs.readFileSync(signsPath, 'utf8'));
  } else {
    isFixture = true;
    raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture-signs.json'), 'utf8'));
  }
  const { signs, thresholds } = parseSigns(raw);
  const refs = {};
  const missing = [];
  for (const s of signs) {
    const refPath = path.join(EXPORT, 'refs', `${s.id}.json`);
    let ref = null;
    if (!isFixture && fs.existsSync(refPath)) ref = JSON.parse(fs.readFileSync(refPath, 'utf8'));
    else if (isFixture) ref = syntheticRef(s.id);
    else missing.push(s.id);
    if (ref) {
      const safe = s.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      fs.writeFileSync(path.join(OUT_REFS, `${safe}.json`), JSON.stringify(compactRef(ref)));
      refs[s.id] = safe;
    }
  }
  const slim = signs.map(({ id, label, packs, description, credit, verified }) => ({
    id,
    label,
    packs,
    description,
    credit,
    verified,
  }));
  const lines = [
    '// GENERATED by scripts/sync-model.js - do not edit.',
    `export const IS_FIXTURE = ${isFixture};`,
    `export const SOURCE = ${JSON.stringify(isFixture ? 'scripts/fixture-signs.json (placeholder)' : 'model/export')};`,
    `export const SIGNS_RAW: any[] = ${JSON.stringify(slim, null, 1)};`,
    `export const THRESHOLDS: any = ${JSON.stringify(thresholds)};`,
    'export const REFS: Record<string, () => any> = {',
    ...Object.entries(refs).map(([id, f]) => `  ${JSON.stringify(id)}: () => require('./refs/${f}.json'),`),
    '};',
    '',
  ];
  fs.writeFileSync(path.join(OUT, 'model.ts'), lines.join('\n'));
  console.log(
    `[sync-model] ${isFixture ? 'FIXTURE (model/export not found)' : 'model/export'}: ${signs.length} signs, ` +
      `${Object.keys(refs).length} refs` +
      (missing.length ? `, missing refs: ${missing.join(', ')}` : '')
  );
}

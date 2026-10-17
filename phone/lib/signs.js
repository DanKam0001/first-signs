// Parses model/export/signs.json. Shared by the phone page and the server (no DOM use here).
//
// PROTOCOL §2 shows signs.json as an array, and §3 says the thresholds live under "_thresholds". Both shapes are accepted:
//   [ {id,...}, {id,...}, {"_thresholds": {...}} ]          (array, thresholds as one extra entry)
//   { "_thresholds": {...}, "signs": [ {id,...}, ... ] }     (object)
//   { "_thresholds": {...}, "milk": {...}, ... }             (object keyed by id)

export const DEFAULT_THRESHOLDS = Object.freeze({ topK: 3, minProb: 0.25, minHandFrac: 0.4 });

const ALIASES = {
  topK: ["topK", "top_k", "topk", "top"],
  minProb: ["minProb", "min_prob", "minP", "p_min", "pTarget", "min_p_target"],
  minHandFrac: ["minHandFrac", "min_hand_frac", "handFrac", "hand_frac", "minHandPresence", "min_hand_presence"],
};

export function parseThresholds(raw) {
  const t = { ...DEFAULT_THRESHOLDS };
  if (!raw || typeof raw !== "object") return t;
  for (const [key, names] of Object.entries(ALIASES)) {
    for (const n of names) {
      const v = Number(raw[n]);
      if (raw[n] !== undefined && Number.isFinite(v)) { t[key] = v; break; }
    }
  }
  return t;
}

export function parseSigns(json) {
  let signs = [];
  let rawThresholds = null;
  if (Array.isArray(json)) {
    for (const e of json) {
      if (e && typeof e === "object" && e._thresholds) rawThresholds = e._thresholds;
      else if (e && typeof e === "object" && e.id) signs.push(e);
    }
  } else if (json && typeof json === "object") {
    rawThresholds = json._thresholds || null;
    if (Array.isArray(json.signs)) signs = json.signs.filter((e) => e && e.id);
    else {
      for (const [k, v] of Object.entries(json)) {
        if (k.startsWith("_") || !v || typeof v !== "object") continue;
        signs.push({ id: v.id || k, ...v });
      }
    }
  }
  const byId = new Map(signs.map((s) => [s.id, s]));
  const packs = [...new Set(signs.flatMap((s) => s.packs || []))];
  return { signs, byId, packs, thresholds: parseThresholds(rawThresholds) };
}

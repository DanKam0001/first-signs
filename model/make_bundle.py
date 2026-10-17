"""Write signs.json and refs/<id>.json into model/export/ (PROTOCOL §2).

  python model/make_bundle.py --run D:/datasets/gislr/runs/final

refs: for each sign, one clean, typical performance from the dataset, chosen automatically:
  candidates = clips with hands in >= 60% of frames, length within the sign's middle 50%, from a
  right-hand-dominant signer (so no mirroring is involved); pick the one the held-out-signer model
  (cross-validation logits, so the clip's signer was unseen) was most confident about.
  Frames are trimmed to the signing (first..last frame with a hand, plus 3 frames each side).
  Pose 0..24 and both hands only, never the face. GISLR has no pose visibility, so v = 1.0.
"""
import argparse
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import vocab as V  # noqa: E402
from evaluate import load_run, softmax  # noqa: E402

EXPORT = os.path.join(HERE, "export")
CREDIT = ("Reference: GISLR, Isolated Sign Language Recognition corpus (Deaf Professional Arts Network, "
          "Georgia Institute of Technology, Google), CC BY 4.0. Recorded by Deaf signers.")
DISPLAY = {"thankyou": "thank you", "icecream": "ice cream", "minemy": "mine / my", "weus": "we / us",
           "callonphone": "call on phone", "frenchfries": "french fries", "glasswindow": "glass / window",
           "haveto": "have to", "hesheit": "he / she / it"}
PACK_LABELS = {"mealtime": "Mealtime", "bedtime": "Bedtime", "bath": "Bath time", "family": "Family"}
THRESHOLDS = {"topK": 3, "minProb": 0.25, "minHandFrac": 0.4}


def r4(a):
    return [round(float(v), 4) for v in a]


def frame_obj(p, l, r):
    def hand(h):
        return None if not np.isfinite(h).all() else [r4(pt) for pt in h]
    pose = None if not np.isfinite(p).all() else [r4(pt) + [1.0] for pt in p]
    return {"pose": pose, "left": hand(l), "right": hand(r)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", required=True)
    ap.add_argument("--cache", default="D:/datasets/gislr/cache/train.npz")
    ap.add_argument("--descriptions", default=os.path.join(HERE, "data", "sign_descriptions.json"))
    ap.add_argument("--thresholds", default=None, help="JSON overriding the verdict thresholds")
    a = ap.parse_args()
    cfg, cat = load_run(a.run)
    labels, packs = cfg["labels"], cfg["packs"]
    z = np.load(a.cache)
    off, P, L, R = z["offsets"], z["pose"], z["left"], z["right"]
    prob = softmax(cat["logits"])
    os.makedirs(os.path.join(EXPORT, "refs"), exist_ok=True)

    chosen = {}
    for c, s in enumerate(labels):
        m = np.nonzero(cat["y"] == c)[0]
        info = []
        for j in m:
            i = cat["items"][j]
            l, r = L[off[i]:off[i + 1]], R[off[i]:off[i + 1]]
            okl, okr = np.isfinite(l[:, 0, 0]), np.isfinite(r[:, 0, 0])
            info.append((j, len(l), (okl | okr).mean(), okr.sum() >= okl.sum()))
        lens = np.array([t[1] for t in info])
        q1, q3 = np.percentile(lens, [25, 75])
        cands = [t for t in info if t[2] >= 0.6 and q1 <= t[1] <= q3 and t[3]] or info
        best = max(cands, key=lambda t: prob[t[0], c])
        j = best[0]
        i = cat["items"][j]
        a0, b0 = off[i], off[i + 1]
        l, r = L[a0:b0], R[a0:b0]
        has = np.nonzero(np.isfinite(l[:, 0, 0]) | np.isfinite(r[:, 0, 0]))[0]
        lo, hi = max(0, has[0] - 3), min(b0 - a0 - 1, has[-1] + 3)
        frames = [frame_obj(P[a0 + k], L[a0 + k], R[a0 + k]) for k in range(lo, hi + 1)]
        ref = {"fps": 30, "id": s, "frames": frames,
               "source": {"dataset": "GISLR (Kaggle asl-signs) train", "participant_id": int(cat["pid"][j]),
                          "sequence_id": int(cat["sid"][j]), "heldout_model_p": round(float(prob[j, c]), 3)},
               "credit": CREDIT}
        with open(os.path.join(EXPORT, "refs", f"{s}.json"), "w") as f:
            json.dump(ref, f, separators=(",", ":"))
        chosen[s] = ref["source"]

    desc = json.load(open(a.descriptions)) if os.path.exists(a.descriptions) else {}
    th = dict(THRESHOLDS)
    if a.thresholds:
        th.update(json.loads(a.thresholds))
    signs = []
    for s in labels:
        d = desc.get(s, {})
        entry = {"id": s, "label": DISPLAY.get(s, s), "packs": [p for p, ids in packs.items() if s in ids],
                 "description": d.get("description", ""), "verified": bool(d.get("verified", False)),
                 "credit": "Reference: GISLR (D-PAN / Georgia Tech / Google), CC BY 4.0"}
        if d.get("sources"):
            entry["sources"] = d["sources"]
        if d.get("note"):
            entry["note"] = d["note"]
        signs.append(entry)
    out = {
        "_thresholds": th,
        "_packs": [{"id": p, "label": PACK_LABELS.get(p, p), "signs": ids} for p, ids in packs.items()],
        "_labels_order": "signs[] order == model output order == labels.json",
        "_credits": CREDIT + " Descriptions written for First Signs from the sources listed per sign; "
                             "they are not from the dataset. Learn from Deaf teachers: these are memory aids.",
        "signs": signs,
    }
    with open(os.path.join(EXPORT, "signs.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
    print(f"wrote signs.json ({len(signs)} signs, {sum(e['verified'] for e in signs)} verified descriptions) "
          f"and {len(chosen)} refs")


if __name__ == "__main__":
    main()

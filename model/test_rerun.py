"""Score a trained model on the GISLR rerun set: 10 Deaf signers who are NOT in the training data.

  python model/test_rerun.py --ckpt D:/datasets/gislr/runs/final/model_all.pt --metrics model/export/metrics.json

Two conditions:
  as_recorded : the clips as GISLR has them (30 fps phone video, short clips)
  phone_sim   : closer to the First Signs phone window: every 2nd frame (15 fps), idle holds added
                before (0.4 s) and after (0.6 s) the sign, 10% of hand detections dropped. Fixed seed.
The rerun set is Kaggle's public release of the competition's hidden test data
(kaggle.com/datasets/sohier/461054610546105), labels included.
"""
import argparse
import json
import os
import sys

import numpy as np
import torch

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from evaluate import compute, hand_fracs  # noqa: E402
from net import SignNet  # noqa: E402
from preprocess import F, T, to_features_arrays  # noqa: E402
from train import Frames, ensure_npy  # noqa: E402


def phone_sim(pose, left, right, rng):
    idx = np.arange(0, len(pose), 2)
    idx = np.concatenate([np.full(6, idx[0]), idx, np.full(9, idx[-1])])
    pose, left, right = pose[idx].copy(), left[idx].copy(), right[idx].copy()
    for H in (left, right):
        H[rng.random(len(H)) < 0.1] = np.nan
        H += rng.normal(0, 0.0015, H.shape)
    pose += rng.normal(0, 0.002, pose.shape)
    return pose, left, right


def score(ckpt, cache, sim, packs=None):
    ck = torch.load(ckpt, map_location="cpu", weights_only=False)
    cfg = ck["cfg"]
    labels = cfg["labels"]
    model = SignNet(T, F, len(labels), d=cfg["dim"], n_conv=cfg["conv"], n_tx=cfg["tx"], drop=cfg["drop"])
    model.load_state_dict(ck["state"])
    model.eval()
    d = ensure_npy(cache)
    fr = Frames(d)
    lab = {s: i for i, s in enumerate(labels)}
    items = np.array([i for i, s in enumerate(fr.sign) if s in lab])
    y = np.array([lab[s] for s in fr.sign[items]])
    rng = np.random.default_rng(0)
    X = np.zeros((len(items), T, F), np.float32)
    for k, i in enumerate(items):
        p, l, r = fr.get(i)
        if sim:
            p, l, r = phone_sim(p, l, r, rng)
        X[k] = to_features_arrays(p, l, r).reshape(T, F)
    with torch.no_grad():
        logits = torch.cat([model(torch.from_numpy(X[a:a + 512])) for a in range(0, len(X), 512)]).numpy()
    cat = {"logits": logits, "y": y, "items": items, "pid": fr.pid[items], "sid": fr.sid[items]}
    return {"labels": labels, "packs": packs or cfg["packs"]}, cat, d


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", required=True)
    ap.add_argument("--cache", default="D:/datasets/gislr/cache/rerun.npz")
    ap.add_argument("--metrics", default=None, help="merge results into this metrics.json")
    ap.add_argument("--topK", type=int, default=3)
    ap.add_argument("--minProb", type=float, default=0.25)
    ap.add_argument("--minHandFrac", type=float, default=0.4)
    a = ap.parse_args()
    th = {"topK": a.topK, "minProb": a.minProb, "minHandFrac": a.minHandFrac}
    out = {}
    for name, sim in (("as_recorded", False), ("phone_sim", True)):
        cfg, cat, d = score(a.ckpt, a.cache, sim)
        hf = hand_fracs(d, cat["items"])
        res = compute(cfg, cat, hf, th)
        out[name] = res
        print(f"== rerun {name}: {res['n_heldout']} clips, {res['n_signers']} unseen signers")
        print("   overall", json.dumps(res["overall"]))
        print("   in-pack", json.dumps({k: round(v, 4) for k, v in res["in_pack"].items() if k != "packs"}))
        for pk, v in res["in_pack"]["packs"].items():
            print(f"     {pk:9s} top1 {v['top1']:.3f} top3 {v['top3']:.3f} TA {v['verdict_true_accept']:.3f} "
                  f"FA {v['verdict_false_accept']:.3f}")
        print("   per signer top1", {k: round(v["top1"], 3) for k, v in res["per_signer"].items()})
        print("   worst signs", sorted(((round(v["top1"], 2), s) for s, v in res["per_sign"].items()))[:8])
        print("   top in-pack confusions", [(c["true"], c["pred"], round(c["rate"], 2)) for c in res["confusions_in_pack"][:8]])
    if a.metrics:
        m = json.load(open(a.metrics)) if os.path.exists(a.metrics) else {}
        m["test_unseen_signers"] = {
            "description": "Shipped model (trained on all 21 GISLR train signers) scored on the GISLR rerun set: "
                           "10 different Deaf signers, never seen in training. phone_sim = 15 fps + idle holds + "
                           "10% dropped hand detections.",
            "source": "kaggle.com/datasets/sohier/461054610546105 (Kaggle's public release of the asl-signs test set)",
            "thresholds": th, **out}
        json.dump(m, open(a.metrics, "w"), indent=1)
        print("updated", a.metrics)


if __name__ == "__main__":
    main()

"""Turn the cross-validation held-out logits into metrics (PROTOCOL §2 metrics.json).

  python model/evaluate.py --run D:/datasets/gislr/runs/final [--metrics model/export/metrics.json]

Every number comes from signers the scoring model never saw in training (k-fold by participant_id).
"In-pack" = the phone's setting: logits masked to the current pack's signs before the softmax.
"Verdict" = PROTOCOL §3 (`ok` if target in top-K, p(target) >= minProb, hands in >= minHandFrac
of frames): true-accept rate when the family signs the target, false-accept rate when they sign a
different sign from the same pack.
"""
import argparse
import glob
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


def softmax(z):
    z = z - z.max(axis=-1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=-1, keepdims=True)


def load_run(run):
    cfg = json.load(open(os.path.join(run, "cv_config.json")))
    parts = [np.load(p) for p in sorted(glob.glob(os.path.join(run, "fold*_heldout.npz")))]
    cat = {k: np.concatenate([p[k] for p in parts]) for k in ("logits", "y", "items", "pid", "sid")}
    return cfg, cat


def hand_fracs(cache_dir, items):
    off = np.load(os.path.join(cache_dir, "offsets.npy"))
    L = np.load(os.path.join(cache_dir, "left.npy"), mmap_mode="r")
    R = np.load(os.path.join(cache_dir, "right.npy"), mmap_mode="r")
    out = []
    for i in items:
        a, b = off[i], off[i + 1]
        ok = np.isfinite(np.asarray(L[a:b, 0, 0])) | np.isfinite(np.asarray(R[a:b, 0, 0]))
        out.append(ok.mean())
    return np.array(out)


def verdict_rates(P_pack, y_local, hf, k, pmin, hmin):
    """P_pack (N, n) in-pack probabilities. Returns (true-accept, false-accept)."""
    n = P_pack.shape[1]
    rank = (-P_pack).argsort(axis=1).argsort(axis=1)  # rank of each class
    ok = (rank < k) & (P_pack >= pmin) & (hf[:, None] >= hmin)
    ta = ok[np.arange(len(y_local)), y_local].mean()
    other = np.ones_like(ok, dtype=bool)
    other[np.arange(len(y_local)), y_local] = False
    fa = ok[other].mean() if n > 1 else 0.0
    return float(ta), float(fa)


def compute(cfg, cat, hf, thresholds):
    labels, packs = cfg["labels"], cfg["packs"]
    C = len(labels)
    logits, y = cat["logits"], cat["y"]
    P = softmax(logits)
    order = (-logits).argsort(axis=1)
    top1 = order[:, 0] == y
    top3 = (order[:, :3] == y[:, None]).any(1)
    res = {"n_heldout": int(len(y)), "n_signers": int(len(np.unique(cat["pid"]))),
           "overall": {"top1": float(top1.mean()), "top3": float(top3.mean()), "classes": C}}

    per_sign = {}
    conf = np.zeros((C, C), int)
    np.add.at(conf, (y, order[:, 0]), 1)
    for c, s in enumerate(labels):
        m = y == c
        per_sign[s] = {"n": int(m.sum()), "top1": float(top1[m].mean()), "top3": float(top3[m].mean())}

    pack_res, pack_conf = {}, []
    all_ip1, all_ip3, all_ta, all_fa, all_n = [], [], [], [], []
    for pk, ids in packs.items():
        idx = [labels.index(s) for s in ids]
        m = np.isin(y, idx)
        lg = logits[m][:, idx]
        yl = np.array([idx.index(v) for v in y[m]])
        o = (-lg).argsort(axis=1)
        ip1 = o[:, 0] == yl
        ip3 = (o[:, :3] == yl[:, None]).any(1)
        Pp = softmax(lg)
        ta, fa = verdict_rates(Pp, yl, hf[m], thresholds["topK"], thresholds["minProb"], thresholds["minHandFrac"])
        pack_res[pk] = {"signs": len(ids), "n": int(m.sum()), "top1": float(ip1.mean()), "top3": float(ip3.mean()),
                        "verdict_true_accept": ta, "verdict_false_accept": fa}
        for j, s in enumerate(ids):
            mm = yl == j
            per_sign[s].setdefault("in_pack", {})[pk] = {"top1": float(ip1[mm].mean()), "top3": float(ip3[mm].mean())}
        cm = np.zeros((len(ids), len(ids)), int)
        np.add.at(cm, (yl, o[:, 0]), 1)
        for a in range(len(ids)):
            for b in range(len(ids)):
                if a != b and cm[a, b]:
                    pack_conf.append({"pack": pk, "true": ids[a], "pred": ids[b], "rate": cm[a, b] / cm[a].sum()})
        all_ip1.append(ip1.sum()); all_ip3.append(ip3.sum()); all_n.append(len(yl))
        all_ta.append(ta * len(yl)); all_fa.append(fa * len(yl))
    N = sum(all_n)
    res["in_pack"] = {"top1": float(sum(all_ip1) / N), "top3": float(sum(all_ip3) / N),
                      "verdict_true_accept": float(sum(all_ta) / N), "verdict_false_accept": float(sum(all_fa) / N),
                      "packs": pack_res}
    res["per_sign"] = per_sign
    pairs = []
    for a in range(C):
        for b in range(C):
            if a != b and conf[a, b]:
                pairs.append({"true": labels[a], "pred": labels[b], "rate": float(conf[a, b] / conf[a].sum())})
    res["confusions_overall"] = sorted(pairs, key=lambda d: -d["rate"])[:25]
    res["confusions_in_pack"] = sorted(pack_conf, key=lambda d: -d["rate"])[:20]

    # per held-out signer (spread across people matters more than the mean)
    ps = {}
    for p in np.unique(cat["pid"]):
        m = cat["pid"] == p
        ps[str(int(p))] = {"n": int(m.sum()), "top1": float(top1[m].mean()), "top3": float(top3[m].mean())}
    res["per_signer"] = ps

    # threshold sweep for the verdict
    sweep = []
    for k in (1, 2, 3):
        for pmin in (0.15, 0.25, 0.35, 0.5):
            ta_t, fa_t = [], []
            for pk, ids in packs.items():
                idx = [labels.index(s) for s in ids]
                m = np.isin(y, idx)
                yl = np.array([idx.index(v) for v in y[m]])
                ta, fa = verdict_rates(softmax(logits[m][:, idx]), yl, hf[m], k, pmin, thresholds["minHandFrac"])
                ta_t.append(ta * len(yl)); fa_t.append(fa * len(yl))
            sweep.append({"topK": k, "minProb": pmin, "true_accept": sum(ta_t) / N, "false_accept": sum(fa_t) / N})
    res["verdict_sweep"] = sweep
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", required=True)
    ap.add_argument("--cache_dir", default="D:/datasets/gislr/cache/train")
    ap.add_argument("--metrics", default=None)
    ap.add_argument("--topK", type=int, default=3)
    ap.add_argument("--minProb", type=float, default=0.25)
    ap.add_argument("--minHandFrac", type=float, default=0.4)
    a = ap.parse_args()
    cfg, cat = load_run(a.run)
    hf = hand_fracs(a.cache_dir, cat["items"])
    th = {"topK": a.topK, "minProb": a.minProb, "minHandFrac": a.minHandFrac}
    res = compute(cfg, cat, hf, th)
    res["thresholds_evaluated"] = th
    res["split"] = {"method": f"{len(cfg['folds'])}-fold cross-validation by signer (participant_id); every "
                              "prediction is from a model that never saw that signer",
                    "folds": cfg["folds"]}
    print(json.dumps({k: res[k] for k in ("n_heldout", "n_signers", "overall")}, indent=1))
    print("in-pack:", json.dumps({k: v for k, v in res["in_pack"].items() if k != "packs"}))
    for pk, v in res["in_pack"]["packs"].items():
        print(f"  {pk:9s} {v['signs']:2d} signs  top1 {v['top1']:.3f} top3 {v['top3']:.3f}  "
              f"TA {v['verdict_true_accept']:.3f} FA {v['verdict_false_accept']:.3f}")
    print("worst signs (overall top1):")
    for s, v in sorted(res["per_sign"].items(), key=lambda kv: kv[1]["top1"])[:15]:
        print(f"  {s:12s} top1 {v['top1']:.3f} top3 {v['top3']:.3f}  in-pack {v.get('in_pack')}")
    print("top confusions overall:")
    for c in res["confusions_overall"][:20]:
        print(f"  {c['true']:>12s} -> {c['pred']:<12s} {c['rate']:.3f}")
    print("top confusions in-pack:")
    for c in res["confusions_in_pack"][:15]:
        print(f"  [{c['pack']}] {c['true']:>12s} -> {c['pred']:<12s} {c['rate']:.3f}")
    print("per signer top1:", {k: round(v["top1"], 3) for k, v in res["per_signer"].items()})
    print("verdict sweep:")
    for s in res["verdict_sweep"]:
        print(f"  top{s['topK']} p>={s['minProb']:.2f}: TA {s['true_accept']:.3f} FA {s['false_accept']:.3f}")
    if a.metrics:
        json.dump(res, open(a.metrics, "w"), indent=1)
        print("wrote", a.metrics)


if __name__ == "__main__":
    main()

"""Train the First Signs classifier on GISLR with signer-independent evaluation.

  # 5-fold cross-validation by signer (participant_id): each fold's test signers are never trained on
  python model/train.py --vocab final --cv 5 --out D:/datasets/gislr/runs/final
  # shipped model: same recipe, all 21 signers
  python model/train.py --vocab final --all --out D:/datasets/gislr/runs/final

Augmentation runs on the raw frames, before preprocess (the exact code path the phone uses):
frame-rate resampling (30 fps -> ~12-30 fps), dropped frames, idle "hold" frames at the ends, crop,
rotation/scale/aspect/shift of the whole image, per-hand size/rotation jitter, landmark noise and
dropped hand detections. Left-handed signers need no extra augmentation: preprocess mirrors any
left-dominant sequence so the dominant hand is always "right".
"""
import argparse
import json
import os
import sys
import time

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, Dataset

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import vocab as V  # noqa: E402
from net import SignNet  # noqa: E402
from preprocess import F, T, to_features_arrays  # noqa: E402


# ---------------------------------------------------------------- data
def ensure_npy(cache_npz):
    """Split the npz into .npy files once so DataLoader workers can memory-map them."""
    d = cache_npz[:-4]
    os.makedirs(d, exist_ok=True)
    if not os.path.exists(os.path.join(d, "done")):
        z = np.load(cache_npz)
        for k in z.files:
            a = z[k]
            if k in ("pose", "left", "right"):
                a = a[..., :2].astype(np.float32)
            np.save(os.path.join(d, k + ".npy"), a)
        open(os.path.join(d, "done"), "w").write("ok")
    return d


class Frames:
    def __init__(self, d):
        self.d = d
        self.pose = np.load(os.path.join(d, "pose.npy"), mmap_mode="r")
        self.left = np.load(os.path.join(d, "left.npy"), mmap_mode="r")
        self.right = np.load(os.path.join(d, "right.npy"), mmap_mode="r")
        self.offsets = np.load(os.path.join(d, "offsets.npy"))
        self.sign = np.load(os.path.join(d, "sign.npy"))
        self.pid = np.load(os.path.join(d, "participant_id.npy"))
        self.sid = np.load(os.path.join(d, "sequence_id.npy"))

    def get(self, i):
        a, b = self.offsets[i], self.offsets[i + 1]
        return (np.array(self.pose[a:b], np.float64), np.array(self.left[a:b], np.float64),
                np.array(self.right[a:b], np.float64))


def _rot(theta):
    c, s = np.cos(theta), np.sin(theta)
    return np.array([[c, -s], [s, c]])


def augment(pose, left, right, rng):
    n = len(pose)
    # temporal: frame rate, drops, crop, idle holds
    idx = np.arange(n)
    if rng.random() < 0.8 and n > 4:
        m = max(2, int(round(n * rng.uniform(0.4, 1.0))))
        idx = np.round(np.linspace(0, n - 1, m)).astype(int)
    if rng.random() < 0.3 and len(idx) > 6:
        idx = idx[rng.random(len(idx)) > 0.1]
    if rng.random() < 0.3 and len(idx) > 8:
        c0 = rng.integers(0, max(1, len(idx) // 10))
        c1 = rng.integers(0, max(1, len(idx) // 10))
        idx = idx[c0:len(idx) - c1]
    if rng.random() < 0.5:  # idle holds: the phone window (2.5 s) is longer than most GISLR clips
        k = len(idx)
        idx = np.concatenate([np.full(rng.integers(0, k + 1), idx[0]), idx, np.full(rng.integers(0, k + 1), idx[-1])])
    pose, left, right = pose[idx].copy(), left[idx].copy(), right[idx].copy()
    n = len(idx)

    # spatial: one affine for the whole image
    sh = (pose[:, 11] + pose[:, 12]) / 2
    c = np.nanmean(sh, axis=0) if np.isfinite(sh).any() else np.array([0.5, 0.6])
    s = rng.uniform(0.8, 1.25)
    asp = rng.uniform(0.85, 1.15)
    A = _rot(rng.uniform(-0.2, 0.2)) @ np.diag([s * asp, s / asp])
    t = rng.uniform(-0.08, 0.08, size=2)
    for X in (pose, left, right):
        X[:] = (X - c) @ A.T + c + t

    # per-hand jitter around its wrist (hand size / detector differences)
    for H in (left, right):
        if rng.random() < 0.5:
            Ah = _rot(rng.uniform(-0.15, 0.15)) * rng.uniform(0.9, 1.1)
            w = H[:, :1, :]
            H[:] = (H - w) @ Ah.T + w
    for X, sd in ((pose, 0.004), (left, 0.002), (right, 0.002)):
        X += rng.normal(0, sd, X.shape)

    # dropped hand detections: random frames + one short segment
    for H in (left, right):
        p = rng.uniform(0, 0.15)
        H[rng.random(n) < p] = np.nan
        if rng.random() < 0.2 and n > 6:
            a = rng.integers(0, n - 3)
            H[a:a + rng.integers(1, 4)] = np.nan
    return pose, left, right


class SignSet(Dataset):
    def __init__(self, d, items, labels, train, seed=0):
        self.d, self.items, self.labels, self.train, self.seed = d, items, labels, train, seed
        self.fr = None
        self.epoch = 0

    def __len__(self):
        return len(self.items)

    def __getitem__(self, k):
        if self.fr is None:
            self.fr = Frames(self.d)
        i = self.items[k]
        pose, left, right = self.fr.get(i)
        if self.train:
            rng = np.random.default_rng()  # fresh OS entropy per sample (persistent workers)
            pose, left, right = augment(pose, left, right, rng)
        x = to_features_arrays(pose, left, right).reshape(T, F)
        return torch.from_numpy(x), self.labels[k]


# ---------------------------------------------------------------- train / eval
def make_folds(pids, k):
    """Signers sorted by sample count, dealt round-robin into k folds (balanced, deterministic)."""
    u, cnt = np.unique(pids, return_counts=True)
    order = u[np.argsort(-cnt, kind="stable")]
    folds = [[] for _ in range(k)]
    for j, p in enumerate(order):
        folds[j % k if (j // k) % 2 == 0 else k - 1 - j % k].append(int(p))
    return folds


def run_epoch_eval(model, loader, dev):
    model.eval()
    out = []
    with torch.no_grad():
        for x, _ in loader:
            out.append(model(x.to(dev)).float().cpu())
    return torch.cat(out).numpy()


def train_one(d, tr_items, tr_y, te_items, te_y, C, args, dev, tag):
    torch.manual_seed(args.seed)
    model = SignNet(T, F, C, d=args.dim, n_conv=args.conv, n_tx=args.tx, drop=args.drop).to(dev)
    ds = SignSet(d, tr_items, tr_y, train=True, seed=args.seed)
    nw = args.workers
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.05)
    steps = args.epochs * ((len(ds) + args.bs - 1) // args.bs)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=args.lr, total_steps=steps, pct_start=0.1)
    lossf = nn.CrossEntropyLoss(label_smoothing=0.1)
    te_loader = None
    if te_items is not None and len(te_items):
        te_loader = DataLoader(SignSet(d, te_items, te_y, train=False), batch_size=256, num_workers=nw,
                               persistent_workers=nw > 0)
    loader = DataLoader(ds, batch_size=args.bs, shuffle=True, num_workers=nw, drop_last=True,
                        persistent_workers=nw > 0, generator=torch.Generator().manual_seed(args.seed))
    for ep in range(args.epochs):
        model.train()
        t0, tot, nb = time.time(), 0.0, 0
        for x, y in loader:
            x, y = x.to(dev), y.to(dev)
            loss = lossf(model(x), y)
            opt.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            sched.step()
            tot += loss.item()
            nb += 1
        msg = f"[{tag}] ep {ep + 1}/{args.epochs} loss {tot / max(nb, 1):.3f} {time.time() - t0:.0f}s"
        if te_loader is not None and ((ep + 1) % 5 == 0 or ep + 1 == args.epochs):
            lg = run_epoch_eval(model, te_loader, dev)
            msg += f" | held-out top1 {np.mean(lg.argmax(1) == te_y):.3f}"
        print(msg, flush=True)
    logits = run_epoch_eval(model, te_loader, dev) if te_loader is not None else None
    return model, logits


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", default="D:/datasets/gislr/cache/train.npz")
    ap.add_argument("--vocab", choices=["candidates", "final"], default="final")
    ap.add_argument("--cv", type=int, default=0, help="k-fold cross-validation by signer")
    ap.add_argument("--folds", default=None, help="comma list of fold indices to run (default all)")
    ap.add_argument("--all", action="store_true", help="train the shipped model on all signers")
    ap.add_argument("--out", required=True)
    ap.add_argument("--epochs", type=int, default=60)
    ap.add_argument("--bs", type=int, default=128)
    ap.add_argument("--lr", type=float, default=2e-3)
    ap.add_argument("--dim", type=int, default=192)
    ap.add_argument("--conv", type=int, default=3)
    ap.add_argument("--tx", type=int, default=2)
    ap.add_argument("--drop", type=float, default=0.3)
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    packs = V.CANDIDATE_PACKS if args.vocab == "candidates" else V.PACKS
    labels = V.labels_of(packs)
    lab_idx = {s: i for i, s in enumerate(labels)}
    d = ensure_npy(args.cache)
    fr = Frames(d)
    keep = np.array([s in lab_idx for s in fr.sign])
    items = np.nonzero(keep)[0]
    y = np.array([lab_idx[s] for s in fr.sign[items]])
    pids = fr.pid[items]
    os.makedirs(args.out, exist_ok=True)
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"{len(labels)} signs, {len(items)} sequences, {len(np.unique(pids))} signers, device {dev}", flush=True)
    cfg = {k: v for k, v in vars(args).items()}
    cfg.update(labels=labels, packs=packs, T=T, F=F)

    if args.cv:
        folds = make_folds(pids, args.cv)
        json.dump({**cfg, "folds": folds}, open(os.path.join(args.out, "cv_config.json"), "w"), indent=1)
        run = range(args.cv) if args.folds is None else [int(f) for f in args.folds.split(",")]
        for k in run:
            te = np.isin(pids, folds[k])
            _, logits = train_one(d, items[~te], y[~te], items[te], y[te], len(labels), args, dev, f"fold{k}")
            np.savez(os.path.join(args.out, f"fold{k}_heldout.npz"), logits=logits, y=y[te], items=items[te],
                     pid=pids[te], sid=fr.sid[items[te]])
            print(f"fold {k} signers {folds[k]}: top1 {np.mean(logits.argmax(1) == y[te]):.4f}", flush=True)
    if args.all:
        model, _ = train_one(d, items, y, None, None, len(labels), args, dev, "all")
        torch.save({"state": model.state_dict(), "cfg": cfg}, os.path.join(args.out, "model_all.pt"))
        print("saved", os.path.join(args.out, "model_all.pt"))


if __name__ == "__main__":
    main()

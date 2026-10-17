"""Convert downloaded GISLR parquet files into one compact cache in the PROTOCOL §1 layout.

GISLR rows per frame: face (468), left_hand (21), pose (33), right_hand (21) = 543 landmarks, x/y/z,
NaN when MediaPipe found nothing. We keep pose 0..24 + both hands, drop the face entirely (never
needed, and the dataset terms ask that landmark data not be used to identify anyone).

Handedness: GISLR `left_hand`/`right_hand` come from MediaPipe Holistic, whose hand labels follow
the pose model's body sides, i.e. the signer's anatomical hands (checked with check_handedness()
below: the `right_hand` wrist sits on pose landmark 16 = right wrist). So the mapping is
left_hand -> left, right_hand -> right, as PROTOCOL §1 wants.

Output: <root>/cache/<name>.npz with
    pose (N,25,3) float32, left (N,21,3), right (N,21,3)   frames of all sequences concatenated
    offsets (S+1,) int64, sequence_id (S,), participant_id (S,), sign (S,) str
"""
import argparse
import os
import sys
from concurrent.futures import ProcessPoolExecutor

import numpy as np
import pandas as pd
import pyarrow.parquet as pq

N_LM = 543
FACE, LH, POSE, RH = slice(0, 468), slice(468, 489), slice(489, 522), slice(522, 543)


def load_seq(path):
    t = pq.read_table(path, columns=["frame", "type", "landmark_index", "x", "y", "z"]).to_pandas()
    n = len(t) // N_LM
    if n * N_LM != len(t):
        raise ValueError(f"{path}: {len(t)} rows is not a multiple of {N_LM}")
    types = t["type"].to_numpy()[:N_LM]
    if not (types[0] == "face" and types[468] == "left_hand" and types[489] == "pose" and types[522] == "right_hand"):
        raise ValueError(f"{path}: unexpected landmark order")
    xyz = t[["x", "y", "z"]].to_numpy(np.float32).reshape(n, N_LM, 3)
    frames = t["frame"].to_numpy().reshape(n, N_LM)[:, 0]
    order = np.argsort(frames, kind="stable")
    xyz = xyz[order]
    return xyz[:, POSE][:, :25], xyz[:, LH], xyz[:, RH]


def _job(args):
    root, path = args
    try:
        return load_seq(os.path.join(root, path))
    except Exception as e:  # noqa: BLE001
        return str(e)


def build(root, df, name, workers=8):
    out_dir = os.path.join(root, "cache")
    os.makedirs(out_dir, exist_ok=True)
    poses, lefts, rights, keep = [], [], [], []
    with ProcessPoolExecutor(workers) as ex:
        for i, res in enumerate(ex.map(_job, [(root, p) for p in df.path], chunksize=32)):
            if isinstance(res, str):
                print("skip", res, file=sys.stderr)
                continue
            p, l, r = res
            if len(p) == 0:
                continue
            poses.append(p)
            lefts.append(l)
            rights.append(r)
            keep.append(i)
            if (i + 1) % 2000 == 0:
                print(f"{i + 1}/{len(df)}", flush=True)
    sub = df.iloc[keep]
    lens = np.array([len(p) for p in poses])
    offsets = np.concatenate([[0], np.cumsum(lens)]).astype(np.int64)
    np.savez(
        os.path.join(out_dir, f"{name}.npz"),
        pose=np.concatenate(poses), left=np.concatenate(lefts), right=np.concatenate(rights),
        offsets=offsets, sequence_id=sub.sequence_id.to_numpy(), participant_id=sub.participant_id.to_numpy(),
        sign=sub.sign.to_numpy().astype(str),
    )
    print(f"wrote {name}.npz: {len(sub)} sequences, {offsets[-1]} frames")


def check_handedness(cache):
    """How often is each GISLR hand's wrist closest to pose wrist 15 (left) vs 16 (right)?"""
    d = np.load(cache)
    P, L, R = d["pose"], d["left"], d["right"]
    for name, H in (("left_hand", L), ("right_hand", R)):
        ok = np.isfinite(H[:, 0, 0]) & np.isfinite(P[:, 15, 0])
        w = H[ok, 0, :2]
        d15 = np.linalg.norm(w - P[ok, 15, :2], axis=1)
        d16 = np.linalg.norm(w - P[ok, 16, :2], axis=1)
        nose_x = P[ok, 0, 0]
        print(f"{name}: {ok.sum()} frames, nearest pose wrist 15(left)={np.mean(d15 < d16):.3f} "
              f"16(right)={np.mean(d16 < d15):.3f}; wrist x > nose x (image right) {np.mean(w[:, 0] > nose_x):.3f}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="D:/datasets/gislr")
    ap.add_argument("--signs", default=None)
    ap.add_argument("--name", default="train")
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--csv", default="train.csv", help="file in <root>/meta: train.csv or rerun.csv")
    a = ap.parse_args()
    if a.check:
        check_handedness(os.path.join(a.root, "cache", f"{a.name}.npz"))
        sys.exit()
    df = pd.read_csv(os.path.join(a.root, "meta", a.csv))
    if a.signs:
        signs = [s.strip() for s in open(a.signs) if s.strip() and not s.startswith("#")]
        df = df[df.sign.isin(signs)]
    df = df[[os.path.exists(os.path.join(a.root, p)) for p in df.path]]
    build(a.root, df.reset_index(drop=True), a.name, a.workers)

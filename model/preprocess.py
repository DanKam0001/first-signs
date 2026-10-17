"""Python port of model/export/preprocess.js (PROTOCOL.md §2). Same algorithm, same constants.

The JS file is the reference that runs on the phone. This port is vectorised with numpy for training
speed but follows the JS step for step; tests/test_parity.py checks both agree to 1e-4.

Internal array form (used by training): pose (n,25,2), left (n,21,2), right (n,21,2), float64,
NaN anywhere in a frame's points = that part is missing in that frame.
"""
import math

import numpy as np

T = 32
POSE_IDX = [0, 2, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
_POSE_MIRROR = {0: 0, 2: 5, 5: 2, 7: 8, 8: 7, 9: 10, 10: 9, 11: 12, 12: 11, 13: 14, 14: 13, 15: 16, 16: 15}
POSE_IDX_MIRRORED = [_POSE_MIRROR[i] for i in POSE_IDX]
F = 21 * 2 * 4 + len(POSE_IDX) * 2 + 2  # 196
CLIP = 8.0
EPS = 1e-3
MOTION_LO = 0.05
MOTION_HI = 0.95
MOTION_PTS = [0, 4, 8, 12, 16, 20]


def frames_to_arrays(frames):
    """PROTOCOL §1 frame dicts -> (pose, left, right) arrays with NaN for missing parts."""
    n = len(frames)
    pose = np.full((n, 25, 2), np.nan)
    left = np.full((n, 21, 2), np.nan)
    right = np.full((n, 21, 2), np.nan)
    for i, fr in enumerate(frames):
        fr = fr or {}
        for key, arr, k in (("pose", pose, 25), ("left", left, 21), ("right", right, 21)):
            pts = fr.get(key)
            if isinstance(pts, list) and len(pts) >= k:
                try:
                    a = np.array([[p[0], p[1]] for p in pts[:k]], dtype=np.float64)
                except (TypeError, IndexError):
                    continue
                if np.isfinite(a).all():
                    arr[i] = a
    return pose, left, right


def to_features(frames):
    return to_features_arrays(*frames_to_arrays(frames))


def _present(a):
    return np.isfinite(a).all(axis=(1, 2))


def _motion(H, ok, lo, hi):
    idx = [i for i in range(lo, hi + 1) if ok[i]]
    if len(idx) < 2:
        return 0.0
    w = H[idx, 0, :]
    return float(np.abs(np.diff(w, axis=0)).sum())


def motion_trim(left, right, okL, okR, lo, hi):
    span = hi - lo
    if span < 4:
        return lo, hi
    m = np.zeros(span + 1)
    for H, ok in ((left, okL), (right, okR)):
        a, b = H[lo:hi][:, MOTION_PTS], H[lo + 1:hi + 1][:, MOTION_PTS]
        both = ok[lo:hi] & ok[lo + 1:hi + 1]
        d = np.abs(b - a).sum(axis=(1, 2))
        m[1:] += np.where(both, d, 0.0)
    cum = np.cumsum(m)
    total = cum[-1]
    if total < 1e-6:
        return lo, hi
    j_s = int(np.argmax(cum[1:] >= MOTION_LO * total)) + 1
    j_e = int(np.argmax(cum[1:] >= MOTION_HI * total)) + 1
    s0, e0 = lo + j_s - 1, lo + j_e
    margin = 2 + int(math.floor(0.1 * (e0 - s0)))
    return max(lo, s0 - margin), min(hi, e0 + margin)


def to_features_arrays(pose, left, right):
    out = np.zeros((T, F), dtype=np.float32)
    n = pose.shape[0]
    if n == 0:
        return out.reshape(-1)
    okP, okL, okR = _present(pose), _present(left), _present(right)

    # 1. trim
    anyh = np.nonzero(okL | okR)[0]
    if len(anyh):
        lo, hi = int(anyh[0]), int(anyh[-1])
    else:
        lo, hi = 0, n - 1
    # 1b. motion trim
    lo, hi = motion_trim(left, right, okL, okR, lo, hi)

    # 2. body frame
    sel = [i for i in range(lo, hi + 1) if okP[i]]
    if sel:
        p = pose[sel]
        mx = (p[:, 11, 0] + p[:, 12, 0]) / 2
        my = (p[:, 11, 1] + p[:, 12, 1]) / 2
        cx = float(mx.mean())
        cy = float(my.mean())
        sx = float(np.abs(p[:, 11, 0] - p[:, 12, 0]).mean())
        sy = float((my - p[:, 0, 1]).mean())
    else:
        cx, cy, sx, sy = 0.5, 0.6, 0.3, 0.15
    sx = max(sx, EPS)
    sy = max(sy, EPS)

    # 3. handedness
    nL = int(okL[lo:hi + 1].sum())
    nR = int(okR[lo:hi + 1].sum())
    mirror = nL > nR
    if nL == nR and nL > 0:
        mirror = _motion(left, okL, lo, hi) > _motion(right, okR, lo, hi)

    # 4. resample (same index arithmetic as JS)
    span = hi - lo
    s = np.array([lo + (j * span) / (T - 1) if span > 0 else lo for j in range(T)], dtype=np.float64)
    i0 = np.minimum(np.floor(s).astype(int), hi)
    i1 = np.where(i0 + 1 <= hi, i0 + 1, hi)
    w = s - i0

    def pick(A, ok):
        a_ok, b_ok = ok[i0], ok[i1]
        res = np.full((T,) + A.shape[1:], np.nan)
        both = a_ok & b_ok
        ww = w[:, None, None]
        res[both] = (A[i0] * (1 - ww) + A[i1] * ww)[both]
        use_a = ~both & a_ok & ((w < 0.5) | ~b_ok)
        res[use_a] = A[i0][use_a]
        use_b = ~both & ~use_a & b_ok
        res[use_b] = A[i1][use_b]
        return res, both | use_a | use_b

    P, hp = pick(pose, okP)
    Lr, hl = pick(left, okL)
    Rr, hr = pick(right, okR)

    # 5. normalise + featurise
    sg = -1.0 if mirror else 1.0
    if mirror:
        Lr, Rr, hl, hr = Rr, Lr, hr, hl

    def norm(A):
        B = np.empty_like(A)
        B[..., 0] = (sg * (A[..., 0] - cx)) / sx
        B[..., 1] = (A[..., 1] - cy) / sy
        return B

    dom, non = norm(Rr), norm(Lr)
    feats = []
    for H, h in ((dom, hr), (non, hl)):
        g = np.where(h[:, None, None], H, 0.0)
        feats.append(g.reshape(T, 42))
    for H, h in ((dom, hr), (non, hl)):
        rel = H - H[:, :1, :]
        size = np.sqrt(rel[:, 9, 0] ** 2 + rel[:, 9, 1] ** 2)
        size = np.where(size < EPS, EPS, size)
        loc = rel / size[:, None, None]
        loc = np.where(h[:, None, None], loc, 0.0)
        feats.append(loc.reshape(T, 42))
    pidx = POSE_IDX_MIRRORED if mirror else POSE_IDX
    PP = norm(P[:, pidx, :])
    PP = np.where(hp[:, None, None], PP, 0.0)
    feats.append(PP.reshape(T, len(POSE_IDX) * 2))
    feats.append(np.stack([hr, hl], axis=1).astype(np.float64))
    X = np.concatenate(feats, axis=1)
    X = np.clip(np.nan_to_num(X, nan=0.0), -CLIP, CLIP)
    out[:] = X
    return out.reshape(-1)


def hand_presence(frames):
    if not frames:
        return 0.0
    _, l, r = frames_to_arrays(frames)
    return float((_present(l) | _present(r)).mean())


if __name__ == "__main__":
    import json
    import sys

    fr = json.load(open(sys.argv[1]))
    fr = fr["frames"] if isinstance(fr, dict) else fr
    x = to_features(fr)
    print(x.shape, float(np.abs(x).sum()), math.isfinite(float(x.sum())))

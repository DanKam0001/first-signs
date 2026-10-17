"""Parity test: model/preprocess.py and model/export/preprocess.js must agree to 1e-4.

Run:  python model/tests/test_parity.py        (needs `node` on PATH)
      python model/tests/test_parity.py --regen   (rewrite the synthetic fixture)

Fixture = model/tests/fixture_frames.json: synthetic edge cases (missing hands, left-dominant
mirroring, ties, no hands, empty, single frame, malformed parts) plus, if present,
model/tests/fixture_real.json (real GISLR sequences converted to PROTOCOL §1 frames by
data/build_cache.py, so the fixture also covers real data).
"""
import json
import os
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from preprocess import F, T, hand_presence, to_features  # noqa: E402

SYN = os.path.join(HERE, "fixture_frames.json")
REAL = os.path.join(HERE, "fixture_real.json")
TOL = 1e-4


def _body(rng, cx=0.5, cy=0.55, sw=0.25):
    pose = []
    for k in range(25):
        pose.append([cx + rng.normal(0, sw), cy + rng.normal(0, sw), rng.normal(0, 0.1), float(rng.uniform())])
    pose[11] = [cx + sw / 2, cy, 0.0, 0.99]  # signer's left shoulder (image right)
    pose[12] = [cx - sw / 2, cy, 0.0, 0.99]
    pose[0] = [cx, cy - 0.6 * sw, 0.0, 0.99]
    return pose


def _hand(rng, wx, wy, s=0.06):
    return [[wx + rng.normal(0, s), wy + rng.normal(0, s), rng.normal(0, 0.02)] for _ in range(21)]


def make_synthetic():
    rng = np.random.default_rng(1234)
    cases = {}

    def seq(n, p_left, p_right, drift=0.004):
        frames = []
        for i in range(n):
            fr = {"pose": _body(rng)}
            fr["left"] = _hand(rng, 0.62 + i * drift, 0.5) if rng.uniform() < p_left else None
            fr["right"] = _hand(rng, 0.38 - i * drift, 0.5) if rng.uniform() < p_right else None
            frames.append(fr)
        return frames

    cases["right_dominant_45"] = seq(45, 0.3, 0.9)
    cases["left_dominant_mirror_50"] = seq(50, 0.95, 0.2)
    cases["short_7"] = seq(7, 0.5, 0.5)
    cases["long_140"] = seq(140, 0.6, 0.7)
    both = seq(30, 1.0, 1.0)
    for i, fr in enumerate(both):  # tie on presence, left moves more -> mirror
        fr["left"] = _hand(rng, 0.62 + 0.02 * i, 0.5, s=0.01)
        fr["right"] = _hand(rng, 0.38, 0.5, s=0.01)
    cases["tie_left_moves_more"] = both
    nh = seq(20, 0.0, 0.0)
    cases["no_hands"] = nh
    cases["empty"] = []
    cases["single_frame"] = seq(1, 1.0, 1.0)
    pad = seq(40, 0.0, 0.8)
    for i in list(range(0, 8)) + list(range(33, 40)):  # idle frames at both ends get trimmed
        pad[i]["right"] = None
    cases["trim_idle_ends"] = pad
    bad = seq(25, 0.5, 0.8)
    bad[3]["pose"] = None
    bad[4]["pose"] = bad[4]["pose"][:10]  # short list -> treated as missing
    bad[5]["right"] = [[None, 0.1, 0.0]] + bad[5]["right"][1:] if bad[5]["right"] else None
    bad[6] = {"pose": bad[6]["pose"], "left": None}  # 'right' key absent
    cases["malformed_parts"] = bad
    still = _hand(rng, 0.4, 0.55, s=0.03)
    hold = []
    for i in range(50):  # still hands, then 15 frames of movement, then still again -> motion trim
        fr = {"pose": _body(rng), "left": None}
        dx = 0.01 * min(max(i - 18, 0), 15)
        fr["right"] = [[p[0] + dx + 1e-4 * rng.normal(), p[1] - dx, p[2]] for p in still]
        hold.append(fr)
    cases["idle_holds_motion_trim"] = hold
    nopose = seq(15, 0.4, 0.9)
    for fr in nopose:
        fr["pose"] = None
    cases["no_pose_at_all"] = nopose
    return cases


def run_node(path):
    res = subprocess.run(["node", os.path.join(HERE, "parity_node.mjs"), path], capture_output=True, text=True, check=True)
    return json.loads(res.stdout)


def check(path):
    cases = json.load(open(path))
    js = run_node(path)
    assert js["T"] == T and js["F"] == F, (js["T"], js["F"], T, F)
    worst = 0.0
    for name, frames in cases.items():
        py = to_features(frames)
        jf = np.array(js["cases"][name]["features"], dtype=np.float32)
        assert py.shape == jf.shape == (T * F,), (name, py.shape, jf.shape)
        d = float(np.abs(py - jf).max())
        worst = max(worst, d)
        assert d <= TOL, f"{name}: max abs diff {d}"
        assert abs(hand_presence(frames) - js["cases"][name]["presence"]) < 1e-9, name
    return len(cases), worst


def test_parity():
    if not os.path.exists(SYN):
        json.dump(make_synthetic(), open(SYN, "w"))
    total = []
    for p in (SYN, REAL):
        if os.path.exists(p):
            n, worst = check(p)
            total.append((os.path.basename(p), n, worst))
    return total


if __name__ == "__main__":
    if "--regen" in sys.argv or not os.path.exists(SYN):
        json.dump(make_synthetic(), open(SYN, "w"))
    for name, n, worst in test_parity():
        print(f"PASS {name}: {n} cases, max |py - js| = {worst:.2e} (tolerance {TOL})")

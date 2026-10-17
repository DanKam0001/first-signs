"""Fetch a few candidate clips per sign (one per signer, several signers) via HTTP Range from the indexed tars,
then score each with MediaPipe hands+pose.
Usage: python -I fetch_score.py <index.json> <raw_dir> <scores.json> <per_signer> sign...
"""
import json, os, sys, urllib.request, collections
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import cv2
import mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions

MP = "D:/datasets/popsign/mp"


def fetch(url, off, size, dst):
    if os.path.exists(dst) and os.path.getsize(dst) == size:
        return
    req = urllib.request.Request(url, headers={"Range": f"bytes={off}-{off + size - 1}"})
    for _ in range(5):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                data = r.read()
            if len(data) == size:
                open(dst, "wb").write(data)
                return
        except Exception:
            pass
    raise RuntimeError("fetch failed " + dst)


def signer_of(name):
    return os.path.basename(name).split("-")[0]


def make_landmarkers():
    h = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=f"{MP}/hand_landmarker.task"), num_hands=2,
        running_mode=vision.RunningMode.VIDEO))
    p = vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=f"{MP}/pose_landmarker_lite.task"),
        running_mode=vision.RunningMode.VIDEO))
    return h, p


def score(path):
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    h, p = make_landmarkers()
    rows, k = [], 0
    while True:
        ok, fr = cap.read()
        if not ok:
            break
        if k % 2 == 0:
            sm = cv2.resize(fr, (fr.shape[1] // 3, fr.shape[0] // 3))
            rgb = cv2.cvtColor(sm, cv2.COLOR_BGR2RGB)
            img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            ts = int(k * 1000 / fps)
            hr = h.detect_for_video(img, ts)
            pr = p.detect_for_video(img, ts)
            hands = [[(l.x, l.y) for l in hl] for hl in hr.hand_landmarks]
            pose = [(l.x, l.y, l.visibility) for l in pr.pose_landmarks[0]] if pr.pose_landmarks else None
            gray = cv2.cvtColor(sm, cv2.COLOR_BGR2GRAY)
            rows.append({"k": k, "hands": hands, "pose": pose, "bright": float(gray.mean()),
                         "contrast": float(gray.std())})
        k += 1
    cap.release(); h.close(); p.close()
    n = len(rows)
    has = [len(r["hands"]) > 0 for r in rows]
    edge = 0
    for r in rows:
        for hd in r["hands"]:
            a = np.array(hd)
            if (a.min() < 0.015) or (a.max() > 0.985):
                edge += 1
                break
    # wrist trajectory for motion span (frames where the hand moves away from rest)
    frac = sum(has) / max(1, n)
    idx = [i for i, x in enumerate(has) if x]
    first = idx[0] if idx else -1
    last = idx[-1] if idx else -1
    poses = [r["pose"] for r in rows if r["pose"]]
    frontal, shoulder_w, nose_c = 0.0, 0.0, 0.0
    if poses:
        P = np.array([[q[:2] for q in pp] for pp in poses])
        sw = np.abs(P[:, 11, 0] - P[:, 12, 0])
        mid = (P[:, 11, 0] + P[:, 12, 0]) / 2
        shoulder_w = float(np.median(sw))
        nose_c = float(np.median(np.abs(P[:, 0, 0] - mid) / np.maximum(sw, 1e-3)))  # 0 = nose centred
        frontal = float(np.median(P[:, 0, 0]))  # where the face sits horizontally
    return {"frames": k, "fps": fps, "sampled": n, "hand_frac": round(frac, 3), "edge_frac": round(edge / max(1, n), 3),
            "first_hand": rows[first]["k"] if first >= 0 else -1, "last_hand": rows[last]["k"] if last >= 0 else -1,
            "two_hand_frac": round(sum(len(r["hands"]) == 2 for r in rows) / max(1, n), 3),
            "pose_frac": round(len(poses) / max(1, n), 3), "shoulder_w": round(shoulder_w, 3),
            "nose_offset": round(nose_c, 3), "face_x": round(frontal, 3),
            "bright": round(float(np.mean([r["bright"] for r in rows])), 1),
            "contrast": round(float(np.mean([r["contrast"] for r in rows])), 1),
            "hand_tracks": [[r["k"], [[round(v, 3) for v in hd[0]] + [round(v, 3) for v in hd[9]] for hd in r["hands"]]]
                            for r in rows]}


def pick_candidates(members, per_signer):
    by = collections.defaultdict(list)
    for m in members:
        by[signer_of(m["name"])].append(m)
    out = []
    for s, ms in sorted(by.items()):
        ms = sorted(ms, key=lambda m: m["name"])
        # spread picks across the signer's session (middle first: warmed-up, not tired)
        order = [len(ms) // 2, len(ms) // 4, 3 * len(ms) // 4, 0, len(ms) - 1]
        seen = []
        for o in order:
            if ms[o] not in seen:
                seen.append(ms[o])
        out += seen[:per_signer]
    return out


def work(args):
    sign, entry, raw_dir, per_signer = args
    d = os.path.join(raw_dir, sign)
    os.makedirs(d, exist_ok=True)
    res = {}
    for m in pick_candidates(entry["members"], per_signer):
        fn = os.path.basename(m["name"])
        dst = os.path.join(d, fn)
        fetch(entry["url"], m["offset"], m["size"], dst)
        try:
            res[fn] = score(dst)
        except Exception as e:
            res[fn] = {"error": str(e)}
    return sign, res


if __name__ == "__main__":
    idx_path, raw_dir, out_path, per_signer = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
    signs = sys.argv[5:]
    idx = json.load(open(idx_path))
    out = json.load(open(out_path)) if os.path.exists(out_path) else {}
    todo = [s for s in signs if s in idx and s not in out]
    with ThreadPoolExecutor(6) as ex:
        for sign, res in ex.map(work, [(s, idx[s], raw_dir, per_signer) for s in todo]):
            out[sign] = res
            json.dump(out, open(out_path, "w"))
            print(sign, len(res), flush=True)

"""Rank scored PopSign candidates per sign and render review sheets (top N candidates x 8 frames over the hand span).
Usage: python -I rank_sheets.py <scores.json> <raw_dir> <sheet_dir> <ranking.json> [topN]
"""
import json, os, sys, subprocess
import cv2
import numpy as np


def quality(r):
    if "error" in r or r["sampled"] == 0:
        return -99, ["error"]
    notes, s = [], 0.0
    s += 3 * r["hand_frac"]
    s -= 6 * r["edge_frac"]
    if r["edge_frac"] > 0.1: notes.append("hand at edge")
    s -= 2 * max(0, 1 - r["pose_frac"])
    s -= 3 * max(0, r["nose_offset"] - 0.15)
    if r["nose_offset"] > 0.25: notes.append("turned")
    sw = r["shoulder_w"]
    if sw > 0.75: s -= 2 * (sw - 0.75) * 4; notes.append("too close")
    if sw < 0.3: s -= 2 * (0.3 - sw) * 4; notes.append("far")
    b = r["bright"]
    if b < 70: s -= (70 - b) / 20; notes.append("dark")
    if b > 190: s -= (b - 190) / 20; notes.append("bright")
    s += r["contrast"] / 100
    # complete sign: hands absent at both clip ends (rest out of frame) or at least sign not cut at the end
    if r["first_hand"] <= 1: s -= 0.5; notes.append("hands at start")
    if r["last_hand"] >= r["frames"] - 3: s -= 1.0; notes.append("hands at end")
    if r["first_hand"] < 0: s -= 5; notes.append("no hands")
    s -= 1.5 * abs(r["face_x"] - 0.5)
    return round(s, 3), notes


def strip(path, r, n=8, h=200):
    cap = cv2.VideoCapture(path)
    a = max(0, r["first_hand"] - 4); b = r["last_hand"] + 4 if r["last_hand"] > 0 else r["frames"] - 1
    b = min(b, r["frames"] - 1)
    ks = np.linspace(a, b, n).round().astype(int)
    tiles = []
    for k in ks:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(k))
        ok, fr = cap.read()
        if not ok:
            fr = np.zeros((1920, 1080, 3), np.uint8)
        w = int(fr.shape[1] * h / fr.shape[0])
        tiles.append(cv2.resize(fr, (w, h)))
    cap.release()
    return np.hstack(tiles)


if __name__ == "__main__":
    scores, raw, sheet_dir, out = sys.argv[1:5]
    top = int(sys.argv[5]) if len(sys.argv) > 5 else 4
    S = json.load(open(scores))
    os.makedirs(sheet_dir, exist_ok=True)
    rank = {}
    for sign, cands in S.items():
        lst = []
        for fn, r in cands.items():
            q, notes = quality(r)
            lst.append({"file": fn, "signer": fn.split("-")[0].split(".")[-1], "q": q, "notes": notes,
                        **{k: r.get(k) for k in ("hand_frac", "edge_frac", "two_hand_frac", "shoulder_w", "nose_offset",
                                                 "bright", "first_hand", "last_hand", "frames")}})
        lst.sort(key=lambda x: -x["q"])
        rank[sign] = lst
        rows = []
        for i, c in enumerate(lst[:top]):
            row = strip(os.path.join(raw, sign, c["file"]), cands[c["file"]])
            lab = f"{sign} #{i} s{c['signer']} q={c['q']} {' '.join(c['notes'])}"
            cv2.rectangle(row, (0, 0), (row.shape[1], 22), (0, 0, 0), -1)
            cv2.putText(row, lab, (4, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1)
            rows.append(row)
        if rows:
            wmax = max(r.shape[1] for r in rows)
            rows = [np.pad(r, ((0, 4), (0, wmax - r.shape[1]), (0, 0))) for r in rows]
            cv2.imwrite(os.path.join(sheet_dir, f"{sign}.jpg"), np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 80])
    json.dump(rank, open(out, "w"), indent=1)
    for sign, lst in rank.items():
        print(sign, [(c["signer"], c["q"]) for c in lst[:6]])

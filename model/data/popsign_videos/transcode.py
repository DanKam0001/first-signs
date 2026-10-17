"""Transcode chosen PopSign clips to small looping MP4s + poster JPGs, write videos.json, and a 40-up contact sheet.
Usage: python -I transcode.py <selection.json> <scores.json> <raw_dir> <out_dir> <labels.json>
selection.json: {sign: {"file": ..., "poster_t": optional fraction 0..1 of the trimmed clip}}
"""
import json, os, sys, subprocess
import cv2
import numpy as np

LEAD = 8      # frames of rest kept before the first / after the last detected hand (~0.27 s at 30 fps)
HEIGHT = 720
CRF = 27


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode:
        raise RuntimeError(p.stderr[-2000:])
    return p.stdout


if __name__ == "__main__":
    sel_p, scores_p, raw, out, labels_p = sys.argv[1:6]
    sel = json.load(open(sel_p)); S = json.load(open(scores_p))
    labels = json.load(open(labels_p))["labels"]
    os.makedirs(out, exist_ok=True)
    manifest = {}
    for sign in labels:
        if sign not in sel:
            print("MISSING", sign); continue
        c = sel[sign]; fn = c["file"]; r = S[sign][fn]
        src = os.path.join(raw, sign, fn)
        fps = r.get("fps") or 30  # some PopSign clips are 120 fps
        lead = int(round(c.get("lead_s", LEAD / 30) * fps))
        a = max(0, r["first_hand"] - lead) if r["first_hand"] >= 0 else 0
        b = min(r["frames"], r["last_hand"] + lead + int(fps / 15)) if r["last_hand"] >= 0 else r["frames"]
        a = c.get("start", a); b = c.get("end", b)
        dst = os.path.join(out, f"{sign}.mp4")
        vf = (f"trim=start_frame={a}:end_frame={b},setpts=PTS-STARTPTS,"
              f"scale=-2:{HEIGHT}:flags=lanczos:out_range=tv,fps=30,format=yuv420p")
        run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", vf, "-an", "-c:v", "libx264", "-preset", "slow",
             "-crf", str(c.get("crf", CRF)), "-profile:v", "main", "-level", "4.0", "-g", "30",
             "-movflags", "+faststart", "-map_metadata", "-1", dst])
        # poster: a frame inside the sign (default 45% through the hand span)
        pt = c.get("poster_t", 0.45)
        hk = r["first_hand"] + pt * (r["last_hand"] - r["first_hand"]) if r["first_hand"] >= 0 else (a + b) / 2
        t = max(0.0, (hk - a) / fps)
        # sharpest frame (Laplacian variance) within +-0.3 s of t, so the poster is not motion-blurred
        cap = cv2.VideoCapture(dst); frames = []
        while True:
            ok, fr = cap.read()
            if not ok:
                break
            frames.append(fr)
        cap.release()
        k0 = int(round(t * 30)); lo, hi = max(0, k0 - 9), min(len(frames), k0 + 10)
        best = max(range(lo, hi), key=lambda k: cv2.Laplacian(cv2.cvtColor(frames[k], cv2.COLOR_BGR2GRAY), cv2.CV_64F).var())
        best = c.get("poster_frame", best)
        cv2.imwrite(os.path.join(out, f"{sign}.jpg"), frames[best], [cv2.IMWRITE_JPEG_QUALITY, 85])
        info = json.loads(run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                               "stream=width,height,nb_frames,duration", "-of", "json", dst]))["streams"][0]
        signer = fn.split("-")[0]
        manifest[sign] = {"video": f"videos/{sign}.mp4", "poster": f"videos/{sign}.jpg",
                          "width": info["width"], "height": info["height"], "fps": 30,
                          "duration_s": round(float(info["duration"]), 2),
                          "bytes": os.path.getsize(dst),
                          "source": {"dataset": "PopSign ASL v1.0", "split": "game/test", "file": fn,
                                     "signer": signer, "source_fps": round(fps, 2), "trim_frames": [a, b]},
                          "credit": f"PopSign ASL v1.0 (Georgia Tech / DPAN), Deaf signer {signer}, CC BY 4.0"}
        if c.get("note"):
            manifest[sign]["note"] = c["note"]
        print(sign, signer, manifest[sign]["bytes"], manifest[sign]["duration_s"], flush=True)
    json.dump({"_note": "Real-video sign references. Clips trimmed and re-encoded from PopSign ASL v1.0 (CC BY 4.0). "
                        "See CREDITS.md.", "signs": manifest}, open(os.path.join(out, "videos.json"), "w"), indent=1)
    # contact sheet: 8 x 5 grid of posters with labels
    tiles = []
    for sign in labels:
        p = os.path.join(out, f"{sign}.jpg")
        im = cv2.imread(p) if os.path.exists(p) else np.zeros((720, 406, 3), np.uint8)
        w = int(round(im.shape[1] * 360 / im.shape[0]))
        im = cv2.resize(im, (w, 360))
        if w > 270:  # 3:4 sources: centre-crop to the 9:16 tile instead of squashing
            x0 = (w - 203) // 2; im = im[:, x0:x0 + 203]
        else:
            im = cv2.resize(im, (203, 360))
        cv2.rectangle(im, (0, 330), (203, 360), (0, 0, 0), -1)
        signer = manifest.get(sign, {}).get("source", {}).get("signer", "?").split(".")[-1]
        cv2.putText(im, f"{sign} ({signer})", (5, 352), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1)
        tiles.append(im)
    rows = [np.hstack(tiles[i:i + 8]) for i in range(0, len(tiles), 8)]
    cv2.imwrite(os.path.join(out, "contact_sheet.jpg"), np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 82])

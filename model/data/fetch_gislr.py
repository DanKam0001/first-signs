"""Download the GISLR (Kaggle `asl-signs`) landmark files we need, without a Kaggle login.

Source: the competition's own files are behind a rules click-through, so we fetch byte-identical
copies that are public Kaggle datasets. Kaggle serves public dataset files anonymously, one at a time:

    https://www.kaggle.com/api/v1/datasets/download/<owner>/<slug>/<url-encoded path>

(or the whole dataset as one zip without the path). Anonymous calls are rate limited: about
2 requests/s worked, more got HTTP 429 with Retry-After: 240. This script paces itself (--rate)
and honours Retry-After.

Mirrors (checked 2026-10-17):
  * carolineyyy/merged-islr-data  -> folder `asl-signs/` is the original competition layout
    (train.csv, sign_to_prediction_index_map.json, train_landmark_files/<pid>/<sid>.parquet).
  * najaf456ali/asl-100-google-slr -> raw parquet for 80 of the 250 signs, same layout.
    Spot checks (`--verify N`) download the same file from both and compare SHA-1.
  * sohier/461054610546105 ("ASL Isolated Sign Recognition Rerun Set", published by Kaggle staff,
    linked from the competition's data page) -> the hidden test set with labels: 10 signers who are
    NOT in train. `--rerun` fetches it; it is our fully independent held-out-signer test set.

Data licence: CC BY 4.0, "The dataset provided by Deaf Professional Arts Network and the Georgia
Institute of Technology" (competition Acknowledgements page + rules "DATA ACCESS AND USE: CC-BY 4.0").

Usage:
    python model/data/fetch_gislr.py --root D:/datasets/gislr --signs model/vocab_candidates.txt
    python model/data/fetch_gislr.py --root D:/datasets/gislr --signs model/vocab_final.txt --rerun
"""
import argparse
import hashlib
import os
import sys
import threading
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

API = "https://www.kaggle.com/api/v1/datasets/download/"
PRIMARY = ("carolineyyy/merged-islr-data", "asl-signs/")
SECONDARY = ("najaf456ali/asl-100-google-slr", "")
RERUN = ("sohier/461054610546105", "")

_local = threading.local()
_lock = threading.Lock()
_next_slot = [0.0]
_pause_until = [0.0]
RATE = [1.0]  # requests per second, shared by all threads


def session():
    if not hasattr(_local, "s"):
        _local.s = requests.Session()
    return _local.s


def _wait_turn():
    while True:
        with _lock:
            now = time.time()
            t = max(now, _next_slot[0], _pause_until[0])
            _next_slot[0] = t + 1.0 / RATE[0]
        if t > now:
            time.sleep(t - now)
        if time.time() >= _pause_until[0]:
            return


def url_for(mirror, path):
    ds, prefix = mirror
    return API + ds + "/" + urllib.parse.quote(prefix + path, safe="")


def fetch(mirror, path, dest, retries=8):
    tmp = dest + ".part"
    err = None
    for attempt in range(retries):
        try:
            _wait_turn()
            r = session().get(url_for(mirror, path), timeout=180, allow_redirects=True)
            if r.status_code == 429:
                wait = float(r.headers.get("Retry-After", 120)) + 5
                with _lock:
                    if _pause_until[0] < time.time():
                        print(f"429 from Kaggle, pausing {wait:.0f}s", flush=True)
                    _pause_until[0] = max(_pause_until[0], time.time() + wait)
                err = RuntimeError("HTTP 429")
                continue
            r.raise_for_status()
            data = r.content
            if path.endswith((".parquet", ".parqet")) and not (data[:4] == b"PAR1" and data[-4:] == b"PAR1"):
                raise ValueError(f"not a parquet file ({len(data)} bytes, starts {data[:15]!r})")
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(tmp, "wb") as f:
                f.write(data)
            os.replace(tmp, dest)
            return len(data)
        except Exception as e:  # noqa: BLE001
            err = e
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"{path}: {err}")


def download(mirror, todo, root, workers):
    done, failed, nbytes, t0 = 0, [], 0, time.time()
    with ThreadPoolExecutor(workers) as ex:
        futs = {ex.submit(fetch, mirror, p, os.path.join(root, p)): p for p in todo}
        for f in as_completed(futs):
            try:
                nbytes += f.result()
            except Exception as e:  # noqa: BLE001
                failed.append(str(e))
            done += 1
            if done % 250 == 0 or done == len(todo):
                el = time.time() - t0
                print(f"{done}/{len(todo)} files, {nbytes / 1e9:.2f} GB, {el / 60:.1f} min, {len(failed)} failed",
                      flush=True)
    return failed


def read_signs(path):
    return [s.strip() for s in open(path, encoding="utf-8") if s.strip() and not s.startswith("#")]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="D:/datasets/gislr")
    ap.add_argument("--signs", required=True, help="text file, one GISLR sign per line")
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--rate", type=float, default=1.5, help="Kaggle API requests per second")
    ap.add_argument("--verify", type=int, default=5, help="cross-mirror SHA-1 spot checks")
    ap.add_argument("--rerun", action="store_true", help="fetch the rerun (test) set instead of train")
    ap.add_argument("--meta-only", action="store_true", help="only fetch train.csv / rerun labels (-> meta/rerun.csv)")
    args = ap.parse_args()
    RATE[0] = args.rate

    import pandas as pd

    root = args.root
    meta = os.path.join(root, "meta")
    os.makedirs(meta, exist_ok=True)
    signs = read_signs(args.signs)

    if args.rerun:
        lab = os.path.join(meta, "rerun_labels.parquet")
        if not os.path.exists(lab):
            fetch(RERUN, "labels.parqet", lab)
        df = pd.read_parquet(lab)
        parts = df.path.str.split("/")
        df["participant_id"] = parts.str[1].astype(int)
        df["sequence_id"] = parts.str[2].str.replace(".parquet", "", regex=False).astype(int)
        df[["path", "participant_id", "sequence_id", "sign"]].to_csv(os.path.join(meta, "rerun.csv"), index=False)
        mirror = RERUN
    else:
        for name in ["train.csv", "sign_to_prediction_index_map.json"]:
            p = os.path.join(meta, name)
            if not os.path.exists(p):
                fetch(PRIMARY, name, p)
        df = pd.read_csv(os.path.join(meta, "train.csv"))
        mirror = PRIMARY
    if args.meta_only:
        print("metadata ready in", meta)
        return
    unknown = sorted(set(signs) - set(df.sign))
    if unknown:
        sys.exit(f"not GISLR signs: {unknown}")
    sub = df[df.sign.isin(signs)]
    todo = [p for p in sub.path if not os.path.exists(os.path.join(root, p))]
    print(f"{'rerun' if args.rerun else 'train'}: {len(signs)} signs, {len(sub)} sequences, {len(todo)} to download",
          flush=True)
    failed = download(mirror, todo, root, args.workers)
    if failed:
        with open(os.path.join(meta, "fetch_failed.txt"), "w") as f:
            f.write("\n".join(failed))
        print(f"FAILED {len(failed)} (see meta/fetch_failed.txt)")

    # provenance: the same file from an independent mirror must be byte-identical
    if args.verify and not args.rerun:
        najaf = os.path.join(meta, "najaf_train.csv")
        if not os.path.exists(najaf):
            fetch(SECONDARY, "train.csv", najaf)
        both = sub[sub.path.isin(set(pd.read_csv(najaf).path))].sample(frac=1, random_state=0).head(args.verify)
        for p in both.path:
            if not os.path.exists(os.path.join(root, p)):
                continue
            a = open(os.path.join(root, p), "rb").read()
            tmp = os.path.join(meta, "_verify.parquet")
            fetch(SECONDARY, p, tmp)
            b = open(tmp, "rb").read()
            same = hashlib.sha1(a).hexdigest() == hashlib.sha1(b).hexdigest()
            print(f"verify {p}: {'identical' if same else 'DIFFERENT'}")
            os.remove(tmp)


if __name__ == "__main__":
    main()

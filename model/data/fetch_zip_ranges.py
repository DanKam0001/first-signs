"""Fetch selected files out of a Kaggle dataset's zip WITHOUT downloading the whole zip.

Kaggle's anonymous download of a whole public dataset is a single API call that redirects to a
signed Google Cloud Storage URL. GCS supports HTTP Range requests, so we read the zip's central
directory from the end of the file and then fetch only the members we need, each with one range
request. Only ONE Kaggle API call is made, so the anonymous rate limit (HTTP 429) is not an issue.

  python model/data/fetch_zip_ranges.py --dataset carolineyyy/merged-islr-data --prefix asl-signs/ \
      --csv D:/datasets/gislr/meta/train.csv --signs model/vocab_candidates.txt --root D:/datasets/gislr
  python model/data/fetch_zip_ranges.py --dataset sohier/461054610546105 --prefix "" \
      --csv D:/datasets/gislr/meta/rerun.csv --signs model/vocab_candidates.txt --root D:/datasets/gislr
"""
import argparse
import io
import os
import struct
import sys
import threading
import time
import zipfile
import zlib
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

API = "https://www.kaggle.com/api/v1/datasets/download/"
_local = threading.local()


def sess():
    if not hasattr(_local, "s"):
        _local.s = requests.Session()
    return _local.s


def signed_url(dataset):
    for attempt in range(10):
        r = requests.get(API + dataset, allow_redirects=False, timeout=60)
        if r.status_code in (301, 302, 303, 307) and r.headers.get("Location"):
            return r.headers["Location"]
        wait = float(r.headers.get("Retry-After", 60)) + 5 if r.status_code == 429 else 10
        print(f"Kaggle answered {r.status_code}; retrying in {wait:.0f}s", flush=True)
        time.sleep(wait)
    sys.exit("could not get a download URL")


def get_range(url, start, end, retries=6):
    for attempt in range(retries):
        try:
            r = sess().get(url, headers={"Range": f"bytes={start}-{end}"}, timeout=120)
            if r.status_code == 206:
                return r.content
            raise RuntimeError(f"HTTP {r.status_code}")
        except Exception as e:  # noqa: BLE001
            err = e
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"range {start}-{end}: {err}")


class RangeFile(io.RawIOBase):
    """Seekable read-only file over HTTP range requests (only used to parse the central directory)."""

    def __init__(self, url):
        self.url = url
        r = requests.get(url, headers={"Range": "bytes=0-0"}, timeout=60)
        self.size = int(r.headers["Content-Range"].split("/")[-1])
        self.pos = 0
        self.cache = {}

    def seekable(self):
        return True

    def readable(self):
        return True

    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else self.pos + off if whence == 1 else self.size + off
        return self.pos

    def tell(self):
        return self.pos

    def readinto(self, b):
        n = min(len(b), self.size - self.pos)
        if n <= 0:
            return 0
        data = get_range(self.url, self.pos, self.pos + n - 1)
        b[:len(data)] = data
        self.pos += len(data)
        return len(data)


def fetch_member(url, zi, dest):
    head = 30 + len(zi.orig_filename.encode()) + 512
    buf = get_range(url, zi.header_offset, zi.header_offset + head + zi.compress_size)
    sig, = struct.unpack("<I", buf[:4])
    if sig != 0x04034B50:
        raise RuntimeError(f"{zi.filename}: bad local header")
    n, m = struct.unpack("<HH", buf[26:30])
    data = buf[30 + n + m:30 + n + m + zi.compress_size]
    if len(data) < zi.compress_size:  # very long extra field: fetch the rest
        data += get_range(url, zi.header_offset + len(buf), zi.header_offset + 30 + n + m + zi.compress_size - 1)
    if zi.compress_type == zipfile.ZIP_STORED:
        raw = data
    elif zi.compress_type == zipfile.ZIP_DEFLATED:
        raw = zlib.decompressobj(-15).decompress(data)
    else:
        raise RuntimeError(f"{zi.filename}: compression {zi.compress_type} not supported")
    if zlib.crc32(raw) & 0xFFFFFFFF != zi.CRC:
        raise RuntimeError(f"{zi.filename}: CRC mismatch")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest + ".part", "wb") as f:
        f.write(raw)
    os.replace(dest + ".part", dest)
    return len(raw)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", required=True)
    ap.add_argument("--prefix", default="")
    ap.add_argument("--csv", required=True, help="csv with path,sign columns")
    ap.add_argument("--signs", required=True)
    ap.add_argument("--root", default="D:/datasets/gislr")
    ap.add_argument("--workers", type=int, default=16)
    ap.add_argument("--url-file", default=None, help="file holding an already obtained signed URL")
    a = ap.parse_args()
    import pandas as pd

    signs = [s.strip() for s in open(a.signs, encoding="utf-8") if s.strip() and not s.startswith("#")]
    df = pd.read_csv(a.csv)
    need = [p for p in df[df.sign.isin(signs)].path if not os.path.exists(os.path.join(a.root, p))]
    print(f"{len(need)} files to fetch", flush=True)
    if not need:
        return
    url = open(a.url_file).read().strip() if a.url_file else signed_url(a.dataset)
    rf = RangeFile(url)
    print(f"zip is {rf.size / 1e9:.1f} GB; reading central directory", flush=True)
    zf = zipfile.ZipFile(io.BufferedReader(rf, buffer_size=4 << 20))
    infos = {zi.filename: zi for zi in zf.infolist()}
    print(f"{len(infos)} members", flush=True)
    missing = [p for p in need if a.prefix + p not in infos]
    if missing:
        print(f"WARNING {len(missing)} files not in zip, e.g. {missing[:3]}")
    jobs = [(infos[a.prefix + p], os.path.join(a.root, p)) for p in need if a.prefix + p in infos]
    t0, done, nb, failed = time.time(), 0, 0, []
    with ThreadPoolExecutor(a.workers) as ex:
        futs = [ex.submit(fetch_member, url, zi, dest) for zi, dest in jobs]
        for f in as_completed(futs):
            try:
                nb += f.result()
            except Exception as e:  # noqa: BLE001
                failed.append(str(e))
            done += 1
            if done % 500 == 0 or done == len(jobs):
                print(f"{done}/{len(jobs)} files, {nb / 1e9:.2f} GB, {(time.time() - t0) / 60:.1f} min, "
                      f"{len(failed)} failed", flush=True)
    if failed:
        print("FAILED:", *failed[:20], sep="\n  ")


if __name__ == "__main__":
    main()

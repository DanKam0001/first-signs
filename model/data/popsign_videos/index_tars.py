"""Walk PopSign per-sign tar files with HTTP Range reads and record (name, offset, size) for every member.
Usage: python index_tars.py <out_json> <split> sign1 sign2 ...
"""
import json, sys, os, urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = "https://signdata.cc.gatech.edu/data/popsign_v1_0/game/{split}/{sign}.tar"


def rng(url, a, b):
    req = urllib.request.Request(url, headers={"Range": f"bytes={a}-{b}", "User-Agent": "first-signs-indexer"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception as e:  # retry transient errors
            err = e
    raise err


def total_len(url):
    req = urllib.request.Request(url, method="HEAD")
    with urllib.request.urlopen(req, timeout=60) as r:
        return int(r.headers["Content-Length"])


def index(split, sign):
    url = BASE.format(split=split, sign=sign)
    n = total_len(url)
    off, out = 0, []
    while off + 512 <= n:
        h = rng(url, off, off + 511)
        if h.strip(b"\0") == b"":
            break
        name = h[0:100].split(b"\0")[0].decode()
        prefix = h[345:500].split(b"\0")[0].decode()
        if prefix:
            name = prefix + "/" + name
        size = int(h[124:136].split(b"\0")[0].strip() or b"0", 8)
        typ = h[156:157]
        if typ in (b"0", b"\0") and size > 0:
            out.append({"name": name, "offset": off + 512, "size": size})
        off += 512 + ((size + 511) // 512) * 512
    return sign, {"url": url, "len": n, "members": out}


if __name__ == "__main__":
    out_json, split, signs = sys.argv[1], sys.argv[2], sys.argv[3:]
    res = json.load(open(out_json)) if os.path.exists(out_json) else {}
    todo = [s for s in signs if s not in res]
    with ThreadPoolExecutor(12) as ex:
        for sign, r in ex.map(lambda s: index(split, s), todo):
            res[sign] = r
            print(sign, len(r["members"]), flush=True)
            json.dump(res, open(out_json, "w"), indent=1)

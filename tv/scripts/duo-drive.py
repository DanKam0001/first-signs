"""Sign Together (duo) flow test on the web build, keyboard only, against scripts/stub-server.js --fake-phone
(whose duo preds are scripted: 1 = camera-L ok / R miss, 2 = both ok, 3 = R out of view, then random).
Saves docs/duo-*.png.

  python -I scripts/duo-drive.py [--url http://127.0.0.1:8091] [--server ws://127.0.0.1:8790/ws]
"""
import argparse
import os
import sys
import time

from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument("--url", default="http://127.0.0.1:8091")
ap.add_argument("--server", default="ws://127.0.0.1:8790/ws")
ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "docs"))
args = ap.parse_args()
errors = []


def key(pg, k, n=1, wait=0.35):
    if k in ("Up", "Down", "Left", "Right"):
        k = "Arrow" + k
    for _ in range(n):
        pg.keyboard.press(k)
        time.sleep(wait)


def shot(pg, name):
    p = os.path.join(args.out, f"duo-{name}.png")
    pg.screenshot(path=p)
    print("saved", os.path.normpath(p))


def wait_for(pg, needles, timeout=15.0):
    t0 = time.time()
    while time.time() - t0 < timeout:
        body = pg.inner_text("body")
        for n in needles:
            if n in body:
                return n
        time.sleep(0.2)
    errors.append(f"none of {needles} appeared")
    print("MISSING", needles)
    return None


def attempt(pg, name, expect):
    key(pg, "Enter", wait=0.1)  # Go!
    time.sleep(1.0)
    shot(pg, f"{name}-countdown")
    time.sleep(3.0)
    shot(pg, f"{name}-recording")
    got = wait_for(pg, expect, 12)
    time.sleep(1.6)  # let the coach tip arrive
    shot(pg, f"{name}-result")
    return got


with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True, args=["--autoplay-policy=no-user-gesture-required"])
    pg = b.new_page(viewport={"width": 1920, "height": 1080})
    pg.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    pg.goto(f"{args.url}/?server={args.server}")
    wait_for(pg, ["Phone connected"], 20)
    time.sleep(0.5)
    key(pg, "Down")
    key(pg, "Right")
    shot(pg, "home-entry")
    key(pg, "Enter", wait=0.8)
    wait_for(pg, ["Standing on the LEFT"])
    shot(pg, "setup")
    key(pg, "Down", n=4)
    key(pg, "Enter", wait=1.5)
    wait_for(pg, ["Sign Together - sign 1 of 5"])
    time.sleep(1.5)
    shot(pg, "intro")

    # 1: need_two hint first, then camera-L (right player Dad) ok, camera-R (left player Mum) misses -> tip for Mum
    key(pg, "Enter", wait=0.1)
    time.sleep(0.8)
    if "needs two people" not in pg.inner_text("body"):
        errors.append("need_two hint not shown")
    shot(pg, "need-two")
    got = wait_for(pg, ["got it!"], 14)
    time.sleep(1.6)
    shot(pg, "r1-one-ok")
    body = pg.inner_text("body")
    if "Dad got it!" not in body or "Mum: almost" not in body:
        errors.append("round 1: expected 'Dad got it!' and 'Mum: almost'")
    if "Tip:" not in body and "Try this:" not in body:
        errors.append("round 1: no coach tip for the player who missed")

    key(pg, "Enter", wait=1.2)  # Next sign
    got = attempt(pg, "r2", ["You both got it!"])
    key(pg, "Enter", wait=1.2)
    got = attempt(pg, "r3", ["step into view"])
    if not got:
        errors.append("round 3: 'step into view' missing")
    if "Mum, step into view" not in pg.inner_text("body"):
        errors.append("round 3: banner should ask Mum to step into view")
    key(pg, "Enter", wait=1.2)
    attempt(pg, "r4", ["got it", "So close"])
    key(pg, "Enter", wait=1.2)
    attempt(pg, "r5", ["got it", "So close"])
    if "See scores" not in pg.inner_text("body"):
        errors.append("last round should offer 'See scores'")
    key(pg, "Enter", wait=1.5)
    wait_for(pg, ["wins this round", "tie"])
    time.sleep(0.6)
    shot(pg, "scoreboard")
    body = pg.inner_text("body")
    if "Mum" not in body or "Dad" not in body:
        errors.append("scoreboard missing a player")

    # Back works mid-round: Play again -> Back returns home
    key(pg, "Enter", wait=1.5)  # Play again
    wait_for(pg, ["sign 1 of 5"])
    key(pg, "Escape", wait=1.0)
    if "routine at a time" not in pg.inner_text("body"):
        errors.append("Back from Sign Together did not return home")
    b.close()

print("\nERRORS:" if errors else "\nDUO CHECKS PASSED")
for e in errors:
    print(" -", e)
sys.exit(1 if errors else 0)

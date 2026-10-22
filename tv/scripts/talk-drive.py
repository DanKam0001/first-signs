"""Drives "Talk with Baby" with the keyboard only (arrows = D-pad, Enter = OK, Escape = Back) against
scripts/stub-server.js --fake-phone, scripting each pred through the stub's /next-pred hook so every
branch is seen: a top-1 reply, a nudge + Show me, a top-3 reply, no hands, a skip and the summary.

  python -I scripts/talk-drive.py [--url http://localhost:8092] [--server ws://localhost:8790/ws]
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument("--url", default="http://localhost:8092")
ap.add_argument("--server", default="ws://localhost:8790/ws")
ap.add_argument("--out", default=os.path.join(HERE, "..", "docs"))
args = ap.parse_args()
os.makedirs(args.out, exist_ok=True)
http_base = re.sub(r"^ws", "http", args.server).rsplit("/ws", 1)[0]

# Scene prompts -> acceptable signs + pack, read from the source so the script follows the data.
src = open(os.path.join(HERE, "..", "src", "data", "talk.ts"), encoding="utf-8").read()
SCENES = {}
for m in re.finditer(r"pack: '([^']+)',\s*art: '[^']+',\s*prompt: '([^']+)',\s*accept: \[([^\]]*)\]", src):
    SCENES[m.group(2)] = {"pack": m.group(1), "accept": re.findall(r"'([^']+)'", m.group(3))}
model = open(os.path.join(HERE, "..", "src", "generated", "model.ts"), encoding="utf-8").read()
signs = json.loads(re.search(r"SIGNS_RAW: any\[\] = (\[[\s\S]*?\n\]);", model).group(1))
PACK_SIGNS = {}
for sg in signs:
    for p in sg.get("packs", []):
        PACK_SIGNS.setdefault(p, []).append(sg["id"])

errors = []


def shot(page, name):
    path = os.path.join(args.out, f"{name}.png")
    page.screenshot(path=path)
    print("saved", os.path.normpath(path))


def key(page, k, n=1, wait=0.35):
    if k in ("Up", "Down", "Left", "Right"):
        k = "Arrow" + k
    for _ in range(n):
        page.keyboard.press(k)
        time.sleep(wait)


def text(page):
    return page.inner_text("body")


def wait_for(page, needles, timeout=14.0):
    t0 = time.time()
    while time.time() - t0 < timeout:
        body = text(page)
        for n in needles:
            if n in body:
                return n
        time.sleep(0.2)
    errors.append(f"none of {needles!r} appeared")
    print("MISSING:", needles)
    return None


def queue(top=None, p=None, hands=True):
    q = []
    if top:
        q.append("top=" + ",".join(top))
    if p:
        q.append("p=" + ",".join(str(x) for x in p))
    if not hands:
        q.append("hands=0")
    urllib.request.urlopen(f"{http_base}/next-pred?{'&'.join(q)}", timeout=5).read()


def current_scene(page):
    body = text(page)
    for prompt, sc in SCENES.items():
        if prompt in body:
            return prompt, sc
    errors.append("could not find the current scene prompt on screen")
    return None, None


def focused_label(page):
    return page.evaluate(
        "() => { const els=[...document.querySelectorAll('div')].filter(d => getComputedStyle(d).backgroundColor === 'rgb(255, 255, 255)' && d.innerText && d.innerText.length < 40); return els.map(e => e.innerText.trim()).pop() || ''; }"
    )


def sign_and_wait(page, needles):
    key(page, "Enter", wait=0.2)
    return wait_for(page, needles)


REPLY = ["You signed"]
NUDGE = ["Good try! For this one"]
NOHANDS = ["couldn’t see your hands"]

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True, args=["--autoplay-policy=no-user-gesture-required"])
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("console", lambda m: m.type == "error" and "favicon" not in (m.location or {}).get("url", "") and errors.append(f"console: {m.text}"))
    urllib.request.urlopen(f"{http_base}/next-pred?clear=1", timeout=5).read()
    page.goto(f"{args.url}/?server={args.server}&screen=home")
    wait_for(page, ["Phone connected"])
    time.sleep(0.8)

    # Home: Down until a menu-row button has focus (the pack grid may have 1 or 2 rows), then Right to it.
    for _ in range(4):
        if focused_label(page) in ("★  Family round", "Sign Together", "Talk with Baby", "Progress"):
            break
        key(page, "Down")
    for _ in range(8):
        if "Talk with Baby" in focused_label(page):
            break
        key(page, "Right")
    if "Talk with Baby" not in focused_label(page):
        errors.append(f"expected focus on Talk with Baby, got {focused_label(page)!r}")
    shot(page, "talk-00-home-entry")
    key(page, "Enter", wait=1.0)
    wait_for(page, ["Which moments?"])
    time.sleep(0.5)
    shot(page, "talk-01-intro")
    key(page, "Enter", wait=1.2)  # Mix it up

    # Scene 1: top-1 is an acceptable answer -> reply.
    wait_for(page, ["Scene 1 of 5"])
    time.sleep(0.8)
    shot(page, "talk-02-scene")
    prompt, sc = current_scene(page)
    print("scene 1:", prompt, sc)
    queue([sc["accept"][0]], [0.83])
    key(page, "Enter", wait=0.2)
    time.sleep(3.6)
    shot(page, "talk-03-recording")
    wait_for(page, REPLY)
    time.sleep(1.0)
    shot(page, "talk-04-reply")
    key(page, "Enter", wait=1.0)  # Next scene

    # Scene 2: a confident wrong sign from the same pack -> nudge, then Show me, then a top-3 answer.
    wait_for(page, ["Scene 2 of 5"])
    time.sleep(0.6)
    prompt, sc = current_scene(page)
    print("scene 2:", prompt, sc)
    wrong = next(x for x in PACK_SIGNS[sc["pack"]] if x not in sc["accept"])
    queue([wrong, sc["accept"][0]], [0.7, 0.12])  # acceptable sign in top-3 but p < 0.25: still a nudge
    if sign_and_wait(page, NUDGE + REPLY) != NUDGE[0]:
        errors.append("scene 2: expected a nudge")
    time.sleep(0.6)
    shot(page, "talk-05-nudge")
    key(page, "Right")
    key(page, "Enter", wait=1.5)  # Show me
    if "Show me:" not in text(page):
        errors.append("Show me did not reveal the reference video")
    shot(page, "talk-06-showme")
    key(page, "Left")
    alt = sc["accept"][-1]
    queue([wrong, alt], [0.55, 0.31])  # top-3 with p >= 0.25 -> accepted
    if sign_and_wait(page, NUDGE[:0] + REPLY) != REPLY[0]:
        errors.append("scene 2: top-3 answer was not accepted")
    time.sleep(0.8)
    shot(page, "talk-07-reply-top3")
    key(page, "Enter", wait=1.0)

    # Scene 3: no hands in the window -> gentle prompt, then Skip.
    wait_for(page, ["Scene 3 of 5"])
    time.sleep(0.6)
    prompt, sc = current_scene(page)
    print("scene 3:", prompt, sc)
    queue([sc["accept"][0]], [0.9], hands=False)
    key(page, "Enter", wait=0.2)
    time.sleep(3.8)
    shot(page, "talk-08-nohands-recording")
    if wait_for(page, NOHANDS + REPLY) != NOHANDS[0]:
        errors.append("scene 3: expected the no-hands message")
    time.sleep(0.4)
    shot(page, "talk-08-nohands")
    key(page, "Right", n=2)
    key(page, "Enter", wait=1.0)  # Skip

    # Scenes 4 and 5: straight answers.
    for n in (4, 5):
        wait_for(page, [f"Scene {n} of 5"])
        time.sleep(0.6)
        prompt, sc = current_scene(page)
        print(f"scene {n}:", prompt, sc)
        queue([sc["accept"][0]], [0.77])
        if sign_and_wait(page, REPLY + NUDGE) != REPLY[0]:
            errors.append(f"scene {n}: expected a reply")
        time.sleep(0.6)
        key(page, "Enter", wait=1.2)

    wait_for(page, ["Lovely chatting!"])
    time.sleep(1.6)
    shot(page, "talk-09-summary")
    body = text(page)
    if "skipped" not in body:
        errors.append("summary does not show the skipped scene")
    if "You used 4 signs" not in body:
        errors.append("summary count is not 4 signs")

    banned = [w for w in ("translat", "interpret") if w in body.lower()]
    if banned:
        errors.append(f"banned words on screen: {banned}")

    # Home from the summary, then Back from the intro returns home too.
    key(page, "Right", n=2)
    key(page, "Enter", wait=1.0)
    wait_for(page, ["routine at a time"])
    browser.close()

print("\nERRORS:" if errors else "\nALL CHECKS PASSED")
for e in errors:
    print(" -", e)
sys.exit(1 if errors else 0)

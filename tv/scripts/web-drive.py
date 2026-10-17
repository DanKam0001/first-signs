"""Drives the exported web build with the keyboard only (arrows = D-pad, Enter = OK, Escape = Back)
against scripts/stub-server.js --fake-phone, and saves screenshots to docs/.

  python -I scripts/web-drive.py [--url http://127.0.0.1:8091] [--server ws://127.0.0.1:8790/ws]
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
os.makedirs(args.out, exist_ok=True)

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


def expect(page, needle, timeout=8.0):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if needle in text(page):
            return True
        time.sleep(0.2)
    errors.append(f"expected text not found: {needle!r}")
    print("MISSING:", needle)
    return False


with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True, args=["--autoplay-policy=no-user-gesture-required"])
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("console", lambda m: m.type == "error" and "favicon" not in (m.location or {}).get("url", "") and errors.append(f"console: {m.text}"))
    page.goto(f"{args.url}/?server={args.server}")

    # 1. Pair screen with QR + code, then the fake phone pairs and we land on Home.
    expect(page, "Connect a phone")
    expect(page, "or enter code")
    shot(page, "01-pair")
    expect(page, "First Signs", timeout=12)
    expect(page, "Phone connected")
    time.sleep(0.6)
    shot(page, "02-home")

    # 2. Home -> Mealtime pack (first card has default focus) -> first sign lesson.
    key(page, "Right")
    shot(page, "03-home-focus-bedtime")
    key(page, "Left")
    key(page, "Enter", wait=0.8)
    expect(page, "Mealtime")
    shot(page, "04-pack-mealtime")
    key(page, "Enter", wait=1.2)
    expect(page, "Your turn")
    time.sleep(1.0)
    shot(page, "05-lesson-watch")

    # 3. Your turn: countdown -> recording -> pred. Fake phone: misses are followed by a success.
    key(page, "Enter", wait=0.2)
    time.sleep(1.0)
    shot(page, "06-lesson-countdown")
    time.sleep(2.6)
    shot(page, "07-lesson-recording")
    t0 = time.time()
    while time.time() - t0 < 10 and not ("You signed" in text(page) or "Almost!" in text(page)):
        time.sleep(0.2)
    time.sleep(1.2)
    body = text(page)
    shot(page, "08-lesson-result-ok" if "You signed" in body else "08-lesson-result-miss")
    if "Almost!" in body:
        expect(page, "Tip:")
        shot(page, "08b-lesson-tip")
        key(page, "Enter", wait=0.2)  # Try again
        t0 = time.time()
        while time.time() - t0 < 12 and "You signed" not in text(page):
            time.sleep(0.2)
        time.sleep(0.3)
        shot(page, "09-lesson-result-ok")
    expect(page, "You signed")

    # 4. Back works: lesson -> pack -> home.
    key(page, "Escape", wait=0.8)
    expect(page, "Pick a sign")
    key(page, "Escape", wait=0.8)
    expect(page, "routine at a time")

    # 5. Family round: Down to the menu row, first button is Family round.
    key(page, "Down")
    shot(page, "10-home-menu-focus")
    key(page, "Enter", wait=0.8)
    expect(page, "Who's playing?")
    shot(page, "11-game-setup")
    # Down x3 -> pack row ... just start with defaults: move down to the Start row.
    key(page, "Down", n=5)
    key(page, "Enter", wait=1.0)
    expect(page, "Turn 1 of")
    shot(page, "12-game-turn")
    key(page, "Right")
    key(page, "Enter", wait=0.8)  # Show me first
    shot(page, "13-game-peek")
    key(page, "Left")
    key(page, "Enter", wait=0.2)  # Go!
    t0 = time.time()
    while time.time() - t0 < 12 and not ("Yes! +" in text(page) or "Good try!" in text(page)):
        time.sleep(0.2)
    time.sleep(0.4)
    shot(page, "14-game-result")
    # play out the remaining turns quickly via Skip/Next
    for _ in range(12):
        body = text(page)
        if "Round over!" in body:
            break
        if "Next:" in body or "See scores" in body:
            key(page, "Enter", wait=0.8)
        else:
            key(page, "Right", n=2)
            key(page, "Enter", wait=0.8)  # Skip
            key(page, "Left", n=3)
    expect(page, "Round over!")
    time.sleep(0.5)
    shot(page, "15-game-over")
    key(page, "Right")
    key(page, "Enter", wait=0.8)  # Home

    # 6. Progress, About, Settings via the menu row.
    expect(page, "routine at a time")
    key(page, "Down")
    key(page, "Right")
    key(page, "Enter", wait=0.8)
    expect(page, "Your progress")
    shot(page, "16-progress")
    key(page, "Escape", wait=0.8)
    key(page, "Down")
    key(page, "Right", n=3)
    key(page, "Enter", wait=0.8)
    expect(page, "Deaf-led ASL class")
    shot(page, "17-about")
    key(page, "Escape", wait=0.8)
    key(page, "Down")
    key(page, "Right", n=4)
    key(page, "Enter", wait=0.8)
    expect(page, "Server address")
    shot(page, "18-settings")
    key(page, "Escape", wait=0.8)
    expect(page, "routine at a time")

    # 7. Reload: progress persisted.
    page.reload()
    expect(page, "learned")
    time.sleep(5)
    body = text(page)
    if "1 of" not in body and "2 of" not in body:
        errors.append("progress did not persist across reload")
    shot(page, "19-home-after-reload")

    banned = [w for w in ("translat", "interpret") if w in text(page).lower()]
    if banned:
        errors.append(f"banned words on screen: {banned}")
    browser.close()

print("\nERRORS:" if errors else "\nALL CHECKS PASSED")
for e in errors:
    print(" -", e)
sys.exit(1 if errors else 0)

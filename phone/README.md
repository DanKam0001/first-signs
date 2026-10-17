# First Signs phone camera page

A single mobile web page for a phone on a stand. It runs MediaPipe hand and pose tracking on the phone, streams
landmark frames to the TV, and when the TV asks for an attempt it counts down, records a short window, runs the sign
model on the phone and sends back the result. **Video never leaves the phone**: only landmark points are sent.

No build step: plain ES modules, served by `server/` at `/p/<code>` (the page) and `/phone/*` (its files).

## Run it

See `server/README.md`. In short: `cd server && npm install && npm run live`, open
`http://localhost:8788/tools/fake_tv.html`, then scan its QR code with the phone (or open `https://<tunnel>/p/<code>`).
The page needs HTTPS for the camera, which the cloudflared tunnel provides. `http://localhost` also works on the PC.

URL options: `?stub=1` forces the stub model, `?debug=1` shows fps and timing, `?camera=back` starts on the back
camera, `?fps=18` sets the frame rate, `?autostart=1` starts the camera without the button (used by tests).

## What it does

1. Shows a big "Start camera" button (the browser's camera prompt follows). Front/back camera toggle and a small
   self-view with the skeleton drawn on it, so the user can frame themselves. The self-view is mirrored for the front
   camera only; the frames sent are never mirrored. Keeps the screen awake with the Wake Lock API.
2. Runs `HandLandmarker` (2 hands) and `PoseLandmarker` (lite) from `@mediapipe/tasks-vision@0.10.14` (jsDelivr), GPU
   delegate with a CPU fallback, at 18 fps by default, and sends PROTOCOL §1 `frame` messages: unmirrored normalized
   image coordinates, pose points 0..24 with visibility, `left`/`right` as the signer's anatomical hands. Coordinates
   are rounded to 4 decimals on the wire; the on-phone model gets full precision. Every frame carries the optional
   `aspect` (video width / height, e.g. 0.5625 for portrait 720x1280), read from the video element on every frame, so it
   follows a camera switch or rotation at once.
3. Sends `phone_state`: `ready` (a hand seen in the last second), `no_hands`, `countdown`, `recording`, `thinking`.
4. On `attempt`: full-screen countdown, then "Sign now" with a progress bar for `windowMs`, then runs the model and sends
   one `pred`. `cancel` with the same id stops it.
5. Reconnects automatically (backoff 0.5 s to 5 s) and re-sends `hello`. A `pred` made while offline is queued.
   `bad_code` shows "This code has expired, scan the new QR code".

## The sign model (PROTOCOL §2, §3)

The page loads `/model/signs.json`, `/model/preprocess.js`, `/model/labels.json` (optional) and `/model/model.onnx`. The
server serves `model/export/<file>` when it exists and `phone/stub/<file>` otherwise. **Swapping in the real model needs
no code change**: put the files in `model/export/` and reload the page.

- If `model.onnx` is missing, or the URL has `?stub=1`, a **stub model** returns random logits, and the page shows an
  orange "STUB MODEL: random guesses" badge. `/healthz` on the server says which files are real.
- Real model: `onnxruntime-web@1.20.1` (jsDelivr, WASM backend, 1 thread), input `float32[1, T, F]` from
  `toFeatures(frames)`, first output = logits. Labels come from `labels.json` (`{"labels": [...]}` or an array), else
  from the order of the signs in `signs.json`.
- Logits are masked to the attempt's pack (plus the target) before the softmax. `ok` = target in the top `topK` AND
  p(target) >= `minProb` AND at least one hand in >= `minHandFrac` of the window frames. The thresholds come from
  `signs.json` `_thresholds` (defaults 3 / 0.25 / 0.4). `signs.json` may be an array or `{ "_thresholds", "signs": [...] }`.

## Handedness

`left`/`right` in a frame must be the signer's **anatomical** hands. The rule, in `lib/hands.js`:

1. **Pose wrists first.** When the pose's wrists are visible, each hand goes to the nearer pose wrist (pose 15 = the
   signer's left wrist, 16 = right). With two hands, the pairing with the smaller total distance wins. This is how
   MediaPipe Holistic assigns hands, and Holistic produced the GISLR training data, so the phone matches the training
   data by construction.
2. **Fallback: MediaPipe's handedness label, unswapped.** MediaPipe's docs say the label assumes a mirrored selfie
   image, which suggests a swap for our raw frames. Measured, it doesn't need one: on `tasks-vision@0.10.14` with raw,
   unmirrored frames of a signer (a public-domain CDC ASL clip played as Chrome's fake camera), the raw label agreed with
   the pose-wrist assignment in 626 of 634 hand-frames. The pose-assigned right hand was on the image's left (where a
   signer's right hand appears in an unmirrored front view) in 293 of 293 two-hand frames. If a future tasks-vision
   version flips this, set `LABEL_SWAP = true` in `lib/hands.js`.
3. If both hands end up with the same label, the more confident one keeps it.

The page keeps checking this: `window.__firstSigns.handedness` counts agree/disagree between rules 1 and 2. Unit tests
are in `phone/test/phone.test.js` (run with `npm test` in `server/`).

## Files

- `index.html`, `style.css`, `app.js`: the page.
- `lib/hands.js`: handedness rule. `lib/frame.js`: MediaPipe result to `frame`. `lib/verdict.js`: masked softmax,
  `ok`, `pred`. `lib/signs.js`: `signs.json` parsing (also used by the server). `lib/model.js`: loads the bundle, real or
  stub. `lib/conn.js`: WebSocket with reconnect. `lib/draw.js`: skeleton drawing (also used by the fake TV).
- `stub/`: the stub `preprocess.js` and a fixture `signs.json`. Its descriptions are placeholders marked
  `"verified": false`, never real sign descriptions.

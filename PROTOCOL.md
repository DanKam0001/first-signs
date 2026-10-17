# First Signs: shared contracts (every component follows these exactly)

## 1. WebSocket messages (JSON, one object per message)
Server URL: `wss://<host>/ws`. In dev, `<host>` is the cloudflared tunnel host. The TV can also connect over plain `ws://` on the LAN.

Pairing
- TV -> server: `{"type":"hello","role":"tv"}`
- server -> TV: `{"type":"room","code":"4821","phoneUrl":"https://<host>/p/4821"}`. The TV renders `phoneUrl` as a QR code and also shows the 4 digits.
- phone -> server: `{"type":"hello","role":"phone","code":"4821"}`. The phone page reads the code from its own URL path.
- server -> both: `{"type":"paired"}`. If either side disconnects: `{"type":"peer_left","role":"phone"|"tv"}`.
- A bad or expired code: server -> phone: `{"type":"error","error":"bad_code"}`.

Relayed phone -> TV (the server forwards unchanged)
- `{"type":"frame","t":<ms since epoch>,"pose":[[x,y,z,v] x 25] | null,"left":[[x,y,z] x 21] | null,"right":[[x,y,z] x 21] | null}`
  - Coordinates are MediaPipe normalized **image** coordinates as the camera sees them: **not mirrored**, x and y in 0..1, z relative.
    `pose` holds pose landmarks 0..24 (upper body), each with visibility v.
  - `left` and `right` are the **signer's** anatomical hands. MediaPipe tasks-vision reports handedness for the mirrored
    selfie view, so the phone swaps the labels if needed. Document the rule in phone/README.
  - Sent at 15-20 fps. The TV mirrors the drawing so it reads like a mirror.
  - Optional `"aspect": <camera width / height>`, e.g. 0.5625 for a portrait 720x1280 phone camera. The phone includes it
    in every frame. The TV uses it to draw the skeleton in the right proportions, and assumes 0.75 if it's missing.
    `refs/<id>.json` carries the same field at the top level (source-video aspect if known, else omitted).
  - Optional `"code"` in `hello` lets a TV that reconnects reclaim its room (a server extension, documented in server/README.md).
- `{"type":"pred","id":"<attempt id>","target":"milk","top":[["milk",0.82],["more",0.07],["drink",0.03]],"ok":true}`
  - Sent once per attempt, after the window closes. `ok` is the phone's verdict (see §3).
- `{"type":"phone_state","state":"ready"|"no_hands"|"countdown"|"recording"|"thinking"}`

Relayed TV -> phone
- `{"type":"attempt","id":"<uuid>","target":"milk","pack":"mealtime","countdownMs":3000,"windowMs":2500}`
  - Tells the phone to count down, record a window of frames, run the model, and reply with a `pred`.
- `{"type":"cancel","id":"<uuid>"}`

TV -> server (handled by the server, not relayed)
- `{"type":"speak","id":"<req id>","text":"Your turn. Sign milk."}` -> `{"type":"audio","id":"<req id>","url":"https://<host>/tts/<sha1>.mp3"}`
  (Polly neural voice, cached by the sha1 of voice+text).
- `{"type":"coach","id":"<req id>","target":"milk","top":[...],"attempts":2}` -> `{"type":"coach_text","id":"<req id>","text":"..."}`
  - Bedrock writes a short, warm tip of 2 sentences or fewer, built from the sign's description in `signs.json`. It never invents sign descriptions.

## 2. Model bundle (produced by model/, consumed by phone/ and tv/)
`model/export/` contains:
- `model.onnx`: input `float32[1, T, F]`, output logits over `labels`. T and F are fixed by `preprocess.js`.
- `preprocess.js`: an ES module that exports `toFeatures(frames) -> Float32Array` (length T*F) and the constants `T` and `F`.
  - `frames` is an array of the `frame` objects from §1, with `left`/`right`/`pose`.
  - **The same code path** is used in Python training: the python preprocessing must be ported line for line and
    unit-tested against the JS on the same fixture, with outputs matching to 1e-4.
- `signs.json`: `[{ "id":"milk", "label":"milk", "packs":["mealtime"], "description":"Squeeze an open hand into a fist twice, like milking.", "credit":"Reference: GISLR (D-PAN / Google), CC BY 4.0" }]`
  - Descriptions must be written from reliable sources and checked. Mark any unverified description `"verified": false`.
- `refs/<id>.json`: one reference performance for each sign, `{ "fps": 30, "frames": [ <frame objects as in §1 without t> ] }`,
  chosen as a clean, typical example from the dataset. Hands and pose only. Never face landmarks.
- `metrics.json`: held-out-signer accuracy (top-1, top-3, per sign), the confusion pairs, and the dataset/split description.

## 3. Attempt verdict (phone)
`ok = target is in the top-3 AND p(target) >= 0.25 AND at least one hand was present in >= 40% of the window frames`.
The thresholds live in `signs.json` -> `"_thresholds"` so they can be tuned without code changes.
Inference runs over the **pack's signs only**: logits are masked to the current pack before the softmax.

## 4. Ports (dev)
- server: `http://localhost:8788`, set with `PORT`. Don't use 8787: Hackathon HQ's dashboard uses it.
- The phone page is served by the server at `/p/:code`. The static assets are at `/phone/*`.

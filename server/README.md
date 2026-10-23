# First Signs server

The relay between the phone camera page and the Fire TV app. It pairs them with a 4-digit code, relays landmark
frames and attempt results, speaks prompts with Amazon Polly, and writes coaching tips with Amazon Bedrock.
`PROTOCOL.md` at the repo root is the contract; this server implements §1 and §4.

## Run it (Windows 11, Node 20+)

```powershell
cd server
npm install
npm run live        # cloudflared quick tunnel + server in one terminal (recommended)
```

`npm run live` starts a cloudflared quick tunnel to `http://localhost:8788`, prints the `https://*.trycloudflare.com`
URL, and starts the server with `PUBLIC_URL` set to it. Then:

- **Fake TV** (stands in for the Fire TV app): open `http://localhost:8788/tools/fake_tv.html`. It shows the code and a QR code.
- **Phone:** scan the QR code, or open `https://<tunnel>/p/<code>`. The camera needs HTTPS, which is what the tunnel is for.
- **Real TV:** connect to `ws://<PC LAN IP>:8788/ws` (printed at startup) or `wss://<tunnel>/ws`.

To run the pieces separately, use two terminals: `npm run dev` (server, restarts on changes in `src/`) and
`npm run tunnel`. The tunnel script writes its URL to `server/.public_url`, and the server reads that file whenever it
builds a `phoneUrl`, so the order doesn't matter. The quick-tunnel URL changes every time the tunnel restarts.

| Command | What it does |
|---|---|
| `npm run live` | tunnel + server |
| `npm run dev` | server only, with file watching |
| `npm run tunnel` | tunnel only, writes `server/.public_url` |
| `npm test` | pairing/relay tests and the phone's pure-logic tests (`node --test`, no AWS calls) |
| `npm run e2e` | end-to-end: a Node "TV" pairs, Chrome opens the phone page through the tunnel with the webcam, frames and latency are measured, one attempt is sent. Flags: `--headful`, `--video clip.mjpeg` (fake camera from a file), `--tv-base http://localhost:8788` (TV over LAN), `--reconnect`, `--seconds N` |
| `npm run smoke:aws` | one Polly call and one Bedrock call, to check AWS access |
| `GET /healthz` | JSON status: rooms, public URL, which model files are real or stub, Polly/Bedrock status, relay counters |

## Settings (environment variables)

| Var | Default | |
|---|---|---|
| `PORT` | `8788` | 8787 is taken by Hackathon HQ |
| `PUBLIC_URL` | from `server/.public_url` | https base URL the phone uses; falls back to the origin the TV connected through |
| `AWS_PROFILE` | `default` | the AWS CLI profile with Polly + Bedrock access |
| `AWS_REGION` | `us-east-1` | |
| `POLLY_VOICE` | `Danielle` | neural en-US; falls back to `Joanna` if the voice is rejected |
| `BEDROCK_MODEL_ID` | tries `us.amazon.nova-micro-v1:0`, `amazon.nova-micro-v1:0`, `us.amazon.nova-lite-v1:0`, `amazon.nova-lite-v1:0` | the first that works is kept and logged |
| `MAX_SPEAK_PER_HOUR` / `MAX_COACH_PER_HOUR` | 300 / 120 | caps on requests across all rooms |
| `DISABLE_AWS` | unset | `1` = never call AWS (tests) |
| `MODEL_DIR` | `../model/export` | the model bundle |

## Routes

- `wss://<host>/ws`: the WebSocket protocol (PROTOCOL §1).
- `/p/:code`: the phone page. `/phone/*`: its static files.
- `/model/*`: the model bundle. It serves `model/export/<file>` if it exists, else `phone/stub/<file>`, so the real
  model replaces the stub with no code change. `/healthz` shows which is in use.
- `/tts/<sha1>.mp3`: cached Polly audio. `/tools/*`: dev tools (the fake TV).

## How AWS is used

- **Amazon Polly** (`SynthesizeSpeech`, neural engine, voice `Danielle`): the TV sends `speak`, and the server returns
  `{"type":"audio","url":"https://<host>/tts/<sha1>.mp3"}`. Every mp3 is cached on disk under `server/cache/tts/`, keyed
  by `sha1(voice + text)`, so each phrase is synthesized once. Text is capped at 300 characters.
- **Amazon Bedrock** (Converse API, Amazon Nova Micro, falling back to Nova Lite): the TV sends `coach` after a missed
  attempt, and the server returns a tip of 2 sentences or fewer. The prompt contains only the target sign's description
  from `model/export/signs.json` (and the description of the sign it was confused with), and tells the model never to add
  anything. Descriptions marked `"verified": false` are never used. Tips are cached under `server/cache/coach/`
  (attempt counts are bucketed to 1, 2, 3+), so a tip is generated once per (sign, confused-with, attempt) combination.
- **If AWS fails:** `speak` answers `{"type":"audio","id":...,"url":null,"error":"tts_failed"}` (the TV should show the
  text instead), and `coach` answers with a canned tip built from the same verified description. The error is logged
  and shown in `/healthz`. Bedrock is not retried for 10 minutes after a failure.
- Only a socket that said `hello` as a TV can send `speak` or `coach`.

## AWS permissions

As of 2026-10-17 the your IAM user IAM user is **not allowed** to call Polly or Bedrock
(`AccessDeniedException: no identity-based policy allows polly:SynthesizeSpeech / bedrock:InvokeModel`). To fix it,
an account admin (the root user or an IAM admin, not this key) must:

1. Open the IAM console > **Users** > your IAM user > **Permissions** tab > **Add permissions** > **Create inline policy**.
2. Choose the **JSON** editor, paste the contents of `server/iam-policy.json`, then **Next**.
3. Name it `FirstSignsPollyBedrock` and select **Create policy**.
4. Only if Bedrock still says access is denied for the model itself: Bedrock console (us-east-1) > **Model access**,
   and enable **Amazon Nova Micro** and **Nova Lite**. (Amazon's own models normally need no request.)
5. Run `npm run smoke:aws`. It should print `POLLY OK` and `BEDROCK OK model=...`.

## Protocol extensions (PROTOCOL §1 points here; none of them change existing messages)

- **Room reclaim:** `{"type":"hello","role":"tv","code":"4821"}`. If room 4821 still exists (not idle-expired) and has no
  TV attached, this TV gets it back: same `room` message and code, and `paired` to both sides if the phone is still there.
  Otherwise the TV simply gets a new room. Use it on every TV reconnect, with the last code you were given.
- If a second phone joins a room, it replaces the first, which is closed with WebSocket code 4000.
- Rooms expire after 30 minutes with no messages. A TV still connected then gets a fresh `room` message with a new code,
  and a connected phone gets `{"type":"error","error":"bad_code"}`.
- **Ping/pong:** either side may send `{"type":"ping","t0":<your clock ms>}`. The server answers that socket only, with
  `{"type":"pong","t0":<echoed>,"ts":<server Date.now()>}`. Round trip = now - t0, and clock offset to the server is
  about ts - (t0 + now) / 2, so the TV can turn a frame's phone-clock `t` into a lag estimate when both sides ping.
- Frames are dropped (never preds) if the TV socket has more than 512 KB queued, so a slow TV link doesn't build lag.
- Errors: `bad_code`, `bad_message` (not JSON), `bad_role`, `tv_only`, `unexpected_type`.

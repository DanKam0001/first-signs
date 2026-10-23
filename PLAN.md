# First Signs: build plan (Amazon Build, Ship, Shape, Fire TV track)

**What it is:** a Fire TV app that helps hearing families learn the first ASL words for their Deaf baby or toddler, together,
on the living-room TV. You put a phone on a stand as the camera. The TV shows how a real Deaf signer makes the sign,
counts you in, and watches you sign it. It tells you whether you got it, and coaches you if you didn't. The words come
in routine packs (Mealtime, Bedtime, Bath, Family), so the signs get used in daily life.

Why "first words" and not the alphabet: fingerspelling is a small part of ASL, and families need everyday words first.
Google's CC BY 4.0 **GISLR** dataset is 250 isolated signs recorded by Deaf signers, taken from early-childhood vocabulary
(the MacArthur-Bates list: milk, sleep, bath, mom, more...). It was made for exactly this purpose: helping hearing
parents of Deaf children. The alphabet is a stretch goal.

## DONE WHEN (falsifiable, by Fri 23 Oct 6pm AEDT; the user submits)
1. The APK is sideloaded on the user's Fire TV stick, and the whole app can be driven with the remote (D-pad, OK, Back).
2. The phone pairs by scanning a QR code on the TV, and the TV shows the user's live hand and arm skeleton with less than 300 ms of lag.
3. At least 30 signs across 4 routine packs. Each sign has a reference animation built from a real Deaf signer's landmarks.
4. Recognition accuracy on held-out signers (people the model never trained on) is measured and published in the README.
   Target: 85% or more top-3 for in-pack recognition. The real number gets published whatever it is.
5. At least 1 game mode as well as lessons (e.g. "Sign of the day", or a family round-robin with a score).
6. AWS is in the runtime path, documented in the README: Polly voice, and Bedrock coaching tips.
7. The demo video is under 3 minutes, shows the real stick on the real TV, and is public on YouTube.
8. The public repo has an MIT licence, setup and run instructions, and credits D-PAN, Georgia Tech and Google for the data.
9. The Devpost text, product feedback for every tool, and a friction log (worth up to 10% bonus) are written in `SUBMIT/`.

## Architecture
```
Phone (browser, HTTPS)                 server/ (Node, ws)                      tv/ (React Native, Fire OS)
 camera -> MediaPipe Hand+Pose           pairing rooms (4-digit code)           QR pairing screen
 -> 15-20 fps landmark frames  -------->  relay frames/preds  ------------------> live skeleton overlay
 -> sign model (ONNX web) on a            Polly TTS (cached mp3)  <------------- lessons / games (D-pad)
    countdown window -> pred  -------->   Bedrock coaching text  <-------------  reference sign playback
```
- **Privacy:** video never leaves the phone. Only the landmarks travel.
- **The phone needs HTTPS** to use the camera. In dev that comes from a `cloudflared` quick tunnel to the local server.
  The QR code on the TV encodes the tunnel URL.
- The protocol lives in `PROTOCOL.md`, and every component must follow it exactly.

## Workstreams
- `model/`: GISLR subset download (to D:), preprocessing, training on the GTX 1660, held-out-signer evaluation,
  ONNX export, and reference sequences for each sign (JSON).
- `phone/`: the camera page. MediaPipe tasks-vision Hand and Pose landmarkers, frame streaming, and windowed inference.
- `server/`: the relay, pairing, Polly and Bedrock endpoints, and serving the phone page.
- `tv/`: the Fire TV app, built from AmazonAppDev/react-native-multi-tv-app-sample (Expo).
- `SUBMIT/`: the Devpost text, feedback, friction log and video script.

## Rules
- Pitch language: never say "translate" or "interpret". It's "hearing families learning ASL". Credit the Deaf signers. Point
  people to Deaf-led classes. Claim only accuracy we measured. See `../FINGERSPELL_RESEARCH.md`.
- Public repo: commits as the user (Danish), with no AI co-author trailers.
- The AWS keys in use belong to a shared AWS profile. Keep spend small: cache Polly audio, and
  use short Bedrock prompts.

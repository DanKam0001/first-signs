# Devpost submission text: First Signs

Every field below is ready to paste. All numbers come from `SUBMIT/FACTS.md` and `model/export/metrics.json`.

**Before pasting, fill in the four remaining TODOs:** the YouTube URL, the GitHub repo URL, the Open Source contribution
(PR) URL and the GitHub username.

---

## Project name
First Signs

## Tagline
Your baby's first ASL words, learned together on the living-room TV, running natively on Vega OS on a real Fire TV Stick.

## Primary track
Fire TV

## Mini challenges
AWS Builder; Open Source

## Video
TODO: public YouTube URL (under 3 minutes; filmed on the real Vega OS Fire TV Stick)

## Code repository
TODO: public GitHub URL (MIT licence)

---

## Inspiration

Babies understand common words from about 6 months. For a Deaf baby, those first words have to be seen, not heard. But 9
in 10 children born deaf have hearing parents, so most Deaf babies depend on parents who are only just starting to learn
a sign language. Early access to language matters: signed or spoken, the earlier the better.

Those parents have books, videos and phone apps. None of them can tell you that *your* sign is wrong. Phone apps have
a second problem: you hold the phone in one hand and try to sign with the other, on a tiny screen, one person at a time.
We saw this in our own data. The Deaf signer who recorded our reference videos held the phone while filming, so 17
two-handed signs in our 61 clips appear one-handed.

The living-room TV fixes all of that. Put the phone on a stand as a camera, and both hands are free. The teacher is
life-size at couch distance. The feedback is big enough for the whole family to see, and they can learn together.

## What it does

First Signs is a Fire TV app that helps hearing families learn their first ASL words for a Deaf baby or toddler. It runs
natively on **Vega OS on a real Fire TV Stick HD** in a real living room; that is the device in our demo video.

- **Pair:** the TV shows a QR code and a 4-digit code. Scan it with a phone and put the phone on a stand. It is now the
  camera.
- **Lessons:** 61 everyday signs in six routine packs: Mealtime (milk, drink, food, please...), Bedtime, Bath time,
  Family, Play (dog, cat, car, outside...) and Feelings & needs (owie, sick, up, wait...). Watch a short clip of a Deaf
  signer making the sign, life-size, with a slow-motion option. Press **Your turn**: the TV counts you in, watches a
  2.5-second window, and tells you whether you got it. If you missed, it says what the sign looked like instead and
  gives a short, specific tip. Each sign earns up to 3 stars.
- **Talk with Baby:** practise signs in context. The TV shows a small everyday scene ("Baby is holding up an empty
  cup."), you answer with one sign, and the TV replies to the sign it saw ("Milk? Let's fill it up."). 52 scenes across
  the six packs.
- **Family round:** players take turns on random signs from a pack, with scores and streaks, ending on a scoreboard.
- **Sign Together:** two people stand side by side in one camera frame. Each gets their own live mirror and verdict.
- **Phone feedback too:** the phone on the stand briefly shows the verdict as well, so you can glance at either screen.
- **Clear on a TV:** a black-and-white interface with an inverted focus state (white fill, black text), so the D-pad
  focus is obvious from the couch.
- **Remote only:** everything works with the D-pad, OK and Back. Every prompt is shown as on-screen text.
- **Private by design:** video never leaves the phone. Only hand and body landmark points are sent.

It is a learning tool for hearing families. It does not translate or interpret ASL, and the About screen credits the Deaf
signers and points families to Deaf-led ASL classes.

## How we built it

- **Vega OS app (the one in the demo):** React Native for Vega (RN 0.83, `@amazon-devices/react-native-kepler` 4.0,
  Vega SDK 0.24), built in WSL2 and installed over Wi-Fi onto a Fire TV Stick HD (2nd Gen) running Vega "OS 2.0". We
  enabled Developer Mode from the CLI (`vega devmode login` and `vega devmode enable-device`), set the stick's
  Connection Mode to TCP/IP, then used `vega exec vda connect`, `vega device install-app` and `vega device launch-app`.
  We ported the Fire OS app screen by screen: `@amazon-devices/react-native-svg` for the QR code and skeleton,
  `TVEventHandler` for the remote, the Vega AsyncStorage package for settings and progress, and w3cmedia for audio.
- **Tuned for a 1 GB stick:**
  - The reference clips play as **bundled JPG sprite sheets** (a frame flipbook animated by one `<Image>`), because
    w3cmedia video would not play reliably on the real stick.
  - An **ANR kill** on the stick was diagnosed from the stick's own crash report (`vega device copy-logs`): graphics
    memory (CMA) ran out from large decoded textures. We halved the sprite sheets (frames 320 to 240 px tall, sheets
    capped at 1024 px) and mount only one sheet at a time.
  - The **live skeleton renders at 10 fps** on Vega and always draws the newest frame, never a queue.
  - The **relay drops stale frames** instead of buffering them, so the mirror never falls behind.
  - Measured: the phone sends about 18.6 landmark frames a second, and the HTTPS tunnel adds about 40 ms one way.
- **Fire OS app:** the same app for Fire OS, in React Native for TV (`react-native-tvos` 0.81) on Expo SDK 54,
  structured like Amazon's react-native-multi-tv-app-sample, whose remote handling we adapted. Focus is handled by
  `react-tv-space-navigation` on both platforms. We built the APK on Windows and tested it on an Android TV emulator and
  in the web build; we did not have a Fire OS stick to test it on.
- **Phone (web page):** MediaPipe tasks-vision Hand and Pose landmarkers run in the phone's browser and stream landmark
  frames. When the TV asks for an attempt, the phone records a window and runs our sign model on-device with
  onnxruntime-web. Video is never uploaded.
- **Sign model:** a ~1.0M-parameter convolution and transformer classifier (4.0 MB ONNX), trained in PyTorch on a GTX
  1660 using landmarks from **21 Deaf signers** in Google's GISLR dataset (D-PAN and Georgia Tech, CC BY 4.0). We
  tested it on **10 different Deaf signers it never saw** (9,882 clips): within a pack, it gets the sign right first
  time 94.5% of the time, and in its top 3 97.7% of the time. On clips altered to look like the phone's window, those
  numbers are 92.4% and 96.3%. Every pack scores at least 96.7% top-3. The Python and JavaScript preprocessing are
  checked against each other on the same fixtures, and onnxruntime-web on the phone matches PyTorch to within 3e-6.
- **Reference videos:** 61 short clips, all of **one Deaf signer** (PopSign ASL v1.0 participant 8037, Georgia Tech and
  DPAN, CC BY 4.0), so every sign is taught by the same person. We fetched only the clips we needed out of tar files of
  up to 3 GB each, using HTTP Range requests, and re-encoded them for TV playback.
- **Relay server (Node.js):** pairs the TV and phone with a 4-digit room code and relays messages over WebSockets. It has
  code for **Amazon Polly** (neural voice) spoken prompts, cached so each phrase is synthesized once, and **Amazon
  Bedrock with Amazon Nova Micro** (falling back to Nova Lite) for coaching tips grounded only in our checked written
  description of the sign. If AWS is unreachable, the app keeps working with on-screen text and built-in tips.
- **Testing:** scripted drivers walk every screen using only remote keys: in a browser, on an Android TV emulator
  (`adb shell input keyevent`) and on the Vega Virtual Device (`inputd-cli`). Then we tested by hand on the real Vega
  stick. Unit tests cover the relay, pairing, handedness, verdict and two-person tracking.

## Challenges we ran into

- **Video on a real Vega stick.** The w3cmedia player showed the clips zoomed and frozen on the Vega Virtual Device and
  never played them on the stick. We switched to bundled sprite sheets, which play reliably and need no network.
- **An ANR on the stick.** The app was killed with an "app not responding" error. The crash report from
  `vega device copy-logs` pointed to graphics-memory (CMA) exhaustion from large decoded textures. Smaller sprite sheets,
  one mounted at a time, fixed it.
- **A live mirror that lagged on 1 GB of RAM.** The stick could not keep up with 15 skeleton redraws a second plus the
  sprite animation. We throttled drawing to 10 fps (newest frame only) and made the relay drop stale frames.
- **Getting onto a retail Vega stick.** Developer options shows only a QR code until you press the device name in About
  7 times; Developer Mode is then enabled from the CLI, and `vega devmode login` in WSL needs an unlocked OS keyring.
  Our stick reports "OS 2.0", while the SDK 0.24 docs describe OS 1.2. It worked, but we couldn't confirm that from the
  docs beforehand.
- **Buying the right hardware.** Retail Fire TV Stick HD and 4K Select models now run Vega OS, with no ADB. We only
  learned that after buying, which is why our Fire OS build is tested on an emulator rather than a stick.
- **Windows path length broke the Fire OS native build.** It failed after 13 minutes with
  `ninja: error: manifest 'build.ninja' still dirty`; the real cause was object paths over 260 characters. We build
  from a short path and drafted a README fix for Amazon's sample.
- **Vega on Windows.** Amazon doesn't support WSL2, but we ran the Vega SDK, the Vega Virtual Device and the real-device
  tooling there, after a host memory crash and a software-GL workaround. All of it is in our friction log.
- **AWS permissions.** Our IAM user on a shared account is denied every Polly and Bedrock call and can't list its own
  policies to see why. We wrote a least-privilege policy for an admin and made the server degrade gracefully.
- **Matching two MediaPipe versions.** The training data came from legacy MediaPipe Holistic; the phone runs
  tasks-vision. We measured both handedness conventions on hundreds of thousands of frames and designed features that
  don't depend on camera aspect ratio or mirroring.

## Accomplishments that we're proud of

- **First Signs runs natively on Vega OS on a real Fire TV Stick, in a real living room.** We ported it to React Native
  for Vega, installed it over Wi-Fi, diagnosed an on-device crash from the stick's own logs, and tuned it until the live
  mirror kept up.
- An accuracy number we can stand behind: measured on 10 Deaf signers the model never saw, with the weak spots
  published (shower is the weakest sign; mom/grandma and dad/grandpa are the main confusions).
- One real Deaf signer teaches all 61 signs on screen, properly credited, instead of an avatar.
- Video never leaves the phone.
- The whole app works with just a remote, and every flow is tested that way automatically.
- A 46-entry friction log covering a Vega port on a real stick, the Vega SDK on WSL2, the Fire OS build and AWS, with
  workarounds others can use.

## What we learned

- The TV changes what sign-learning software can do: two free hands, a life-size teacher and a shared screen.
- A streaming stick is a real constraint. Graphics memory and the UI thread, not the model, set our limits, and the
  device's own crash report found the problem faster than guessing.
- Hand-tracking data has conventions (handedness, mirroring, aspect ratio) that are rarely documented. Measuring them is
  faster than guessing.
- Generative AI is safest when it can only rephrase checked facts. Our Bedrock prompt contains the sign's verified
  description and nothing else, and unverified descriptions are never sent.
- Respect matters as much as accuracy: use the word "learning", not "translating"; credit the Deaf signers; point to
  Deaf teachers.

## What's next for First Signs

- Measure accuracy live, with hearing learners on real phone cameras, and publish it whatever it shows.
- Get Deaf ASL teachers to review the packs, descriptions, scenes and feedback wording.
- Turn on the Polly voice and Bedrock tips once the IAM policy is attached, and check audio on the Vega stick.
- Test the Fire OS build on a Fire OS device.
- More packs, for baby-sign families (hearing babies) and general ASL learners.
- Auslan, built with Deaf Australians.
- Echo Show and other devices with built-in cameras, which would remove the phone.

## Built with

vega-os, vega-sdk, react-native-for-vega, react-native, react-native-tvos, expo, typescript, javascript, node.js,
websockets, python, pytorch, onnx, onnxruntime-web, mediapipe, react-tv-space-navigation, react-native-svg, expo-video,
amazon-polly, amazon-bedrock, amazon-nova, aws-iam, aws-sdk-for-javascript, fire-tv, fire-os, android, wsl2,
cloudflared, gislr, popsign-asl

## Testing instructions (optional field)

Full steps are in the README. In short: `cd server && npm install && npm run live`, then:

- **Vega OS Fire TV stick:** enable Developer Mode (`vega devmode login`, then `vega devmode enable-device --code <code>`),
  set Developer options > Connection Mode to TCP/IP, build the armv7 `.vpkg`, then
  `vega exec vda connect <stick-ip>:5555`, `vega device -d <serial> install-app --packagePath <vpkg>` and
  `vega device -d <serial> launch-app --appName com.dankam.firstsigns.main`. Set the server address in Settings.
- **Fire OS:** sideload `tv/dist/first-signs.apk` (or build it with `cd tv && npm run android:release`) and point the TV
  at the server in Settings or with
  `adb shell am start -a android.intent.action.VIEW -d "firstsigns://config?server=ws://<PC-IP>:8788/ws"`.
- **No Fire TV:** the web build in `tv/` runs in a browser with the keyboard as the remote and the PC's webcam as the
  camera.

Then scan the QR code on the TV with a phone. AWS is optional; without it, prompts show as text.

---

## Product feedback

### 1. Vega OS on a real Fire TV Stick (Vega SDK 0.24, Vega CLI, VVD)

- **What we used it for:** First Signs runs natively on a Fire TV Stick HD (2nd Gen) with Vega "OS 2.0", and our demo is
  filmed on it. We ported our React Native for TV app to React Native for Vega (RN 0.83, SDK 0.24.12112, CLI 1.4.5),
  built it in WSL2, tested it first on the Vega Virtual Device, then installed it on the stick over Wi-Fi.
- **What worked well:**
  - **Developer Mode from the CLI.** `vega devmode login` plus `vega devmode enable-device --code <6 digits>` enabled a
    retail stick with no per-device portal registration. That is a big improvement.
  - **Wi-Fi install.** Once Connection Mode was TCP/IP, `vega exec vda connect`, `vega device install-app` and
    `vega device launch-app` installed and started the app with no cable.
  - **`vega device copy-logs`.** It pulled the stick's crash report (ACR), which told us our ANR was graphics-memory
    (CMA) exhaustion. That turned a mystery kill into a one-line fix.
  - **React Native for Vega.** Most of our Fire OS code ported unchanged. The `@amazon-devices` versions of SVG and
    AsyncStorage have the same APIs, and `TVEventHandler` covered the remote.
  - The VVD boots in about 16 seconds, and the helloWorld template built packages for all three architectures in about
    40 seconds.
- **What needs work:**
  - **w3cmedia video didn't play on the device.** Our mp4 clips stayed stuck on the real stick (on the VVD they were
    zoomed, cropped and frozen), with no error in JS. We fell back to sprite sheets. A troubleshooting page listing what
    w3cmedia needs (MIME type, HTTP Range, manifest privileges) and an error event when playback can't start would help.
  - **No screenshot or screen-record command for real devices.** `vega device --help` (CLI 1.4.5) lists no screenshot or
    recording command, so we filmed our demo with a camera pointed at the TV.
  - **`vega devmode login` in WSL needs an unlocked OS keyring.** Without gnome-keyring running and unlocked, login fails.
    We wrapped it in `dbus-run-session` with a keyring-unlock script. A file-based token option would fix headless use.
  - **Developer options shows only a QR code** until you press the device name in About 7 times. Nothing on the TV says
    so; the QR page could say it.
  - **Connection Mode has to be set to TCP/IP** (and the stick reboots) before anything listens on the network. Before
    Developer Mode, a port scan finds nothing, which looks like a broken device.
  - **OS 2.0 vs OS 1.2.** Our stick reports "OS 2.0"; the SDK 0.24 docs and our manifest target OS 1.2. The app ran fine,
    but no doc we found says OS 2.0 devices accept 1.2 apps.
  - **Retail stick naming.** Fire TV Stick HD and 4K Select are Vega OS with no ADB, but product pages don't make that
    clear to a developer. We bought expecting Fire OS.
  - **Graphics memory budget.** Nothing in the docs says how much texture memory an app can use on a 1 GB stick. We found
    out from an ANR.
  - **Release-build `console.log` output** never appeared in `loggingctl log`, and VVD key injection (`inputd-cli` with
    evdev names) is undocumented.
- **Onboarding (zero to the app on the stick):** the SDK install and VVD took a full session on WSL2 (see the friction
  log). On the stick, the steps themselves are short; the time went on finding the 7-press step, the keyring fix and
  the Connection Mode setting, none of which we saw in one place.
- **Would we build with it again?** Yes. Vega is where new Fire TV devices are going, React Native for Vega let us reuse
  most of our app, and the CLI-only Developer Mode and Wi-Fi install are a good developer experience once documented.

### 2. Fire TV: React Native for TV and the react-native-multi-tv-app-sample

- **What we used it for:** the starting structure of our Fire OS app: React Native for TV (`react-native-tvos` 0.81) on
  Expo SDK 54. We adapted the sample's remote-control layer and its `withKeyEvent` config plugin, and followed its
  pattern of JS-side focus with `react-tv-space-navigation`, so the same navigation code runs on Fire OS, Vega and the
  web.
- **What worked well:** the sample's split between platform-specific remote handlers (`.android`, `.kepler`, web) and
  shared screens made our Vega port much faster. Keeping the old architecture and avoiding reanimated, as the sample
  does, kept our app light. The D-pad focus behaviour needed no special cases.
- **What needs work:**
  - On Windows the native build fails on paths over 260 characters with an error that never mentions paths (see the
    Open Source section; we drafted a README fix).
  - The sample's Expo modules are SDK 52 versions next to `expo ~54.0.0` (for example `expo-constants ~17.0.0` where SDK
    54 wants `~18`). `npx expo install --check` in CI would catch this.
  - The Vega workspace uses RN 0.72 / react-native-kepler 2.x, while `vega project generate` now gives RN 0.83 /
    kepler 4.x with a different build command. A note on which to start from would help.
  - The disk space needed for the first build (about 15 GB with caches and the NDK) isn't stated.
- **Onboarding (zero to hello world):** slow on Windows. The first build failed after about 13 minutes, and the cause
  took diagnosis. Once building from a short path, a cold build took about 12 minutes.
- **Would we build with it again?** Yes. One React Native codebase that targets Fire OS, Vega and the web is the right
  model for small teams, and the sample is the best starting point we found.

### 3. Fire OS: adb sideloading and testing

- **What we used it for:** building the release APK, configuring the server address with a deep link
  (`firstsigns://config?server=...`), and automated testing with `adb shell input keyevent`. We tested on an Android TV
  emulator only: our stick turned out to be Vega OS, so the Fire OS build has not run on a Fire OS device.
- **What worked well:** because Fire OS is Android-based, the standard Android toolchain just works: adb install, deep
  links, logcat and screencap. Driving the whole app with D-pad key events over adb gave us repeatable remote-only tests.
- **What needs work:** there is no Fire OS emulator image in `sdkmanager`, and the docs don't say which Android TV image
  is the closest match for each Fire OS version. We used `android-30;android-tv;x86` (Android 11, the same base as Fire
  OS 8). Fire-specific behaviour (the launcher banner, menu keys, stick performance) can only be checked on hardware.
- **Onboarding:** the emulator path was straightforward once we chose an image. Without a Fire OS device, we can't
  report on Developer options or ADB debugging on real hardware.
- **Would we build with it again?** Yes. The Android toolchain makes testing fast, but a Fire OS emulator image would
  make it trustworthy.

### 4. Amazon Polly (AWS Builder)

- **What we used it for:** spoken prompts on the TV ("Your turn. Sign milk."). The TV sends a `speak` message, the server
  calls `SynthesizeSpeech` (neural engine, voice Danielle, falling back to Joanna), saves the mp3 to disk keyed by a hash
  of voice and text, and returns a URL. Each phrase would be synthesized once, which keeps cost near zero.
- **What worked well:** the SDK v3 Polly client is small and simple to call from Node, and caching the returned audio
  stream to disk took a few lines. The access-denied error names the exact action that's missing
  (`polly:SynthesizeSpeech`), which made writing a least-privilege policy straightforward.
- **What needs work:** the IAM user couldn't see its own policies, so it couldn't tell what it was missing (see AWS IAM
  below).
- **Onboarding:** the code took minutes. On our shared account, the IAM policy was still not attached at submission, so
  every call returns `AccessDenied` and the app uses its on-screen-text fallback.
- **Would we build with it again?** Yes. The integration is simple, and the cache keeps cost close to zero.

### 5. Amazon Bedrock with Amazon Nova (AWS Builder)

- **What we used it for:** a short coaching tip after a missed sign. The server calls the Converse API with Amazon Nova
  Micro (falling back to Nova Lite), trying the `us.` cross-region inference profile first. The prompt contains only our
  checked description of the target sign, and of the sign it was confused with, and tells the model to use nothing
  else. Tips are cached per sign, confused sign and attempt number. Unverified descriptions are never sent.
- **What worked well:** the Converse API lets us swap Nova Micro and Nova Lite with no code change, and Nova Micro is a
  good fit for a two-sentence tip: small and cheap.
- **What needs work:**
  - When IAM denies the call, the error names the foundation-model ARN, not the layer that denied it, so it isn't clear
    whether "model access" or IAM is the problem. It was IAM.
  - For cross-region inference profiles, the policy must allow both the inference-profile ARN and the foundation-model
    ARN in every region the profile routes to. A copy-paste minimal policy on each Nova model page would save time.
- **Onboarding:** the code was quick to write. Calls are still denied by IAM on our shared account, so the app serves
  built-in tips from the same verified descriptions.
- **Would we build with it again?** Yes. Grounding a small model on checked facts is a pattern we'd reuse.

### 6. AWS IAM (AWS Builder)

- **What we used it for:** a least-privilege inline policy (`server/iam-policy.json`) that allows only
  `polly:SynthesizeSpeech` and `bedrock:InvokeModel` on the Nova Micro and Nova Lite models and inference profiles.
- **What worked well:** the error messages name the missing action precisely, and an inline policy is quick to attach
  from the console.
- **What needs work:** a user without IAM read access can't discover what it's allowed to do;
  `list-attached-user-policies` is denied too. A "what can I call?" self-check for the current principal, or a Bedrock
  console button to test a principal against a model, would have saved us the most time.
- **Onboarding:** the policy took minutes to write; attaching it needs an account admin, and on our shared account that
  hadn't happened by submission.
- **Would we build with it again?** Yes; there's no alternative, and least privilege is the right default.

---

## Feature requests

| # | Request | Why it matters to First Signs | Priority |
|---|---|---|---|
| 1 | `vega device screenshot` and `vega device screen-record` for real devices and the VVD | We had to film our demo with a camera pointed at the TV; screenshots are needed for docs and bug reports | Important |
| 2 | A w3cmedia troubleshooting guide (MIME type, HTTP Range, manifest privileges) and an error event when playback can't start | Our clips never played on the real stick and we got no error; we replaced video with sprite sheets | Important |
| 3 | A documented graphics-memory (texture) budget per Vega device, and a warning before CMA exhaustion | We found the 1 GB stick's limit through an ANR kill | Important |
| 4 | `vega devmode login` without an OS keyring (a file-based token or `--no-keyring`) | Login fails in WSL and other headless Linux without an unlocked gnome-keyring | Important |
| 5 | Clear labelling of which retail Fire TV devices run Vega OS vs Fire OS, and whether they have ADB | We bought a Vega stick expecting Fire OS, so our Fire OS build is emulator-tested only | Important |
| 6 | Official Vega SDK and VVD support on Windows (WSL2) | Our development machine is Windows; we ran everything in WSL2 anyway | Important |
| 7 | A Fire TV pattern or API for pairing a phone as a companion camera or input device | Fire TV sticks have no camera; every camera-based TV app has to build its own pairing and relay | Important |
| 8 | Bedrock errors that say which layer denied the call, plus a "test this principal" button | We couldn't tell IAM from model access | Important |
| 9 | Vega installer: exit non-zero on missing dependencies, a resumable install, parallel decompression | A failed install looked like success, and extraction crashed our host | Important |
| 10 | Docs that say which Vega OS versions an SDK supports (our stick is OS 2.0; SDK 0.24 docs say OS 1.2) | We couldn't tell in advance whether our app would install | Nice-to-have |
| 11 | On-screen hint on the Developer options QR page: "press the device name in About 7 times" | Nothing on the TV explains how to reach Developer Mode | Nice-to-have |
| 12 | Release-build JS console output in `loggingctl`, and documented key injection for the VVD | We relayed logs over our own WebSocket and found `inputd-cli` by searching the device | Nice-to-have |
| 13 | A Fire OS emulator image in the Android SDK, or a documented closest Android TV image per Fire OS version | Our Fire OS build could only be tested on a generic Android TV image | Nice-to-have |
| 14 | Windows short-path guidance, or a newer bundled CMake/ninja, in react-native-multi-tv-app-sample | The first native build fails with an unrelated-looking error | Important |

## Friction log

See `SUBMIT/FRICTION_LOG.md` (46 entries: the Vega port on a real Fire TV Stick, the Vega port on the VVD, a Vega SDK
trial on WSL2, the Fire OS build, AWS, and data tools), each with steps, expected and actual results, severity, time lost,
workaround and a suggested fix.

---

## AWS Builder mini-challenge

**AWS services:** Amazon Polly, Amazon Bedrock (Amazon Nova Micro and Nova Lite via the Converse API), and AWS IAM.

**How they're used:** both services are wired into the app's runtime path, called by our Node.js relay server with the
AWS SDK for JavaScript v3.

- **Polly** gives the TV its voice. Every prompt ("Your turn. Sign milk.") is synthesized with a neural voice, cached on
  disk by a hash of voice and text, and served to the TV as an mp3, so each phrase is synthesized only once.
- **Bedrock with Nova** writes the coaching tip after a missed sign. It is grounded: the prompt contains only our checked,
  human-written description of the target sign (and the sign the learner's attempt looked like), and the model is told
  to add nothing. Descriptions we couldn't verify are never sent. Tips are cached per (sign, confused-with, attempt
  number). The server tries Nova Micro through the `us.` cross-region inference profile first and falls back to Nova
  Lite, and keeps whichever works.
- **IAM:** a least-privilege inline policy (`server/iam-policy.json`) allows only those two actions on those models.
- **Resilience:** if either service fails, the TV shows the prompt as text and the server returns a built-in tip from the
  same description, so a family never sees an error. `/healthz` reports the status of each service, and
  `npm run smoke:aws` checks both.
- **What AWS never sees:** no video and no landmarks. Only prompt text and a sign's written description.

**Status at submission:** our shared AWS account was still waiting on an admin to attach the IAM policy, so
`npm run smoke:aws` returns `AccessDenied` for both Polly and Bedrock, and the demo shows the fallback path (on-screen
text and built-in tips). The integration is complete in code and goes live as soon as the policy is attached.

Documentation: the "How AWS is used" and "AWS permissions" sections of `server/README.md`, and the architecture diagram
in the main README.

## Open Source mini-challenge

- **Contribution URL:** TODO (the PR to AmazonAppDev/react-native-multi-tv-app-sample)
- **Project repository URL:** TODO
- **GitHub username:** TODO

**What we did:**

1. **First Signs is open source under the MIT licence:** the relay server, the phone camera page, the Fire OS TV app,
   the Vega OS port notes, and the full training, evaluation and export pipeline for the sign model. The datasets and
   sign videos keep their own CC BY 4.0 licences and credits.
2. **A pull request to AmazonAppDev/react-native-multi-tv-app-sample** (drafted in `SUBMIT/OSS_PR.md`) that documents why
   native Android/Fire OS builds fail on Windows, and how to fix it.

**How the PR works:** on Windows, the sample's native modules (react-native-screens, expo-modules-core,
react-native-reanimated) fail to build with `ninja: error: manifest 'build.ninja' still dirty after 100 tries` when the
repo sits under a normal user folder. We traced it to object paths over 260 characters, which the ninja bundled with the
Android SDK's CMake 3.22.1 can't handle even with `LongPathsEnabled` on. The PR adds a Windows section to the README:
clone to a short root such as `D:\tv`, clear cached `android/build` and `.cxx` folders, don't move an installed repo
(Yarn workspace links break), and use `GRADLE_USER_HOME` when the system drive is short of space. It also adds the
roughly 15 GB disk requirement to the prerequisites. We tested the workaround: the same build completed in about 12
minutes.

**Why it matters:** this is the first native build most developers run from Amazon's multi-TV sample. On Windows it
fails after about 13 minutes with an error that never mentions paths. A few README lines save every Windows developer that
diagnosis.

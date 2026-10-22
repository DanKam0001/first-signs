# Devpost submission text: First Signs

Every field below is ready to paste. Lines marked **TODO** need a fact we don't have yet; fix or delete them before
submitting. All numbers come from `SUBMIT/FACTS.md` and `model/export/metrics.json`.

**Before pasting, resolve these TODOs:**
1. Has the APK been run on the real Fire TV stick? (Fire OS feedback and "Accomplishments" are written for the emulator
   until then.)
2. Has an admin attached `server/iam-policy.json`, and does `npm run smoke:aws` print `POLLY OK` and `BEDROCK OK`?
   (The AWS sections say the integration is built and falls back gracefully; once it passes, change them to say it runs.)
3. Live accuracy on the phone camera: measured or not?
4. YouTube URL, GitHub repo URL, Open Source PR URL, GitHub username.

---

## Project name
First Signs

## Tagline
Your baby's first ASL words, learned together on the living-room TV.

## Primary track
Fire TV

## Mini challenges
AWS Builder; Open Source

## Video
TODO: public YouTube URL (under 3 minutes, shows the app on a real Fire TV)

## Code repository
TODO: public GitHub URL (MIT licence)

---

## Inspiration

Babies understand common words from about 6 months. For a Deaf baby, those first words have to be seen, not heard. But 9
in 10 children born deaf have hearing parents, so most Deaf babies depend on parents who are only just starting to learn
a sign language. Early access to language matters: signed or spoken, the earlier the better.

Those parents have books, videos and phone apps. None of them can tell you that *your* sign is wrong. Phone apps have
a second problem: you hold the phone in one hand and try to sign with the other, on a tiny screen, one person at a time.
We saw this in our own data. The Deaf signers who recorded our reference videos held their phones while filming, and
about 18 of our 61 clips are one-handed as a result.

The living-room TV fixes all of that. Put the phone on a stand as a camera, and both hands are free. The teacher is
life-size at couch distance. The feedback is big enough for the whole family to see, and they can learn together.

## What it does

First Signs is a Fire TV app that helps hearing families learn their first ASL words for a Deaf baby or toddler.

- **Pair:** the TV shows a QR code. Scan it with a phone and put the phone on a stand. It is now the camera.
- **Lessons:** 61 everyday signs in six routine packs: Mealtime (milk, drink, food, please...), Bedtime, Bath time,
  Family, Play (dog, cat, car, outside...) and Feelings & needs (owie, sick, up, wait...). Watch a short clip of a Deaf signer making the sign, life-size, with a slow-motion option. Press **Your
  turn**: the TV counts you in, watches a 2.5-second window, and tells you whether you got it. If you missed, it says
  what the sign looked like instead and gives a short, specific tip. Each sign earns up to 3 stars.
- **Family round:** players take turns on random signs from a pack, with scores and streaks, ending on a scoreboard.
- **Sign Together:** two people stand side by side in one camera frame. Each gets their own live mirror and verdict.
- **Voice and text:** prompts are spoken by Amazon Polly and always shown on screen too.
- **Remote only:** everything works with the D-pad, OK and Back.
- **Private by design:** video never leaves the phone. Only hand and body landmark points are sent.

It is a learning tool for hearing families. It does not translate or interpret ASL, and the About screen points families
to Deaf-led ASL classes.

## How we built it

- **Phone (web page):** MediaPipe tasks-vision Hand and Pose landmarkers run in the phone's browser and stream
  landmark frames at 15-20 fps. When the TV asks for an attempt, the phone records a window and runs our sign model
  on-device with onnxruntime-web. Video is never uploaded.
- **Sign model:** a ~1.0M-parameter convolution and transformer classifier (4.0 MB ONNX), trained in PyTorch on a GTX
  1660 using landmarks from **21 Deaf signers** in Google's GISLR dataset (D-PAN and Georgia Tech, CC BY 4.0). We
  tested it on **10 different Deaf signers it never saw** (9,882 clips): within a pack, it gets the sign right first
  time 94.5% of the time, and in its top 3 97.7% of the time. On clips altered to look like the phone's window, those
  numbers are 92.4% and 96.3%. The Python and JavaScript preprocessing are checked against each other on the same
  fixtures, and onnxruntime-web on the phone matches PyTorch to within 3e-6.
- **Reference videos:** 61 short clips of a Deaf signer from PopSign ASL v1.0 (Georgia Tech and DPAN, CC BY 4.0). We
  fetched only the 936 clips we needed to choose from out of tar files of up to 3 GB each, using HTTP Range requests, and re-encoded
  them for Android TV playback.
- **Relay server (Node.js):** pairs the TV and phone with a 4-digit room code and relays messages over WebSockets. It
  calls **Amazon Polly** (neural voice) for spoken prompts, caching every phrase so it is synthesized once, and
  **Amazon Bedrock with Amazon Nova Micro** (falling back to Nova Lite) for coaching tips. The Bedrock prompt only
  contains our checked written description of the sign, and the model is told not to add anything. If AWS is
  unreachable, the app keeps working with on-screen text and built-in tips.
- **Fire TV app:** React Native for TV (`react-native-tvos` 0.81) on Expo SDK 54, structured like Amazon's
  react-native-multi-tv-app-sample, whose remote handling we adapted. Focus is handled by `react-tv-space-navigation`.
  The sign clips play through expo-video, and the live mirror skeleton is drawn with react-native-svg at 15 fps to stay
  light on a streaming stick. We built the APK on Windows and sideloaded it with adb.
- **Testing:** scripted drivers walk every screen using only remote keys: in a browser (arrows, Enter, Escape) and on
  an Android TV emulator (`adb shell input keyevent`). Unit tests cover the relay, pairing, handedness, verdict and
  two-person tracking.

## Challenges we ran into

- **Windows path length broke the native build.** The Fire OS build failed after 13 minutes with
  `ninja: error: manifest 'build.ninja' still dirty`. The real cause was object paths over 260 characters. We build
  from a short path on another drive, and drafted a README fix for Amazon's sample.
- **No Fire OS emulator.** We tested on the closest Android TV image (Android 11, the same base as Fire OS 8) and drove
  it entirely with adb key events.
- **AWS permissions.** Our IAM user was denied every Polly and Bedrock call, and couldn't even list its own policies to
  see why. We wrote a least-privilege policy and made the server degrade gracefully.
- **Hand-held reference data.** Every PopSign clip was filmed hand-held, so two-handed signs appear one-handed. That was a
  data problem, but also the clearest proof of our pitch.
- **Matching two MediaPipe versions.** The training data came from legacy MediaPipe Holistic; the phone runs
  tasks-vision. We measured both handedness conventions on hundreds of thousands of frames and designed features that
  don't depend on camera aspect ratio or mirroring.
- **Vega on Windows.** We got the Vega SDK and Vega Virtual Device running in WSL2, which Amazon doesn't support, but
  only after a host memory crash and a software-GL workaround. That's logged step by step in our friction log.

## Accomplishments that we're proud of

- An accuracy number we can stand behind: measured on Deaf signers the model never saw, with the weak spots published
  (shower is the weakest sign; mom/grandma and dad/grandpa are the main confusions).
- Real Deaf signers on screen, properly credited, instead of avatars.
- Video never leaves the phone.
- The whole app works with just a remote, and every flow is tested that way automatically.
- A 17-step Vega-on-WSL2 friction log and a full Fire OS friction log, with workarounds others can use.
- TODO: "Running on a real Fire TV stick in a real living room" once the stick test is done.

## What we learned

- The TV changes what sign-learning software can do: two free hands, a life-size teacher and a shared screen.
- Hand-tracking data has conventions (handedness, mirroring, aspect ratio) that are rarely documented. Measuring them is
  faster than guessing.
- Generative AI is safest when it can only rephrase checked facts. Our Bedrock prompt contains the sign's verified
  description and nothing else, and unverified descriptions are never sent.
- Respect matters as much as accuracy: use the words "learning", not "translating"; credit the Deaf signers; point to
  Deaf teachers.

## What's next for First Signs

- Measure accuracy live, with hearing learners on real phone cameras, and publish it whatever it shows.
- Get Deaf ASL teachers to review the packs, descriptions and feedback wording.
- More packs, for baby-sign families (hearing babies) and general ASL learners.
- Auslan, built with Deaf Australians.
- Echo Show and other devices with built-in cameras, which would remove the phone.
- A Vega OS build of the TV app.

## Built with

react-native, react-native-tvos, expo, typescript, javascript, node.js, websockets, python, pytorch, onnx,
onnxruntime-web, mediapipe, react-tv-space-navigation, react-native-svg, expo-video, expo-audio, amazon-polly,
amazon-bedrock, amazon-nova, aws-iam, aws-sdk-for-javascript, fire-tv, fire-os, android, adb, vega-sdk, cloudflared,
gislr, popsign-asl

## Testing instructions (optional field)

Full steps are in the README. In short: `cd server && npm install && npm run live`, sideload `tv/dist/first-signs.apk`
(or build it with `cd tv && npm run android:release`), point the TV at the server with Settings or
`adb shell am start -a android.intent.action.VIEW -d "firstsigns://config?server=ws://<PC-IP>:8788/ws"`, then scan the QR
code with a phone. Without a Fire TV, the web build in `tv/` runs in a browser with the keyboard as the remote and the
PC's webcam as the camera. AWS is optional; without it, prompts show as text.

---

## Product feedback

### 1. Fire TV: React Native for TV and the react-native-multi-tv-app-sample

- **What we used it for:** the starting structure of our Fire OS app: React Native for TV (`react-native-tvos` 0.81) on
  Expo SDK 54. We adapted the sample's remote-control layer and its `withKeyEvent` config plugin, and followed its
  pattern of JS-side focus with `react-tv-space-navigation`, so the same navigation code runs on Fire OS and the web.
- **What worked well:** the sample's split between platform-specific remote handlers (`.android`, `.kepler`, web) and
  shared screens is a clean way to target Fire OS and Vega from one codebase. Keeping the old architecture and avoiding
  reanimated, as the sample does, kept our app light. Once built, the D-pad focus behaviour needed no special cases.
- **What needs work:**
  - On Windows the native build fails on paths over 260 characters with an error that never mentions paths (see the
    Open Source section; we drafted a README fix).
  - The sample's Expo modules are SDK 52 versions next to `expo ~54.0.0` (for example `expo-constants ~17.0.0` where SDK
    54 wants `~18`). `npx expo install --check` in CI would catch this.
  - The disk space needed for the first build (about 15 GB with caches and the NDK) isn't stated.
  - `yarn install` prints many peer-dependency and patch warnings that look alarming but are harmless.
- **Onboarding (zero to hello world):** slow on Windows. The first build failed after about 13 minutes, and the cause
  took diagnosis. Once building from a short path, a cold build took about 12 minutes.
- **Would we build with it again?** Yes. One React Native codebase that targets Fire OS, the web and (with more work)
  Vega is the right model for small teams, and the sample is the best starting point we found.

### 2. Fire OS: adb sideloading and testing

- **What we used it for:** installing the release APK, configuring the server address with a deep link
  (`firstsigns://config?server=...`) so nobody has to type on the TV, and automated testing with
  `adb shell input keyevent`.
- **What worked well:** because Fire OS is Android-based, the standard Android toolchain just works: adb install, deep
  links, logcat and screencap. Driving the whole app with D-pad key events over adb gave us repeatable remote-only tests.
- **What needs work:** there is no Fire OS emulator image in `sdkmanager`, and the docs don't say which Android TV image
  is the closest match for each Fire OS version. We used `android-30;android-tv;x86` (Android 11, the same base as Fire
  OS 8). Fire-specific behaviour (the launcher banner, menu keys, stick performance) can only be checked on hardware.
- **Onboarding:** TODO (real stick: time from unboxing to the app running, any issues with Developer options or ADB debugging).
- **Would we build with it again?** Yes. Sideloading over Wi-Fi from Windows is the fastest way we found to get a custom
  app onto a TV.

### 3. Vega SDK and Vega Virtual Device

- **What we used it for:** evaluating a Vega OS build. We installed the Vega SDK 0.24 and the VVD in WSL2 on Windows,
  built the helloWorld template and ran it on the VVD. First Signs itself runs on Fire OS today; the remote layer
  already has a Vega (`.kepler`) handler for the port.
- **What worked well:** once running, the VVD booted in about 16 seconds, `vega project generate` worked first time, the
  build produced packages for three architectures in about 40 seconds, and `vega run-app` installed and launched the
  app. No Amazon account was needed to install, build or run.
- **What needs work:**
  - The installer prints "jq is required" and exits with code 0. `jq` isn't in the prerequisites.
  - The VVD image is a single-stream bzip2 archive, extracted on one core. On our 32 GB machine this exhausted host
    memory and left the WSL file system read-only.
  - An interrupted install leaves no `~/vega/env`, and a re-run without a TTY fails at an overwrite prompt while still
    marking the component installed.
  - The helloWorld template needs `@babel/runtime` as a direct dependency.
  - On WSLg the VVD crashes seconds after boot; `--no-gl-accel` keeps it up but renders black. Forcing Mesa's software
    renderer (`LIBGL_ALWAYS_SOFTWARE=1 GALLIUM_DRIVER=llvmpipe`) fixes it.
  - There is no screenshot command, and `run-app` fails if run right after "ready".
- **Onboarding:** we reached hello world on the VVD in one session. Most of the time went on the download (about 20
  minutes), extraction (5+ minutes on one core) and recovering from the memory crash. Windows and WSL are officially unsupported, so we
  expected friction.
- **Would we build with it again?** Yes, once Windows (or WSL2) is supported, because Vega is where new Fire TV devices
  are going. Our 17-step log should help make WSL2 a supported path.

### 4. Amazon Polly (AWS Builder)

- **What we used it for:** spoken prompts on the TV ("Your turn. Sign milk."). The TV sends a `speak` message, the server
  calls `SynthesizeSpeech` (neural engine, voice Danielle, falling back to Joanna), saves the mp3 to disk keyed by a hash
  of voice and text, and returns a URL. Each phrase is synthesized once, which keeps cost near zero.
- **What worked well:** the SDK v3 Polly client is small and simple to call from Node, and the audio comes back as a
  stream that converts to bytes in one call, so caching it to disk took a few lines. The access-denied error names the exact action that's missing
  (`polly:SynthesizeSpeech`), which made writing a least-privilege policy straightforward.
- **What needs work:** the IAM user couldn't see its own policies, so it couldn't tell what it was missing (see AWS IAM
  below).
- **Onboarding:** the code took minutes. Permissions took much longer. TODO: add the time to the first successful mp3.
- **Would we build with it again?** Yes. TODO (once smoke:aws passes): one sentence on the voice quality.

### 5. Amazon Bedrock with Amazon Nova (AWS Builder)

- **What we used it for:** a short coaching tip after a missed sign. The server calls the Converse API with Amazon Nova
  Micro (falling back to Nova Lite), trying the `us.` cross-region inference profile first. The prompt contains only our
  checked description of the target sign, and of the sign it was confused with, and tells the model to use nothing
  else. Tips are cached per sign, confused sign and attempt number, so the same tip is never generated twice.
  Unverified descriptions are never sent.
- **What worked well:** the Converse API lets us swap Nova Micro and Nova Lite with no code change, and Nova Micro is a
  good fit for a two-sentence tip: small and cheap.
- **What needs work:**
  - When IAM denies the call, the error names the foundation-model ARN, not the layer that denied it, so it isn't clear
    whether "model access" or IAM is the problem. It was IAM.
  - For cross-region inference profiles, the policy must allow both the inference-profile ARN and the foundation-model
    ARN in every region the profile routes to. A copy-paste minimal policy on each Nova model page would save time.
- **Onboarding:** TODO: time to the first successful tip.
- **Would we build with it again?** Yes. Grounding a small model on checked facts is a pattern we'd reuse.

### 6. AWS IAM (AWS Builder)

- **What we used it for:** a least-privilege inline policy (`server/iam-policy.json`) that allows only
  `polly:SynthesizeSpeech` and `bedrock:InvokeModel` on the Nova Micro and Nova Lite models and inference profiles.
- **What worked well:** the error messages name the missing action precisely, and an inline policy is quick to attach
  from the console.
- **What needs work:** a user without IAM read access can't discover what it's allowed to do; `list-attached-user-policies`
  is denied too. A "what can I call?" self-check for the current principal, or a Bedrock console button to test a
  principal against a model, would have saved us the most time.
- **Onboarding:** the policy took minutes to write; getting it attached needed an account admin.
- **Would we build with it again?** Yes; there's no alternative, and least privilege is the right default.

---

## Feature requests

| # | Request | Why it matters to First Signs | Priority |
|---|---|---|---|
| 1 | A Fire OS emulator image in the Android SDK, or a documented closest Android TV image per Fire OS version | We had to test on a generic Android TV image until hardware arrived | Important |
| 2 | Official Vega SDK and VVD support on Windows (WSL2) | Our development machine is Windows; Vega is the path for new Fire TV devices | Important |
| 3 | Windows short-path guidance, or a newer bundled CMake/ninja, in react-native-multi-tv-app-sample | The first native build fails with an unrelated-looking error | Important |
| 4 | A Fire TV pattern or API for pairing a phone as a companion camera or input device | Fire TV sticks have no camera; every camera-based TV app has to build its own pairing and relay | Important |
| 5 | Bedrock errors that say which layer denied the call, plus a "test this principal" button | We couldn't tell IAM from model access | Important |
| 6 | `vega device screenshot` | Needed for docs, bug reports and demo videos | Nice-to-have |
| 7 | Vega installer: exit non-zero on missing dependencies, a resumable install, parallel decompression | A failed install looked like success, and extraction crashed our host | Important |

## Friction log

See `SUBMIT/FRICTION_LOG.md` (28 entries: Fire OS build, AWS, a 17-step Vega SDK/VVD trial on WSL2, and data tools),
each with steps, expected and actual results, severity, time lost, workaround and a suggested fix.

---

## AWS Builder mini-challenge

**AWS services:** Amazon Polly, Amazon Bedrock (Amazon Nova Micro and Nova Lite via the Converse API), and AWS IAM.

**How they're used:** both services sit in the app's runtime path, called by our Node.js relay server with the AWS SDK
for JavaScript v3.

- **Polly** gives the TV its voice. Every prompt ("Your turn. Sign milk.") is synthesized with a neural voice, cached on
  disk by a hash of voice and text, and served to the TV as an mp3. A family hears each phrase from the cache after the
  first time, so cost stays near zero.
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

Documentation: the "How AWS is used" and "AWS permissions" sections of `server/README.md`, and the architecture diagram
in the main README.

TODO: if `smoke:aws` still fails at submission time, add one honest line: "At submission, our shared AWS account was
waiting on an admin to attach the IAM policy; the demo shows the fallback path."

## Open Source mini-challenge

- **Contribution URL:** TODO
- **Project repository URL:** TODO
- **GitHub username:** TODO

**What we did:** a pull request to AmazonAppDev/react-native-multi-tv-app-sample that documents why native Android/Fire
OS builds fail on Windows, and how to fix it. Separately, First Signs itself is released under the MIT licence, including
the relay server, the phone camera page, the Fire TV app, and the full training, evaluation and export pipeline for the
sign model.

**How it works:** on Windows, the sample's native modules (react-native-screens, expo-modules-core,
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

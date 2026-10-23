# First Signs: friction log

Everything that slowed us down while building First Signs: a Vega OS port running on a real Fire TV Stick, the same
port on the Vega Virtual Device (VVD), the Vega SDK install on WSL2, a sideloadable Fire OS APK, AWS, and data tools.
46 entries. Logged as it happened, 2026-10-17 to 2026-10-23 (AEDT).

**Host:** Windows 11 Home (build 26200), 32 GB RAM, GTX 1660, a nearly full C: drive and a spare D: drive. Vega work ran
in WSL2 (kernel 6.18.33.2) with WSLg, on Ubuntu 26.04 LTS, with Vega SDK 0.24.12112 and Vega CLI 1.4.5.

**Device:** Fire TV Stick HD (2nd Gen), software "OS 2.0 (2602000051520)", 1 GB RAM class, on home Wi-Fi.

**Format of each entry:** task, steps, expected, actual, severity, time lost, workaround, suggested fix. "Time lost" is
what we measured or noted at the time; "not recorded" means we didn't time it, and we have not guessed.

**Severity scale:** **High** = blocks the build or the feature with no obvious way forward. **Medium** = costs real time
or needs a non-obvious workaround. **Low** = noise, confusion, or a small detour.

## Summary

| ID | Area | Issue | Severity |
|---|---|---|---|
| R1 | Vega real device / buying | Retail Fire TV Stick HD and 4K Select are Vega OS with no ADB; not clear when buying | Medium |
| R2 | Vega real device / Developer Mode | Developer options shows only a QR code until the device name is pressed 7 times | Medium |
| R3 | Vega CLI / Developer Mode | `vega devmode login` in WSL needs an unlocked OS keyring | Medium |
| R4 | Vega real device / connection | Nothing listens on the network until Connection Mode is set to TCP/IP | Low |
| R5 | Vega real device / OS version | Stick reports OS 2.0; SDK 0.24 docs and templates target OS 1.2 | Low |
| R6 | Vega w3cmedia | mp4 clips never played on the real stick; no error, and no logs left afterwards | High |
| R7 | Vega real device / memory | ANR kill from graphics-memory (CMA) exhaustion; no documented texture budget | High |
| R8 | Vega real device / performance | Live mirror lagged: UI thread couldn't keep up with ~15 SVG redraws a second plus the sprite animation | Medium |
| R9 | Vega CLI | No screenshot or screen-record command for real devices | Medium |
| P1 | Vega port / templates | Amazon's sample is RN 0.72 / kepler 2.x; `vega project generate` gives RN 0.83 / kepler 4.x | Low |
| P2 | Vega port / npm | Confusing dist-tags on `@amazon-devices` packages | Low |
| P3 | Vega Virtual Device | VVD killed when the launching `wsl.exe` call returns | Low |
| P4 | Vega Virtual Device | Key injection undocumented; `inputd-cli` needs evdev names | Low |
| P5 | React Native for Vega | OK button arrives as `enter`, not `select` as in the sample | Low |
| P6 | Vega logging | Release-build `console.log` never appears in `loggingctl log` | Medium |
| P7 | Vega Virtual Device | `SpatialNavigationScrollView` froze the whole VVD display | Medium |
| P8 | Vega Virtual Device | Display freezes survive reinstall and relaunch; only a hard restart recovers | Medium |
| P9 | Vega w3cmedia (VVD) | Clip drawn about 2x, cropped and frozen in a small view | Medium |
| F1 | Fire OS / RN multi-TV sample | Native build fails on Windows paths over 260 characters (ninja "still dirty") | High |
| F2 | Fire OS / RN multi-TV sample | Expo module versions in the sample don't match its Expo SDK | Medium |
| F3 | Fire OS / RN multi-TV sample | Disk space for the first native build is undocumented | Medium |
| F4 | Fire OS / RN multi-TV sample | Moving the repo breaks Yarn workspace junctions | Low |
| F5 | Fire OS / RN multi-TV sample | Noisy, alarming `yarn install` warnings | Low |
| F6 | Fire OS build workaround | robocopy `/XD android` silently excludes needed `node_modules` folders | Low |
| F7 | Fire OS testing | No Fire OS emulator image to test against | Medium |
| A1 | AWS IAM + Bedrock + Polly | Access denied everywhere, and the principal can't discover why | High |
| A2 | AWS Bedrock | Cross-region inference profiles need two kinds of ARN in the policy | Medium |
| V1 | Vega SDK installer | `jq` missing: installer prints an error but exits 0 | Medium |
| V2 | Vega SDK installer | Single-threaded bzip2 VVD extraction; host ran out of commit memory and WSL went read-only | High |
| V3 | Vega SDK installer | `~/vega/env` never written after an interrupted install | Medium |
| V4 | Vega SDK installer | Re-running a component install fails without a TTY, and marks it installed | Medium |
| V5 | Vega project / npm | Interrupted `npm install` leaves a broken tree that a retry doesn't repair | Low |
| V6 | Vega helloWorld template | `@babel/runtime` not a direct dependency; Metro can't resolve it | Medium |
| V7 | Vega Virtual Device | VVD crashes a few seconds after boot on WSLg's d3d12 GL driver | High |
| V8 | Vega Virtual Device | `--no-gl-accel` keeps it up, but the screen is black | Medium |
| V9 | Vega CLI | `run-app` right after "Virtual device ready" fails with a JavaScript error | Low |
| V10 | Vega CLI | No screenshot command | Low |
| V11 | Vega CLI | `vvman command not found` warning on every call | Low |
| V12 | Vega Virtual Device | Host memory pressure while the VVD runs | Medium |
| D1 | Data (non-Amazon) | GISLR handedness convention undocumented; no pose visibility | Medium |
| D2 | Data (non-Amazon) | Kaggle anonymous downloads rate limited | Medium |
| D3 | Data (non-Amazon) | PopSign only offers whole-sign tars up to 3 GB | Medium |
| D4 | Data (non-Amazon) | Mixed frame rates and colour ranges in one dataset | Low |
| D5 | Data (non-Amazon) | Every PopSign clip filmed hand-held, so two-handed signs appear one-handed | Medium |
| D6 | Tools (non-Amazon) | MediaPipe handedness docs don't match measured behaviour | Medium |
| D7 | Tools (non-Amazon) | ffmpeg single-image output fails on full-range input | Low |

**Totals:** 46 entries: 9 on a real Vega stick (R), 9 on the Vega port in the VVD (P), 12 on the Vega SDK install on
WSL2 (V), 7 Fire OS (F), 2 AWS (A), 7 data and tools (D). High: 6 (R6, R7, F1, A1, V2, V7). Medium: 24. Low: 16.

---

## Vega OS on a real Fire TV Stick

First Signs runs natively on this stick, and our demo video is filmed on it. These entries cover getting from a retail
stick to the app running well. What worked first time, and is not friction: the CLI Developer Mode flow once the
keyring was unlocked (no per-device portal registration), `vega exec vda connect` over Wi-Fi, `vega device
install-app` and `launch-app`, an app with `[os.version] 1.2` running on OS 2.0, and `vega device copy-logs`, which
gave us the crash report that solved R7.

### R1. Retail Vega sticks have no ADB, and that isn't clear when buying
- **Task:** buy a Fire TV stick to test our Fire OS (Android) build.
- **Steps:** bought a Fire TV Stick HD (2nd Gen) at retail.
- **Expected:** a Fire OS device with ADB debugging in Developer options.
- **Actual:** the retail Fire TV Stick HD and 4K Select models run Vega OS, which has no ADB and doesn't run APKs. The
  product listing doesn't make the OS a developer will get obvious.
- **Severity:** Medium.
- **Time lost:** not recorded. The bigger cost: our Fire OS build is tested only on an Android TV emulator.
- **Workaround:** we ported the app to React Native for Vega and made the stick the demo device.
- **Suggested fix:** a developer page that lists which retail devices run Vega OS vs Fire OS, and whether they have ADB.

### R2. Developer options shows only a QR code
- **Task:** enable developer features on the retail stick.
- **Steps:** Settings > My Fire TV > Developer options.
- **Expected:** toggles for developer features.
- **Actual:** only a QR code to developer.amazon.com/apps-and-games/vega. A port scan found nothing open except 8009
  (Cast). The way in, pressing the **device name** in Settings > My Fire TV > About **7 times**, isn't shown on the TV.
- **Severity:** Medium.
- **Time lost:** not recorded.
- **Workaround:** press the device name 7 times ("You are now a developer"), then Developer options > Developer Mode >
  Continue for a 6-digit code, then `vega devmode login` and `vega devmode enable-device --code <code>` on the PC.
- **Suggested fix:** say "press the device name in About 7 times" on the QR page itself.

### R3. `vega devmode login` in WSL needs an unlocked OS keyring
- **Task:** log in for Developer Mode from WSL2.
- **Steps:** `vega devmode login`.
- **Expected:** browser OAuth, then a stored token.
- **Actual:** it fails without an unlocked gnome-keyring, which a WSL shell doesn't have by default.
- **Severity:** Medium.
- **Time lost:** not recorded.
- **Workaround:** a helper script that starts `dbus-run-session`, unlocks gnome-keyring, then runs vega:
  `wsl dbus-run-session -- bash -l ~/vega_apps/vkr.sh devmode ...`.
- **Suggested fix:** a file-based token option (or `--no-keyring`) for headless Linux and WSL, or a clear error that
  names the keyring.

### R4. Nothing listens on the network until Connection Mode is TCP/IP
- **Task:** connect to the stick over Wi-Fi.
- **Steps:** `vega exec vda connect <stick-ip>:5555` after enabling Developer Mode.
- **Expected:** a connection.
- **Actual:** the stick only accepts connections after Developer options > **Connection Mode** > TCP/IP > standard port
  5555 > Continue, which reboots it. Before Developer Mode, port 5555 is closed, which looks like a broken device.
- **Severity:** Low.
- **Time lost:** not recorded.
- **Workaround:** set Connection Mode to TCP/IP, wait for the reboot, then `vega exec vda connect` and `vega device list`.
  USB with `vega exec vda tcpip 5555` is the alternative, but WSL2 can't see USB without usbipd-win.
- **Suggested fix:** put the Connection Mode step in the Developer Mode page, not only in vda-over-tcpip.

### R5. OS 2.0 on the stick, OS 1.2 in the docs
- **Task:** check the app would install before trying.
- **Expected:** docs saying which device OS versions SDK 0.24 apps run on.
- **Actual:** the stick reports "OS 2.0 (2602000051520)". SDK 0.24's release notes and the generated manifest target
  OS 1.2 (`[os.version] min/target = 1.2`), and no doc we found mentions OS 2.0. It installed and ran fine.
- **Severity:** Low.
- **Time lost:** none, but we planned a fallback to the RN 0.72 template in case it was rejected.
- **Workaround:** none needed.
- **Suggested fix:** a compatibility table: SDK version vs device OS versions.

### R6. w3cmedia mp4 never played on the real stick
- **Task:** play the Deaf signer's reference clip in the lesson's teacher pane.
- **Steps:** w3cmedia `VideoPlayer` with `KeplerVideoSurfaceView`, streaming the mp4 from our server, ordered like the
  official sample (initialize, load, `loadedmetadata`, mount the surface, play).
- **Expected:** the clip plays.
- **Actual:** stuck, no frames, and no error in JS. On the VVD it was zoomed, cropped and frozen (P9). It couldn't be
  diagnosed afterwards: `loggingctl log` with no options prints help, and the journal had rotated by then.
- **Severity:** High (the core teaching video).
- **Time lost:** not recorded.
- **Workaround:** bundled JPG sprite sheets (12 fps) animated by one `<Image>` in a clipped View. Same real signer,
  reliable looping, slow motion still works, and no network or media services needed.
- **Suggested fix:** a w3cmedia troubleshooting page (MIME type, HTTP Range, the `secureplayback` privilege and media
  category), and an error event when playback can't start.

### R7. ANR kill from graphics-memory exhaustion
- **Task:** run lessons on the stick.
- **Expected:** the app runs.
- **Actual:** the app was killed with an ANR. The crash report from `vega device copy-logs` showed graphics memory (CMA)
  exhausted by large decoded textures: our sprite sheets decoded to up to 7.6 MB each.
- **Severity:** High.
- **Time lost:** not recorded.
- **Workaround:** halved the sheets (frames 320 to 240 px tall, sheets capped at 1024 px, so each decodes to about 4 MB
  or less) and mounted only one sheet at a time.
- **Suggested fix:** document the texture memory budget per device, and have the VVD optionally emulate it.

### R8. Live mirror lagged on the stick
- **Task:** draw the family's live skeleton from the phone's landmark frames (the phone sends about 18.6 a second).
- **Expected:** a smooth, current mirror, as on the VVD and the emulator.
- **Actual:** the stick's UI thread couldn't keep up with about 15 SVG redraws a second plus the sprite animation, so the
  mirror fell behind. Frames also piled up in the relay.
- **Severity:** Medium.
- **Time lost:** not recorded.
- **Workaround:** draw at 10 fps on Vega, always the newest frame (no queue); the relay drops landmark frames (never
  predictions) when the TV's socket falls behind. Measured: the tunnel adds about 40 ms one way.
- **Suggested fix:** a performance guide for React Native for Vega on 1 GB devices (SVG cost, recommended frame rates).

### R9. No screenshot or screen-record command for real devices
- **Task:** capture screenshots and the demo video from the stick.
- **Steps:** `vega device --help` (CLI 1.4.5).
- **Expected:** `screenshot` and `screen-record` subcommands.
- **Actual:** none. The `vega device` commands cover logs, files, apps, ports and shell, but not the screen. (VVD
  screenshots work through the emulator console; see V10.)
- **Severity:** Medium.
- **Time lost:** not recorded.
- **Workaround:** filmed the TV with a camera for the demo video.
- **Suggested fix:** `vega device screenshot` and `vega device screen-record`.

---

## Vega OS port on the Vega Virtual Device

Porting our Fire OS app to React Native for Vega and testing it in the VVD, before the real stick. Full detail, with
the remaining risks, is in `tv/VEGA.md`.

### P1. Two different React Native baselines
- **Task:** pick the RN version for the port.
- **Expected:** the multi-TV sample's Vega app and the CLI template agree.
- **Actual:** the sample's Vega workspace is RN 0.72 / react-native-kepler 2.x; `vega project generate --template
  helloWorld` gives RN 0.83 / kepler 4.x, with a different runtime module and build command (`build-vega` vs
  `build-kepler`).
- **Severity:** Low.
- **Time lost:** not recorded.
- **Workaround:** used the RN 0.83 template and ported the sample's patterns (TVEventHandler, w3cmedia).
- **Suggested fix:** a note in the sample saying which baseline new apps should start from.

### P2. Confusing dist-tags on `@amazon-devices` packages
- **Task:** find the Vega versions of react-native-svg and AsyncStorage.
- **Actual:** tags like `3.0.9000000001`, `-rn-83` and `rn83-alpha-old`; the packages carry `temporary-alias-for-package`
  metadata but must be imported by their `@amazon-devices/...` names.
- **Severity:** Low.
- **Time lost:** not recorded.
- **Workaround:** `npm view @amazon-devices/<pkg> dist-tags`, then `latest`.
- **Suggested fix:** a table of library equivalents and versions per RN baseline.

### P3. VVD killed when the launching `wsl.exe` call returns
- **Task:** start the VVD from a script run as `wsl -- bash script.sh`.
- **Actual:** `nohup vega virtual-device start &` (and a nohup'd node stub) were killed when `wsl.exe` returned ("Wait
  for emulator ... to shutdown gracefully").
- **Severity:** Low (WSL is unsupported).
- **Time lost:** not recorded.
- **Workaround:** `setsid nohup ... < /dev/null & disown`.
- **Suggested fix:** a `--detach` option on `vega virtual-device start`.

### P4. Key injection undocumented
- **Task:** drive the remote in the VVD for automated tests.
- **Actual:** no docs. We found `inputd-cli` on the device; names like `dpad_right` give "invalid button value", but
  evdev names work (`KEY_RIGHT`, `KEY_ENTER`, `KEY_BACK`).
- **Severity:** Low.
- **Time lost:** not recorded.
- **Workaround:** `vega exec vda shell "inputd-cli button_press KEY_ENTER"`.
- **Suggested fix:** document `inputd-cli`, or add `vega device press-key`.

### P5. OK arrives as `enter`, not `select`
- **Task:** handle the OK button with `TVEventHandler`.
- **Expected:** eventType `select`, as the sample maps it.
- **Actual:** `KEY_ENTER` arrives as `enter`; `KEY_SELECT` produced no JS event.
- **Severity:** Low.
- **Time lost:** not recorded.
- **Workaround:** map both `select` and `enter`.
- **Suggested fix:** list the eventType values per input in the TVEventHandler docs.

### P6. Release-build `console.log` never appears
- **Task:** read JS logs from the app.
- **Expected:** `loggingctl log` shows them.
- **Actual:** only native `KeplerScript-Native` telemetry appeared; `loggingctl log -S '-10min'` fails to parse.
- **Severity:** Medium.
- **Time lost:** not recorded.
- **Workaround:** relay debug messages and errors over the app's own WebSocket; an ErrorBoundary shows errors on screen.
- **Suggested fix:** route release-build JS console output to the system log, or document how to enable it.

### P7. `SpatialNavigationScrollView` froze the VVD display
- **Task:** open the pack screen (a grid of signs in a scroll view).
- **Actual:** the screen went blank and the whole VVD display froze, while JS kept running.
- **Severity:** Medium.
- **Time lost:** not recorded.
- **Workaround:** a plain View (each pack fits on one screen).
- **Suggested fix:** investigate react-tv-space-navigation's scroll view on Vega, or note it as unsupported.

### P8. Display freezes survive reinstall and relaunch
- **Task:** recover the VVD after a freeze (P7, or after reinstalling an app with a live video surface).
- **Actual:** the display stayed frozen, or on the plain background colour, after reinstall, relaunch and Home.
  `vega virtual-device stop` then start, without checking status, sometimes didn't restart at all.
- **Severity:** Medium.
- **Time lost:** not recorded.
- **Workaround:** a restart script that waits for `"running":false`, kills qemu if needed, then boots.
- **Suggested fix:** a `vega virtual-device restart` that does this.

### P9. w3cmedia clip zoomed, cropped and frozen in the VVD
- **Task:** play an mp4 in a small view.
- **Actual:** drawn about 2x, cropped to the top-left, stuck on an early frame; `scalingmode="fit"` changed nothing.
- **Severity:** Medium.
- **Time lost:** not recorded.
- **Workaround:** sprite sheets (see R6).
- **Suggested fix:** as R6.

---

## Fire OS app: React Native multi-TV sample on Windows 11

### F1. Native build fails when the project path is long
- **Task:** build a debug APK of `apps/expo-multi-tv` from AmazonAppDev/react-native-multi-tv-app-sample, from a normal
  Windows project folder under the user profile.
- **Steps:** `yarn install`, then `gradlew assembleDebug` in the app's `android/` folder. Later, the same for our own app
  (`EXPO_TV=1 expo prebuild`, then `gradlew assembleRelease`).
- **Expected:** a debug APK.
- **Actual:** after about 13 minutes, the CMake builds of react-native-screens, expo-modules-core and
  react-native-reanimated fail with `ninja: error: manifest 'build.ninja' still dirty after 100 tries`. The object file
  paths go over 260 characters. Setting `LongPathsEnabled=1` in the registry does not help, because the ninja bundled
  with SDK CMake 3.22.1 ignores it. Nothing in the error mentions path length.
- **Severity:** High.
- **Time lost:** about 13 minutes per failed build, plus the time to diagnose the cause.
- **Workaround:** build from a short root (`D:\tv` for the sample; our `tv/scripts/build-apk.js` mirrors the app to
  `D:\fs-tv` and builds there). Then delete every `android/build` and `android/.cxx` folder, because they cache the old
  absolute paths. After that, a cold native build took about 12 minutes (549 tasks, armeabi-v7a and arm64-v8a).
- **Suggested fix:** state the short-path requirement in the sample's README for Windows users, or pin a newer CMake
  and ninja that handle long paths. We drafted a README PR for this (`SUBMIT/OSS_PR.md`).

### F2. The sample's Expo module versions don't match its Expo SDK
- **Task:** start a new Fire OS app by copying `apps/expo-multi-tv/package.json` from the sample.
- **Steps:** read the dependency list, then compare it with `npm view expo@54 dependencies`.
- **Expected:** module versions that match `expo ~54.0.0`.
- **Actual:** `expo-constants ~17.0.0`, `expo-font ~13.0.0`, `expo-splash-screen ~0.29.0`, `expo-status-bar ~2.0.0` and
  `expo-linear-gradient ~14.0.0` are the SDK 52 versions (SDK 54 wants `expo-constants ~18`, `expo-font ~14`, and so
  on). The installed tree had `expo 54.0.33` next to `expo-constants 17.0.8`.
- **Severity:** Medium.
- **Time lost:** not recorded.
- **Workaround:** start from a clean `package.json` and let `npx expo install <pkg>` pick versions, with
  `"expo.install.exclude": ["react-native"]` so it keeps `react-native-tvos`.
- **Suggested fix:** run `npx expo install --check` in the sample's CI.

### F3. Disk space for the first native build is undocumented
- **Task:** the first cold native build of the sample.
- **Steps:** `yarn install`, then `gradlew assembleDebug`.
- **Expected:** the prerequisites say how much disk is needed.
- **Actual:** the Gradle and Yarn caches plus the NDK filled a nearly full C: drive, and the build failed in
  `compileDebugKotlin` with `There is not enough space on the disk`.
- **Severity:** Medium.
- **Time lost:** one failed build (not timed separately).
- **Workaround:** set `GRADLE_USER_HOME` to a folder on another drive.
- **Suggested fix:** list the disk needed (about 15 GB for caches plus the NDK) in the prerequisites, and mention
  `GRADLE_USER_HOME`.

### F4. Moving the repo breaks Yarn workspace junctions
- **Task:** move the sample to a short path (the F1 workaround).
- **Steps:** `robocopy` the repo to `D:\tv`.
- **Expected:** a working copy.
- **Actual:** the absolute junctions from `apps/*/node_modules/@multi-tv/shared-ui` to `packages/shared-ui` still point
  at the old location.
- **Severity:** Low.
- **Time lost:** not recorded.
- **Workaround:** recreate the junctions, or re-run `yarn install` in the new location.
- **Suggested fix:** a note next to the F1 fix: "clone to a short path; don't move an installed repo".

### F5. Noisy `yarn install`
- **Task:** install the sample's dependencies.
- **Expected:** a clean install, or warnings that say they are harmless.
- **Actual:** many YN0002/YN0086 peer-dependency warnings (mostly in the Vega workspace) and YN0066
  `typescript@patch ... Cannot apply hunk #1`.
- **Severity:** Low.
- **Time lost:** a few minutes checking whether they mattered (they don't).
- **Workaround:** none needed.
- **Suggested fix:** a line in the README saying these warnings are expected, or fix the peer ranges.

### F6. robocopy `/XD android` excludes more than intended
- **Task:** mirror our TV app to `D:\fs-tv` for the build (F1 workaround), excluding the generated `android/` folder.
- **Steps:** `robocopy tv D:\fs-tv /MIR /XD android ...`, then `expo prebuild`.
- **Expected:** only the top-level `android/` is skipped.
- **Actual:** `/XD android` matches every folder named `android`, including
  `node_modules/@expo/config-plugins/build/android`, and prebuild fails with `Cannot find module './android/Manifest'`.
- **Severity:** Low.
- **Time lost:** not recorded.
- **Workaround:** exclude by full path only.
- **Suggested fix:** if Amazon documents the short-path workaround (F1), show a copy command that excludes by full path.

### F7. No Fire OS emulator image
- **Task:** test the Fire OS build. (The stick we bought turned out to run Vega OS, see R1, so this emulator is the
  only place the Fire OS build has run.)
- **Steps:** `sdkmanager --list`, looking for a Fire OS or Amazon system image.
- **Expected:** a Fire OS image, or a documented closest match.
- **Actual:** only Google's `android-tv` and `google-tv` images are listed.
- **Severity:** Medium.
- **Time lost:** not recorded.
- **Workaround:** `system-images;android-30;android-tv;x86` (Android 11, the same base as Fire OS 8) with WHPX and the
  AVD on D:. The release APK installs and runs there, and our test script drives it only with
  `adb shell input keyevent` (D-pad 19-23, Back 4). Fire-specific behaviour (the launcher banner in "Your Apps &
  Channels", the remote's menu keys, performance on a stick) is unverified for the Fire OS build.
- **Suggested fix:** say in the Fire TV docs which Android TV emulator image best matches each Fire OS version.

---

## AWS: Polly and Bedrock from the relay server

Setup: `server/`, Node 24, `@aws-sdk` v3.1152.0, region us-east-1, an existing IAM user profile.

### A1. Access denied everywhere, and no way to see why
- **Task:** one Polly neural `SynthesizeSpeech` call and one Bedrock `Converse` call from the server.
- **Steps:** `aws bedrock list-foundation-models --region us-east-1`; `aws bedrock-runtime converse --model-id
  amazon.nova-micro-v1:0` (also `us.amazon.nova-micro-v1:0` and `us.amazon.nova-lite-v1:0`); `aws polly
  synthesize-speech --engine neural --voice-id Joanna`; `aws iam list-attached-user-policies`.
- **Expected:** a model list, a short reply, an mp3.
- **Actual:** every call returns `AccessDeniedException ... no identity-based policy allows the
  bedrock:ListFoundationModels / bedrock:InvokeModel / polly:SynthesizeSpeech / polly:DescribeVoices action`. The IAM
  calls are denied too, so the user can't see which policy is missing. The Bedrock error names the foundation-model
  ARN, not the model-access page, so it isn't clear whether "model access" or IAM is the blocker. (It was IAM.)
- **Severity:** High.
- **Time lost:** not recorded.
- **Workaround:** the server degrades gracefully: `speak` returns `url: null` and the TV shows the text; `coach` returns
  a canned tip from the verified sign description. We wrote a least-privilege inline policy
  (`server/iam-policy.json`) and step-by-step console instructions for an admin, plus `npm run smoke:aws` to confirm.
- **Suggested fix:** make the Bedrock error say which layer denied the call ("IAM denies this; model access is fine"),
  and add a "test this principal" button in the Bedrock console.

### A2. Cross-region inference profiles need two kinds of ARN
- **Task:** allow Nova Micro and Nova Lite through the `us.` inference profiles.
- **Expected:** allowing the inference-profile ARN is enough.
- **Actual:** the policy must allow both the inference-profile ARN and the foundation-model ARN in every region the
  profile routes to (`arn:aws:bedrock:*::foundation-model/...`).
- **Severity:** Medium.
- **Time lost:** not recorded.
- **Workaround:** both ARN types are in `server/iam-policy.json`.
- **Suggested fix:** a copy-paste minimal policy for each inference profile on the Nova model pages.

---

## Vega SDK and Vega Virtual Device on WSL2

Amazon supports Ubuntu 20.04/22.04/24.04 x86_64 and says Windows and WSL are not currently supported. We tried it
anyway, on Ubuntu 26.04 under WSL2 with WSLg, following install-vega-sdk, build-an-app, run-apps (VVD tab) and kvd-issues
for 0.24. **Verdict: it works, with workarounds.** The VVD boots in about 16 seconds via nested KVM, and the helloWorld
template builds and runs, once software GL is forced (V7). No Amazon account was needed for install, VVD, build or
run-app. These steps worked first time and are not friction: KVM access, the lz4/deadsnakes/libpython3.8-dev
prerequisites (deadsnakes has a 26.04 build), Node 22, `vega project generate`, and `vega run-app` once the VVD was up.

### V1. Installer exits 0 when `jq` is missing
- **Task:** install the Vega CLI and SDK.
- **Steps:** a saved copy of `get_vvm.sh` (from `curl -fsSL https://sdk-installer.vega.labcollab.net/get_vvm.sh`), run
  with `NONINTERACTIVE=true`.
- **Expected:** the SDK installs, or the script fails with a non-zero exit code.
- **Actual:** `jq is required. Please install jq and ensure it is on the PATH. Exiting...`, with **exit code 0**. `jq`
  is not in the documented prerequisites. Any script that checks the exit code thinks the install worked.
- **Severity:** Medium.
- **Time lost:** one install attempt.
- **Workaround:** `apt install jq`, then re-run.
- **Suggested fix:** add `jq` to the prerequisites, and exit non-zero when a dependency is missing.

### V2. VVD extraction exhausted host memory and WSL went read-only
- **Task:** the installer's second run, which downloads the SDK and VVD.
- **Steps:** re-ran the installer. Vega CLI 1.4.5 installed to `~/vega/bin`; SDK 0.24.12112 downloaded (about 3.8 GB SDK
  plus an 853 MB VVD archive) and extracted (5.7 GB on disk).
- **Expected:** the install finishes.
- **Actual:** the VVD archive is a single bzip2 stream, decompressed on one core by `dutyfree-vega install --component
  simulator-tv` (100% of one core for 5+ minutes). During it, Windows logged `The paging file is too small for this
  operation to complete`, the WSL ext4 journal aborted, and the distro's root went emergency read-only (`Read-only file
  system`; `Input/output error` reading `/usr/bin/dmesg`). `wsl --terminate` then failed with
  `Wsl/Service/CreateInstance/E_FAIL`. Cause: host commit memory ran out (WSL committing about 10.6 GB while caching GBs
  of extracted files, plus other apps).
- **Severity:** High.
- **Time lost:** download about 20 minutes, extraction 5+ minutes, then recovery (not timed separately).
- **Workaround:** `wsl --shutdown`, then start again: ext4 replayed its journal and mounted read-write with no errors.
  For the rest of the run, a root loop ran `sync; echo 1 > /proc/sys/vm/drop_caches` every 20 seconds to keep the VM's
  page cache down.
- **Suggested fix:** ship the VVD image in a parallel-friendly format (zstd or multi-stream xz), extract with a
  streaming tool, and state the RAM and disk needed during install.

### V3. `~/vega/env` missing after an interrupted install
- **Task:** follow the docs' next step, `source ~/vega/env`.
- **Expected:** the environment file exists.
- **Actual:** the installer writes `~/vega/env` and the PATH lines in `.bashrc` only at the very end, so after V2 they
  were missing and the documented command failed.
- **Severity:** Medium.
- **Time lost:** not recorded.
- **Workaround:** call `~/vega/bin/vega` directly, or add `~/vega/bin` to PATH by hand.
- **Suggested fix:** write the env file first, or make the installer resumable and have it check for a half-finished install.

### V4. Re-running a component install fails without a TTY
- **Task:** resume the VVD component install after V2.
- **Expected:** a re-run picks up where it stopped.
- **Actual:** `VegaSDK Warning: simulator-tv installed, do you want to overwrite?[y/n]:` then `VegaSDK Error:
  Installation failed: EOF when reading a line`. The component was marked installed even though extraction had been
  cut off.
- **Severity:** Medium.
- **Time lost:** not recorded.
- **Workaround:** `yes y | bash $SDK/bin/vega install --component simulator-tv --path
  ~/vega/sdk/vega-virtual-device/main/0.24.12112`.
- **Suggested fix:** respect `NONINTERACTIVE` or add `--force`, and only mark a component installed after it has been
  fully extracted and verified.

### V5. Interrupted `npm install` leaves a broken tree
- **Task:** install the helloWorld project's dependencies.
- **Steps:** `npm install` timed out (`ERR_SOCKET_TIMEOUT`, tarballs taking about 67 seconds each on a slow network);
  retried with `--fetch-timeout=600000 --fetch-retries=5 --maxsockets=8`; then `npm run build:app`.
- **Expected:** the retry leaves a working tree.
- **Actual:** `Error: Cannot find module 'es-abstract/2025/ToString'` from `npm-run-all`. The first install's
  half-written `node_modules` was not repaired by the retry.
- **Severity:** Low (an npm issue, not Vega's).
- **Time lost:** about 3 minutes for the clean reinstall, plus the failed attempts.
- **Workaround:** `rm -rf node_modules && npm install`.
- **Suggested fix:** a troubleshooting line in build-an-app: "if the build can't find a module, delete node_modules and reinstall".

### V6. helloWorld template doesn't depend on `@babel/runtime` directly
- **Task:** `npm run build:app` on a clean tree.
- **Expected:** a build.
- **Actual:** Metro: `Unable to resolve module @babel/runtime/helpers/interopRequireDefault from
  .../@amazon-devices/react-native-kepler/Libraries/Components/ActivityIndicator/ActivityIndicator.js`. `@babel/runtime`
  was only nested under `metro-runtime/node_modules`. Probably the Ubuntu-packaged npm 9.2.0 hoists differently from
  the npm 10 that ships with Node 22.
- **Severity:** Medium.
- **Time lost:** not recorded; the build itself then took about 40 seconds.
- **Workaround:** `npm install @babel/runtime`. The build then produced `.vpkg` files for x86_64, aarch64 and armv7.
- **Suggested fix:** list `@babel/runtime` as a direct dependency in the template, and state the minimum npm version.

### V7. VVD crashes seconds after boot on WSLg
- **Task:** `vega virtual-device start` with default options.
- **Expected:** the VVD boots and stays up.
- **Actual:** `Virtual device ready.` in 16 seconds (with a "Running in Nested Virtualization" warning dialog), then a
  crash about 6 seconds later: crashpad `elf_dynamic_array_reader.h:64 tag not found` in `virtual_device.err`, after
  many `sPrepareTexImage2D:3614 failed validation` lines. `vega virtual-device status` then reports
  `{"running":false}`. Cause: the emulator's host-GPU renderer on WSLg's Mesa d3d12 GL driver.
- **Severity:** High.
- **Time lost:** not recorded.
- **Workaround (the one that works):** `LIBGL_ALWAYS_SOFTWARE=1 GALLIUM_DRIVER=llvmpipe vega virtual-device start
  --timeout 300`. GL acceleration stays on, but Mesa uses llvmpipe software GL instead of d3d12. The VVD boots, stays
  up, and renders the launcher and the app.
- **Suggested fix:** detect the crash and print a hint to use software GL; add this recipe to kvd-issues, even with a
  "WSL is unsupported" caveat.

### V8. `--no-gl-accel` keeps the VVD up, but the screen is black
- **Task:** the documented Ubuntu-x86 option for software rendering.
- **Steps:** `vega virtual-device start --no-gl-accel`, then `vega run-app`.
- **Expected:** the VVD with software rendering.
- **Actual:** it stays up, `vega device list` shows the device, and `vega run-app` installs and launches the app (it
  appears in `vega device running-apps`), but the TV screen is black in the window and in an emulator-console screenshot.
- **Severity:** Medium.
- **Time lost:** not recorded.
- **Workaround:** use the V7 recipe instead.
- **Suggested fix:** document what `--no-gl-accel` does and doesn't render, or make it fall back to llvmpipe.

### V9. `run-app` right after "ready" fails
- **Task:** `vega run-app build/x86_64-release/hellovega_x86_64.vpkg com.dankam.hellovega.main -d VirtualDevice`.
- **Expected:** the app installs and launches.
- **Actual:** the first run straight after `Virtual device ready.` failed with `Vega operation FAILED due to an
  irrecoverable error: Cannot read properties of undefined (reading 'trim')`. It worked on retry about 20 seconds later.
- **Severity:** Low.
- **Time lost:** under a minute.
- **Workaround:** wait 20-30 seconds after "ready".
- **Suggested fix:** have `run-app` wait for the device to be fully ready, and turn the JavaScript error into a readable message.

### V10. No screenshot command
- **Task:** take a screenshot of the VVD.
- **Expected:** a CLI command.
- **Actual:** none in the docs.
- **Severity:** Low.
- **Time lost:** not recorded.
- **Workaround:** the Android emulator console the VVD is built on: connect to `127.0.0.1:5554`, send `auth
  <~/.emulator_console_auth_token>`, then `screenrecord screenshot <dir>`, which gives a 1920x1080 PNG. A Windows
  `PrintWindow` on the WSLg window also works.
- **Suggested fix:** `vega device screenshot`.

### V11. `vvman command not found` on every CLI call
- **Actual:** `[WARN] vvman command not found ... fallback to kepler --v` is printed on every `vega` call.
- **Severity:** Low.
- **Time lost:** none, but it hides real warnings.
- **Suggested fix:** check once and stay quiet, or install `vvman` with the SDK.

### V12. Host memory pressure while the VVD runs
- **Task:** keep the VVD running for testing.
- **Actual:** with the VVD up, Windows commit free fell to 1.3 GB (3.0 GB after stopping it). The host's commit limit is
  49.4 GB (32 GB RAM plus an auto-managed page file of about 18 GB), and WSL is allowed 24 GB. This is the same condition
  that caused V2.
- **Severity:** Medium.
- **Time lost:** none in this run; the VVD was stopped at the end.
- **Workaround:** a larger fixed page file, or a lower `memory=` in `.wslconfig`, before long VVD sessions.
- **Suggested fix:** state the VVD's memory needs, including host-side commit, in the system requirements.

---

## Data and non-Amazon tools

These aren't Amazon tools, but they cost real time on the way to a working Fire TV app, and they may help other teams.

### D1. GISLR handedness convention undocumented, no pose visibility
- **Task:** make training features from GISLR match what the phone sends.
- **Steps:** compared GISLR hand wrists with pose wrists 15/16 over 933k training frames and 332k test frames
  (`model/data/build_cache.py --check`).
- **Expected:** a documented hand-label convention and the same landmark fields as MediaPipe tasks-vision.
- **Actual:** the convention isn't on the dataset page. Measured: GISLR hand labels follow the pose body sides 99.6-99.9%
  of the time, so they are the signer's anatomical hands in an unmirrored image. GISLR has no pose visibility column,
  and the video size isn't published.
- **Severity:** Medium.
- **Workaround:** features ignore visibility, normalise x by shoulder width and y by nose-to-shoulder height (cancelling
  the camera's aspect ratio), and mirror left-dominant clips so the dominant hand is always "right".
- **Suggested fix:** document the convention on the dataset page.

### D2. Kaggle anonymous downloads rate limited
- **Steps:** about 3,400 anonymous per-file downloads, then 48 parallel workers.
- **Actual:** `HTTP 429` with `Retry-After: 240`.
- **Severity:** Medium.
- **Workaround:** one API call for the dataset zip's signed URL, then HTTP Range requests for only the files needed
  (`model/data/fetch_zip_ranges.py`): 31k files (17.8 GB) in about 35 minutes.

### D3. PopSign only offers whole-sign tars
- **Task:** get one clip for each of 40 signs.
- **Actual:** one tar per sign and split, up to 3.1 GB (`milk` train). Individual clips aren't downloadable, and the
  site's preview videos aren't for reuse.
- **Severity:** Medium.
- **Workaround:** the server supports HTTP Range, so we walked each tar's 512-byte headers with Range requests and fetched
  only the chosen members: 607 clips (2.4 GB) instead of about 1 TB.

### D4. Mixed frame rates and colour ranges
- **Actual:** 47 of 607 clips are 120 fps (the rest 30 fps). One signer's clips are 1944x2592 full-range (`yuvj420p`).
  Frame-based trimming was wrong until it was made fps-aware, and full-range output can look washed out on Android decoders.
- **Severity:** Low.
- **Workaround:** trim by each clip's own fps; encode everything to 30 fps, limited range.

### D5. Every PopSign clip filmed hand-held
- **Actual:** signers held the phone to record, so in 607 clips from the 8 test signers both hands are visible in under
  3% of frames. Two-handed signs (book, night, morning, clean, wet, finish, bath, sad, brother, wake) appear one-handed.
- **Severity:** Medium (content, not tooling).
- **Workaround:** none in this dataset; listed as a limitation in the README. It is also the clearest evidence for our
  pitch: a phone in one hand means signing with the other.

### D6. MediaPipe handedness docs vs behaviour
- **Actual:** the docs say handedness labels assume a mirrored selfie image. Measured on `@mediapipe/tasks-vision@0.10.14`
  with raw, unmirrored frames, the labels already match the signer's anatomical hands (626 of 634 hand-frames agree
  with the pose-wrist assignment).
- **Severity:** Medium.
- **Workaround:** assign hands by pose-wrist distance first (as MediaPipe Holistic does), and fall back to the unswapped
  label. The phone page keeps counting agreement in case a future version changes this.

### D7. ffmpeg single-image output on full-range input
- **Actual:** `-frames:v 1 x.jpg` from a `yuvj420p` clip fails with "Non full-range YUV is non-standard".
- **Severity:** Low.
- **Workaround:** pick the sharpest frame with OpenCV (Laplacian variance) and write the JPEG from there.

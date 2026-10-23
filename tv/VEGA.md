# First Signs on Vega OS (Fire TV, React Native for Vega)

This is the Vega OS port of the Fire OS TV app in this folder. It is a separate app at `D:\fs-vega`, which is the
source of truth. It builds inside WSL at `~/vega_apps/fs-vega`, because the Vega SDK is Linux-only and long Windows
paths break the build. The Fire OS app in `tv/` was not modified.

- Package `com.dankam.firstsigns`, component `com.dankam.firstsigns.main`
- RN 0.83 runtime (`@amazon-devices/react-native-kepler` 4.0.x), Vega SDK 0.24.12112, Vega CLI 1.4.5
- `[os.version] min/target = 1.2`

## Status (2026-10-22, tested in the Vega Virtual Device)

| Feature | VVD result | Screenshot |
|---|---|---|
| App boots, theme, fonts, SVG icons | works | `docs/vega-02-home.png` |
| WebSocket to the server, pairing QR + 4-digit code (QR drawn with `@amazon-devices/react-native-svg`) | works | `docs/vega-01-pair-qr.png` |
| Fake-phone pairing, then auto-navigates to Home | works | `docs/vega-02-home.png` |
| D-pad focus (react-tv-space-navigation), OK, Back | works | `docs/vega-03-pack.png` |
| Lesson: reference sign video | **fixed 2026-10-22 with bundled sprite sheets** (real signer, looping, correct framing, slow motion works) on the VVD. The old w3cmedia path was zoomed/cropped/frozen on the VVD and stuck on the real stick | `D:s-vega\shots\sp06-lesson-a.png`, `sp07-drink-a.png` |
| Live skeleton + colour-coded hand close-up (SVG, ~15 fps) | works | `docs/vega-04-lesson-video-skeleton.png` |
| Countdown, recording bar, `attempt`/`pred` round trip | works | `docs/vega-05-recording.png` |
| Verdict ("Almost! That looked a bit like 'more'") + coach tip | works | `docs/vega-06-verdict.png` |
| Spoken prompts (`speak` -> audio URL -> w3cmedia `AudioPlayer`) | requests sent and answered; could not hear the VVD audio | n/a |
| Settings (server URL) + AsyncStorage persistence | code ported (`@amazon-devices/react-native-async-storage__async-storage`); not exercised | n/a |
| Real Vega stick | **running**: Fire TV Stick HD (2nd Gen, OS 2.0), installed over Wi-Fi with `vega device install-app`; the demo video is filmed on it | 2026-10-23 |

## What changed from the Fire OS app

| Fire OS (Expo + react-native-tvos) | Vega port |
|---|---|
| `expo-video` with bundled mp4 | **Bundled JPG sprite sheets** animated by one `<Image>` in a clipped View (`src/components/SignVideo.tsx`). `scripts/make-sprites.py` (Windows, PIL + `C:fmpeg`) turns `model/export/videos/*.mp4` into `src/generated/sprites/<id>.jpg` (12 fps, 320 px tall, <=2048 px sheets, 40 sheets = 6.4 MB) and `src/generated/sprites.ts`. Re-run it when the clips change. The w3cmedia path (streams `GET /model/videos/<id>.mp4`) is still in the file behind `USE_W3C = false` |
| `expo-audio` | w3cmedia `AudioPlayer`. `src/net/voice.ts` |
| `react-native-svg` | `@amazon-devices/react-native-svg` 3.0.x (same API) |
| `@react-native-async-storage/async-storage` | `@amazon-devices/react-native-async-storage__async-storage`, with a 2.5 s timeout so the app never waits forever. `src/store/store.ts` |
| `react-native-keyevent` + BackHandler | `TVEventHandler` (`left/right/up/down/select/enter/playpause`) + BackHandler `hardwareBackPress`, deduped. `src/remote/RemoteControlManager.ts` |
| `expo-keep-awake` | removed (no Vega equivalent found in time) |
| `Linking` deep link `firstsigns://config?server=` | kept, but guarded and time-limited; the Settings screen is the supported path |
| `SpatialNavigationScrollView` on the pack screen | replaced by a plain View; it froze the VVD renderer, and packs have at most 12 signs |
| | ErrorBoundary that shows render errors on screen and sends them to the server as `{type:"debug"}` |

The built-in default server is set in `D:\fs-vega\src\generated\config.json`. It is now `ws://192.168.0.60:8788/ws`, the
real server on this PC. The VVD can reach that address too. To use the WSL stub from the VVD, change it to
`ws://10.0.2.2:8790/ws`, either in that file or in Settings.

## Build and run in the VVD (from Windows / Git Bash)

```bash
export MSYS_NO_PATHCONV=1
wsl -d Ubuntu -- bash /mnt/d/fs-vega/scripts/wsl-sync-build.sh Release   # rsync D:\fs-vega -> WSL, npm install if needed, build all 3 archs
wsl -d Ubuntu -- bash /mnt/d/fs-vega/scripts/wsl-vvd-up.sh               # VVD with llvmpipe, detached (setsid), waits ~25 s after boot
wsl -d Ubuntu -- bash /mnt/d/fs-vega/scripts/wsl-stub.sh --fake-phone --pair-delay 3000   # stub on :8790 (+ /model/videos)
wsl -d Ubuntu -- bash /mnt/d/fs-vega/scripts/wsl-run.sh                  # install + launch x86_64 vpkg
wsl -d Ubuntu -- bash /mnt/d/fs-vega/scripts/wsl-key.sh KEY_ENTER wait:2 shot:name   # remote keys + screenshots -> D:\fs-vega\shots
wsl -d Ubuntu -- bash /mnt/d/fs-vega/scripts/wsl-vvd-restart.sh          # hard restart when the display freezes
```

Outputs: `~/vega_apps/fs-vega/build/{x86_64,aarch64,armv7}-release/firstsigns_<arch>.vpkg`, each about 8.4 MB since the sprite sheets were bundled (2.1 MB before).

Remote keys for `inputd-cli` (run on the device via `vega exec vda shell`) use evdev names: `KEY_UP/DOWN/LEFT/RIGHT`,
`KEY_ENTER` (arrives in JS as eventType `enter`), and `KEY_BACK`.

## Install on the real Vega Fire TV Stick

Target device: Fire TV Stick HD (2nd Gen), Software Version "OS 2.0 (2602000051520)", at 192.168.0.147. The PC is at
192.168.0.60.

### 1. Developer Mode (done on 2026-10-22 by the coordinator)

On a retail stick, Developer options shows only a QR code to developer.amazon.com/apps-and-games/vega until Developer
Mode is enabled. Since SDK 0.24 (6 Aug 2026) this is done from the CLI. Per-device portal registration is no longer
needed.

1. On the stick, go to Settings > My Fire TV > About. Select the **device name** and press OK **7 times** ("You are
   now a developer").
2. Go to Developer options > Developer Mode > Continue. A 6-digit code appears; it is valid for 5 minutes.
3. On the PC, run `vega devmode login`. A browser opens for OAuth; choose Allow.
4. On the PC, run `vega devmode enable-device --code <6 digits>`. Pick the vendor (here "DanVentures"). The stick
   reboots, and Developer Mode then shows Enabled.
   - **In WSL, devmode needs an unlocked gnome-keyring.** Run devmode commands through the helper:
     `wsl dbus-run-session -- bash -l /home/fatal/vega_apps/vkr.sh devmode ...`
5. You need an Amazon Developer account. Only non-`com.amazon` packages can be sideloaded.

Sources: developer.amazon.com/docs/vega/0.24/developer-mode.html, /run-apps.html,
community.amazondeveloper.com/t/authenticate-and-enable-developer-mode-from-the-cli/28885

### 2. Connection: network works, but only after Developer Mode

- Before Developer Mode, nothing listens on the stick (port scan: only 8009/Cast; 5555 closed). That is expected.
- **Over the network (no cable):** on the stick, go to Settings > My Fire TV > About > Developer Options >
  **Connection Mode** > TCP/IP > Use standard port 5555 > Continue (the stick reboots). Then on the PC:
  `vega exec vda connect 192.168.0.147:5555` and `vega device list`.
- **Over USB, then network:** connect a data cable to the PC and run `vega exec vda tcpip 5555`. Unplug, then
  `vega exec vda connect 192.168.0.147:5555`.
  - WSL2 cannot see USB devices without usbipd-win. Amazon also discourages VM USB passthrough. Prefer the TCP/IP route.
- Source: developer.amazon.com/docs/vega/0.24/vda-over-tcpip.html. Amazon lists Windows/WSL as "not supported/tested";
  everything here ran in WSL2 anyway.

### 3. Build, install and launch (armv7: Fire TV sticks are armv7)

```bash
# 1. set the server in D:\fs-vega\src\generated\config.json (already ws://192.168.0.60:8788/ws), then build
wsl -d Ubuntu -- bash /mnt/d/fs-vega/scripts/wsl-sync-build.sh Release
# 2. install + launch (same commands as scripts/wsl-device-install.sh)
vega exec vda connect 192.168.0.147:5555
vega device list                                  # note the device serial it prints
vega device -d <serial> install-app --packagePath ~/vega_apps/fs-vega/build/armv7-release/firstsigns_armv7.vpkg
vega device -d <serial> launch-app --appName com.dankam.firstsigns.main
# uninstall: vega device -d <serial> uninstall-app --appName com.dankam.firstsigns.main
```

- `vega run-app <vpkg> <component> -d <serial>` also works; that is what the VVD flow uses.
- A sideloaded app may not appear in the launcher; `launch-app` is the documented way to start it.
- Device logs: `vega exec vda shell` then `loggingctl log -f`.

## Remaining risks

1. **w3cmedia sign video: replaced by sprite sheets (2026-10-22).** On the real stick the clips never played (stuck);
   on the VVD they were zoomed/cropped/frozen. The root cause on hardware was **not confirmed**: by the time it was
   investigated the app was not running and the stick's journal had rotated. Likely contributors, if anyone retries
   `USE_W3C = true`: (a) `server/src/static.js` serves `.mp4` as `application/octet-stream` and ignores `Range`
   (always 200, no `Accept-Ranges`), which media stacks often need; (b) the old code mounted the surface and called
   `play()` before `loadedmetadata` (now reordered to match the official sample); (c) the manifest lacks the sample's
   `needs.privilege com.amazon.media.secureplayback` and `com.amazon.category.kepler.media` category.
2. **OS 2.0 vs SDK 0.24 / RN 0.83.** SDK 0.24 release notes say it targets OS 1.2. OS 2.0 is newer and is not
   mentioned in any doc found. RN 0.83 on Vega is "early access". If the install is rejected for OS/runtime reasons,
   run `vega update` for a newer SDK. Otherwise regenerate from the `helloWorld-rn72` template (RN 0.72,
   react-native-kepler 2.x, react 18) and copy `src/` across; the code doesn't use React 19-only APIs.
3. **VVD display freezes.** It happened after killing/reinstalling an app that had a live video surface, and once on
   a scroll view. The JS kept running, as the server log showed. The only fix is a hard VVD restart.
4. **Video needs the server.** Clips stream from `http://<server>/model/videos/<id>.mp4`. The real `server/` serves
   them; the stub needed `scripts/vega-stub-server.js` (a copy with a `/model/` route).
5. **No keep-awake** on Vega yet, so the screensaver may start during long hands-free sessions.
6. Audio playback was not heard (VVD audio not checked). The request/response path works.

## Friction log (Vega port, 2026-10-22)

| # | Step | Expected | Actual | Workaround |
|---|---|---|---|---|
| 1 | Any `wsl` call | WSL answers | Every `wsl.exe` call hung, including `echo`. Hung calls from 17 Oct were still in the process list; the VM had been wedged since the 17 Oct commit-exhaustion crash | `wsl --shutdown`, then start again |
| 2 | `wsl -- bash -c '... $PATH ...'` from Git Bash | Expands inside Linux | `$VAR`s were expanded on the Windows side, so bash got a Windows PATH full of `(x86)` and failed with a syntax error | Put commands in script files and run `wsl -- bash /mnt/.../script.sh` |
| 3 | `nohup vega virtual-device start &` inside `wsl -- bash script` | VVD keeps running | VVD (and a nohup'd node stub) were killed when the `wsl.exe` call returned ("Wait for emulator ... to shutdown gracefully") | `setsid nohup ... < /dev/null & disown` |
| 4 | Pick an RN version | Sample monorepo (`D:\tv\apps\vega`) is the reference | The sample is RN 0.72 / react-native-kepler 2.x; `vega project generate --template helloWorld` gives RN 0.83 / kepler 4.x with different runtime-module and build command (`build-vega` vs `build-kepler`) | Used the RN 0.83 template; ported the sample's patterns (TVEventHandler, w3cmedia) |
| 5 | Find Vega versions of libs | Docs list | npm tags are confusing (`3.0.9000000001`, `-rn-83`, `rn83-alpha-old`). The packages carry `temporary-alias-for-package` metadata but must be imported by their `@amazon-devices/...` names | `npm view @amazon-devices/<pkg> dist-tags`; used `latest` |
| 6 | Run the stub server inside the RN tree | `ws` works | `WebSocketServer is not a constructor`: the RN tree hoists an old `ws` | Run the stub from its own folder with `ws@8` (`scripts/wsl-stub.sh`) |
| 7 | VVD to dev server | `10.0.2.2` reaches the host, as on the Android emulator | It works: `10.0.2.2` and the WSL eth0 IP reach WSL, and the Windows LAN IP 192.168.0.60:8788 is reachable too. The first failure was only the stub having died (row 3) | Probe with `vega exec vda shell "curl ..."` |
| 8 | Drive the remote | Docs | No docs for injecting keys. Found `inputd-cli` on the device; names like `dpad_right` give "invalid button value". Evdev names work (`KEY_RIGHT`, `KEY_ENTER`, `KEY_BACK`) | `vega exec vda shell "inputd-cli button_press KEY_ENTER"` |
| 9 | OK button in JS | eventType `select` (sample maps `select`) | `KEY_ENTER` arrives as eventType `enter`; `KEY_SELECT` produced no JS event | Map both `select` and `enter` |
| 10 | See `console.log` | `loggingctl log` shows JS logs | Release-build JS console output never appeared (only native `KeplerScript-Native` telemetry). `loggingctl log -S '-10min'` fails to parse | Relay debug/errors over the app's WebSocket to the stub; ErrorBoundary renders errors on screen |
| 11 | Open the pack screen | Grid with scroll | `SpatialNavigationScrollView` (react-tv-space-navigation 6 beta): screen went blank and the whole VVD display froze, while JS kept running | Plain View (packs fit on one screen) |
| 12 | VVD display freeze recovery | Reinstall/relaunch recovers | It stayed frozen; Home did nothing. `vega virtual-device stop` + start without checking status sometimes didn't restart at all | `scripts/wsl-vvd-restart.sh` waits for `"running":false`, kills qemu if needed, then boots |
| 13 | w3cmedia video in a small view | Clip fits its view | On the VVD the clip is drawn ~2x, cropped to the top-left, and seems stuck on an early frame; `scalingmode="fit"` changed nothing | Open: verify on hardware; fallback is the skeleton reference |
| 14 | `vega devmode` in WSL (coordinator) | OAuth login works | Needs an unlocked gnome-keyring; it fails without one | `wsl dbus-run-session -- bash -l ~/vega_apps/vkr.sh <vega args>` (unlocks the keyring, then runs vega) |
| 15 | Retail stick Developer options | Toggles | Only a QR code to developer.amazon.com/apps-and-games/vega, and no ADB-style port open (only 8009) | Press the device name in About 7 times, then use the devmode CLI flow (section 1) |
| 16 | w3cmedia mp4 on the real stick | Clip plays in the teacher pane | Stuck, no frames (VVD: zoomed/cropped/frozen). Not diagnosable afterwards: `loggingctl log` with no options prints help, and the journal had rotated | Bundled JPG sprite sheets + `<Image>` offset animation (`scripts/make-sprites.py`); verified on the VVD. Capture `loggingctl log -o short_precise` **while** reproducing next time |
| 17 | Reinstall onto a running VVD | App relaunches | Display stayed on the plain background colour after `run-app` (friction 12 again) | `wsl-vvd-restart.sh`, then `wsl-run.sh` |

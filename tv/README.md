# First Signs: TV app (Fire TV / Android TV / web)

The living-room half of First Signs. It shows a QR code so a phone can pair as the camera, then teaches ASL first
words in routine packs (Mealtime, Bedtime, Bath, Family). For each sign it plays a reference performance recorded by Deaf
signers as an animated hand-and-arm skeleton, counts the family in, draws their live mirrored skeleton next to it, and
shows the phone's verdict, with a coaching tip when it was a miss. There is also a "Family round" turn-taking game and a
progress page. Everything is driven with the remote: D-pad, OK and Back.

React Native for TV (`react-native-tvos` 0.81) on Expo SDK 54, structured like Amazon's
[react-native-multi-tv-app-sample](https://github.com/AmazonAppDev/react-native-multi-tv-app-sample) (MIT-0). The remote
handling and the `withKeyEvent` config plugin are adapted from it. Focus is handled in JS by `react-tv-space-navigation`,
so the same navigation code runs on Fire OS, the web and (later) Vega.

## Screens
| Screen | What it does |
| --- | --- |
| Pair | `hello` as `tv`, shows `phoneUrl` as a QR code plus the 4-digit code, waits for `paired`. "Just watch for now" skips. |
| Home | The four packs (with learned counts), Family round, Progress, Connect phone, About, Settings. |
| Pack | A grid of signs with 0-3 stars each. |
| Lesson | The reference skeleton with its credit line and description. **Your turn** sends `attempt`, runs the 3-2-1 countdown and recording bar, draws the live skeleton from `frame`s, then shows the `pred` result: confetti if ok; if missed, "looked a bit like X" plus a `coach` tip. Also Try again, Slow motion and Next. Back cancels an attempt in flight (`cancel`). |
| Family round | Pick players (Mum, Dad, Grandma...), a pack and the number of turns. Players take turns on random signs; a right answer scores 1, or 2 on a streak of 3 or more. "Show me first" lets you peek. Ends with a scoreboard. |
| Progress | Signs learned per pack, stored on the TV (AsyncStorage). "Start over" asks you to press twice. |
| About | Says this is a practice buddy and not a teacher, points families to Deaf-led ASL classes, credits the data, and explains privacy. |
| Settings | Server URL (typed with the TV keyboard), voice prompts, mirror the teacher, slow motion, and connection info. |

Spoken prompts go TV -> `speak` -> `audio` URL (Polly mp3) and are played with `expo-audio`. They're cached per text
for the session. If the server doesn't answer, the app simply stays silent: every prompt is also shown on screen.

## Data
`npm run sync` (it also runs automatically before every build) reads `../model/export/signs.json` and `refs/<id>.json`
and writes a compact copy to `src/generated/`. The compact copy keeps only pose landmarks 11-24 and the two hands
(x/y), resampled to 15 fps, and **never face landmarks**. Until the model export exists, the script falls back to
`scripts/fixture-signs.json` with **synthetic placeholder motion**. In that case the app labels the animation
"Placeholder motion, not a real sign", shows a "Preview build" note on Home, and does not show the
"Recorded by Deaf signers" credit. **Rebuild after the model agent exports.**

## Configure the server
- At build time, the default URL is `FS_SERVER_URL`. If that isn't set, it's `ws://<this PC's LAN IPv4>:8788/ws`,
  detected by `scripts/write-config.js` and printed during the build.
- At run time, go to **Settings -> Server address**. Press OK on the box, type the address, then press
  "Save and reconnect". The setting persists on the device.
- **From the PC, with no typing on the TV:**
  `adb shell am start -a android.intent.action.VIEW -d "firstsigns://config?server=ws://192.168.0.60:8788/ws"`.
  This deep link saves the URL and reconnects.
- On the web, add `?server=ws://host:port/ws` to the address (and `&screen=home` to skip pairing).
- After a dropped connection the TV reconnects and asks for the same room code (`hello` with `code`, which `server/`
  supports), so a paired phone stays paired.
- Release builds allow cleartext `ws://`/`http://` (`usesCleartextTraffic`) so the TV can use the LAN server directly.

## Build the APK (Windows)
Prerequisites: Node 18+, JDK 17 (`JAVA_HOME`), and the Android SDK (`ANDROID_HOME`, with platform 36 and build-tools 36).
```
cd tv
npm install
npm run android:release        # = node scripts/build-apk.js
```
The script mirrors `tv/` to **`D:\fs-tv`** and runs `EXPO_TV=1 expo prebuild` plus `gradlew assembleRelease --no-daemon`
there, with `GRADLE_USER_HOME=D:\AndroidBuild\gradle-home`. It then copies the APK to **`tv/dist/first-signs.apk`**.
It builds on D: because under the long Desktop path the CMake/ninja object paths go over 260 characters and the native
modules fail. You can override this with `FS_BUILD_DIR`, `FS_ABIS` (default `armeabi-v7a,arm64-v8a,x86`; many Fire TV
sticks run a 32-bit userland, and x86 is only for the emulator) and `FS_SERVER_URL`.
The release build is signed with the debug key, which is fine for sideloading but not for the Appstore.

## Sideload onto the Fire TV stick
1. On the stick, go to **Settings -> My Fire TV -> About** and click the device name 7 times to unlock Developer options.
   Then go to **Settings -> My Fire TV -> Developer options** and turn on **ADB debugging** (and "Apps from Unknown
   Sources" if it's listed).
2. Find the stick's IP in **Settings -> My Fire TV -> About -> Network**.
3. From the PC (on the same Wi-Fi):
   ```
   adb connect <stick-ip>:5555        # accept the "Allow USB debugging?" prompt on the TV the first time
   adb -s <stick-ip>:5555 install -r tv/dist/first-signs.apk
   adb -s <stick-ip>:5555 shell am start -n com.dankam.firstsigns/.MainActivity
   ```
   The app also appears under **Your Apps & Channels** with the First Signs banner.
4. Start the server on the PC (`server/`, port 8788). If the PC's IP changed since the build, fix it in Settings on the TV.
5. Useful while testing: `adb -s <ip>:5555 logcat *:S ReactNativeJS:V ReactNative:V` and
   `adb -s <ip>:5555 exec-out screencap -p > shot.png`.

## Test without the stick or the real server
- **Stub server:** `node scripts/stub-server.js --fake-phone [--port 8790]` implements PROTOCOL.md section 1. It pairs a
  fake phone after a couple of seconds, streams synthetic frames at 15 fps, answers each `attempt` with
  `phone_state` + `pred` (about 50% ok, and a miss is always followed by an ok), answers `speak` with a chime WAV and
  `coach` with a canned tip. Without `--fake-phone` it just relays a real phone. The stub doesn't use Polly or Bedrock.
- **Web, keyboard as remote:** `npm run export:web`, serve `dist-web/` (e.g. `python -m http.server 8091 --directory dist-web`),
  then `python -I scripts/web-drive.py`. That script drives every screen with arrows, Enter and Escape only, asserts the
  flow (pair -> lesson miss -> tip -> retry ok -> Back x2 -> family round to the scoreboard -> progress -> about ->
  settings -> progress survives a reload) and saves screenshots to `docs/`.
- **Android TV emulator:** API 30 `android-tv;x86` image, AVD `fs_tv30` stored on D: (`ANDROID_AVD_HOME=D:\AndroidBuild\avd`),
  WHPX acceleration. Run the stub, then:
  `ADB_SERIAL=emulator-5554 FS_SERVER=ws://10.0.2.2:8790/ws node scripts/emu-drive.js --install dist/first-signs.apk`.
  This installs the APK, sets the server through the deep link (10.0.2.2 is the host PC as seen from the emulator),
  drives the app only with `adb shell input keyevent` (D-pad, OK, Back) and saves `docs/emu-*.png`. uiautomator can't
  dump the screen while the skeletons animate, so the attempt flow is checked from screenshots, not text.

## Performance notes (Fire TV sticks are weak)
- The skeleton is one `<Svg>` with three `<Path>`s (arms, hand bones, joints) plus a head-guide circle. Incoming
  frames are written to a ref, and a 15 fps timer re-renders only the skeleton component.
- The reference playback runs at 15 fps from pre-resampled data. Confetti and the recording bar use the native driver.
- The old architecture (`newArchEnabled: false`), as in the Amazon sample. No reanimated, no video.

## Vega OS (Fire TV with Vega) notes
- The remote layer already has a `RemoteControlManager.kepler.ts` (Vega TVEventHandler) next to the Android and web
  ones. Focus is JS-side (`react-tv-space-navigation`), which is the approach the multi-TV sample uses for its Vega app.
- To target Vega, add the screens to a Vega app (the `apps/vega` workspace pattern from the sample) and swap these:
  `expo-audio` -> Vega's W3C media/audio API, AsyncStorage -> `@amazon-devices/react-native-async-storage__async-storage`,
  and check `react-native-svg` support on Vega (`@amazon-devices/react-native-svg`). The Vega Virtual Device runs in WSL2
  on this machine (see `../../vega_test/FRICTION.md`). This is a stretch goal and hasn't been built yet.

## Words we use
The app never says "translate" or "interpret". It's hearing families **learning** ASL, crediting the Deaf signers, and
pointing people to Deaf-led classes. Accuracy claims belong in the top-level README, measured on held-out signers.

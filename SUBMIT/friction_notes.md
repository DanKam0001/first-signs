
## Toolchain setup, Fire OS (react-native-multi-tv-app-sample, Windows 11), 2026-10-17

- **Path length breaks native builds (Severity: High).**
  - **Task:** `gradlew assembleDebug` for apps/expo-multi-tv from a normal Windows project path.
  - **Expected:** a debug APK.
  - **Actual:** `ninja: error: manifest 'build.ninja' still dirty after 100 tries` in the CMake builds of react-native-screens, expo-modules-core and react-native-reanimated, after about 13 minutes. Object paths go over 260 characters. LongPathsEnabled=1 does not help, because the ninja bundled with SDK CMake 3.22.1 ignores it.
  - **Workaround:** move the repo to a short root (`D:\tv`). Then delete every `android/build` and `android/.cxx` folder, because they cache absolute paths.
  - **Suggestion:** document a short-path requirement for Windows in the sample README, or pin a newer CMake/ninja.
- **Disk usage (Severity: Medium).** The first cold build plus the Gradle and Yarn caches filled a nearly full C: drive (`There is not enough space on the disk` in compileDebugKotlin). The workaround was to set `GRADLE_USER_HOME` on another drive. **Suggestion:** state the disk needed (about 15 GB for caches plus the NDK) in the prerequisites.
- **Moving the repo breaks Yarn workspace junctions (Severity: Low).** robocopy does not move the absolute junctions from `apps/*/node_modules/@multi-tv/shared-ui` to `packages/shared-ui`. The workaround is to recreate them, or re-run `yarn install`.
- **Noisy install (Severity: Low).** `yarn install` prints many YN0002/YN0086 peer-dependency warnings (mostly in the vega workspace) and YN0066 "typescript@patch ... Cannot apply hunk #1". These are harmless but alarming to newcomers.
- **Time to first APK:** about 12 minutes for a cold native build once the paths were fixed (549 tasks, armeabi-v7a and arm64-v8a).

The Vega SDK on WSL2 has its own 17-step log in `../vega_test/FRICTION.md`. It needs jq, needs a software-rendering workaround for the VVD display on WSLg, and the installer reports success (exit 0) when its dependencies are missing.

## AWS from the relay server (server/, Node 24, @aws-sdk v3.1152.0, us-east-1), 2026-10-17

- **IAM user cannot call Polly or Bedrock, and cannot discover what it may call (Severity: High).**
  - **Task:** one Polly neural `SynthesizeSpeech` and one Bedrock `Converse` call from the server with the `opencv-hackathon` profile.
  - **Steps:** `aws bedrock list-foundation-models --region us-east-1`; `aws bedrock-runtime converse --model-id amazon.nova-micro-v1:0` (also `us.amazon.nova-micro-v1:0`, `us.amazon.nova-lite-v1:0`); `aws polly synthesize-speech --engine neural --voice-id Joanna`; `aws iam list-attached-user-policies`.
  - **Expected:** a model list, a short reply, an mp3.
  - **Actual:** every call is `AccessDeniedException ... no identity-based policy allows the bedrock:ListFoundationModels / bedrock:InvokeModel / polly:SynthesizeSpeech / polly:DescribeVoices action`, and the IAM calls are denied too, so the user cannot even see which policy is missing. The Bedrock error names the foundation-model ARN, not the model-access page, so it is not obvious whether "model access" or IAM is the blocker (it is IAM).
  - **Workaround:** the server falls back gracefully (`audio` with `url: null`, canned coaching tip from signs.json) until an admin attaches `server/iam-policy.json` as an inline policy. For cross-region inference profiles (`us.amazon.nova-*`) the policy must allow both the inference-profile ARN and the foundation-model ARN in every region the profile routes to (`arn:aws:bedrock:*::foundation-model/...`).
  - **Suggestion:** a Bedrock console "test this principal" button, or an error that says "IAM denies this; model access is fine".
- **MediaPipe handedness docs vs behaviour (Severity: Medium, not an Amazon tool).** The docs say handedness labels assume a mirrored selfie image. Measured on `@mediapipe/tasks-vision@0.10.14` with raw, unmirrored frames, the labels already match the signer's anatomical hands (626 of 634 hand-frames agree with the pose-wrist assignment; swapped labels agree in 6-8). Workaround: assign hands by pose-wrist distance first (as MediaPipe Holistic does) and fall back to the unswapped label; the self-check counter stays in the phone page.

## Fire OS TV app (tv/, built from react-native-multi-tv-app-sample patterns, Windows 11), 2026-10-17

- **The sample's Expo module versions don't match its Expo SDK (Severity: Medium).**
  - **Task:** start a new Fire OS app by copying `apps/expo-multi-tv/package.json` from AmazonAppDev/react-native-multi-tv-app-sample.
  - **Steps:** read the dependency list, then compare it with `npm view expo@54 dependencies`.
  - **Expected:** versions that match `expo ~54.0.0`.
  - **Actual:** `expo-constants ~17.0.0`, `expo-font ~13.0.0`, `expo-splash-screen ~0.29.0`, `expo-status-bar ~2.0.0` and `expo-linear-gradient ~14.0.0` are the SDK 52 versions (SDK 54 wants `expo-constants ~18`, `expo-font ~14` and so on). The installed tree had `expo 54.0.33` next to `expo-constants 17.0.8`.
  - **Workaround:** start from a clean `package.json` and let `npx expo install <pkg>` pick the versions (with `"expo.install.exclude": ["react-native"]` so it keeps `react-native-tvos`).
  - **Suggestion:** run `npx expo install --check` in the sample's CI.
- **`expo prebuild` + Gradle can't run from the project's real path on Windows (Severity: High, same root cause as the toolchain entry above).**
  - **Task:** `node scripts/build-apk.js` (prebuild with `EXPO_TV=1`, then `gradlew assembleRelease`).
  - **Workaround:** the script mirrors `tv/` to `D:\fs-tv` with robocopy and builds there, with `GRADLE_USER_HOME` on D:, and copies the APK back. One gotcha in that workaround: robocopy's `/XD android` matches every folder named `android`, including `node_modules/@expo/config-plugins/build/android`, so prebuild then fails with "Cannot find module './android/Manifest'". Exclude by full path only.
- **No Fire OS emulator to test against (Severity: Medium).**
  - **Task:** test the Fire OS build before the Fire TV Stick arrives.
  - **Steps:** `sdkmanager --list`, looking for any Fire OS / Amazon system image.
  - **Expected:** a Fire OS image, or a documented closest match.
  - **Actual:** only Google's `android-tv` / `google-tv` images are listed.
  - **Workaround:** `system-images;android-30;android-tv;x86` (Android 11, the same base as Fire OS 8) with WHPX, AVD stored on D:. The release APK installs and runs there and is fully driven with `adb shell input keyevent` (D-pad 19-23, Back 4). Fire-specific behaviour (the launcher banner in "Your Apps & Channels", the remote's menu keys, performance on a stick SoC) is unverified until the real device arrives.
  - **Suggestion:** say clearly in the Fire TV docs which Android TV emulator image best matches each Fire OS version.

# Draft PR for AmazonAppDev/react-native-multi-tv-app-sample

Not opened yet. Fork the repo, make the README change below on a branch, push, and open the PR with this title and body.
Then put the PR URL (or the fork/branch URL if it isn't merged) into the Devpost Open Source field.

Checked against the upstream README at commit `d435082` (4 Oct 2026): "Getting Started > Prerequisites" lists Node,
Yarn and platform tools, and "Building and Running > Platform-Specific Instructions > Android TV" has no Windows notes.

---

## Title

docs: Windows build notes for Android TV / Fire OS (260-char path limit, disk space)

## Body

### Problem

On Windows, building `apps/expo-multi-tv` for Android TV / Fire OS fails if the repo is cloned under a typical user
folder (for example `C:\Users\<name>\Desktop\projects\...`). After about 13 minutes, the CMake builds of
`react-native-screens`, `expo-modules-core` and `react-native-reanimated` stop with:

```
ninja: error: manifest 'build.ninja' still dirty after 100 tries
```

The cause is path length: the generated object file paths go over Windows' 260-character limit. Turning on
`LongPathsEnabled` in the registry doesn't help, because the ninja bundled with the Android SDK's CMake 3.22.1 doesn't
use long paths. The error message never mentions paths, so it is hard to diagnose.

A second, related problem: the first cold build plus the Gradle and Yarn caches and the NDK need roughly 15 GB. On a
nearly full system drive the build fails in `compileDebugKotlin` with `There is not enough space on the disk`.

### Reproduction

- Windows 11, Android SDK with CMake 3.22.1, JDK 17, Node, Yarn 4.
- Clone to a long path, `yarn install`, then build the Android app (`gradlew assembleDebug` in
  `apps/expo-multi-tv/android`).

### Workaround (tested)

1. Clone to a short root, for example `D:\tv` or `C:\tv`. With the repo at `D:\tv`, the same build completed: about
   12 minutes cold, 549 tasks, armeabi-v7a and arm64-v8a.
2. If you already built from a long path, delete every `android\build` and `android\.cxx` folder before rebuilding;
   they cache absolute paths.
3. Clone fresh rather than moving an installed repo. Moving it leaves the Yarn workspace junctions
   (`apps/*/node_modules/@multi-tv/shared-ui`) pointing at the old location. If you did move it, run `yarn install` again.
4. If the system drive is short of space, put the Gradle cache on another drive with `GRADLE_USER_HOME`.

### Change

This PR only adds documentation: a "Windows notes" block under the Android TV build instructions, and a disk-space line
in Prerequisites. No code changes.

A longer-term fix would be pinning a newer CMake/ninja for the native modules (via `expo-build-properties` or
`android/build.gradle`) so long paths work. I haven't tested that, so it isn't part of this PR.

### Why it matters

Windows is a common development machine for Fire TV developers, and this is the first native build most people run
from the sample. The failure costs about 13 minutes per attempt and gives no hint about the cause.

---

## Proposed README diff

```diff
@@ ### Prerequisites @@
 - **Node.js**: v18 or higher
 - **Yarn**: v4.5.0 (configured via packageManager field)
 - **Platform-specific tools**:
   - **Android TV**: Android Studio with Android SDK
   - **Apple TV**: Xcode (macOS required) with tvOS SDK
   - **Fire TV**: [Amazon Vega SDK](https://developer.amazon.com/docs/vega/0.21/install-vega-sdk.html)
   - **Web**: Modern web browser
+- **Disk space**: about 15 GB free for the first Android build (Gradle and Yarn caches plus the NDK).
+- **Windows**: clone the repo to a short path such as `C:\tv` or `D:\tv`. See [Windows notes](#windows-notes).

@@ #### Android TV @@
 Or directly from the app directory:

 ```bash
 cd apps/expo-multi-tv
 yarn android
 ```

+##### Windows notes
+
+Native Android builds on Windows fail if the repo path is long. The symptom is
+`ninja: error: manifest 'build.ninja' still dirty after 100 tries` in the CMake builds of
+`react-native-screens`, `expo-modules-core` or `react-native-reanimated`, usually after several minutes.
+The generated object paths exceed Windows' 260-character limit, and the ninja bundled with CMake 3.22.1
+ignores the `LongPathsEnabled` setting.
+
+- Clone the repo to a short root, for example `C:\tv` or `D:\tv`, and build from there.
+- If you already built from a long path, delete every `android\build` and `android\.cxx` folder first.
+  They cache absolute paths.
+- Don't move an installed repo: the Yarn workspace links under `apps/*/node_modules/@multi-tv/` keep pointing
+  at the old location. Clone fresh, or run `yarn install` again after moving.
+- Short of space on the system drive? Put the Gradle cache elsewhere before building:
+
+  ```powershell
+  $env:GRADLE_USER_HOME = "D:\gradle-home"
+  ```
+
```

## Devpost Open Source field values (fill in after pushing)

- **Contribution URL:** TODO (PR link, or fork branch link if unmerged)
- **Project repository URL:** TODO (public First Signs repo)
- **GitHub username:** TODO
- **Description:** see "Open Source mini-challenge" in `SUBMIT/DEVPOST.md`.

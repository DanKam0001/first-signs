#!/usr/bin/env node
// Drives the installed APK on an Android TV emulator (or a Fire TV over adb) with remote key events only,
// checks on-screen text through uiautomator, and saves screenshots to docs/emu-*.png.
//   ADB_SERIAL=emulator-5554 FS_SERVER=ws://10.0.2.2:8790/ws node scripts/emu-drive.js [--install dist/first-signs.apk]
// Needs a server the app can reach (e.g. node scripts/stub-server.js --fake-phone --port 8788).
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ADB = process.env.ADB || path.join(process.env.ANDROID_HOME || process.env.LOCALAPPDATA + '\\Android\\Sdk', 'platform-tools', 'adb');
const SERIAL = process.env.ADB_SERIAL;
const PKG = 'com.dankam.firstsigns';
const DOCS = path.resolve(__dirname, '..', 'docs');
const adbArgs = (a) => (SERIAL ? ['-s', SERIAL, ...a] : a);
const adb = (...a) => execFileSync(ADB, adbArgs(a), { encoding: 'utf8', maxBuffer: 64 << 20 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];

const KEYS = { up: 19, down: 20, left: 21, right: 22, ok: 23, back: 4 };
async function key(name, n = 1, wait = 450) {
  for (let i = 0; i < n; i++) {
    adb('shell', 'input', 'keyevent', String(KEYS[name]));
    await sleep(wait);
  }
}
function shot(name) {
  const buf = execFileSync(ADB, adbArgs(['exec-out', 'screencap', '-p']), { maxBuffer: 64 << 20 });
  const p = path.join(DOCS, `emu-${name}.png`);
  fs.writeFileSync(p, buf);
  console.log('saved', p);
}
function screenText() {
  try {
    adb('shell', 'uiautomator', 'dump', '/sdcard/fs_ui.xml');
    const xml = adb('shell', 'cat', '/sdcard/fs_ui.xml');
    return Array.from(xml.matchAll(/text="([^"]*)"/g)).map((m) => m[1]).join(' | ');
  } catch (e) {
    return '';
  }
}
async function expect(needle, timeout = 10000) {
  const t0 = Date.now();
  let last = '';
  while (Date.now() - t0 < timeout) {
    last = screenText();
    if (last.includes(needle)) return true;
    await sleep(700);
  }
  errors.push(`missing "${needle}" (screen: ${last.slice(0, 200)})`);
  console.log('MISSING', needle);
  return false;
}

(async () => {
  fs.mkdirSync(DOCS, { recursive: true });
  const i = process.argv.indexOf('--install');
  if (i > 0) {
    console.log(adb('install', '-r', process.argv[i + 1]).trim());
  }
  adb('shell', 'am', 'force-stop', PKG);
  adb('shell', 'pm', 'clear', PKG);
  if (process.env.FS_SERVER) {
    // deep link sets the server URL (e.g. ws://10.0.2.2:8790/ws = the host PC from the emulator)
    adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', `"firstsigns://config?server=${process.env.FS_SERVER}"`, PKG);
  } else {
    adb('shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LEANBACK_LAUNCHER', '1');
  }
  await sleep(6000);
  await sleep(1500);
  shot('01-start');
  await expect('Phone connected', 20000);
  await sleep(1000);
  shot('02-home');
  await key('right');
  shot('03-home-focus-moved');
  await key('left');
  await key('ok', 1, 1200);
  await expect('Pick a sign');
  shot('04-pack');
  await key('ok', 1, 2000);
  await sleep(2500); // lesson screens play video, so uiautomator can't dump them: screenshots only from here
  shot('05-lesson-video');
  await key('right');
  await key('ok', 1, 1500);
  shot('05b-lesson-video-slow');
  await key('ok', 1, 800); // back to normal speed
  await key('left');
  // uiautomator can't dump while the skeletons animate (the UI never goes idle), so the attempt
  // flow is checked with fixed waits + screenshots, and text checks resume on static screens.
  await key('ok', 1, 1500);
  shot('06-countdown');
  await sleep(2500);
  shot('07-recording');
  await sleep(6000);
  shot('08-result');
  await sleep(2500);
  shot('08b-result-tip');
  await key('ok', 1, 500); // Try again (or Next on a success)
  await sleep(9000);
  shot('09-second-result');
  await key('back', 1, 2000);
  shot('09b-back-to-pack');
  await key('back', 1, 1200);
  await expect('routine at a time');
  await key('down');
  await key('ok', 1, 1200);
  await expect("Who's playing?");
  shot('10-game-setup');
  await key('down', 5);
  await key('ok', 1, 1500);
  await expect('Turn 1 of');
  await key('ok', 1, 500);
  await sleep(9000);
  shot('11-game-result');
  await key('back', 1, 1200); // leave the round
  await expect('routine at a time');
  await key('down');
  await key('right', 3);
  await key('ok', 1, 1200);
  await expect('Deaf-led ASL class');
  shot('12-about');
  await key('back', 1, 1200);
  await expect('routine at a time');
  console.log(errors.length ? `\nERRORS:\n - ${errors.join('\n - ')}` : '\nALL CHECKS PASSED');
  process.exit(errors.length ? 1 : 0);
})();

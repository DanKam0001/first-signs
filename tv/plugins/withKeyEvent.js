// Adapted from AmazonAppDev/react-native-multi-tv-app-sample (MIT-0), plugins/withKeyEvent.js.
// Forwards remote-control key events to react-native-keyevent so the JS spatial navigation sees
// D-pad presses (DPAD_CENTER/ENTER are otherwise consumed by the focused view on Android TV).
// Change from the sample: null-safe getInstance() so a key press before React Native is up can't crash.
const { withMainActivity } = require("expo/config-plugins");
const { mergeContents } = require("@expo/config-plugins/build/utils/generateCode");

const withImports = (config) =>
  withMainActivity(config, (config) => {
    config.modResults.contents = mergeContents({
      tag: "react-native-keyevent-import",
      src: config.modResults.contents,
      newSrc: ["import android.view.KeyEvent", "import com.github.kevinejohn.keyevent.KeyEventModule"].join("\n"),
      anchor: `import`,
      offset: 1,
      comment: "//",
    }).contents;
    return config;
  });

const withBody = (config) =>
  withMainActivity(config, (config) => {
    const newSrc = [
      "override fun dispatchKeyEvent(event: KeyEvent): Boolean {",
      "  val km: KeyEventModule? = KeyEventModule.getInstance()",
      "  if (km != null && event.keyCode != KeyEvent.KEYCODE_BACK) {",
      "    when (event.action) {",
      "      KeyEvent.ACTION_DOWN -> km.onKeyDownEvent(event.keyCode, event)",
      "      KeyEvent.ACTION_UP -> km.onKeyUpEvent(event.keyCode, event)",
      "    }",
      "  }",
      "  return super.dispatchKeyEvent(event)",
      "}",
    ];
    config.modResults.contents = mergeContents({
      tag: "react-native-keyevent-body",
      src: config.modResults.contents,
      newSrc: newSrc.join("\n"),
      anchor: `class MainActivity`,
      offset: 1,
      comment: "//",
    }).contents;
    return config;
  });

module.exports = function withKeyEvent(config) {
  return withBody(withImports(config));
};

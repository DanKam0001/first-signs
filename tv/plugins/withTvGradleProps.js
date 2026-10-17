// Fire TV sticks run 32-bit (armeabi-v7a) or arm64 userlands; x86 is kept for the Android TV emulator image.
// Dropping x86_64 trims the APK and the build.
const { withGradleProperties } = require("expo/config-plugins");

module.exports = function withTvGradleProps(config) {
  return withGradleProperties(config, (config) => {
    const set = (key, value) => {
      const item = config.modResults.find((p) => p.type === "property" && p.key === key);
      if (item) item.value = value;
      else config.modResults.push({ type: "property", key, value });
    };
    set("reactNativeArchitectures", process.env.FS_ABIS || "armeabi-v7a,arm64-v8a,x86");
    set("org.gradle.jvmargs", "-Xmx4096m -XX:MaxMetaspaceSize=1024m");
    return config;
  });
};

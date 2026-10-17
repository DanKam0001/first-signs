// Metro config. EXPO_TV=1 lets *.tv.tsx files win over *.tsx (same trick as the multi-TV sample).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
if (process.env.EXPO_TV === '1') {
  const exts = config.resolver.sourceExts;
  config.resolver.sourceExts = [...exts.map((e) => `tv.${e}`), ...exts];
}
module.exports = config;

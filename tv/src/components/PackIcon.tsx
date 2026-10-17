import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/** Hand-drawn simple glyphs, no third-party artwork. */
export function PackIcon({ pack, size, color }: { pack: string; size: number; color: string }) {
  let body: React.ReactNode;
  switch (pack) {
    case 'mealtime': // bowl with steam
      body = (
        <>
          <Path d="M10 44 H90 C88 70 70 84 50 84 C30 84 12 70 10 44 Z" fill={color} />
          <Path d="M36 34 C30 26 42 22 36 12 M52 34 C46 26 58 22 52 12 M68 34 C62 26 74 22 68 12" stroke={color} strokeWidth={5} strokeLinecap="round" fill="none" />
        </>
      );
      break;
    case 'bedtime': // crescent moon + star
      body = (
        <>
          <Path d="M62 12 A36 36 0 1 0 88 66 A28 28 0 1 1 62 12 Z" fill={color} />
          <Circle cx={80} cy={22} r={5} fill={color} />
        </>
      );
      break;
    case 'bath': // water drop + bubbles
      body = (
        <>
          <Path d="M50 10 C64 32 76 46 76 62 A26 26 0 0 1 24 62 C24 46 36 32 50 10 Z" fill={color} />
          <Circle cx={84} cy={30} r={7} stroke={color} strokeWidth={4} fill="none" />
          <Circle cx={18} cy={34} r={5} stroke={color} strokeWidth={4} fill="none" />
        </>
      );
      break;
    default: // family: heart
      body = <Path d="M50 86 C20 64 8 48 8 32 A20 20 0 0 1 50 24 A20 20 0 0 1 92 32 C92 48 80 64 50 86 Z" fill={color} />;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {body}
    </Svg>
  );
}

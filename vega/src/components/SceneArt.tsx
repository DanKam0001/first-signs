// Monochrome line illustrations for the "Talk with Baby" scene cards. Hand-drawn simple glyphs on a
// 100x100 grid, one stroke colour, no third-party artwork (same style as PackIcon / Glyph).
import React from 'react';
import Svg, { Circle, Line, Path, Rect } from '@amazon-devices/react-native-svg';
import type { SceneArt as Art } from '../data/talk';

export function SceneArt({ art, size, color }: { art: Art; size: number; color: string }) {
  const st = { stroke: color, strokeWidth: 4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  let body: React.ReactNode;
  switch (art) {
    case 'highchair': // high chair with tray and a little bowl
      body = (
        <>
          <Path d="M34 20 V60 H70" {...st} />
          <Path d="M26 46 H80" {...st} />
          <Path d="M58 46 C58 38 72 38 72 46" {...st} />
          <Path d="M38 60 L28 90 M64 60 L74 90" {...st} />
          <Circle cx={48} cy={30} r={7} {...st} />
        </>
      );
      break;
    case 'cup':
      body = (
        <>
          <Path d="M28 30 H64 L60 84 H32 Z" {...st} />
          <Path d="M64 42 C80 42 80 64 62 66" {...st} />
          <Path d="M40 22 C36 16 44 12 40 6 M52 22 C48 16 56 12 52 6" {...st} strokeWidth={3} />
        </>
      );
      break;
    case 'bowl':
      body = (
        <>
          <Path d="M14 48 H86 C84 72 68 84 50 84 C32 84 16 72 14 48 Z" {...st} />
          <Path d="M60 44 L80 16" {...st} />
          <Circle cx={82} cy={13} r={4} {...st} />
        </>
      );
      break;
    case 'apple':
      body = (
        <>
          <Path d="M50 30 C36 20 16 26 18 50 C20 74 38 90 50 82 C62 90 80 74 82 50 C84 26 64 20 50 30 Z" {...st} />
          <Path d="M50 30 C50 22 52 16 56 12" {...st} />
          <Path d="M56 20 C64 12 72 14 74 18 C68 24 60 24 56 20 Z" {...st} />
        </>
      );
      break;
    case 'sun':
      body = (
        <>
          <Circle cx={50} cy={50} r={17} {...st} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
            const r = (a * Math.PI) / 180;
            return <Line key={a} x1={50 + Math.cos(r) * 27} y1={50 + Math.sin(r) * 27} x2={50 + Math.cos(r) * 38} y2={50 + Math.sin(r) * 38} {...st} />;
          })}
        </>
      );
      break;
    case 'clock':
      body = (
        <>
          <Circle cx={50} cy={50} r={36} {...st} />
          <Path d="M50 50 L34 62 M50 50 V24" {...st} />
          <Circle cx={50} cy={50} r={3} fill={color} />
        </>
      );
      break;
    case 'eyes': // sleepy face
      body = (
        <>
          <Circle cx={50} cy={50} r={36} {...st} />
          <Path d="M32 46 C36 52 42 52 46 46 M54 46 C58 52 64 52 68 46" {...st} />
          <Circle cx={50} cy={67} r={6} {...st} />
        </>
      );
      break;
    case 'moon':
      body = (
        <>
          <Path d="M58 14 A36 36 0 1 0 86 64 A28 28 0 1 1 58 14 Z" {...st} />
          <Path d="M78 18 V30 M72 24 H84" {...st} strokeWidth={3} />
          <Path d="M22 22 V30 M18 26 H26" {...st} strokeWidth={3} />
        </>
      );
      break;
    case 'book':
      body = (
        <>
          <Path d="M50 28 C40 20 24 20 12 24 V78 C24 74 40 74 50 82 C60 74 76 74 88 78 V24 C76 20 60 20 50 28 Z" {...st} />
          <Path d="M50 28 V82" {...st} />
        </>
      );
      break;
    case 'cot':
      body = (
        <>
          <Path d="M14 30 V84 M86 30 V84 M14 44 H86 M14 76 H86" {...st} />
          <Path d="M30 44 V76 M44 44 V76 M58 44 V76 M72 44 V76" {...st} strokeWidth={3} />
          <Path d="M62 18 V28 M67 13 V23" {...st} strokeWidth={3} />
          <Path d="M70 10 H78 L70 20 H78" {...st} strokeWidth={3} />
        </>
      );
      break;
    case 'tub':
      body = (
        <>
          <Path d="M10 50 H90 V58 C90 74 78 82 62 82 H38 C22 82 10 74 10 58 Z" {...st} />
          <Path d="M24 50 V24 C24 16 36 14 38 22" {...st} />
          <Circle cx={56} cy={40} r={6} {...st} />
          <Circle cx={70} cy={34} r={4} {...st} />
          <Circle cx={80} cy={42} r={5} {...st} />
          <Path d="M30 82 L26 90 M70 82 L74 90" {...st} />
        </>
      );
      break;
    case 'drop':
      body = (
        <>
          <Path d="M46 12 C60 34 70 46 70 62 A24 24 0 0 1 22 62 C22 46 32 34 46 12 Z" {...st} />
          <Path d="M34 64 C34 72 40 76 44 76" {...st} strokeWidth={3} />
          <Circle cx={80} cy={34} r={6} {...st} />
          <Circle cx={84} cy={56} r={4} {...st} />
        </>
      );
      break;
    case 'towel':
      body = (
        <>
          <Path d="M14 20 H86" {...st} />
          <Rect x={26} y={20} width={48} height={66} rx={4} {...st} />
          <Path d="M26 70 H74 M26 76 H74" {...st} strokeWidth={3} />
        </>
      );
      break;
    case 'toothbrush':
      body = (
        <>
          <Path d="M16 84 L66 34" {...st} strokeWidth={7} />
          <Path d="M62 30 L80 12 M66 40 L84 22" {...st} />
          <Path d="M64 24 L72 32 M70 18 L78 26 M76 12 L84 20" {...st} strokeWidth={3} />
        </>
      );
      break;
    case 'shower':
      body = (
        <>
          <Path d="M20 12 H50 V24" {...st} />
          <Path d="M32 34 C32 24 68 24 68 34 Z" {...st} />
          {[36, 44, 52, 60].map((x, i) => (
            <Path key={x} d={`M${x} 44 L${x - 4} ${58 + (i % 2) * 8} M${x - 6} ${70 + (i % 2) * 6} L${x - 9} ${80 + (i % 2) * 6}`} {...st} strokeWidth={3} />
          ))}
        </>
      );
      break;
    case 'door':
      body = (
        <>
          <Path d="M28 88 V12 H72 V88" {...st} />
          <Path d="M14 88 H86" {...st} />
          <Circle cx={62} cy={52} r={4} fill={color} />
          <Path d="M80 30 C86 36 86 44 80 50 M86 24 C96 34 96 46 86 56" {...st} strokeWidth={3} />
        </>
      );
      break;
    case 'heart':
      body = <Path d="M50 84 C22 64 10 50 10 34 A19 19 0 0 1 50 26 A19 19 0 0 1 90 34 C90 50 78 64 50 84 Z" {...st} />;
      break;
    case 'wave': // open hand waving
      body = (
        <>
          <Path d="M36 86 C26 76 22 64 24 54 L30 40 C32 36 38 38 37 42 L35 52 L40 22 C41 17 48 18 47 23 L45 46 L50 16 C51 11 58 12 57 17 L54 46 L60 22 C61 17 68 18 67 23 L62 50 L68 36 C70 32 76 34 75 38 L68 64 C64 78 56 86 46 88 Z" {...st} strokeWidth={3.5} />
          <Path d="M80 14 C86 18 88 24 88 30 M14 30 C12 24 14 18 18 14" {...st} strokeWidth={3} />
        </>
      );
      break;
    case 'tear': // sad face with a tear
      body = (
        <>
          <Circle cx={50} cy={50} r={36} {...st} />
          <Circle cx={38} cy={42} r={3.5} fill={color} />
          <Circle cx={62} cy={42} r={3.5} fill={color} />
          <Path d="M36 70 C42 62 58 62 64 70" {...st} />
          <Path d="M66 50 C70 56 72 60 72 62 A4 4 0 0 1 64 62 C64 60 64 56 66 50 Z" {...st} strokeWidth={3} />
        </>
      );
      break;
    case 'smile':
      body = (
        <>
          <Circle cx={50} cy={50} r={36} {...st} />
          <Circle cx={38} cy={42} r={3.5} fill={color} />
          <Circle cx={62} cy={42} r={3.5} fill={color} />
          <Path d="M34 58 C40 72 60 72 66 58" {...st} />
        </>
      );
      break;
    case 'photo':
      body = (
        <>
          <Rect x={14} y={20} width={72} height={60} rx={6} {...st} />
          <Circle cx={50} cy={44} r={10} {...st} />
          <Path d="M30 80 C30 64 70 64 70 80" {...st} />
        </>
      );
      break;
    case 'ball':
      body = (
        <>
          <Circle cx={56} cy={52} r={30} {...st} />
          <Path d="M26 52 H86 M56 22 C42 36 42 68 56 82 M56 22 C70 36 70 68 56 82" {...st} strokeWidth={3} />
          <Path d="M8 70 H18 M6 80 H20" {...st} strokeWidth={3} />
        </>
      );
      break;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {body}
    </Svg>
  );
}

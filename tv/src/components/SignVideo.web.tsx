// Web build: a plain HTML <video> (loops, contain-fit, poster, playbackRate for slow motion).
import React, { useEffect, useRef } from 'react';
import { Image } from 'react-native';

const uri = (mod: any): string | undefined => {
  if (!mod) return undefined;
  if (typeof mod === 'string') return mod;
  const r = (Image as any).resolveAssetSource ? (Image as any).resolveAssetSource(mod) : null;
  return r?.uri || mod?.uri || mod?.default;
};

export function SignVideo({
  video,
  poster,
  width,
  height,
  rate = 1,
  paused = false,
}: {
  video: any;
  poster: any | null;
  aspect?: number;
  width: number;
  height: number;
  rate?: number;
  paused?: boolean;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.playbackRate = rate;
    if (paused) el.pause();
    else el.play().catch(() => {});
  }, [rate, paused]);
  return React.createElement('video', {
    ref,
    src: uri(video),
    poster: uri(poster),
    autoPlay: !paused,
    loop: true,
    muted: true,
    playsInline: true,
    onLoadedMetadata: (e: any) => {
      e.currentTarget.playbackRate = rate;
    },
    style: { width, height, objectFit: 'contain', background: '#000', display: 'block' },
  });
}

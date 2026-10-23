// Real Deaf-signer sign "video" on Fire TV with Vega OS.
//
// Default: a bundled JPG sprite sheet per clip (scripts/make-sprites.py, 12 fps, ~320 px tall) animated by moving one
// <Image> inside a clipped View. w3cmedia never played the clips on the real Vega stick (stuck, no frames) and on the
// VVD drew them zoomed/cropped/frozen, so the reference must not depend on the media pipeline or the network.
// It loops, holds the last frame briefly so the end pose reads, and honours rate (0.5 = slow motion) and paused.
//
// USE_W3C = true switches back to w3cmedia streaming from the server (GET /model/videos/<id>.mp4), following the
// order the official Vega sample uses: initialize -> src/load -> 'loadedmetadata' -> mount KeplerVideoSurfaceView ->
// onSurfaceViewCreated -> setSurfaceHandle -> play().
import React, { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { KeplerVideoSurfaceView, VideoPlayer } from '@amazon-devices/react-native-w3cmedia';
import { conn } from '../net/connection';
import { SPRITES, SPRITE_FPS } from '../generated/sprites';

const USE_W3C = false;
const END_HOLD_MS = 450;

export function fitBox(aspect: number, width: number, height: number) {
  const a = aspect > 0 ? aspect : 0.75;
  return width / height > a ? { w: Math.round(height * a), h: height } : { w: width, h: Math.round(width / a) };
}

export function videoUrl(id: string): string {
  return `${conn.httpBase()}/model/videos/${encodeURIComponent(id)}.mp4`;
}

type Props = {
  video: any; // sign id (string) on Vega
  poster: any | null;
  aspect: number;
  width: number;
  height: number;
  rate?: number;
  paused?: boolean;
};

export function SignVideo(props: Props) {
  const id = String(props.video);
  if (!USE_W3C && SPRITES[id]) return <SignSprite {...props} />;
  return <SignVideoW3C {...props} />;
}

function SignSprite({ video, width, height, rate = 1, paused = false }: Props) {
  const sp = SPRITES[String(video)];
  const [frame, setFrame] = useState(0);
  const frameRef = useRef(0);

  useEffect(() => {
    frameRef.current = 0;
    setFrame(0);
  }, [video]);

  useEffect(() => {
    if (paused || !sp) return;
    const step = Math.max(16, Math.round(1000 / (SPRITE_FPS * (rate > 0 ? rate : 1))));
    let t: ReturnType<typeof setTimeout> | null = null;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      const next = frameRef.current + 1 >= sp.n ? 0 : frameRef.current + 1;
      frameRef.current = next;
      setFrame(next);
      // hold the final pose a moment before looping
      t = setTimeout(tick, next === sp.n - 1 ? step + END_HOLD_MS : step);
    };
    t = setTimeout(tick, step);
    return () => {
      alive = false;
      if (t) clearTimeout(t);
    };
  }, [sp, rate, paused]);

  const box = fitBox(sp.fw / sp.fh, width, height);
  const kx = box.w / sp.fw;
  const ky = box.h / sp.fh;
  const col = frame % sp.cols;
  const row = Math.floor(frame / sp.cols);
  return (
    <View style={[styles.box, { width, height }]}>
      <View style={{ width: box.w, height: box.h, overflow: 'hidden' }}>
        {/* No poster on the sprite path (2026-10-23): it was a second 406x720 texture per sign on a stick that ran
            out of graphics memory, and the bundled sheet loads almost at once anyway. */}
        <Image
          source={sp.src}
          fadeDuration={0}
          resizeMode="stretch"
          style={{
            position: 'absolute',
            left: -col * box.w,
            top: -row * box.h,
            width: sp.cols * sp.fw * kx,
            height: sp.rows * sp.fh * ky,
          }}
        />
      </View>
    </View>
  );
}

function SignVideoW3C({ video, poster, aspect, width, height, rate = 1, paused = false }: Props) {
  const [ready, setReady] = useState(false);
  const [meta, setMeta] = useState(false);
  const player = useRef<VideoPlayer | null>(null);
  const surface = useRef<string | null>(null);
  const rateRef = useRef(rate);
  rateRef.current = rate;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    let alive = true;
    const p = new VideoPlayer();
    player.current = p;
    const onPlaying = () => alive && setReady(true);
    const onMeta = () => alive && setMeta(true);
    const onError = () => console.warn('[SignVideo] error', video);
    const onEnded = () => {
      try {
        p.currentTime = 0;
        p.play();
      } catch {}
    };
    p.initialize()
      .then(() => {
        if (!alive) return;
        p.addEventListener('loadedmetadata', onMeta);
        p.addEventListener('playing', onPlaying);
        p.addEventListener('error', onError);
        p.addEventListener('ended', onEnded);
        p.autoplay = false;
        p.loop = true;
        p.muted = true;
        p.src = videoUrl(String(video));
        p.pause();
        p.load();
      })
      .catch((e: unknown) => console.warn('[SignVideo] init failed', e));
    return () => {
      alive = false;
      try {
        if (surface.current) p.clearSurfaceHandle(surface.current);
        p.removeEventListener('loadedmetadata', onMeta);
        p.removeEventListener('playing', onPlaying);
        p.removeEventListener('error', onError);
        p.removeEventListener('ended', onEnded);
        p.pause();
        p.deinitializeSync(1500);
      } catch (e) {
        console.warn('[SignVideo] deinit failed', e);
      }
      player.current = null;
    };
  }, [video]);

  useEffect(() => {
    try {
      if (player.current && meta) player.current.playbackRate = rate;
    } catch {}
  }, [rate, meta]);
  useEffect(() => {
    const p = player.current;
    if (!p || !meta || !surface.current) return;
    if (paused) p.pause();
    else p.play();
  }, [paused, meta]);

  const box = fitBox(aspect, width, height);
  return (
    <View style={[styles.box, { width, height }]}>
      <View style={{ width: box.w, height: box.h }}>
        {meta ? (
          <KeplerVideoSurfaceView
            style={StyleSheet.absoluteFill}
            onSurfaceViewCreated={(h: string) => {
              surface.current = h;
              const p = player.current;
              if (!p) return;
              p.setSurfaceHandle(h);
              try {
                p.playbackRate = rateRef.current;
              } catch {}
              if (!pausedRef.current) p.play();
            }}
            onSurfaceViewDestroyed={(h: string) => {
              try {
                player.current?.clearSurfaceHandle(h);
              } catch {}
              surface.current = null;
            }}
          />
        ) : null}
        {poster && !ready ? <Image source={poster} style={StyleSheet.absoluteFill} resizeMode="stretch" /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ box: { backgroundColor: '#000', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' } });

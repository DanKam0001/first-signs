// Real Deaf-signer sign video on Fire OS / Android TV, with expo-video (Media3 ExoPlayer underneath).
// Loops, muted, fitted without cropping (the view is sized to the clip's exact aspect and centred on a black
// letterbox), poster until the first frame, playbackRate 0.5 for slow motion.
// surfaceType="textureView": with a SurfaceView (react-native-video 6.19's only mode - its viewType prop is a
// no-op) the picture was drawn zoomed and cropped on the Android TV emulator.
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

export function fitBox(aspect: number, width: number, height: number) {
  const a = aspect > 0 ? aspect : 0.75;
  return width / height > a ? { w: Math.round(height * a), h: height } : { w: width, h: Math.round(width / a) };
}

export function SignVideo({
  video,
  poster,
  aspect,
  width,
  height,
  rate = 1,
  paused = false,
}: {
  video: any;
  poster: any | null;
  aspect: number;
  width: number;
  height: number;
  rate?: number;
  paused?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const player = useVideoPlayer(video, (p) => {
    p.loop = true;
    p.muted = true;
    p.playbackRate = rate;
    if (!paused) p.play();
  });
  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') setReady(true);
      if (status === 'error') console.warn('sign video error');
    });
    return () => sub.remove();
  }, [player]);
  useEffect(() => {
    player.playbackRate = rate;
  }, [player, rate]);
  useEffect(() => {
    if (paused) player.pause();
    else player.play();
  }, [player, paused]);
  const box = fitBox(aspect, width, height);
  return (
    <View style={[styles.box, { width, height }]}>
      <View style={{ width: box.w, height: box.h }}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          nativeControls={false}
          surfaceType="textureView"
          allowsFullscreen={false}
          allowsPictureInPicture={false}
          focusable={false}
        />
        {poster && !ready ? <Image source={poster} style={StyleSheet.absoluteFill} resizeMode="stretch" /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ box: { backgroundColor: '#000', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' } });

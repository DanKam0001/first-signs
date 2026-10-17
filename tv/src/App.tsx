import './remote/configureRemoteControl';
import React, { useEffect, useState } from 'react';
import { Linking, StatusBar, StyleSheet, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { conn } from './net/connection';
import { RouterProvider, Route, routeKey, useRouter } from './nav/router';
import { AboutScreen } from './screens/AboutScreen';
import { GameScreen } from './screens/GameScreen';
import { GameSetupScreen } from './screens/GameSetupScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LessonScreen } from './screens/LessonScreen';
import { PackScreen } from './screens/PackScreen';
import { PairScreen } from './screens/PairScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { progress } from './store/progress';
import { effectiveServerUrl, settings } from './store/settings';
import { colors } from './theme';

function renderRoute(r: Route) {
  switch (r.name) {
    case 'pair':
      return <PairScreen />;
    case 'home':
      return <HomeScreen />;
    case 'pack':
      return <PackScreen packId={r.packId} />;
    case 'lesson':
      return <LessonScreen packId={r.packId} signId={r.signId} />;
    case 'gameSetup':
      return <GameSetupScreen />;
    case 'game':
      return <GameScreen players={r.players} packId={r.packId} turnsEach={r.turnsEach} />;
    case 'progress':
      return <ProgressScreen />;
    case 'about':
      return <AboutScreen />;
    case 'settings':
      return <SettingsScreen />;
  }
}

function Current() {
  const { top } = useRouter();
  // Keyed per navigation so each screen mounts fresh with its own spatial-navigation root.
  return (
    <View key={routeKey(top)} style={StyleSheet.absoluteFill}>
      {renderRoute(top)}
    </View>
  );
}

export default function App() {
  useKeepAwake(); // lessons are hands-free; don't let the TV screensaver kick in
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // firstsigns://config?server=ws://192.168.0.60:8788/ws sets the server from a PC:
    //   adb shell am start -a android.intent.action.VIEW -d "firstsigns://config?server=ws://IP:8788/ws"
    const applyLink = (url: string | null) => {
      const m = url ? /[?&]server=([^&]+)/.exec(url) : null;
      if (!m) return false;
      settings.set({ serverUrl: decodeURIComponent(m[1]) });
      conn.connect(effectiveServerUrl());
      return true;
    };
    const sub = Linking.addEventListener('url', (e) => applyLink(e.url));
    Promise.all([settings.ready, progress.ready]).then(async () => {
      const initial = await Linking.getInitialURL().catch(() => null);
      if (!applyLink(initial)) conn.connect(effectiveServerUrl());
      setReady(true);
    });
    return () => sub.remove();
  }, []);
  if (!ready) return <View style={styles.root} />;
  return (
    <View style={styles.root}>
      <StatusBar hidden />
      <RouterProvider initial={initialRoute()}>
        <Current />
      </RouterProvider>
    </View>
  );
}

function initialRoute(): Route {
  // Web testing helper: ?screen=home skips pairing.
  if (typeof window !== 'undefined' && (window as any).location?.search) {
    const q = new URLSearchParams((window as any).location.search).get('screen');
    if (q === 'home') return { name: 'home' };
  }
  return { name: 'pair' };
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.bg } });

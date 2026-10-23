import './remote/configureRemoteControl';
import React, { useEffect, useState } from 'react';
import { Linking, StatusBar, StyleSheet, Text, View } from 'react-native';
import { conn } from './net/connection';
import { RouterProvider, Route, routeKey, useRouter } from './nav/router';
import { AboutScreen } from './screens/AboutScreen';
import { GameScreen } from './screens/GameScreen';
import { GameSetupScreen } from './screens/GameSetupScreen';
import { DuoScreen } from './screens/DuoScreen';
import { DuoSetupScreen } from './screens/DuoSetupScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LessonScreen } from './screens/LessonScreen';
import { PackScreen } from './screens/PackScreen';
import { PairScreen } from './screens/PairScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TalkScreen } from './screens/TalkScreen';
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
    case 'duoSetup':
      return <DuoSetupScreen />;
    case 'duo':
      return <DuoScreen leftName={r.leftName} rightName={r.rightName} packId={r.packId} rounds={r.rounds} />;
    case 'talk':
      return <TalkScreen />;
    case 'progress':
      return <ProgressScreen />;
    case 'about':
      return <AboutScreen />;
    case 'settings':
      return <SettingsScreen />;
  }
}

// Vega: JS console output is not visible in loggingctl for release builds, so render errors are shown on screen
// and relayed to the server as {type:'debug'} (the stub logs them).
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) {
    return { err };
  }
  componentDidCatch(err: Error, info: any) {
    try {
      conn.send({ type: 'debug', what: 'render_error', message: String(err?.message || err), stack: String(err?.stack || '').slice(0, 1500), component: String(info?.componentStack || '').slice(0, 1500) });
    } catch {}
  }
  render() {
    if (this.state.err) {
      return (
        <View style={[StyleSheet.absoluteFill, { padding: 60 }]}>
          <Text style={{ color: colors.warn, fontSize: 28 }}>Something went wrong: {String(this.state.err.message)}</Text>
          <Text style={{ color: colors.textDim, fontSize: 18, marginTop: 20 }}>{String(this.state.err.stack || '').slice(0, 1200)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function Current() {
  const { top } = useRouter();
  // Keyed per navigation so each screen mounts fresh with its own spatial-navigation root.
  return (
    <View key={routeKey(top)} style={StyleSheet.absoluteFill}>
      <ErrorBoundary>{renderRoute(top)}</ErrorBoundary>
    </View>
  );
}

export default function App() {
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
    // Vega: Linking may be unimplemented; deep links are optional (Settings screen covers the server URL).
    let sub: { remove: () => void } | null = null;
    try {
      sub = Linking.addEventListener('url', (e) => applyLink(e.url));
    } catch (e) {
      console.log('Linking unavailable', e);
    }
    Promise.all([settings.ready, progress.ready]).then(async () => {
      let initial: string | null = null;
      try {
        initial = await Promise.race([
          Linking.getInitialURL(),
          new Promise<null>((r) => setTimeout(() => r(null), 1500)),
        ]);
      } catch {}
      if (!applyLink(initial)) conn.connect(effectiveServerUrl());
      setReady(true);
    });
    return () => sub?.remove();
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

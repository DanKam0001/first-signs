// The two side-by-side panels used by lessons and the family round:
// left = the reference performance (teacher, amber), right = the family member live (teal).
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { CREDIT_PLACEHOLDER, CREDIT_REAL, DATA_IS_PLACEHOLDER, RefData } from '../data/signs';
import { AttemptPhase } from '../net/useAttempt';
import { useConn } from '../net/connection';
import { settings } from '../store/settings';
import { colors, s, type } from '../theme';
import { LiveSkeleton, RefSkeleton } from './Skeleton';

export const PANEL_W = s(780);
export const PANEL_H = s(500);
export const PANEL_H_COMPACT = s(420);

export function PracticeStage({
  refData,
  phase,
  count,
  windowMs,
  showLive,
  compact,
}: {
  refData: RefData | null;
  phase: AttemptPhase;
  count: number;
  windowMs: number;
  showLive: boolean;
  compact?: boolean;
}) {
  const H = compact ? PANEL_H_COMPACT : PANEL_H;
  const st = settings.use();
  const c = useConn();
  return (
    <View style={styles.row}>
      <View>
        <Text style={[styles.panelLabel, { color: colors.teacher }]}>Watch</Text>
        <View style={[styles.panel, { borderColor: colors.teacher, height: H + s(8) }]}>
          <RefSkeleton data={refData} width={PANEL_W} height={H} mirror={st.mirrorTeacher} speed={st.slowTeacher ? 0.5 : 1} />
        </View>
        <Text style={styles.credit} numberOfLines={1}>
          {DATA_IS_PLACEHOLDER ? CREDIT_PLACEHOLDER : CREDIT_REAL}
        </Text>
      </View>
      <View>
        <Text style={[styles.panelLabel, { color: colors.you }]}>You (like a mirror)</Text>
        <View style={[styles.panel, { borderColor: showLive ? colors.you : colors.line, height: H + s(8) }]}>
          {showLive ? (
            <LiveSkeleton width={PANEL_W} height={H} />
          ) : (
            <View style={styles.idle}>
              <Text style={styles.idleText}>{c.paired ? 'Press "Your turn" when you are ready' : 'Connect a phone to try it yourself'}</Text>
            </View>
          )}
          <PhaseOverlay phase={phase} count={count} windowMs={windowMs} noHands={c.phoneState === 'no_hands'} />
        </View>
        <Text style={styles.credit}> </Text>
      </View>
    </View>
  );
}

function PhaseOverlay({ phase, count, windowMs, noHands }: { phase: AttemptPhase; count: number; windowMs: number; noHands: boolean }) {
  const bar = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (phase === 'recording') {
      bar.setValue(0);
      Animated.timing(bar, { toValue: 1, duration: windowMs, easing: Easing.linear, useNativeDriver: true }).start();
    }
  }, [phase, windowMs, bar]);
  if (phase !== 'countdown' && phase !== 'recording' && phase !== 'thinking') return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.overlay]}>
      {phase === 'countdown' ? <Text style={styles.count}>{count}</Text> : null}
      {phase === 'recording' ? (
        <View style={styles.recBox}>
          <Text style={styles.signNow}>Sign now!</Text>
          <View style={styles.recTrack}>
            <Animated.View style={[styles.recFill, { transform: [{ scaleX: bar }] }]} />
          </View>
        </View>
      ) : null}
      {phase === 'thinking' ? <Text style={styles.thinking}>Checking...</Text> : null}
      {noHands && phase !== 'thinking' ? (
        <Text style={styles.noHands}>We can't see your hands - step back so the phone sees your hands and chest</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  panelLabel: { fontSize: type.small, fontWeight: '800', marginBottom: s(8) },
  panel: {
    width: PANEL_W + s(8),
    height: PANEL_H + s(8),
    borderWidth: s(4),
    borderRadius: s(28),
    backgroundColor: colors.bgDeep,
    overflow: 'hidden',
  },
  credit: { color: colors.textDim, fontSize: s(22), marginTop: s(8), width: PANEL_W },
  idle: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: s(40) },
  idleText: { color: colors.textDim, fontSize: type.body, textAlign: 'center' },
  overlay: { alignItems: 'center', justifyContent: 'center' },
  count: {
    color: colors.text,
    fontSize: s(300),
    fontWeight: '900',
    textShadowColor: '#000',
    textShadowRadius: s(20),
  },
  recBox: { position: 'absolute', bottom: s(24), left: s(40), right: s(40), alignItems: 'center' },
  signNow: { color: colors.you, fontSize: type.h2, fontWeight: '900', marginBottom: s(12) },
  recTrack: { width: '100%', height: s(18), borderRadius: s(9), backgroundColor: colors.card, overflow: 'hidden' },
  recFill: { width: '100%', height: s(18), backgroundColor: colors.you, transformOrigin: 'left' } as any,
  thinking: { color: colors.text, fontSize: type.h2, fontWeight: '800', backgroundColor: '#0008', padding: s(20), borderRadius: s(20) },
  noHands: {
    position: 'absolute',
    top: s(24),
    left: s(30),
    right: s(30),
    color: colors.almost,
    fontSize: type.small,
    textAlign: 'center',
    backgroundColor: '#000A',
    padding: s(14),
    borderRadius: s(16),
  },
});

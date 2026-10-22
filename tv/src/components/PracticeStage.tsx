// The two side-by-side panels used by lessons and the family round:
// left = the real Deaf-signer sign video (teacher), right = the family member's live mirror skeleton.
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { CREDIT_PLACEHOLDER, CREDIT_REAL, CREDIT_VIDEO, DATA_IS_PLACEHOLDER, refFor, videoFor } from '../data/signs';
import { AttemptPhase } from '../net/useAttempt';
import { useConn } from '../net/connection';
import { settings } from '../store/settings';
import { colors, hair, s, track, type, zinc } from '../theme';
import { LiveSkeleton, RefSkeleton } from './Skeleton';
import { SignVideo } from './SignVideo';

// The sign videos are portrait (3:4 or 9:16), so the teacher pane is narrow and the live mirror gets the room.
export const TEACHER_W = s(600);
export const LIVE_W = s(1088);
export const PANEL_H = s(450);
export const PANEL_H_COMPACT = s(400);

export function PracticeStage({
  signId,
  hideTeacher,
  phase,
  count,
  windowMs,
  showLive,
  compact,
  cover,
  teacherLabel,
}: {
  signId: string;
  /** Family round: hide the answer until "Show me first". */
  hideTeacher?: boolean;
  /** Shown in the teacher pane instead of the "peek" hint while hideTeacher is on (Talk with Baby scene art). */
  cover?: React.ReactNode;
  /** Replaces the "Watch" label above the teacher pane. */
  teacherLabel?: string;
  phase: AttemptPhase;
  count: number;
  windowMs: number;
  showLive: boolean;
  compact?: boolean;
}) {
  const H = compact ? PANEL_H_COMPACT : PANEL_H;
  const st = settings.use();
  const c = useConn();
  const video = useMemo(() => videoFor(signId), [signId]);
  const refData = useMemo(() => (video ? null : refFor(signId)), [signId, video]);
  const rate = st.slowTeacher ? 0.5 : 1;
  let teacher: React.ReactNode;
  if (hideTeacher && cover) {
    teacher = <View style={styles.idle}>{cover}</View>;
  } else if (hideTeacher) {
    teacher = (
      <View style={styles.idle}>
        <Text style={styles.idleText}>Remember it? Peek with "Show me first"</Text>
      </View>
    );
  } else if (video) {
    teacher = <SignVideo key={signId} video={video.video} poster={video.poster} aspect={video.aspect} width={TEACHER_W} height={H} rate={rate} />;
  } else {
    teacher = <RefSkeleton data={refData} width={TEACHER_W} height={H} mirror={st.mirrorTeacher} speed={rate} />;
  }
  const credit = video ? CREDIT_VIDEO : DATA_IS_PLACEHOLDER ? CREDIT_PLACEHOLDER : CREDIT_REAL;
  return (
    <View style={styles.row}>
      <View style={{ width: TEACHER_W + s(8) }}>
        <Text style={styles.panelLabel}>
          {teacherLabel ?? 'Watch'}
          {st.slowTeacher && !(hideTeacher && cover) ? '  (slow motion)' : ''}
        </Text>
        <View style={[styles.panel, { width: TEACHER_W + s(8), height: H + s(8) }]}>{teacher}</View>
        {video?.note && !hideTeacher ? (
          <Text style={styles.note} numberOfLines={2}>
            {video.note}
          </Text>
        ) : null}
        {hideTeacher && cover ? null : (
          <Text style={styles.credit} numberOfLines={2}>
            {credit}
          </Text>
        )}
      </View>
      <View>
        <Text style={styles.panelLabel}>You (like a mirror)</Text>
        <View
          style={[
            styles.panel,
            { width: LIVE_W + s(8), height: H + s(8) },
            showLive && styles.panelLive,
            phase === 'recording' && styles.panelRec,
          ]}
        >
          {showLive ? (
            <LiveSkeleton width={LIVE_W} height={H} />
          ) : (
            <View style={styles.idle}>
              <Text style={styles.idleText}>{c.paired ? 'Press "Your turn" when you are ready' : 'Connect a phone to try it yourself'}</Text>
            </View>
          )}
          <PhaseOverlay phase={phase} count={count} windowMs={windowMs} noHands={c.phoneState === 'no_hands'} />
        </View>
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
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.overlay, phase === 'countdown' && styles.dim]}>
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
  panelLabel: {
    color: colors.textDim,
    fontSize: s(26),
    fontWeight: '700',
    letterSpacing: track.label,
    marginBottom: s(12),
  },
  panel: {
    borderWidth: hair,
    borderColor: colors.line,
    borderRadius: s(24),
    backgroundColor: colors.bgDeep,
    overflow: 'hidden',
  },
  panelLive: { borderColor: zinc[600] },
  panelRec: { borderColor: colors.text, borderWidth: s(4) },
  credit: { color: colors.textMute, fontSize: s(20), marginTop: s(8) },
  note: { color: colors.textDim, fontSize: s(24), marginTop: s(8), fontStyle: 'italic' },
  idle: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: s(40) },
  idleText: { color: colors.textDim, fontSize: type.small, textAlign: 'center' },
  overlay: { alignItems: 'center', justifyContent: 'center' },
  dim: { backgroundColor: 'rgba(0,0,0,0.7)' },
  count: {
    color: colors.text,
    fontSize: s(300),
    fontWeight: '800',
    letterSpacing: track.hero,
    textShadowColor: '#000',
    textShadowRadius: s(30),
  },
  recBox: { position: 'absolute', bottom: s(28), left: '37%', right: s(32), alignItems: 'center' },
  signNow: { color: colors.text, fontSize: type.h2, fontWeight: '900', letterSpacing: track.h2, marginBottom: s(14) },
  recTrack: { width: '100%', height: s(8), borderRadius: s(4), backgroundColor: zinc[800], overflow: 'hidden' },
  recFill: { width: '100%', height: s(8), backgroundColor: colors.text, transformOrigin: 'left' } as any,
  thinking: {
    color: colors.text,
    fontSize: type.body,
    fontWeight: '700',
    backgroundColor: '#000000',
    borderWidth: hair,
    borderColor: zinc[600],
    paddingVertical: s(18),
    paddingHorizontal: s(34),
    borderRadius: s(18),
    overflow: 'hidden',
  },
  noHands: {
    position: 'absolute',
    top: s(24),
    left: s(30),
    right: s(30),
    color: colors.text,
    fontSize: type.small,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: '#000000',
    borderWidth: hair,
    borderColor: colors.text,
    padding: s(14),
    borderRadius: s(16),
    overflow: 'hidden',
  },
});

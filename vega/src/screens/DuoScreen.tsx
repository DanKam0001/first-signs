// Sign Together (duo mode, PROTOCOL.md 1b): two people sign at once in one camera frame.
// Mirror rule: camera-left person "L" is drawn on the TV's RIGHT, so the player standing on the left (facing the
// TV) is side "R" and appears in the left pane - everyone sees themselves on their own side.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationRoot, SpatialNavigationView } from 'react-tv-space-navigation';
import { Celebration } from '../components/Celebration';
import { LiveSkeleton } from '../components/Skeleton';
import { SignVideo } from '../components/SignVideo';
import { FocusButton, Screen, StatusPill, Verdict } from '../components/ui';
import { CREDIT_VIDEO, Sign, SIGNS, signsInPack, videoFor } from '../data/signs';
import { DuoResult, useConn } from '../net/connection';
import { useAttempt } from '../net/useAttempt';
import { coachTip, speak } from '../net/voice';
import { useBackOverride, useRouter } from '../nav/router';
import { recordAttempt } from '../store/progress';
import { settings } from '../store/settings';
import { colors, hair, s, track, type, zinc } from '../theme';
import { DUO_LEFT_COLOR, DUO_RIGHT_COLOR } from './DuoSetupScreen';

const TEACHER_W = s(360);
const PANE_W = s(640);
const PANE_H = s(420);

type Score = { points: number; streak: number; best: number };
type Verdict = { ok: boolean; present: boolean; top: [string, number][] };

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export function DuoScreen({ leftName, rightName, packId, rounds }: { leftName: string; rightName: string; packId: string; rounds: number }) {
  const router = useRouter();
  const c = useConn();
  const st = settings.use();
  const att = useAttempt();
  const pool = useMemo(() => (packId === 'all' ? SIGNS : signsInPack(packId)), [packId]);
  const deck = useRef<Sign[]>([]);
  const draw = (): Sign => {
    if (!deck.current.length) deck.current = shuffle(pool);
    return deck.current.pop()!;
  };
  const [round, setRound] = useState(0);
  const [sign, setSign] = useState<Sign>(() => draw());
  const [scores, setScores] = useState<{ left: Score; right: Score }>({
    left: { points: 0, streak: 0, best: 0 },
    right: { points: 0, streak: 0, best: 0 },
  });
  const [verdicts, setVerdicts] = useState<{ left: Verdict; right: Verdict } | null>(null);
  const [tips, setTips] = useState<{ left?: string | null; right?: string | null }>({});
  const [burst, setBurst] = useState(0);
  const tries = useRef(0);
  const handled = useRef<string | null>(null);
  const finished = round >= rounds;
  const video = useMemo(() => videoFor(sign.id), [sign.id]);
  const signPack = packId === 'all' ? sign.packs[0] || 'mealtime' : packId;

  useEffect(() => {
    if (!finished) speak(`Sign Together: ${sign.label}. Watch first.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, sign.id, finished]);

  useBackOverride(() => att.cancel());

  // Per-person verdicts from a duo pred. Left player = side "R" (camera right), right player = side "L".
  useEffect(() => {
    const p = att.pred;
    if (att.phase !== 'done' || !p || handled.current === p.id) return;
    handled.current = p.id;
    tries.current += 1;
    const people: DuoResult[] = p.people ?? [{ side: 'L', top: p.top, ok: p.ok, present: true }];
    const get = (side: 'L' | 'R'): Verdict => {
      const r = people.find((q) => q.side === side);
      if (!r) return { ok: false, present: false, top: [] };
      return { ok: !!r.ok && r.present !== false, present: r.present !== false, top: r.top || [] };
    };
    const v = { left: get('R'), right: get('L') };
    setVerdicts(v);
    setTips({});
    const bump = (sc: Score, vd: Verdict): Score => {
      if (!vd.present) return sc;
      if (!vd.ok) return { ...sc, streak: 0 };
      const streak = sc.streak + 1;
      return { points: sc.points + (streak >= 3 ? 2 : 1), streak, best: Math.max(sc.best, streak) };
    };
    setScores((sc) => ({ left: bump(sc.left, v.left), right: bump(sc.right, v.right) }));
    if (v.left.present) recordAttempt(sign.id, v.left.ok);
    if (v.right.present) recordAttempt(sign.id, v.right.ok);
    if (v.left.ok && v.right.ok) {
      setBurst((b) => b + 1);
      speak('You both got it!');
    } else if (v.left.ok || v.right.ok) {
      setBurst((b) => b + 1);
      const missedVd = v.left.ok ? v.right : v.left;
      speak(`${v.left.ok ? leftName : rightName} got it! ${v.left.ok ? rightName : leftName}, ${missedVd.present ? 'almost.' : 'step into view.'}`);
    } else speak('So close, both of you. Watch again.');
    // a coaching tip for each person who was in view but missed
    for (const [key, vd] of [
      ['left', v.left],
      ['right', v.right],
    ] as const) {
      if (vd.present && !vd.ok) {
        setTips((t) => ({ ...t, [key]: undefined }));
        coachTip(sign.id, vd.top, tries.current).then((tip) => setTips((t) => ({ ...t, [key]: tip })));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [att.phase, att.pred]);

  const go = () => {
    setVerdicts(null);
    setTips({});
    speak('Get ready, both of you!');
    att.start(sign.id, signPack, 'duo');
  };
  const next = () => {
    att.reset();
    setVerdicts(null);
    setTips({});
    tries.current = 0;
    setSign(draw());
    setRound((r) => r + 1);
  };

  useEffect(() => {
    if (!finished) return;
    setBurst((b) => b + 1);
    const { left, right } = scores;
    speak(
      left.points === right.points
        ? 'Round over. It is a tie. Great teamwork!'
        : `Round over. Top signer: ${left.points > right.points ? leftName : rightName}. Great signing, both of you!`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  if (finished) {
    const rows = [
      { name: leftName, sc: scores.left, color: DUO_LEFT_COLOR },
      { name: rightName, sc: scores.right, color: DUO_RIGHT_COLOR },
    ].sort((a, b) => b.sc.points - a.sc.points);
    const tie = scores.left.points === scores.right.points;
    return (
      <Screen>
        <Text style={styles.big}>{tie ? "It's a tie - great teamwork!" : `${rows[0].name} wins this round!`}</Text>
        {rows.map((r) => (
          <View key={r.name} style={[styles.boardRow, !tie && r === rows[0] && styles.boardTop]}>
            <Text style={[styles.boardName, !tie && r === rows[0] && styles.onTop]}>{r.name}</Text>
            <Text style={[styles.boardPts, !tie && r === rows[0] && styles.onTop]}>{r.sc.points} pts</Text>
            <Text style={[styles.boardMeta, !tie && r === rows[0] && { color: zinc[600] }]}>best streak {r.sc.best}</Text>
          </View>
        ))}
        <View style={{ height: s(30) }} />
        <SpatialNavigationRoot>
          <SpatialNavigationView direction="horizontal" style={styles.controls}>
            <DefaultFocus>
              <FocusButton label="Play again" accent={colors.good} onSelect={() => router.replace({ name: 'duo', leftName, rightName, packId, rounds })} />
            </DefaultFocus>
            <FocusButton label="Home" onSelect={() => router.reset({ name: 'home' })} />
          </SpatialNavigationView>
        </SpatialNavigationRoot>
        <Celebration burstKey={burst} />
      </Screen>
    );
  }

  const busy = att.busy;
  const result = att.phase === 'done' && verdicts ? verdicts : null;
  const needTwo = c.phoneState === 'need_two';

  let banner: React.ReactNode;
  if (needTwo && (busy || att.phase === 'idle')) {
    banner = <Verdict tone="info" title="Sign Together needs two people: stand side by side, both fully in view." />;
  } else if (result) {
    const both = result.left.ok && result.right.ok;
    const one = result.left.ok !== result.right.ok;
    const missed = result.left.ok ? result.right : result.left;
    const missedName = result.left.ok ? rightName : leftName;
    const away = [!result.left.present && leftName, !result.right.present && rightName].filter(Boolean);
    let msg: string;
    if (both) msg = 'You both got it! ★';
    else if (one)
      msg = `${result.left.ok ? leftName : rightName} got it! ${missedName}, ${missed.present ? 'almost - see the tip.' : 'step into view so the phone can see you.'}`;
    else if (away.length) msg = `${away.join(' and ')}: step into view, side by side, then try again.`;
    else msg = 'So close, both of you - watch the video again.';
    banner = <Verdict tone={both ? 'yes' : !one && away.length ? 'info' : 'almost'} title={msg} />;
  } else if (att.phase === 'timeout' || att.phase === 'offline') {
    banner = <Verdict tone="info" title="The phone didn't answer. Check it, then press Go again." />;
  } else if (busy) {
    banner = <Text style={styles.banner}>{att.phase === 'countdown' ? 'Get ready, both of you!' : att.phase === 'recording' ? 'Sign now - together!' : 'Checking...'}</Text>;
  } else {
    banner = <Text style={styles.hint}>Watch the video, then press Go. Get ready, both of you!</Text>;
  }

  const key = result ? 'result' : busy ? 'busy' : `intro-${att.phase}`;
  let controls: React.ReactNode;
  if (busy) {
    controls = (
      <DefaultFocus>
        <FocusButton label="Stop" onSelect={() => att.cancel()} />
      </DefaultFocus>
    );
  } else if (result) {
    controls = (
      <>
        <DefaultFocus>
          <FocusButton label={round + 1 >= rounds ? 'See scores' : 'Next sign'} accent={colors.good} onSelect={next} />
        </DefaultFocus>
        <FocusButton label="Try again" onSelect={go} />
        <FocusButton label="End" onSelect={() => router.pop()} />
      </>
    );
  } else {
    controls = (
      <>
        <DefaultFocus>
          <FocusButton label={c.paired ? 'Go!' : 'Connect phone'} accent={colors.you} onSelect={() => (c.paired ? go() : router.push({ name: 'pair' }))} />
        </DefaultFocus>
        <FocusButton label={st.slowTeacher ? 'Normal speed' : 'Slow motion'} onSelect={() => settings.set({ slowTeacher: !st.slowTeacher })} />
        <FocusButton label="Skip" onSelect={next} />
        <FocusButton label="End" onSelect={() => router.pop()} />
      </>
    );
  }

  const pane = (who: 'left' | 'right') => {
    const name = who === 'left' ? leftName : rightName;
    const color = who === 'left' ? DUO_LEFT_COLOR : DUO_RIGHT_COLOR;
    const sc = scores[who];
    const vd = result ? result[who] : null;
    const tip = tips[who];
    return (
      <View>
        <Text style={[styles.paneLabel, { color: colors.text }]}>
          {name}  <Text style={styles.paneScore}>{sc.points} pts{sc.streak >= 2 ? ` · ${sc.streak} in a row` : ''}</Text>
        </Text>
        <View style={[styles.pane, att.phase === 'recording' && styles.paneRec]}>
          {c.paired ? (
            <LiveSkeleton width={PANE_W} height={PANE_H} side={who === 'left' ? 'R' : 'L'} color={color} waitingText={`Waiting for ${name}...`} />
          ) : (
            <View style={styles.center}>
              <Text style={styles.idleText}>Connect a phone first</Text>
            </View>
          )}
          {att.phase === 'countdown' ? (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center, styles.dim]}>
              <Text style={styles.count}>{att.count}</Text>
            </View>
          ) : null}
          {vd ? (
            <View pointerEvents="none" style={styles.verdictBox}>
              <Verdict
                compact
                tone={!vd.present ? 'away' : vd.ok ? 'yes' : 'almost'}
                title={!vd.present ? `${name}: step into view` : vd.ok ? `${name} got it!` : `${name}: almost`}
                detail={
                  vd.present && !vd.ok
                    ? tip === undefined
                      ? 'Getting a tip...'
                      : tip
                      ? `Tip: ${tip}`
                      : `Try this: ${sign.description}`
                    : null
                }
              />
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <Screen>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.turn}>
            Sign Together - sign {round + 1} of {rounds}
          </Text>
          <Text style={styles.word}>Sign: {sign.label}</Text>
        </View>
        <StatusPill />
      </View>
      <View style={styles.stage}>
        <View>
          <Text style={[styles.paneLabel, styles.eyebrow]}>Watch</Text>
          <View style={[styles.pane, { width: TEACHER_W + s(8) }]}>
            {video ? (
              <SignVideo key={sign.id} video={video.video} poster={video.poster} aspect={video.aspect} width={TEACHER_W} height={PANE_H} rate={st.slowTeacher ? 0.5 : 1} />
            ) : (
              <View style={styles.center}>
                <Text style={styles.idleText}>{sign.description}</Text>
              </View>
            )}
          </View>
        </View>
        {pane('left')}
        {pane('right')}
      </View>
      <Text style={styles.credit} numberOfLines={1}>
        {video?.note ? `${video.note}  ·  ` : ''}
        {CREDIT_VIDEO}
      </Text>
      <View style={styles.bannerBox}>{banner}</View>
      <SpatialNavigationRoot key={key}>
        <SpatialNavigationView direction="horizontal" style={styles.controls}>
          {controls}
        </SpatialNavigationView>
      </SpatialNavigationRoot>
      <Celebration burstKey={burst} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', marginBottom: s(18) },
  turn: { color: colors.textDim, fontSize: type.small, fontWeight: '600' },
  word: { color: colors.text, fontSize: type.title, fontWeight: '900', letterSpacing: track.title },
  stage: { flexDirection: 'row', justifyContent: 'space-between' },
  paneLabel: { fontSize: type.small, fontWeight: '800', marginBottom: s(10) },
  eyebrow: { color: colors.textDim, fontSize: s(26), fontWeight: '700', letterSpacing: track.label, lineHeight: s(40) },
  paneScore: { color: colors.textDim, fontSize: type.tiny, fontWeight: '600' },
  pane: {
    width: PANE_W + s(8),
    height: PANE_H + s(8),
    borderWidth: hair,
    borderColor: zinc[700],
    borderRadius: s(24),
    backgroundColor: colors.bgDeep,
    overflow: 'hidden',
  },
  paneRec: { borderColor: colors.text, borderWidth: s(4) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: s(24) },
  dim: { backgroundColor: 'rgba(0,0,0,0.7)' },
  idleText: { color: colors.textDim, fontSize: type.small, textAlign: 'center' },
  count: { color: colors.text, fontSize: s(220), fontWeight: '800', letterSpacing: track.hero, textShadowColor: '#000', textShadowRadius: s(30) },
  verdictBox: { position: 'absolute', top: s(14), left: s(14), right: s(14) },
  credit: { color: colors.textMute, fontSize: s(20), marginTop: s(10) },
  bannerBox: { minHeight: s(96), justifyContent: 'center', marginTop: s(6), marginBottom: s(14) },
  banner: { color: colors.text, fontSize: type.h2, fontWeight: '800', letterSpacing: track.h2 },
  hint: { color: colors.text, fontSize: type.body },
  controls: { flexDirection: 'row' },
  big: { color: colors.text, fontSize: type.hero, fontWeight: '900', letterSpacing: track.hero, marginBottom: s(40) },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: s(22),
    borderWidth: hair,
    borderColor: colors.line,
    paddingHorizontal: s(36),
    paddingVertical: s(20),
    marginBottom: s(14),
    width: '100%',
  },
  boardTop: { backgroundColor: colors.text, borderColor: colors.text },
  onTop: { color: colors.onFocus },
  boardName: { color: colors.text, fontSize: type.h2, fontWeight: '800', letterSpacing: track.h2, flex: 1 },
  boardPts: { color: colors.text, fontSize: type.h2, fontWeight: '900', width: s(260), fontVariant: ['tabular-nums'] },
  boardMeta: { color: colors.textDim, fontSize: type.small, width: s(260) },
});

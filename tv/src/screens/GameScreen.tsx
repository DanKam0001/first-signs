import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationRoot, SpatialNavigationView } from 'react-tv-space-navigation';
import { Celebration } from '../components/Celebration';
import { PracticeStage } from '../components/PracticeStage';
import { FocusButton, Screen, StatusPill, Verdict } from '../components/ui';
import { Sign, SIGNS, signsInPack } from '../data/signs';
import { useConn } from '../net/connection';
import { useAttempt } from '../net/useAttempt';
import { speak } from '../net/voice';
import { useBackOverride, useRouter } from '../nav/router';
import { recordAttempt } from '../store/progress';
import { colors, hair, s, track, type, zinc } from '../theme';

type Score = { name: string; points: number; streak: number; best: number };

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export function GameScreen({ players, packId, turnsEach }: { players: string[]; packId: string; turnsEach: number }) {
  const router = useRouter();
  const c = useConn();
  const att = useAttempt();
  const pool = useMemo(() => (packId === 'all' ? SIGNS : signsInPack(packId)), [packId]);
  const deck = useRef<Sign[]>([]);
  const draw = (): Sign => {
    if (!deck.current.length) deck.current = shuffle(pool);
    return deck.current.pop()!;
  };
  const totalTurns = players.length * turnsEach;
  const [turn, setTurn] = useState(0);
  const [sign, setSign] = useState<Sign>(() => draw());
  const [peek, setPeek] = useState(false);
  const [scores, setScores] = useState<Score[]>(players.map((name) => ({ name, points: 0, streak: 0, best: 0 })));
  const [lastGain, setLastGain] = useState(0);
  const [burst, setBurst] = useState(0);
  const handled = useRef<string | null>(null);
  const player = players[turn % players.length];
  const finished = turn >= totalTurns;
  const signPack = packId === 'all' ? sign.packs[0] || 'mealtime' : packId;

  useEffect(() => {
    if (!finished) speak(`${player}, your turn. Sign ${sign.label}.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, finished]);

  useEffect(() => {
    const p = att.pred;
    if (att.phase !== 'done' || !p || handled.current === p.id) return;
    handled.current = p.id;
    recordAttempt(sign.id, p.ok);
    const idx = turn % players.length;
    const cur = scores[idx];
    const streak = p.ok ? cur.streak + 1 : 0;
    const gain = p.ok ? (streak >= 3 ? 2 : 1) : 0;
    setLastGain(gain);
    setScores((all) =>
      all.map((sc, i) => (i !== idx ? sc : { ...sc, points: sc.points + gain, streak, best: Math.max(sc.best, streak) }))
    );
    if (p.ok) {
      setBurst((b) => b + 1);
      speak(`Well done ${player}!`);
    } else speak(`Good try, ${player}!`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [att.phase, att.pred]);

  useBackOverride(() => att.cancel());

  const nextTurn = () => {
    att.reset();
    setPeek(false);
    setSign(draw());
    setTurn((t) => t + 1);
  };
  const go = () => att.start(sign.id, signPack);

  useEffect(() => {
    if (finished) {
      const top = Math.max(...scores.map((x) => x.points));
      const winners = scores.filter((x) => x.points === top).map((x) => x.name);
      setBurst((b) => b + 1);
      speak(top > 0 ? `Round over! Top signer: ${winners.join(' and ')}. Great signing, everyone!` : 'Round over! Great practice, everyone!');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  if (finished) {
    const sorted = [...scores].sort((a, b) => b.points - a.points);
    return (
      <Screen>
        <Text style={styles.big}>Round over!</Text>
        <View style={styles.board}>
          {sorted.map((sc, i) => (
            <View key={sc.name} style={[styles.boardRow, i === 0 && sc.points > 0 && styles.boardTop]}>
              <Text style={[styles.boardName, i === 0 && sc.points > 0 && styles.onTop]}>
                {i === 0 && sc.points > 0 ? '★ ' : ''}
                {sc.name}
              </Text>
              <Text style={[styles.boardPts, i === 0 && sc.points > 0 && styles.onTop]}>{sc.points} pts</Text>
              <Text style={[styles.boardMeta, i === 0 && sc.points > 0 && { color: zinc[600] }]}>best streak {sc.best}</Text>
            </View>
          ))}
        </View>
        <SpatialNavigationRoot>
          <SpatialNavigationView direction="horizontal" style={styles.controls}>
            <DefaultFocus>
              <FocusButton label="Play again" accent={colors.good} onSelect={() => router.replace({ name: 'game', players, packId, turnsEach })} />
            </DefaultFocus>
            <FocusButton label="Home" onSelect={() => router.reset({ name: 'home' })} />
          </SpatialNavigationView>
        </SpatialNavigationRoot>
        <Celebration burstKey={burst} />
      </Screen>
    );
  }

  const result = att.phase === 'done' && att.pred ? att.pred : null;
  const key = result ? 'result' : att.busy ? 'busy' : `intro-${peek}-${att.phase}`;
  let controls: React.ReactNode;
  if (att.busy) {
    controls = (
      <DefaultFocus>
        <FocusButton label="Stop" onSelect={() => att.cancel()} />
      </DefaultFocus>
    );
  } else if (result) {
    controls = (
      <>
        <DefaultFocus>
          <FocusButton label={turn + 1 >= totalTurns ? 'See scores' : `Next: ${players[(turn + 1) % players.length]}`} accent={colors.good} onSelect={nextTurn} />
        </DefaultFocus>
        {!result.ok ? <FocusButton label="One more go" onSelect={go} /> : null}
      </>
    );
  } else {
    controls = (
      <>
        <DefaultFocus>
          <FocusButton label={c.paired ? 'Go!' : 'Connect phone'} accent={colors.you} onSelect={() => (c.paired ? go() : router.push({ name: 'pair' }))} />
        </DefaultFocus>
        <FocusButton label={peek ? 'Hide the sign' : 'Show me first'} onSelect={() => setPeek((v) => !v)} />
        <FocusButton label="Skip" onSelect={nextTurn} />
        <FocusButton label="End round" onSelect={() => router.pop()} />
      </>
    );
  }

  return (
    <Screen>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.turn}>
            Turn {turn + 1} of {totalTurns} - <Text style={{ color: colors.text, fontWeight: '800' }}>{player}</Text>
          </Text>
          <Text style={styles.word}>Sign: {sign.label}</Text>
        </View>
        <StatusPill />
      </View>
      <View style={styles.scores}>
        {scores.map((sc, i) => (
          <View key={sc.name} style={[styles.chip, i === turn % players.length && styles.chipNow]}>
            <Text style={[styles.chipName, i === turn % players.length && { color: colors.text }]}>{sc.name}</Text>
            <Text style={styles.chipPts}>
              {sc.points}
              {sc.streak >= 2 ? `  ${sc.streak} in a row` : ''}
            </Text>
          </View>
        ))}
      </View>
      <PracticeStage
        signId={sign.id}
        hideTeacher={!(peek || result)}
        phase={att.phase}
        count={att.count}
        windowMs={att.windowMs}
        showLive={c.paired}
        compact
      />
      <View style={styles.bannerBox}>
        {result ? (
          <Verdict
            tone={result.ok ? 'yes' : 'almost'}
            title={result.ok ? `Yes! +${lastGain} ${lastGain > 1 ? '(streak bonus!)' : ''}` : `Good try! Watch how "${sign.label}" goes.`}
          />
        ) : att.phase === 'timeout' || att.phase === 'offline' ? (
          <Verdict tone="info" title="The phone didn't answer. Check it, then press Go again." />
        ) : (
          <Text style={styles.hint}>{peek ? sign.description : 'Remember it? Press Go - or peek with "Show me first".'}</Text>
        )}
      </View>
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
  top: { flexDirection: 'row', alignItems: 'center' },
  turn: { color: colors.textDim, fontSize: type.small, fontWeight: '600' },
  word: { color: colors.text, fontSize: type.title, fontWeight: '900', letterSpacing: track.title },
  scores: { flexDirection: 'row', marginTop: s(16), marginBottom: s(20) },
  chip: {
    borderRadius: s(40),
    borderWidth: hair,
    borderColor: colors.line,
    paddingHorizontal: s(26),
    paddingVertical: s(8),
    marginRight: s(14),
    flexDirection: 'row',
    alignItems: 'center',
  },
  // whose turn it is: a white outline (white fill is reserved for focus)
  chipNow: { borderColor: colors.text, borderWidth: Math.max(hair, s(3)), backgroundColor: zinc[900] },
  chipName: { color: colors.textDim, fontSize: type.small, fontWeight: '600', marginRight: s(14) },
  chipPts: { color: colors.text, fontSize: type.small, fontWeight: '800', fontVariant: ['tabular-nums'] },
  bannerBox: { minHeight: s(96), justifyContent: 'center', marginTop: s(8), marginBottom: s(14) },
  hint: { color: colors.text, fontSize: type.body },
  controls: { flexDirection: 'row' },
  big: { color: colors.text, fontSize: type.hero, fontWeight: '900', letterSpacing: track.hero, marginBottom: s(40) },
  board: { marginBottom: s(44) },
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
  // the winner's row is the one inverted panel on the score board
  boardTop: { backgroundColor: colors.text, borderColor: colors.text },
  onTop: { color: colors.onFocus },
  boardName: { color: colors.text, fontSize: type.h2, fontWeight: '800', letterSpacing: track.h2, flex: 1 },
  boardPts: { color: colors.text, fontSize: type.h2, fontWeight: '900', width: s(260), fontVariant: ['tabular-nums'] },
  boardMeta: { color: colors.textDim, fontSize: type.small, width: s(260) },
});

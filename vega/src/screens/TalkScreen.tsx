// "Talk with Baby": practise signs in context. The TV shows a little everyday scene, the family answers by
// signing ONE word, and the TV replies to what the recogniser reported. Uses the normal attempt/pred
// protocol unchanged: the attempt carries the scene's pack (the phone masks to it) and the TV reads pred.top.
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationRoot, SpatialNavigationView } from 'react-tv-space-navigation';
import { Celebration } from '../components/Celebration';
import { PracticeStage } from '../components/PracticeStage';
import { SceneArt } from '../components/SceneArt';
import { FocusButton, Header, Screen, StatusPill, Verdict } from '../components/ui';
import { PACKS, signById } from '../data/signs';
import { matchAnswer, minHandFrac, optionList, pickSession, Scene, SESSION_LEN, talkPacks } from '../data/talk';
import { conn, Frame } from '../net/connection';
import { useConn } from '../net/connection';
import { useAttempt } from '../net/useAttempt';
import { speak } from '../net/voice';
import { useBackOverride, useRouter } from '../nav/router';
import { recordAttempt } from '../store/progress';
import { colors, hair, s, track, type, zinc } from '../theme';

type Outcome =
  | { kind: 'reply'; sign: string; text: string }
  | { kind: 'nudge'; heard: string | null }
  | { kind: 'nohands' };
type Used = { scene: Scene; sign: string | null };

const packName = (id: string) => (id === 'all' ? 'Mixed' : PACKS.find((p) => p.id === id)?.name || id.charAt(0).toUpperCase() + id.slice(1));
const label = (id: string) => signById(id)?.label || id;

export function TalkScreen() {
  const [packId, setPackId] = useState<string | null>(null);
  const [round, setRound] = useState(0); // bump to start a fresh session
  if (!packId) return <TalkIntro onPick={(p) => { setPackId(p); setRound((r) => r + 1); }} />;
  return (
    <TalkSession
      key={round}
      packId={packId}
      onAgain={() => setRound((r) => r + 1)}
      onChoose={() => setPackId(null)}
    />
  );
}

function TalkIntro({ onPick }: { onPick: (packId: string) => void }) {
  const router = useRouter();
  const packs = talkPacks();
  useEffect(() => {
    speak('Talk with Baby. A little scene appears. Answer it by signing one word.');
  }, []);
  const steps: { art: React.ComponentProps<typeof SceneArt>['art']; title: string; text: string }[] = [
    { art: 'highchair', title: '1. A little scene', text: '“Baby is reaching for the table. What do they want?”' },
    { art: 'wave', title: '2. Sign one word', text: 'Answer with a sign you’ve been practising.' },
    { art: 'smile', title: '3. The TV answers', text: '“Water? Here you go!” Then on to the next scene.' },
  ];
  return (
    <Screen>
      <Header title="Talk with Baby" subtitle={`Everyday moments, answered with one sign. ${SESSION_LEN} scenes per chat.`} />
      <View style={styles.steps}>
        {steps.map((st) => (
          <View key={st.title} style={styles.step}>
            <SceneArt art={st.art} size={s(120)} color={colors.text} />
            <Text style={styles.stepTitle}>{st.title}</Text>
            <Text style={styles.stepText}>{st.text}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.label}>Which moments?</Text>
      <SpatialNavigationRoot>
        <SpatialNavigationView direction="horizontal" style={styles.packRow}>
          <DefaultFocus>
            <FocusButton label="Mix it up" accent={colors.good} onSelect={() => onPick('all')} />
          </DefaultFocus>
          {packs.map((p) => (
            <FocusButton key={p} small={packs.length > 4} label={packName(p)} onSelect={() => onPick(p)} />
          ))}
          <FocusButton small={packs.length > 4} label="Back" onSelect={() => router.pop()} />
        </SpatialNavigationView>
      </SpatialNavigationRoot>
    </Screen>
  );
}

function TalkSession({ packId, onAgain, onChoose }: { packId: string; onAgain: () => void; onChoose: () => void }) {
  const router = useRouter();
  const c = useConn();
  const att = useAttempt();
  // State, not useMemo: the draw must survive re-renders and Fast Refresh (memos are recomputed on refresh).
  const [scenes] = useState(() => pickSession(packId));
  const [idx, setIdx] = useState(0);
  const [showMe, setShowMe] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [used, setUsed] = useState<Used[]>([]);
  const [burst, setBurst] = useState(0);
  const handled = useRef<string | null>(null);
  const finished = idx >= scenes.length;
  const scene = scenes[Math.min(idx, scenes.length - 1)];
  const suggest = scene?.accept[0];

  // Hands in view during the recording window, counted from the live frames (pred has no hand info).
  const phaseRef = useRef(att.phase);
  phaseRef.current = att.phase;
  const hands = useRef({ n: 0, withHands: 0 });
  useEffect(() => {
    const onFrame = (f: Frame) => {
      if (phaseRef.current !== 'recording') return;
      hands.current.n++;
      if (f.left || f.right) hands.current.withHands++;
    };
    conn.events.on('frame', onFrame);
    return () => conn.events.off('frame', onFrame);
  }, []);
  useEffect(() => {
    if (att.phase === 'countdown') hands.current = { n: 0, withHands: 0 };
  }, [att.phase]);

  useEffect(() => {
    if (!finished && scene) speak(scene.prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  useEffect(() => {
    const p = att.pred;
    if (att.phase !== 'done' || !p || handled.current === p.id || !scene) return;
    handled.current = p.id;
    const h = hands.current;
    const handFrac = h.n >= 5 ? h.withHands / h.n : 1; // too few frames seen to judge: trust the phone
    if (handFrac < minHandFrac()) {
      setOutcome({ kind: 'nohands' });
      speak('We couldn’t see your hands that time. Let’s try again.');
      return;
    }
    const m = matchAnswer(scene, p.top || []);
    if (m) {
      const text = scene.replies[m.id];
      recordAttempt(m.id, true);
      setOutcome({ kind: 'reply', sign: m.id, text });
      setUsed((u) => [...u, { scene, sign: m.id }]);
      setShowMe(false);
      setBurst((b) => b + 1);
      speak(text);
    } else {
      const heard = p.top && p.top.length ? p.top[0][0] : null;
      setOutcome({ kind: 'nudge', heard });
      speak(`Good try! For this one, you could sign ${optionList(scene.accept)}.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [att.phase, att.pred]);

  useBackOverride(() => att.cancel());

  const signIt = () => {
    if (!c.paired) {
      router.push({ name: 'pair' });
      return;
    }
    setOutcome(null);
    att.start(suggest, scene.pack);
  };
  const next = () => {
    att.reset();
    setOutcome(null);
    setShowMe(false);
    setIdx((i) => i + 1);
  };
  const skip = () => {
    if (outcome?.kind !== 'reply') setUsed((u) => [...u, { scene, sign: null }]);
    next();
  };

  const words = used.filter((u) => u.sign).map((u) => label(u.sign!));
  useEffect(() => {
    if (!finished) return;
    if (words.length) setBurst((b) => b + 1);
    speak(
      words.length
        ? `Lovely chatting! You used ${words.length} ${words.length === 1 ? 'sign' : 'signs'}: ${words.join(', ')}.`
        : 'Lovely practising! Every try helps.'
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  if (!scene) {
    return (
      <Screen>
        <Header title="Talk with Baby" />
        <Verdict tone="info" title="No scenes are ready for these signs yet." />
        <SpatialNavigationRoot>
          <SpatialNavigationView direction="horizontal" style={{ ...styles.controls, marginTop: s(30) }}>
            <DefaultFocus>
              <FocusButton label="Back" onSelect={() => router.pop()} />
            </DefaultFocus>
          </SpatialNavigationView>
        </SpatialNavigationRoot>
      </Screen>
    );
  }

  if (finished) {
    return (
      <Screen>
        <View style={styles.top}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Talk with Baby · {packName(packId)}</Text>
            <Text style={styles.big}>{words.length ? 'Lovely chatting!' : 'Lovely practising!'}</Text>
          </View>
          <StatusPill />
        </View>
        <Text style={styles.sumLine}>
          {words.length
            ? `You used ${words.length} ${words.length === 1 ? 'sign' : 'signs'} in ${scenes.length} scenes.`
            : 'No answers this time, and that’s fine. Every try helps.'}
        </Text>
        <View style={styles.sumList}>
          {used.map((u, i) => (
            <View key={i} style={styles.sumRow}>
              <View style={styles.sumArt}>
                <SceneArt art={u.scene.art} size={s(56)} color={u.sign ? colors.text : zinc[600]} />
              </View>
              <Text style={[styles.sumPrompt, !u.sign && { color: colors.textMute }]} numberOfLines={1}>
                {u.scene.prompt}
              </Text>
              {u.sign ? (
                <View style={styles.wordChip}>
                  <Text style={styles.wordChipText}>✓ {label(u.sign)}</Text>
                </View>
              ) : (
                <Text style={styles.skipped}>skipped</Text>
              )}
            </View>
          ))}
        </View>
        <SpatialNavigationRoot>
          <SpatialNavigationView direction="horizontal" style={styles.controls}>
            <DefaultFocus>
              <FocusButton label="Chat again" accent={colors.good} onSelect={onAgain} />
            </DefaultFocus>
            <FocusButton label="Other moments" onSelect={onChoose} />
            <FocusButton label="Home" onSelect={() => router.reset({ name: 'home' })} />
          </SpatialNavigationView>
        </SpatialNavigationRoot>
        <Celebration burstKey={burst} />
      </Screen>
    );
  }

  const replied = outcome?.kind === 'reply';
  const key = att.busy ? 'busy' : `${idx}-${outcome?.kind || att.phase}`;
  let controls: React.ReactNode;
  if (att.busy) {
    controls = (
      <DefaultFocus>
        <FocusButton label="Stop" onSelect={() => att.cancel()} />
      </DefaultFocus>
    );
  } else if (replied) {
    controls = (
      <>
        <DefaultFocus>
          <FocusButton label={idx + 1 >= scenes.length ? 'See our chat' : 'Next scene'} accent={colors.good} onSelect={next} />
        </DefaultFocus>
        <FocusButton label="Back" onSelect={() => router.pop()} />
      </>
    );
  } else {
    controls = (
      <>
        <DefaultFocus>
          <FocusButton
            label={c.paired ? (outcome ? 'Sign again' : 'Sign my answer') : 'Connect phone'}
            accent={colors.you}
            onSelect={signIt}
          />
        </DefaultFocus>
        <FocusButton label={showMe ? 'Hide' : 'Show me'} onSelect={() => setShowMe((v) => !v)} />
        <FocusButton label="Skip" onSelect={skip} />
        <FocusButton label="Back" onSelect={() => router.pop()} />
      </>
    );
  }

  let banner: React.ReactNode;
  if (outcome?.kind === 'reply') {
    banner = <Verdict tone="yes" title={outcome.text} detail={`You signed “${label(outcome.sign)}”`} />;
  } else if (outcome?.kind === 'nudge') {
    const heard = outcome.heard && outcome.heard !== suggest ? label(outcome.heard) : null;
    banner = (
      <Verdict
        tone="almost"
        title={`Good try! For this one, you could sign ${optionList(scene.accept)}.`}
        detail={`${heard ? `That looked a bit like “${heard}”. ` : ''}${showMe ? `Here’s “${label(suggest)}”. Watch, then sign again.` : `Press Show me to see “${label(suggest)}”.`}`}
      />
    );
  } else if (outcome?.kind === 'nohands') {
    banner = <Verdict tone="info" title="We couldn’t see your hands that time." detail="Step back so the phone sees your hands and chest, then sign again." />;
  } else if (att.phase === 'timeout') {
    banner = <Verdict tone="info" title="We didn't hear back from the phone. Check it's still open, then try again." />;
  } else if (att.phase === 'offline') {
    banner = <Verdict tone="info" title="The phone isn't connected right now." />;
  } else if (showMe) {
    banner = (
      <Text style={styles.hint} numberOfLines={2}>
        <Text style={{ fontWeight: '800' }}>{label(suggest)}: </Text>
        {signById(suggest)?.description}
      </Text>
    );
  } else {
    banner = <Text style={styles.hint}>Answer with one sign. Stuck? Press “Show me” for an idea.</Text>;
  }

  const cover = (
    <View style={{ alignItems: 'center' }}>
      <SceneArt art={scene.art} size={s(250)} color={colors.text} />
      <Text style={styles.coverPack}>{packName(scene.pack)}</Text>
    </View>
  );

  return (
    <Screen>
      <View style={styles.top}>
        <View style={{ flex: 1, marginRight: s(40) }}>
          <View style={styles.kickerRow}>
            <Text style={styles.kicker}>Talk with Baby · Scene {idx + 1} of {scenes.length}</Text>
            <View style={styles.dots}>
              {scenes.map((_, i) => (
                <View key={i} style={[styles.dot, (i < idx || (i === idx && replied)) && styles.dotOn]} />
              ))}
            </View>
          </View>
          <Text style={styles.prompt} numberOfLines={2}>
            {scene.prompt}
          </Text>
        </View>
        <StatusPill />
      </View>
      <PracticeStage
        signId={suggest}
        hideTeacher={!showMe}
        cover={cover}
        teacherLabel={showMe ? `Show me: ${label(suggest)}` : 'The scene'}
        phase={att.phase}
        count={att.count}
        windowMs={att.windowMs}
        showLive={c.paired}
        compact
      />
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
  kickerRow: { flexDirection: 'row', alignItems: 'center' },
  kicker: { color: colors.textDim, fontSize: type.small, fontWeight: '600', letterSpacing: track.label },
  dots: { flexDirection: 'row', alignItems: 'center', marginLeft: s(24) },
  dot: { width: s(16), height: s(16), borderRadius: s(8), borderWidth: s(3), borderColor: zinc[400], marginRight: s(12) },
  dotOn: { backgroundColor: colors.text, borderColor: colors.text },
  prompt: { color: colors.text, fontSize: s(50), fontWeight: '800', letterSpacing: track.h2, lineHeight: s(60), marginTop: s(6) },
  coverPack: { color: colors.textMute, fontSize: type.tiny, fontWeight: '600', letterSpacing: track.label, marginTop: s(18) },
  bannerBox: { minHeight: s(140), justifyContent: 'center', marginTop: s(10), marginBottom: s(20) },
  hint: { color: colors.textDim, fontSize: type.body },
  controls: { flexDirection: 'row' },
  packRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  label: { color: colors.textDim, fontSize: type.small, fontWeight: '700', letterSpacing: track.label, marginBottom: s(18) },
  steps: { flexDirection: 'row', marginTop: s(10), marginBottom: s(56) },
  step: {
    flex: 1,
    borderWidth: hair,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: s(24),
    padding: s(34),
    marginRight: s(24),
    minHeight: s(400),
  },
  stepTitle: { color: colors.text, fontSize: type.h2, fontWeight: '800', letterSpacing: track.h2, marginTop: s(28) },
  stepText: { color: colors.textDim, fontSize: type.small, lineHeight: s(42), marginTop: s(12) },
  big: { color: colors.text, fontSize: type.hero, fontWeight: '900', letterSpacing: track.hero },
  sumLine: { color: colors.textDim, fontSize: type.body, marginBottom: s(26) },
  sumList: { marginBottom: s(36) },
  sumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: s(20),
    borderWidth: hair,
    borderColor: colors.line,
    paddingHorizontal: s(28),
    paddingVertical: s(12),
    marginBottom: s(12),
  },
  sumArt: { width: s(80) },
  sumPrompt: { color: colors.text, fontSize: type.small, flex: 1, marginRight: s(24) },
  // the word they used: white outline chip (white fill is reserved for focus)
  wordChip: {
    borderWidth: Math.max(hair, s(3)),
    borderColor: colors.text,
    backgroundColor: zinc[900],
    borderRadius: s(40),
    paddingHorizontal: s(26),
    paddingVertical: s(6),
  },
  wordChipText: { color: colors.text, fontSize: type.small, fontWeight: '800' },
  skipped: { color: colors.textMute, fontSize: type.small, fontStyle: 'italic', paddingHorizontal: s(26) },
});

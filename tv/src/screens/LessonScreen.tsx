import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationRoot, SpatialNavigationView } from 'react-tv-space-navigation';
import { Celebration } from '../components/Celebration';
import { PracticeStage } from '../components/PracticeStage';
import { FocusButton, Header, Screen } from '../components/ui';
import { refFor, signById, signsInPack, PACKS } from '../data/signs';
import { useConn } from '../net/connection';
import { useAttempt } from '../net/useAttempt';
import { coachTip, speak } from '../net/voice';
import { useBackOverride, useRouter } from '../nav/router';
import { recordAttempt } from '../store/progress';
import { settings } from '../store/settings';
import { colors, packColors, s, type } from '../theme';

export function LessonScreen({ packId, signId }: { packId: string; signId: string }) {
  const router = useRouter();
  const c = useConn();
  const st = settings.use();
  const sign = signById(signId);
  const refData = useMemo(() => refFor(signId), [signId]);
  const att = useAttempt();
  const [tries, setTries] = useState(0);
  const [tip, setTip] = useState<string | null>(null);
  const [tipLoading, setTipLoading] = useState(false);
  const [burst, setBurst] = useState(0);
  const recorded = useRef<string | null>(null);
  const accent = packColors[packId] || colors.focus;
  const label = sign?.label || signId;
  const pack = PACKS.find((p) => p.id === packId);

  useEffect(() => {
    speak(`This is the sign for ${label}.`);
  }, [label]);

  // Result handling: record progress once per pred, celebrate or fetch a coaching tip.
  useEffect(() => {
    const p = att.pred;
    if (att.phase !== 'done' || !p || recorded.current === p.id) return;
    recorded.current = p.id;
    recordAttempt(signId, p.ok);
    const n = tries + 1;
    setTries(n);
    if (p.ok) {
      setBurst((b) => b + 1);
      speak(`Yes! That was ${label}. Great signing!`);
    } else {
      setTip(null);
      setTipLoading(true);
      speak('Nice try. Let’s look again.');
      coachTip(signId, p.top || [], n).then((t) => {
        setTipLoading(false);
        setTip(t);
        if (t) setTimeout(() => speak(t), 1800);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [att.phase, att.pred]);

  useBackOverride(() => att.cancel());

  const yourTurn = () => {
    if (!c.paired) {
      router.push({ name: 'pair' });
      return;
    }
    setTip(null);
    speak(`Your turn. Sign ${label}.`);
    att.start(signId, packId);
  };

  const list = signsInPack(packId);
  const idx = list.findIndex((x) => x.id === signId);
  const next = list.length > 1 ? list[(idx + 1) % list.length] : null;
  const goNext = () => next && router.replace({ name: 'lesson', packId, signId: next.id });

  const result = att.phase === 'done' && att.pred ? att.pred : null;
  const guess = result && !result.ok ? (result.top || []).find(([id]) => id !== signId)?.[0] : null;
  const guessLabel = guess ? signById(guess)?.label || guess : null;

  // Controls are keyed by phase so focus resets to a sensible default whenever the buttons change.
  const controlsKey = result ? (result.ok ? 'ok' : 'miss') : att.busy ? 'busy' : att.phase;
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
          {result.ok && next ? (
            <FocusButton label={`Next: ${next.label}`} accent={colors.good} onSelect={goNext} />
          ) : (
            <FocusButton label="Try again" accent={colors.good} onSelect={yourTurn} />
          )}
        </DefaultFocus>
        {result.ok ? <FocusButton label="Sign it again" onSelect={yourTurn} /> : null}
        {!result.ok && next ? <FocusButton label="Skip to next" onSelect={goNext} /> : null}
        <FocusButton label={st.slowTeacher ? 'Normal speed' : 'Slow motion'} onSelect={() => settings.set({ slowTeacher: !st.slowTeacher })} />
        <FocusButton label="Back to pack" onSelect={() => router.pop()} />
      </>
    );
  } else {
    controls = (
      <>
        <DefaultFocus>
          <FocusButton label={c.paired ? 'Your turn' : 'Connect phone to try'} accent={colors.you} onSelect={yourTurn} />
        </DefaultFocus>
        <FocusButton label={st.slowTeacher ? 'Normal speed' : 'Slow motion'} onSelect={() => settings.set({ slowTeacher: !st.slowTeacher })} />
        {next ? <FocusButton label={`Next: ${next.label}`} onSelect={goNext} /> : null}
        <FocusButton label="Back" onSelect={() => router.pop()} />
      </>
    );
  }

  let banner: React.ReactNode = null;
  if (result?.ok) {
    banner = <Text style={[styles.banner, { color: colors.good }]}>You signed "{label}"! ★</Text>;
  } else if (result) {
    banner = (
      <View>
        <Text style={[styles.banner, { color: colors.almost }]}>
          Almost! {guessLabel ? `That looked a bit like "${guessLabel}".` : 'Let’s try once more.'}
        </Text>
        <Text style={styles.tip}>{tipLoading ? 'Getting a tip...' : tip ? `Tip: ${tip}` : `Try this: ${sign?.description || ''}`}</Text>
      </View>
    );
  } else if (att.phase === 'timeout') {
    banner = <Text style={[styles.banner, { color: colors.almost }]}>We didn't hear back from the phone. Check it's still open, then try again.</Text>;
  } else if (att.phase === 'offline') {
    banner = <Text style={[styles.banner, { color: colors.almost }]}>The phone isn't connected right now.</Text>;
  } else {
    banner = (
      <Text style={styles.desc}>
        {sign?.description}
        {sign && sign.verified === false ? <Text style={styles.unverified}>  (description being checked)</Text> : null}
      </Text>
    );
  }

  return (
    <Screen>
      <Header title={`${label}`} subtitle={undefined} accent={accent} />
      <PracticeStage refData={refData} phase={att.phase} count={att.count} windowMs={att.windowMs} showLive={c.paired} />
      <View style={styles.bannerBox}>{banner}</View>
      <SpatialNavigationRoot key={controlsKey}>
        <SpatialNavigationView direction="horizontal" style={styles.controls}>
          {controls}
        </SpatialNavigationView>
      </SpatialNavigationRoot>
      <Celebration burstKey={burst} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bannerBox: { minHeight: s(120), justifyContent: 'center' },
  banner: { fontSize: type.h2, fontWeight: '800' },
  desc: { color: colors.text, fontSize: type.body },
  unverified: { color: colors.textDim, fontSize: type.tiny },
  tip: { color: colors.text, fontSize: type.small, marginTop: s(6) },
  controls: { flexDirection: 'row' },
});

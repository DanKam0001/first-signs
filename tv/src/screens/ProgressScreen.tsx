import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationRoot, SpatialNavigationView } from 'react-tv-space-navigation';
import { PackIcon } from '../components/PackIcon';
import { FocusButton, Header, ProgressBar, Screen } from '../components/ui';
import { PACKS, signsInPack } from '../data/signs';
import { useRouter } from '../nav/router';
import { isLearned, progress, resetProgress } from '../store/progress';
import { colors, packColors, s, type } from '../theme';

export function ProgressScreen() {
  const router = useRouter();
  const prog = progress.use();
  const [confirm, setConfirm] = useState(false);
  const all = PACKS.flatMap((p) => signsInPack(p.id).map((sg) => sg.id));
  const uniq = Array.from(new Set(all));
  const learnedTotal = uniq.filter((id) => isLearned(prog.signs[id])).length;

  return (
    <Screen>
      <Header title="Your progress" subtitle={`${learnedTotal} of ${uniq.length} signs learned so far - saved on this TV`} />
      {PACKS.map((p) => {
        const list = signsInPack(p.id);
        const learned = list.filter((sg) => isLearned(prog.signs[sg.id]));
        const accent = packColors[p.id];
        return (
          <View key={p.id} style={styles.pack}>
            <PackIcon pack={p.id} size={s(76)} color={accent} />
            <View style={styles.packMain}>
              <View style={styles.packTop}>
                <Text style={[styles.packName, { color: accent }]}>{p.name}</Text>
                <Text style={styles.count}>
                  {learned.length} / {list.length}
                </Text>
              </View>
              <ProgressBar value={list.length ? learned.length / list.length : 0} color={accent} />
              <Text style={styles.signs} numberOfLines={1}>
                {list.map((sg) => (isLearned(prog.signs[sg.id]) ? `★ ${sg.label}` : `· ${sg.label}`)).join('    ')}
              </Text>
            </View>
          </View>
        );
      })}
      <SpatialNavigationRoot key={String(confirm)}>
        <SpatialNavigationView direction="horizontal" style={styles.controls}>
          <DefaultFocus>
            <FocusButton label="Back" onSelect={() => router.pop()} />
          </DefaultFocus>
          <FocusButton
            label={confirm ? 'Press again to clear everything' : 'Start over'}
            accent={confirm ? colors.warn : colors.focus}
            onSelect={() => {
              if (confirm) {
                resetProgress();
                setConfirm(false);
              } else setConfirm(true);
            }}
          />
        </SpatialNavigationView>
      </SpatialNavigationRoot>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pack: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: s(24), padding: s(22), marginBottom: s(18) },
  packMain: { flex: 1, marginLeft: s(26) },
  packTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: s(10) },
  packName: { fontSize: type.body, fontWeight: '800' },
  count: { color: colors.text, fontSize: type.body, fontWeight: '800' },
  signs: { color: colors.textDim, fontSize: type.tiny, marginTop: s(10) },
  controls: { flexDirection: 'row', marginTop: s(16) },
});

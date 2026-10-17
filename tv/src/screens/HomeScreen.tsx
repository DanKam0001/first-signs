import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationRoot, SpatialNavigationView } from 'react-tv-space-navigation';
import { PackIcon } from '../components/PackIcon';
import { FocusButton, FocusCard, Header, ProgressBar, Screen } from '../components/ui';
import { DATA_IS_PLACEHOLDER, PACKS, signsInPack } from '../data/signs';
import { useConn } from '../net/connection';
import { useRouter } from '../nav/router';
import { isLearned, progress } from '../store/progress';
import { colors, packColors, s, type } from '../theme';

export function HomeScreen() {
  const router = useRouter();
  const c = useConn();
  const prog = progress.use();

  return (
    <Screen>
      <Header title="First Signs" subtitle="Learn your first ASL signs together, one routine at a time" />
      {DATA_IS_PLACEHOLDER ? (
        <Text style={styles.placeholder}>Preview build: sample signs with placeholder motion</Text>
      ) : null}
      <SpatialNavigationRoot>
        <SpatialNavigationView direction="vertical">
          <SpatialNavigationView direction="horizontal" style={styles.packs}>
            {PACKS.map((p, i) => {
              const list = signsInPack(p.id);
              const learned = list.filter((sg) => isLearned(prog.signs[sg.id])).length;
              const accent = packColors[p.id] || colors.focus;
              const card = (
                <FocusCard key={p.id} accent={accent} style={styles.packCard} onSelect={() => router.push({ name: 'pack', packId: p.id })}>
                  {(focused) => (
                    <View style={styles.packBody}>
                      <PackIcon pack={p.id} size={s(120)} color={accent} />
                      <Text style={[styles.packName, focused && { color: accent }]}>{p.name}</Text>
                      <Text style={styles.packBlurb}>{p.blurb}</Text>
                      <Text style={styles.packCount}>
                        {learned} of {list.length} learned
                      </Text>
                      <ProgressBar value={list.length ? learned / list.length : 0} color={accent} />
                    </View>
                  )}
                </FocusCard>
              );
              return i === 0 ? <DefaultFocus key={p.id}>{card}</DefaultFocus> : card;
            })}
          </SpatialNavigationView>
          <SpatialNavigationView direction="horizontal" style={styles.menu}>
            <FocusButton label="Family round" icon="★" onSelect={() => router.push({ name: 'gameSetup' })} />
            <FocusButton label="Progress" onSelect={() => router.push({ name: 'progress' })} />
            <FocusButton label={c.paired ? 'Phone connected' : 'Connect phone'} onSelect={() => router.push({ name: 'pair' })} />
            <FocusButton label="About" onSelect={() => router.push({ name: 'about' })} />
            <FocusButton label="Settings" onSelect={() => router.push({ name: 'settings' })} />
          </SpatialNavigationView>
        </SpatialNavigationView>
      </SpatialNavigationRoot>
    </Screen>
  );
}

const styles = StyleSheet.create({
  placeholder: { color: colors.almost, fontSize: type.tiny, marginTop: s(-16), marginBottom: s(8) },
  packs: { flexDirection: 'row', marginLeft: s(-14) },
  packCard: { width: s(400), height: s(470) },
  packBody: { padding: s(30), flex: 1 },
  packName: { color: colors.text, fontSize: type.h2, fontWeight: '800', marginTop: s(14) },
  packBlurb: { color: colors.textDim, fontSize: type.tiny, marginTop: s(6), height: s(66) },
  packCount: { color: colors.text, fontSize: type.small, marginTop: s(10), marginBottom: s(12) },
  menu: { flexDirection: 'row', marginTop: s(46) },
});

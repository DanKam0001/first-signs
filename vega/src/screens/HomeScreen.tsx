import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationRoot, SpatialNavigationView } from 'react-tv-space-navigation';
import { PackIcon } from '../components/PackIcon';
import { FocusButton, FocusCard, Header, ProgressBar, Screen } from '../components/ui';
import { DATA_IS_PLACEHOLDER, PACKS, signsInPack } from '../data/signs';
import { useConn } from '../net/connection';
import { useRouter } from '../nav/router';
import { isLearned, progress } from '../store/progress';
import { colors, s, track, type, zinc } from '../theme';

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
          {[PACKS.slice(0, 3), PACKS.slice(3)].map((row, r) => (
          <SpatialNavigationView key={r} direction="horizontal" style={styles.packs}>
            {row.map((p, j) => {
              const i = r * 3 + j;
              const list = signsInPack(p.id);
              const learned = list.filter((sg) => isLearned(prog.signs[sg.id])).length;
              const card = (
                <FocusCard key={p.id} style={styles.packCard} onSelect={() => router.push({ name: 'pack', packId: p.id })}>
                  {(focused) => (
                    <View style={styles.packBody}>
                      <View style={styles.packTop}>
                        <PackIcon pack={p.id} size={s(84)} color={focused ? colors.onFocus : colors.text} />
                        <Text style={[styles.packName, focused && { color: colors.onFocus }]} numberOfLines={1}>{p.name}</Text>
                      </View>
                      <View style={{ flex: 1 }} />
                      <Text style={[styles.packBlurb, focused && { color: zinc[600] }]}>{p.blurb}</Text>
                      <Text style={[styles.packCount, focused && { color: colors.onFocus }]}>
                        {learned} of {list.length} learned
                      </Text>
                      <ProgressBar
                        value={list.length ? learned / list.length : 0}
                        color={focused ? colors.onFocus : colors.text}
                        trackColor={focused ? zinc[300] : zinc[800]}
                      />
                    </View>
                  )}
                </FocusCard>
              );
              return i === 0 ? <DefaultFocus key={p.id}>{card}</DefaultFocus> : card;
            })}
          </SpatialNavigationView>
          ))}
          <SpatialNavigationView direction="horizontal" style={styles.menu}>
            <FocusButton small label="Family round" icon="★" onSelect={() => router.push({ name: 'gameSetup' })} />
            <FocusButton small label="Sign Together" onSelect={() => router.push({ name: 'duoSetup' })} />
            <FocusButton small label="Talk with Baby" onSelect={() => router.push({ name: 'talk' })} />
            <FocusButton small label="Progress" onSelect={() => router.push({ name: 'progress' })} />
            <FocusButton small label={c.paired ? 'Phone' : 'Connect phone'} onSelect={() => router.push({ name: 'pair' })} />
            <FocusButton small label="About" onSelect={() => router.push({ name: 'about' })} />
            <FocusButton small label="Settings" onSelect={() => router.push({ name: 'settings' })} />
          </SpatialNavigationView>
        </SpatialNavigationView>
      </SpatialNavigationRoot>
    </Screen>
  );
}

const styles = StyleSheet.create({
  placeholder: { color: colors.textDim, fontSize: type.tiny, marginTop: s(-16), marginBottom: s(8) },
  packs: { flexDirection: 'row', marginLeft: s(-14) },
  // 6 packs: two rows of 3 (D-pad: left/right within a row, down to the next row, then the menu)
  packCard: { width: s(548), height: s(262) },
  packBody: { paddingHorizontal: s(30), paddingVertical: s(26), flex: 1 },
  packTop: { flexDirection: 'row', alignItems: 'center' },
  packName: { flex: 1, color: colors.text, fontSize: type.h2, fontWeight: '800', letterSpacing: track.h2, marginLeft: s(22) },
  packBlurb: { color: colors.textDim, fontSize: type.tiny, lineHeight: s(32) },
  packCount: { color: colors.text, fontSize: type.tiny, fontWeight: '600', marginTop: s(10), marginBottom: s(12) },
  menu: { flexDirection: 'row', marginTop: s(36) },
});

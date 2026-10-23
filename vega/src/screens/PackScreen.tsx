import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  DefaultFocus,
  SpatialNavigationRoot,
  SpatialNavigationView,
} from 'react-tv-space-navigation';
import { FocusCard, Header, Screen } from '../components/ui';
import { PACKS, signsInPack } from '../data/signs';
import { useRouter } from '../nav/router';
import { progress } from '../store/progress';
import { colors, s, track, type, zinc } from '../theme';

const PER_ROW = 4;

export function PackScreen({ packId }: { packId: string }) {
  const router = useRouter();
  const prog = progress.use();
  const pack = PACKS.find((p) => p.id === packId);
  const list = signsInPack(packId);
  const rows: (typeof list)[] = [];
  for (let i = 0; i < list.length; i += PER_ROW) rows.push(list.slice(i, i + PER_ROW));

  return (
    <Screen>
      <Header title={pack?.name || packId} subtitle="Pick a sign to learn. Back returns home." />
      {list.length === 0 ? <Text style={styles.empty}>No signs in this pack yet.</Text> : null}
      <SpatialNavigationRoot>
        {/* Vega: SpatialNavigationScrollView froze the VVD renderer; packs have <= 12 signs (3 rows), so a plain View fits. */}
        <View style={{ flex: 1 }}>
          <SpatialNavigationView direction="vertical" alignInGrid>
            {rows.map((row, r) => (
              <SpatialNavigationView key={r} direction="horizontal" style={styles.row}>
                {row.map((sg, c) => {
                  const p = prog.signs[sg.id];
                  const stars = Math.min(3, p?.ok || 0);
                  const card = (
                    <FocusCard
                      key={sg.id}
                      style={styles.card}
                      onSelect={() => router.push({ name: 'lesson', packId, signId: sg.id })}
                    >
                      {(focused) => (
                        <View style={styles.cardBody}>
                          <Text style={[styles.label, focused && { color: colors.onFocus }]} numberOfLines={1}>
                            {sg.label}
                          </Text>
                          <View style={styles.foot}>
                            <Text style={[styles.meta, focused && { color: zinc[600] }]}>{p?.ok ? 'Learned' : p?.tries ? 'Keep practising' : 'New'}</Text>
                            <Text style={styles.stars}>
                              <Text style={{ color: focused ? colors.onFocus : colors.text }}>{'★'.repeat(stars)}</Text>
                              <Text style={{ color: focused ? zinc[300] : zinc[700] }}>{'★'.repeat(3 - stars)}</Text>
                            </Text>
                          </View>
                        </View>
                      )}
                    </FocusCard>
                  );
                  return r === 0 && c === 0 ? <DefaultFocus key={sg.id}>{card}</DefaultFocus> : card;
                })}
              </SpatialNavigationView>
            ))}
          </SpatialNavigationView>
        </View>
      </SpatialNavigationRoot>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.textDim, fontSize: type.body },
  row: { flexDirection: 'row', paddingLeft: s(6) },
  card: { width: s(392), height: s(220) },
  cardBody: { paddingHorizontal: s(32), paddingVertical: s(22), flex: 1, justifyContent: 'space-between' },
  label: { color: colors.text, fontSize: s(58), fontWeight: '800', letterSpacing: track.title },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stars: { fontSize: type.small, letterSpacing: s(4) },
  meta: { color: colors.textDim, fontSize: type.tiny, fontWeight: '600' },
});

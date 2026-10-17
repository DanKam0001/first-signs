import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  DefaultFocus,
  SpatialNavigationRoot,
  SpatialNavigationScrollView,
  SpatialNavigationView,
} from 'react-tv-space-navigation';
import { FocusCard, Header, Screen } from '../components/ui';
import { PACKS, signsInPack } from '../data/signs';
import { useRouter } from '../nav/router';
import { progress } from '../store/progress';
import { colors, packColors, s, type } from '../theme';

const PER_ROW = 4;

export function PackScreen({ packId }: { packId: string }) {
  const router = useRouter();
  const prog = progress.use();
  const pack = PACKS.find((p) => p.id === packId);
  const list = signsInPack(packId);
  const accent = packColors[packId] || colors.focus;
  const rows: (typeof list)[] = [];
  for (let i = 0; i < list.length; i += PER_ROW) rows.push(list.slice(i, i + PER_ROW));

  return (
    <Screen>
      <Header title={pack?.name || packId} subtitle="Pick a sign to learn. Back returns home." accent={accent} />
      {list.length === 0 ? <Text style={styles.empty}>No signs in this pack yet.</Text> : null}
      <SpatialNavigationRoot>
        <SpatialNavigationScrollView offsetFromStart={s(40)} style={{ flex: 1 }}>
          <SpatialNavigationView direction="vertical" alignInGrid>
            {rows.map((row, r) => (
              <SpatialNavigationView key={r} direction="horizontal" style={styles.row}>
                {row.map((sg, c) => {
                  const p = prog.signs[sg.id];
                  const stars = Math.min(3, p?.ok || 0);
                  const card = (
                    <FocusCard
                      key={sg.id}
                      accent={accent}
                      style={styles.card}
                      onSelect={() => router.push({ name: 'lesson', packId, signId: sg.id })}
                    >
                      {(focused) => (
                        <View style={styles.cardBody}>
                          <Text style={[styles.label, focused && { color: accent }]} numberOfLines={1}>
                            {sg.label}
                          </Text>
                          <Text style={styles.stars}>
                            <Text style={{ color: colors.focus }}>{'★'.repeat(stars)}</Text>
                            <Text style={{ color: colors.line }}>{'★'.repeat(3 - stars)}</Text>
                          </Text>
                          <Text style={styles.meta}>{p?.ok ? 'Learned' : p?.tries ? 'Keep practising' : 'New'}</Text>
                        </View>
                      )}
                    </FocusCard>
                  );
                  return r === 0 && c === 0 ? <DefaultFocus key={sg.id}>{card}</DefaultFocus> : card;
                })}
              </SpatialNavigationView>
            ))}
          </SpatialNavigationView>
        </SpatialNavigationScrollView>
      </SpatialNavigationRoot>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.textDim, fontSize: type.body },
  row: { flexDirection: 'row', paddingLeft: s(6) },
  card: { width: s(392), height: s(250) },
  cardBody: { padding: s(28), flex: 1, justifyContent: 'center' },
  label: { color: colors.text, fontSize: s(60), fontWeight: '800' },
  stars: { fontSize: type.body, marginTop: s(8) },
  meta: { color: colors.textDim, fontSize: type.tiny, marginTop: s(6) },
});

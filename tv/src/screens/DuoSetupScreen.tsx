import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { DefaultFocus, SpatialNavigationRoot, SpatialNavigationView } from 'react-tv-space-navigation';
import { FocusButton, Header, Hint, Screen } from '../components/ui';
import { PACKS, signsInPack } from '../data/signs';
import { useRouter } from '../nav/router';
import { colors, packColors, s, type } from '../theme';

const NAMES = ['Mum', 'Dad', 'Grandma', 'Grandpa', 'Sister', 'Brother', 'Friend'];
export const DUO_LEFT_COLOR = '#FF7EB6';
export const DUO_RIGHT_COLOR = '#4FD1C5';

/** Sign Together setup: who stands on the left / right (facing the TV), which pack, how many signs. */
export function DuoSetupScreen() {
  const router = useRouter();
  const [left, setLeft] = useState('Mum');
  const [right, setRight] = useState('Dad');
  const [packId, setPackId] = useState('all');
  const [rounds, setRounds] = useState(5);

  const nameRow = (value: string, set: (n: string) => void, other: string, accent: string, first: boolean) =>
    [NAMES].map((group, g) => (
      <SpatialNavigationView key={g} direction="horizontal" style={{ ...styles.row, marginBottom: s(10) }}>
        {group.map((name, i) => {
          const on = value === name;
          const btn = (
            <FocusButton
              key={name}
              small
              accent={accent}
              label={on ? `✓ ${name}` : name}
              style={on ? { ...styles.on, borderColor: accent } : name === other ? styles.taken : undefined}
              onSelect={() => name !== other && set(name)}
            />
          );
          return first && g === 0 && i === 0 ? <DefaultFocus key={name}>{btn}</DefaultFocus> : btn;
        })}
      </SpatialNavigationView>
    ));

  return (
    <Screen>
      <Header title="Sign Together" subtitle="Two people, one camera. Stand side by side and sign at the same time." />
      <SpatialNavigationRoot>
        <SpatialNavigationView direction="vertical">
          <Text style={[styles.label, { color: DUO_LEFT_COLOR }]}>Standing on the LEFT (facing the TV)</Text>
          {nameRow(left, setLeft, right, DUO_LEFT_COLOR, true)}
          <Text style={[styles.label, { color: DUO_RIGHT_COLOR }]}>Standing on the RIGHT</Text>
          {nameRow(right, setRight, left, DUO_RIGHT_COLOR, false)}
          <Text style={styles.label}>Which signs?</Text>
          <SpatialNavigationView direction="horizontal" style={styles.row}>
            <FocusButton small label={packId === 'all' ? '✓ All packs' : 'All packs'} style={packId === 'all' ? styles.on : undefined} onSelect={() => setPackId('all')} />
            {PACKS.map((p) => (
              <FocusButton
                key={p.id}
                small
                accent={packColors[p.id]}
                label={packId === p.id ? `✓ ${p.name}` : p.name}
                style={packId === p.id ? { ...styles.on, borderColor: packColors[p.id] } : undefined}
                onSelect={() => setPackId(p.id)}
              />
            ))}
          </SpatialNavigationView>
          <Text style={styles.label}>How many signs?</Text>
          <SpatialNavigationView direction="horizontal" style={styles.row}>
            {[3, 5, 8].map((n) => (
              <FocusButton key={n} small label={rounds === n ? `✓ ${n}` : String(n)} style={rounds === n ? styles.on : undefined} onSelect={() => setRounds(n)} />
            ))}
          </SpatialNavigationView>
          <SpatialNavigationView direction="horizontal" style={{ ...styles.row, marginTop: s(30) }}>
            <FocusButton
              label="Start"
              accent={colors.good}
              onSelect={() => router.replace({ name: 'duo', leftName: left, rightName: right, packId, rounds })}
            />
            <FocusButton label="Back" onSelect={() => router.pop()} />
          </SpatialNavigationView>
        </SpatialNavigationView>
      </SpatialNavigationRoot>
      <Hint>
        {left} on the left, {right} on the right - {packId === 'all' ? 'signs from every pack' : `${signsInPack(packId).length} signs`}, {rounds} rounds
      </Hint>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.text, fontSize: type.small, fontWeight: '800', marginTop: s(14), marginBottom: s(10) },
  row: { flexDirection: 'row' },
  on: { borderColor: colors.focus, backgroundColor: colors.cardHi },
  taken: { opacity: 0.4 },
});

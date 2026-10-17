import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationRoot, SpatialNavigationView } from 'react-tv-space-navigation';
import { FocusButton, Header, Hint, Screen } from '../components/ui';
import { PACKS, signsInPack } from '../data/signs';
import { useRouter } from '../nav/router';
import { colors, packColors, s, type } from '../theme';

const PEOPLE = ['Mum', 'Dad', 'Grandma', 'Grandpa', 'Sister', 'Brother', 'Auntie', 'Uncle', 'Friend'];

export function GameSetupScreen() {
  const router = useRouter();
  const [players, setPlayers] = useState<string[]>(['Mum', 'Dad']);
  const [packId, setPackId] = useState<string>('all');
  const [turns, setTurns] = useState(3);

  const toggle = (name: string) =>
    setPlayers((p) => (p.includes(name) ? p.filter((x) => x !== name) : p.length >= 6 ? p : [...p, name]));
  const canStart = players.length >= 1;

  return (
    <Screen>
      <Header title="Family round" subtitle="Take turns signing. Everyone scores, streaks score extra." />
      <SpatialNavigationRoot>
        <SpatialNavigationView direction="vertical">
          <Text style={styles.label}>Who's playing? ({players.length})</Text>
          {[PEOPLE.slice(0, 5), PEOPLE.slice(5)].map((group, g) => (
            <SpatialNavigationView key={g} direction="horizontal" style={{ ...styles.row, marginBottom: s(14) }}>
              {group.map((name, i) => {
                const on = players.includes(name);
                const btn = (
                  <FocusButton
                    key={name}
                    small
                    label={on ? `✓ ${name}` : name}
                    style={on ? styles.on : undefined}
                    onSelect={() => toggle(name)}
                  />
                );
                return g === 0 && i === 0 ? <DefaultFocus key={name}>{btn}</DefaultFocus> : btn;
              })}
            </SpatialNavigationView>
          ))}
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
          <Text style={styles.label}>Turns each</Text>
          <SpatialNavigationView direction="horizontal" style={styles.row}>
            {[2, 3, 5].map((n) => (
              <FocusButton key={n} small label={turns === n ? `✓ ${n}` : String(n)} style={turns === n ? styles.on : undefined} onSelect={() => setTurns(n)} />
            ))}
          </SpatialNavigationView>
          <SpatialNavigationView direction="horizontal" style={{ ...styles.row, marginTop: s(36) }}>
            <FocusButton
              label="Start the round"
              accent={colors.good}
              onSelect={() => canStart && router.replace({ name: 'game', players, packId, turnsEach: turns })}
            />
            <FocusButton label="Back" onSelect={() => router.pop()} />
          </SpatialNavigationView>
        </SpatialNavigationView>
      </SpatialNavigationRoot>
      <Hint>
        {packId === 'all' ? 'Signs from every pack' : `${signsInPack(packId).length} signs`} - {players.join(', ') || 'pick at least one player'}
      </Hint>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.text, fontSize: type.body, fontWeight: '800', marginTop: s(22), marginBottom: s(14) },
  row: { flexDirection: 'row', flexWrap: 'nowrap' },
  on: { borderColor: colors.focus, backgroundColor: colors.cardHi },
});

import React, { useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  DefaultFocus,
  SpatialNavigationFocusableView,
  SpatialNavigationRoot,
  SpatialNavigationView,
} from 'react-tv-space-navigation';
import { FocusButton, Header, Screen } from '../components/ui';
import { DATA_IS_PLACEHOLDER, SIGNS } from '../data/signs';
import { conn, useConn } from '../net/connection';
import { useRouter } from '../nav/router';
import { defaultServerUrl, effectiveServerUrl, settings } from '../store/settings';
import { colors, s, type } from '../theme';
import { SOURCE } from '../generated/model';

export function SettingsScreen() {
  const router = useRouter();
  const st = settings.use();
  const c = useConn();
  const [draft, setDraft] = useState(st.serverUrl || defaultServerUrl());
  const input = useRef<TextInput>(null);

  const apply = (url: string) => {
    const clean = url.trim();
    settings.set({ serverUrl: clean === defaultServerUrl() ? '' : clean });
    setDraft(clean || defaultServerUrl());
    conn.connect(effectiveServerUrl());
  };

  return (
    <Screen>
      <Header title="Settings" />
      <SpatialNavigationRoot>
        <SpatialNavigationView direction="vertical">
          <Text style={styles.label}>Server address (ws://computer-ip:8788/ws)</Text>
          <SpatialNavigationFocusableView onSelect={() => input.current?.focus()}>
            {({ isFocused }) => (
              <View style={[styles.inputWrap, isFocused && { borderColor: colors.focus }]}>
                <TextInput
                  ref={input}
                  value={draft}
                  onChangeText={setDraft}
                  onSubmitEditing={() => apply(draft)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType={Platform.OS === 'android' ? 'url' : 'default'}
                  style={styles.input}
                  placeholder={defaultServerUrl()}
                  placeholderTextColor={colors.textDim}
                />
              </View>
            )}
          </SpatialNavigationFocusableView>
          <Text style={styles.small}>Press OK on the box to type. Built-in default: {defaultServerUrl()}</Text>
          <SpatialNavigationView direction="horizontal" style={styles.row}>
            <DefaultFocus>
              <FocusButton small label="Save and reconnect" accent={colors.good} onSelect={() => apply(draft)} />
            </DefaultFocus>
            <FocusButton small label="Use default" onSelect={() => apply(defaultServerUrl())} />
            <FocusButton small label="Reconnect" onSelect={() => conn.connect(effectiveServerUrl())} />
          </SpatialNavigationView>
          <Text style={styles.label}>Learning</Text>
          <SpatialNavigationView direction="horizontal" style={styles.row}>
            <FocusButton small label={`Voice prompts: ${st.voice ? 'On' : 'Off'}`} onSelect={() => settings.set({ voice: !st.voice })} />
            <FocusButton small label={`Mirror the teacher: ${st.mirrorTeacher ? 'On' : 'Off'}`} onSelect={() => settings.set({ mirrorTeacher: !st.mirrorTeacher })} />
            <FocusButton small label={`Slow motion: ${st.slowTeacher ? 'On' : 'Off'}`} onSelect={() => settings.set({ slowTeacher: !st.slowTeacher })} />
          </SpatialNavigationView>
          <SpatialNavigationView direction="horizontal" style={{ ...styles.row, marginTop: s(30) }}>
            <FocusButton label="Back" onSelect={() => router.pop()} />
          </SpatialNavigationView>
        </SpatialNavigationView>
      </SpatialNavigationRoot>
      <View style={styles.info}>
        <Text style={styles.small}>
          Connection: {c.status}
          {c.code ? ` - room ${c.code}` : ''}
          {c.paired ? ' - phone paired' : ''} - {c.url}
        </Text>
        {c.lastError ? <Text style={[styles.small, { color: colors.warn }]}>{c.lastError}</Text> : null}
        <Text style={styles.small}>
          Signs: {SIGNS.length} from {SOURCE}
          {DATA_IS_PLACEHOLDER ? ' (placeholder data)' : ''}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.text, fontSize: type.body, fontWeight: '800', marginTop: s(20), marginBottom: s(12) },
  inputWrap: { borderWidth: s(4), borderColor: colors.line, borderRadius: s(20), backgroundColor: colors.bgDeep, width: s(1300) },
  input: { color: colors.text, fontSize: type.body, paddingHorizontal: s(26), paddingVertical: s(18) },
  small: { color: colors.textDim, fontSize: type.tiny, marginTop: s(10) },
  row: { flexDirection: 'row', marginTop: s(16) },
  info: { position: 'absolute', left: s(96), bottom: s(40) },
});

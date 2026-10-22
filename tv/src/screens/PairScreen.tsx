import React, { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationRoot, SpatialNavigationView } from 'react-tv-space-navigation';
import { QRCode } from '../components/QRCode';
import { FocusButton, Header, Screen } from '../components/ui';
import { conn, useConn } from '../net/connection';
import { speak } from '../net/voice';
import { useRouter } from '../nav/router';
import { colors, hair, s, track, type, zinc } from '../theme';

const WEB = Platform.OS === 'web';

export function PairScreen() {
  const c = useConn();
  const router = useRouter();
  const isRoot = router.stack.length === 1;

  useEffect(() => {
    const onPaired = () => {
      speak('Phone connected. Let’s learn some signs!');
      if (isRoot) router.replace({ name: 'home' });
      else router.pop();
    };
    conn.events.on('paired', onPaired);
    return () => conn.events.off('paired', onPaired);
  }, [isRoot, router]);

  const leave = () => (isRoot ? router.replace({ name: 'home' }) : router.pop());
  const reachable = c.status === 'open';

  return (
    <Screen>
      <Header title="Connect a phone" subtitle="The phone is the camera. The TV is where you learn." />
      <View style={styles.row}>
        <View style={styles.qrBox}>
          {reachable && c.phoneUrl ? (
            <>
              <View style={styles.qrWell}>
                <QRCode value={c.phoneUrl} size={s(400)} />
              </View>
              <Text style={styles.codeLabel}>or enter code</Text>
              <Text style={styles.code} testID="pair-code">
                {(c.code || '----').split('').join(' ')}
              </Text>
            </>
          ) : (
            <View style={styles.waiting}>
              <Text style={styles.waitTitle}>{c.status === 'connecting' ? 'Connecting...' : 'Can’t reach the server'}</Text>
              <Text style={styles.waitBody}>{c.url}</Text>
              {c.status !== 'connecting' ? (
                <Text style={styles.waitBody}>Check the server is running on the same Wi-Fi, or change it in Settings.</Text>
              ) : null}
            </View>
          )}
        </View>
        <View style={styles.steps}>
          <Step n={1} text="Stand a phone up facing the sofa, about 2 metres away, so it sees your hands and chest." />
          <Step n={2} text="Point the phone camera at this QR code and open the link." />
          <Step n={3} text="Allow the camera. Video stays on the phone - only hand and arm points are sent to the TV." />
          {c.phoneUrl ? <Text style={styles.url}>{c.phoneUrl}</Text> : null}
          {/* keyed: the webcam button appears once a code exists, and spatial-nav orders nodes by mount time */}
          <SpatialNavigationRoot key={WEB && c.code ? 'with-webcam' : 'plain'}>
            <SpatialNavigationView direction="horizontal" style={styles.buttons}>
              <DefaultFocus>
                <FocusButton small={WEB} label={isRoot ? 'Just watch for now' : 'Back'} onSelect={leave} />
              </DefaultFocus>
              {Platform.OS === 'web' && c.code ? (
                // Web/live-trial only: use this computer's webcam as "the phone" (camera works on http://localhost).
                <FocusButton
                  small
                  label="Use this PC's webcam"
                  onSelect={() => window.open(`${conn.httpBase()}/p/${c.code}`, 'first-signs-phone', 'width=900,height=800')}
                />
              ) : null}
              <FocusButton small={WEB} label="Settings" onSelect={() => router.push({ name: 'settings' })} />
            </SpatialNavigationView>
          </SpatialNavigationRoot>
        </View>
      </View>
    </Screen>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNum}>
        <Text style={styles.stepNumText}>{n}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  qrBox: {
    width: s(560),
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: hair,
    borderColor: colors.line,
    borderRadius: s(32),
    paddingVertical: s(44),
    marginRight: s(90),
  },
  // the QR keeps a white quiet zone: dark modules on white scan reliably
  qrWell: { backgroundColor: '#FFFFFF', borderRadius: s(20), padding: s(10) },
  codeLabel: {
    color: colors.textDim,
    fontSize: s(26),
    fontWeight: '700',
    letterSpacing: track.label,
    marginTop: s(34),
  },
  code: { color: colors.text, fontSize: s(110), fontWeight: '800', letterSpacing: s(8), fontVariant: ['tabular-nums'] },
  waiting: { height: s(560), justifyContent: 'center', paddingHorizontal: s(36) },
  waitTitle: { color: colors.text, fontSize: type.h2, fontWeight: '800', letterSpacing: track.h2, textAlign: 'center', marginBottom: s(20) },
  waitBody: { color: colors.textDim, fontSize: type.small, textAlign: 'center', marginTop: s(10) },
  steps: { flex: 1 },
  step: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: s(40) },
  stepNum: {
    width: s(68),
    height: s(68),
    borderRadius: s(34),
    borderWidth: hair,
    borderColor: zinc[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: s(32),
  },
  stepNumText: { color: colors.text, fontSize: type.small, fontWeight: '700' },
  stepText: { flex: 1, color: colors.text, fontSize: type.body, lineHeight: s(54), paddingTop: s(6) },
  url: { color: colors.textMute, fontSize: type.tiny, marginBottom: s(34) },
  buttons: { flexDirection: 'row', marginTop: s(20) },
});

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationRoot, SpatialNavigationView } from 'react-tv-space-navigation';
import { FocusButton, Header, Screen } from '../components/ui';
import { DATA_IS_PLACEHOLDER } from '../data/signs';
import { useRouter } from '../nav/router';
import { colors, s, type } from '../theme';

export function AboutScreen() {
  const router = useRouter();
  return (
    <Screen>
      <Header title="About First Signs" />
      <View style={styles.cols}>
        <View style={styles.col}>
          <Text style={styles.h}>A practice buddy for hearing families</Text>
          <Text style={styles.p}>
            Most Deaf children are born to hearing parents. First Signs helps the whole family practise everyday ASL words
            together - milk, more, bath, sleep, mom - so signing becomes part of daily routines.
          </Text>
          <Text style={styles.p}>
            It is not a teacher and it is not a replacement for real people. ASL is a full language, and the best way to learn it
            is from Deaf teachers. Please look for a Deaf-led ASL class near you or online - for example Gallaudet University's ASL
            Connect, or the family resources from the American Society for Deaf Children (deafchildren.org). Fingerspelling is
            only a small part of ASL; these packs start with everyday words.
          </Text>
          <Text style={styles.p}>
            The checker can be wrong. If it says "almost" but your Deaf teacher says you got it, trust your teacher.
          </Text>
        </View>
        <View style={styles.col}>
          <Text style={styles.h}>Thank you to the Deaf signers</Text>
          <Text style={styles.p}>
            <Text style={styles.b}>Sign videos:</Text> PopSign ASL v1.0 by Georgia Tech and the Deaf Professional Arts Network
            (DPAN), performed by Deaf signers, CC BY 4.0 (creativecommons.org/licenses/by/4.0). Clips trimmed and re-encoded.
            signdata.cc.gatech.edu
          </Text>
          <Text style={styles.p}>
            <Text style={styles.b}>Sign checker:</Text> trained on the Isolated Sign Language Recognition corpus (GISLR) by DPAN,
            Georgia Tech and Google, recorded by Deaf signers, CC BY 4.0. Only hand and arm points are used.
          </Text>
          <Text style={styles.small}>
            Georgia Tech, DPAN, Google and the signers do not endorse First Signs. Sign descriptions were written for First
            Signs as memory aids.
          </Text>
          {DATA_IS_PLACEHOLDER ? (
            <Text style={[styles.p, { color: colors.almost }]}>
              This preview build still uses placeholder motion; the real recordings appear once the model export is bundled.
            </Text>
          ) : null}
          <Text style={styles.h}>Privacy</Text>
          <Text style={styles.p}>
            Camera video never leaves your phone. The phone sends only hand and arm points to the TV. Spoken prompts use Amazon
            Polly and tips use Amazon Bedrock; no video or images are sent to them.
          </Text>
        </View>
      </View>
      <SpatialNavigationRoot>
        <SpatialNavigationView direction="horizontal" style={{ flexDirection: 'row' }}>
          <DefaultFocus>
            <FocusButton label="Back" onSelect={() => router.pop()} />
          </DefaultFocus>
        </SpatialNavigationView>
      </SpatialNavigationRoot>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cols: { flex: 1, flexDirection: 'row' },
  col: { flex: 1, marginRight: s(60) },
  h: { color: colors.focus, fontSize: type.body, fontWeight: '800', marginBottom: s(12), marginTop: s(8) },
  p: { color: colors.text, fontSize: s(28), lineHeight: s(40), marginBottom: s(16) },
  b: { color: colors.focus, fontWeight: '800' },
  small: { color: colors.textDim, fontSize: s(22), lineHeight: s(30), marginBottom: s(16) },
});

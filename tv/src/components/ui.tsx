import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { SpatialNavigationFocusableView } from 'react-tv-space-navigation';
import { useConn } from '../net/connection';
import { colors, hair, s, safe, track, type, zinc } from '../theme';

// Inner Pressables are not natively focusable on TV: react-tv-space-navigation owns focus, so the
// Android focus engine and the JS one never fight. Pressable is still there for mouse clicks on web.
const pressProps = Platform.isTV ? { focusable: false } : {};

// Monochrome focus language (10-foot UI): the focused item inverts to a white fill with black text and
// grows slightly. Nothing else on screen is ever a white-filled button, so focus is unmistakable.
// `accent` no longer sets a colour: passing one marks the button as the primary action (white outline).
export function FocusButton({
  label,
  onSelect,
  icon,
  style,
  accent,
  small,
  testID,
}: {
  label: string;
  onSelect: () => void;
  icon?: string;
  style?: ViewStyle;
  accent?: string;
  small?: boolean;
  testID?: string;
}) {
  const primary = accent !== undefined;
  return (
    <SpatialNavigationFocusableView onSelect={onSelect}>
      {({ isFocused }) => (
        <Pressable
          {...pressProps}
          testID={testID}
          onPress={onSelect}
          style={[
            styles.btn,
            small && styles.btnSmall,
            primary && styles.btnPrimary,
            style,
            isFocused && styles.btnFocused,
          ]}
        >
          <Text
            style={[
              styles.btnText,
              small && styles.btnTextSmall,
              primary && styles.btnTextPrimary,
              isFocused && styles.btnTextFocused,
            ]}
          >
            {icon ? `${icon}  ` : ''}
            {label}
          </Text>
        </Pressable>
      )}
    </SpatialNavigationFocusableView>
  );
}

/** A focusable card. Inverts when focused; `children(focused)` should switch its own text/icon to colors.onFocus. */
export function FocusCard({
  onSelect,
  style,
  children,
}: {
  onSelect: () => void;
  /** Kept for API compatibility; cards are monochrome now. */
  accent?: string;
  style?: ViewStyle;
  children: (focused: boolean) => React.ReactNode;
}) {
  return (
    <SpatialNavigationFocusableView onSelect={onSelect}>
      {({ isFocused }) => (
        <Pressable {...pressProps} onPress={onSelect} style={[styles.card, style, isFocused && styles.cardFocused]}>
          {children(isFocused)}
        </Pressable>
      )}
    </SpatialNavigationFocusableView>
  );
}

/** Connection state: solid dot = phone connected, open ring = waiting, faint ring = no server. The text says which. */
export function StatusPill() {
  const c = useConn();
  let text = 'No server';
  let dot: ViewStyle = styles.dotOff;
  if (c.status === 'connecting') {
    text = 'Connecting...';
    dot = styles.dotWait;
  } else if (c.status === 'open' && c.paired) {
    text = 'Phone connected';
    dot = styles.dotOn;
  } else if (c.status === 'open') {
    text = c.code ? `Code ${c.code} - no phone yet` : 'No phone yet';
    dot = styles.dotWait;
  }
  return (
    <View style={styles.pill}>
      <View style={[styles.dot, dot]} />
      <Text style={styles.pillText}>{text}</Text>
    </View>
  );
}

export function Header({ title, subtitle }: { title: string; subtitle?: string; accent?: string }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1, marginRight: s(40) }}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <StatusPill />
    </View>
  );
}

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Hint({ children }: { children: React.ReactNode }) {
  return <Text style={styles.hint}>{children}</Text>;
}

export function ProgressBar({
  value,
  color = colors.text,
  trackColor = zinc[800],
  height = s(8),
}: {
  value: number;
  color?: string;
  trackColor?: string;
  height?: number;
}) {
  return (
    <View style={[styles.barBg, { height, borderRadius: height / 2, backgroundColor: trackColor }]}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

/** Line glyphs drawn in SVG so they look identical on every platform font. */
export function Glyph({ name, size, color }: { name: 'check' | 'retry' | 'alert' | 'away'; size: number; color: string }) {
  const sw = 9;
  let body: React.ReactNode;
  if (name === 'check') body = <Path d="M28 52 L44 68 L74 34" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
  else if (name === 'retry')
    body = (
      <>
        <Path d="M70 36 A24 24 0 1 0 74 58" stroke={color} strokeWidth={sw} strokeLinecap="round" fill="none" />
        <Path d="M72 22 L72 38 L56 38" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    );
  else if (name === 'away')
    body = <Path d="M30 50 H70" stroke={color} strokeWidth={sw} strokeLinecap="round" fill="none" />;
  else
    body = (
      <>
        <Path d="M50 28 V56" stroke={color} strokeWidth={sw} strokeLinecap="round" fill="none" />
        <Circle cx={50} cy={72} r={5.5} fill={color} />
      </>
    );
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={45} stroke={color} strokeWidth={5} fill="none" />
      {body}
    </Svg>
  );
}

/**
 * Result / status panel. "yes" is the one inverted (white) panel on screen; "almost" is a bright outline;
 * "info" is a quiet grey outline. The glyph and the words carry the meaning, never a colour.
 */
export function Verdict({
  tone,
  title,
  detail,
  compact,
}: {
  tone: 'yes' | 'almost' | 'info' | 'away';
  title: string;
  detail?: string | null;
  compact?: boolean;
}) {
  const inv = tone === 'yes';
  const fg = inv ? colors.onFocus : colors.text;
  const glyph = tone === 'yes' ? 'check' : tone === 'almost' ? 'retry' : tone === 'away' ? 'away' : 'alert';
  return (
    <View
      style={[
        styles.verdict,
        compact && styles.verdictCompact,
        compact && detail ? { alignItems: 'flex-start' } : null,
        inv ? styles.verdictYes : tone === 'almost' ? styles.verdictAlmost : styles.verdictInfo,
      ]}
    >
      <Glyph name={glyph} size={compact ? s(46) : s(64)} color={fg} />
      <View style={{ flex: 1, marginLeft: compact ? s(16) : s(26) }}>
        <Text style={[compact ? styles.verdictTitleCompact : styles.verdictTitle, { color: fg }]} numberOfLines={compact ? 2 : 2}>
          {title}
        </Text>
        {detail ? (
          <Text style={[compact ? styles.verdictDetailCompact : styles.verdictDetail, { color: inv ? zinc[700] : colors.textDim }]} numberOfLines={compact ? 3 : 2}>
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: safe.h, paddingVertical: safe.v },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: s(30),
    paddingBottom: s(24),
    borderBottomWidth: hair,
    borderBottomColor: colors.line,
  },
  title: { color: colors.text, fontSize: type.title, fontWeight: '800', letterSpacing: track.title },
  subtitle: { color: colors.textDim, fontSize: type.small, marginTop: s(6) },
  btn: {
    backgroundColor: 'transparent',
    borderRadius: s(18),
    borderWidth: hair,
    borderColor: zinc[700],
    paddingVertical: s(20),
    paddingHorizontal: s(42),
    marginRight: s(20),
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: s(200),
  },
  btnSmall: { paddingVertical: s(14), paddingHorizontal: s(30), minWidth: s(150), borderRadius: s(14) },
  btnPrimary: { borderColor: colors.text, backgroundColor: zinc[900] },
  btnFocused: { backgroundColor: colors.focus, borderColor: colors.focus, transform: [{ scale: 1.08 }] },
  btnText: { color: zinc[200], fontSize: type.body, fontWeight: '600' },
  btnTextSmall: { fontSize: type.small },
  btnTextPrimary: { color: colors.text, fontWeight: '800' },
  btnTextFocused: { color: colors.onFocus, fontWeight: '800' },
  card: {
    backgroundColor: colors.card,
    borderRadius: s(24),
    borderWidth: hair,
    borderColor: colors.line,
    overflow: 'hidden',
    margin: s(14),
  },
  cardFocused: { backgroundColor: colors.focus, borderColor: colors.focus, transform: [{ scale: 1.06 }] },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: hair,
    borderColor: colors.line,
    borderRadius: s(40),
    paddingHorizontal: s(26),
    paddingVertical: s(12),
  },
  dot: { width: s(18), height: s(18), borderRadius: s(9), marginRight: s(14), borderWidth: s(3) },
  dotOn: { backgroundColor: colors.text, borderColor: colors.text },
  dotWait: { backgroundColor: 'transparent', borderColor: zinc[300] },
  dotOff: { backgroundColor: 'transparent', borderColor: zinc[600] },
  pillText: { color: zinc[200], fontSize: type.tiny, fontWeight: '600' },
  hint: { color: colors.textDim, fontSize: type.small, marginTop: s(16) },
  barBg: { width: '100%', overflow: 'hidden' },
  verdict: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: s(22),
    borderWidth: s(3),
    paddingVertical: s(16),
    paddingHorizontal: s(28),
  },
  verdictCompact: { paddingVertical: s(12), paddingHorizontal: s(16), borderRadius: s(16) },
  verdictYes: { backgroundColor: colors.focus, borderColor: colors.focus },
  verdictAlmost: { backgroundColor: '#000000', borderColor: colors.text },
  verdictInfo: { backgroundColor: '#000000', borderColor: zinc[600] },
  verdictTitle: { fontSize: s(44), fontWeight: '800', letterSpacing: track.h2 },
  verdictTitleCompact: { fontSize: type.small, fontWeight: '800' },
  verdictDetail: { fontSize: type.small, marginTop: s(4) },
  verdictDetailCompact: { fontSize: s(22), marginTop: s(4) },
});

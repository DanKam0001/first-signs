import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SpatialNavigationFocusableView } from 'react-tv-space-navigation';
import { useConn } from '../net/connection';
import { colors, s, safe, type } from '../theme';

// Inner Pressables are not natively focusable on TV: react-tv-space-navigation owns focus, so the
// Android focus engine and the JS one never fight. Pressable is still there for mouse clicks on web.
const pressProps = Platform.isTV ? { focusable: false } : {};

export function FocusButton({
  label,
  onSelect,
  icon,
  style,
  accent = colors.focus,
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
            style,
            isFocused && { backgroundColor: accent, borderColor: colors.text, transform: [{ scale: 1.06 }] },
          ]}
        >
          <Text style={[styles.btnText, small && styles.btnTextSmall, isFocused && { color: colors.onFocus }]}>
            {icon ? `${icon}  ` : ''}
            {label}
          </Text>
        </Pressable>
      )}
    </SpatialNavigationFocusableView>
  );
}

export function FocusCard({
  onSelect,
  accent = colors.focus,
  style,
  children,
}: {
  onSelect: () => void;
  accent?: string;
  style?: ViewStyle;
  children: (focused: boolean) => React.ReactNode;
}) {
  return (
    <SpatialNavigationFocusableView onSelect={onSelect}>
      {({ isFocused }) => (
        <Pressable
          {...pressProps}
          onPress={onSelect}
          style={[
            styles.card,
            { borderColor: isFocused ? colors.text : 'transparent' },
            isFocused && { backgroundColor: colors.cardHi, transform: [{ scale: 1.05 }] },
            style,
          ]}
        >
          <View style={[styles.cardStripe, { backgroundColor: accent }]} />
          {children(isFocused)}
        </Pressable>
      )}
    </SpatialNavigationFocusableView>
  );
}

export function StatusPill() {
  const c = useConn();
  let text = 'No server';
  let color = colors.warn;
  if (c.status === 'connecting') {
    text = 'Connecting...';
    color = colors.almost;
  } else if (c.status === 'open' && c.paired) {
    text = 'Phone connected';
    color = colors.good;
  } else if (c.status === 'open') {
    text = c.code ? `Code ${c.code} - no phone yet` : 'No phone yet';
    color = colors.almost;
  }
  return (
    <View style={styles.pill}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.pillText}>{text}</Text>
    </View>
  );
}

export function Header({ title, subtitle, accent }: { title: string; subtitle?: string; accent?: string }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, accent ? { color: accent } : null]} numberOfLines={1}>
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

export function ProgressBar({ value, color = colors.good, height = s(16) }: { value: number; color?: string; height?: number }) {
  return (
    <View style={[styles.barBg, { height, borderRadius: height / 2 }]}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: safe.h, paddingVertical: safe.v },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: s(28) },
  title: { color: colors.text, fontSize: type.title, fontWeight: '800' },
  subtitle: { color: colors.textDim, fontSize: type.body, marginTop: s(4) },
  btn: {
    backgroundColor: colors.card,
    borderRadius: s(48),
    borderWidth: s(4),
    borderColor: 'transparent',
    paddingVertical: s(22),
    paddingHorizontal: s(44),
    marginRight: s(24),
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: s(220),
  },
  btnSmall: { paddingVertical: s(14), paddingHorizontal: s(30), minWidth: s(160) },
  btnText: { color: colors.text, fontSize: type.body, fontWeight: '700' },
  btnTextSmall: { fontSize: type.small },
  card: {
    backgroundColor: colors.card,
    borderRadius: s(28),
    borderWidth: s(5),
    overflow: 'hidden',
    margin: s(14),
  },
  cardStripe: { height: s(14), width: '100%' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgDeep,
    borderRadius: s(30),
    paddingHorizontal: s(26),
    paddingVertical: s(12),
  },
  dot: { width: s(20), height: s(20), borderRadius: s(10), marginRight: s(14) },
  pillText: { color: colors.text, fontSize: type.small, fontWeight: '600' },
  hint: { color: colors.textDim, fontSize: type.small, marginTop: s(16) },
  barBg: { width: '100%', backgroundColor: colors.bgDeep, overflow: 'hidden' },
});

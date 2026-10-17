// A light confetti burst: 28 coloured dots on the native driver (transform + opacity only).
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { s } from '../theme';

const COLORS = ['#FFB547', '#FF8A5B', '#8EA8FF', '#4FD1C5', '#FF7EB6', '#7BE495', '#FFF7E8'];

export function Celebration({ burstKey }: { burstKey: number }) {
  const t = useRef(new Animated.Value(0)).current;
  const dots = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => {
        const a = (i / 28) * Math.PI * 2 + Math.random() * 0.4;
        const dist = s(260 + Math.random() * 280);
        return {
          dx: Math.cos(a) * dist,
          dy: Math.sin(a) * dist - s(80),
          size: s(18 + Math.random() * 22),
          color: COLORS[i % COLORS.length],
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [burstKey]
  );
  useEffect(() => {
    t.setValue(0);
    Animated.timing(t, { toValue: 1, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [burstKey, t]);
  if (!burstKey) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
      {dots.map((d, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: d.size,
            height: d.size,
            borderRadius: d.size / 2,
            backgroundColor: d.color,
            opacity: t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, d.dx] }) },
              { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, d.dy + s(160)] }) },
              { scale: t.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.2, 1.2, 0.8] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });

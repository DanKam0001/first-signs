// A light confetti burst: 28 white/grey dots and rings on the native driver (transform + opacity only).
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { s } from '../theme';

const COLORS = ['#FFFFFF', '#E4E4E7', '#A1A1AA', '#FFFFFF', '#71717A'];

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
          ring: i % 3 === 0,
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
            backgroundColor: d.ring ? 'transparent' : d.color,
            borderWidth: d.ring ? s(4) : 0,
            borderColor: d.color,
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

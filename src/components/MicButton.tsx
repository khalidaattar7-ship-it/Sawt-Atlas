// Sawt Atlas Urgence — Bouton microphone rond avec 3 états et animation pulse concentrique
// Fichier créé le 2026-05-07

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../constants/colors';

export type MicState = 'disabled' | 'idle' | 'listening';

interface MicButtonProps {
  state: MicState;
  onPress?: () => void;
  size?: number;
}

// Icône micro en SVG pur (pas de dépendance externe)
const MicIcon = ({ color, size }: { color: string; size: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
      fill={color}
    />
    <Path
      d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"
      fill={color}
    />
  </Svg>
);

const MicButton: React.FC<MicButtonProps> = ({ state, onPress, size = 100 }) => {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;

  const buttonColor =
    state === 'disabled' ? COLORS.textLight :
    state === 'listening' ? COLORS.red :
    COLORS.green;

  const ringColor =
    state === 'listening' ? COLORS.red : COLORS.green;

  const makePulse = (anim: Animated.Value, delay: number) =>
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );

  useEffect(() => {
    if (state === 'disabled') {
      ring1.setValue(0);
      ring2.setValue(0);
      ring3.setValue(0);
      return;
    }

    const a1 = makePulse(ring1, 0);
    const a2 = makePulse(ring2, 470);
    const a3 = makePulse(ring3, 940);
    a1.start();
    a2.start();
    a3.start();

    return () => { a1.stop(); a2.stop(); a3.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Chaque anneau : scale 1→2, opacity 0.6→0
  const ringStyle = (anim: Animated.Value) => ({
    position: 'absolute' as const,
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: ringColor,
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
  });

  return (
    <View style={[styles.wrapper, { width: size * 2.5, height: size * 2.5 }]}>
      {/* Anneaux de pulse */}
      <Animated.View style={ringStyle(ring1)} />
      <Animated.View style={ringStyle(ring2)} />
      <Animated.View style={ringStyle(ring3)} />

      {/* Bouton principal */}
      <TouchableOpacity
        onPress={state !== 'disabled' ? onPress : undefined}
        activeOpacity={state === 'disabled' ? 1 : 0.85}
        style={[
          styles.button,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: buttonColor,
            shadowColor: state === 'listening' ? COLORS.red : COLORS.green,
          },
        ]}
      >
        <MicIcon
          color={state === 'disabled' ? COLORS.textMuted : '#FFFFFF'}
          size={size * 0.42}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
});

export default MicButton;

// Sawt Atlas Urgence — Indicateur de phase en haut de l'écran de triage (speaking/listening/processing/waiting)
// Fichier créé le 2026-05-07

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { COLORS } from '../constants/colors';

export type IndicatorPhase = 'speaking' | 'listening' | 'processing' | 'waiting';

interface StatusIndicatorProps {
  phase: IndicatorPhase;
}

// ─── Icônes SVG inline ────────────────────────────────────────────────────────

const SpeakerIcon = ({ color }: { color: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24">
    <Path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" fill={color} />
    <Path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77 0-4.28-2.99-7.86-7-8.77z" fill={color} />
  </Svg>
);

const MicIcon = ({ color }: { color: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24">
    <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill={color} />
    <Path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z" fill={color} />
  </Svg>
);

const WaitingIcon = ({ color }: { color: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24">
    <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={2} fill="none" />
    <Path d="M12 7v5l3 3" stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
  </Svg>
);

// ─── Spinner pour le mode processing ─────────────────────────────────────────

const Spinner = ({ color }: { color: string }) => {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(rotation, { toValue: 1, duration: 900, useNativeDriver: true })
    );
    anim.start();
    return () => anim.stop();
  }, [rotation]);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Path
          d="M12 2a10 10 0 0 1 10 10"
          stroke={color} strokeWidth={2.5} strokeLinecap="round" fill="none"
        />
        <Path
          d="M12 2a10 10 0 0 0-10 10"
          stroke={color} strokeWidth={2.5} strokeLinecap="round" fill="none"
          opacity={0.3}
        />
      </Svg>
    </Animated.View>
  );
};

// ─── Onde sonore miniature pour "speaking" ───────────────────────────────────

const MiniWave = ({ color }: { color: string }) => {
  const bars = useRef(
    Array.from({ length: 5 }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    const loops = bars.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 80),
          Animated.timing(anim, { toValue: 1, duration: 250, useNativeDriver: false }),
          Animated.timing(anim, { toValue: 0.2, duration: 250, useNativeDriver: false }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [bars]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 22, gap: 3, marginLeft: 4 }}>
      {bars.map((anim, i) => {
        const height = anim.interpolate({ inputRange: [0, 1], outputRange: [4, 18] });
        return (
          <Animated.View
            key={i}
            style={{ width: 3, height, backgroundColor: color, borderRadius: 2 }}
          />
        );
      })}
    </View>
  );
};

// ─── Composant principal ─────────────────────────────────────────────────────

const PHASE_CONFIG: Record<
  IndicatorPhase,
  { bg: string; iconColor: string }
> = {
  speaking:   { bg: COLORS.primarySoft, iconColor: COLORS.primary },
  listening:  { bg: COLORS.redSoft,     iconColor: COLORS.red },
  processing: { bg: COLORS.accentSoft,  iconColor: COLORS.accent },
  waiting:    { bg: COLORS.border,      iconColor: COLORS.textMuted },
};

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ phase }) => {
  const { bg, iconColor } = PHASE_CONFIG[phase];

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Icône de phase */}
      {phase === 'speaking'   && <SpeakerIcon color={iconColor} />}
      {phase === 'listening'  && <MicIcon color={iconColor} />}
      {phase === 'processing' && <Spinner color={iconColor} />}
      {phase === 'waiting'    && <WaitingIcon color={iconColor} />}

      {/* Mini-onde uniquement en mode speaking */}
      {phase === 'speaking' && <MiniWave color={iconColor} />}

      {/* Dot pulsant en listening */}
      {phase === 'listening' && (
        <PulsingDot color={iconColor} />
      )}
    </View>
  );
};

// Petit point rouge pulsant à côté du micro
const PulsingDot = ({ color }: { color: string }) => {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.2, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: color, opacity, marginLeft: 6 },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default StatusIndicator;

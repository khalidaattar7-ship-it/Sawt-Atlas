// Sawt Atlas Urgence — Animation onde sonore : barres verticales (listening) ou onde douce (speaking)
// Fichier créé le 2026-05-07

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

interface SpeechWaveProps {
  type: 'speaking' | 'listening';
  active: boolean;
  color: string;
  barCount?: number;
  maxHeight?: number;
}

// Profils d'animation par barre (déterministes, pas de Math.random au render)
const BAR_PROFILES = [
  { high: 0.9, low: 0.2, dur: 280 },
  { high: 0.6, low: 0.15, dur: 220 },
  { high: 1.0, low: 0.3, dur: 340 },
  { high: 0.5, low: 0.1, dur: 200 },
  { high: 0.8, low: 0.25, dur: 310 },
  { high: 0.7, low: 0.2, dur: 260 },
  { high: 0.95, low: 0.35, dur: 380 },
  { high: 0.55, low: 0.12, dur: 230 },
  { high: 0.85, low: 0.28, dur: 320 },
  { high: 0.65, low: 0.18, dur: 270 },
  { high: 0.75, low: 0.22, dur: 300 },
  { high: 0.45, low: 0.1, dur: 210 },
  { high: 0.9, low: 0.3, dur: 350 },
  { high: 0.6, low: 0.15, dur: 240 },
  { high: 0.8, low: 0.25, dur: 290 },
  { high: 0.5, low: 0.12, dur: 220 },
  { high: 1.0, low: 0.4, dur: 370 },
  { high: 0.7, low: 0.2, dur: 260 },
  { high: 0.85, low: 0.3, dur: 330 },
  { high: 0.55, low: 0.1, dur: 250 },
];

const SpeechWave: React.FC<SpeechWaveProps> = ({
  type,
  active,
  color,
  barCount = 20,
  maxHeight = 48,
}) => {
  const count = Math.min(barCount, BAR_PROFILES.length);

  // Tableau fixe d'Animated.Values (jamais recréé entre renders)
  const barAnims = useRef(
    Array.from({ length: BAR_PROFILES.length }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    if (!active) {
      // Toutes les barres reviennent à plat (4px)
      Animated.parallel(
        barAnims.map((anim) =>
          Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: false })
        )
      ).start();
      return;
    }

    // Chaque barre oscille indépendamment avec son propre profil
    const loops = barAnims.slice(0, count).map((anim, i) => {
      const profile = BAR_PROFILES[i];
      const delay = (i * 30) % 200; // décalage de phase progressif

      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: profile.high,
            duration: profile.dur,
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: profile.low,
            duration: profile.dur,
            useNativeDriver: false,
          }),
        ])
      );
    });

    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active, count, barAnims]);

  const MIN_BAR_HEIGHT = 4;

  if (type === 'speaking') {
    // Onde douce : les barres ont une enveloppe sinusoïdale (plus hautes au centre)
    return (
      <View style={styles.container}>
        {barAnims.slice(0, count).map((anim, i) => {
          // Enveloppe : les barres du centre sont plus hautes
          const envelope = Math.sin((i / (count - 1)) * Math.PI);
          const height = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [MIN_BAR_HEIGHT, Math.max(MIN_BAR_HEIGHT, maxHeight * envelope)],
          });
          return (
            <Animated.View
              key={i}
              style={[
                styles.bar,
                {
                  height,
                  backgroundColor: color,
                  opacity: 0.5 + envelope * 0.5,
                  marginHorizontal: 2,
                  width: 3,
                  borderRadius: 2,
                },
              ]}
            />
          );
        })}
      </View>
    );
  }

  // Listening : barres uniformes oscillant librement
  return (
    <View style={styles.container}>
      {barAnims.slice(0, count).map((anim, i) => {
        const height = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [MIN_BAR_HEIGHT, maxHeight],
        });
        return (
          <Animated.View
            key={i}
            style={[
              styles.bar,
              {
                height,
                backgroundColor: color,
                marginHorizontal: 1.5,
                width: 4,
                borderRadius: 2,
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    paddingHorizontal: 8,
  },
  bar: {
    alignSelf: 'center',
  },
});

export default SpeechWave;

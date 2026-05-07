// Sawt Atlas Urgence — Bannière de résultat plein écran colorée selon le niveau d'urgence
// Fichier créé le 2026-05-07

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { COLORS } from '../constants/colors';

export type UrgencyLevel = 'RED' | 'ORANGE' | 'GREEN';

interface UrgencyBannerProps {
  level: UrgencyLevel;
  visible?: boolean;
}

const CONFIG: Record<UrgencyLevel, { bg: string; softBg: string; emoji: string }> = {
  RED:    { bg: COLORS.red,    softBg: COLORS.redSoft,    emoji: '🚨' },
  ORANGE: { bg: COLORS.orange, softBg: COLORS.orangeSoft, emoji: '⚠️' },
  GREEN:  { bg: COLORS.green,  softBg: COLORS.greenSoft,  emoji: '✅' },
};

const UrgencyBanner: React.FC<UrgencyBannerProps> = ({ level, visible = true }) => {
  const flash = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const { bg, softBg, emoji } = CONFIG[level];

  useEffect(() => {
    if (!visible) return;

    // Animation d'entrée
    Animated.spring(scale, {
      toValue: 1,
      tension: 60,
      friction: 7,
      useNativeDriver: true,
    }).start();

    // Flash doux uniquement pour RED
    if (level === 'RED') {
      const flashAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(flash, { toValue: 0.4, duration: 600, useNativeDriver: true }),
          Animated.timing(flash, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      flashAnim.start();
      return () => flashAnim.stop();
    } else {
      flash.setValue(1);
    }
  }, [level, visible, flash, scale]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: softBg, opacity: level === 'RED' ? flash : 1 },
      ]}
    >
      {/* Bande colorée supérieure */}
      <View style={[styles.topBar, { backgroundColor: bg }]} />

      {/* Emoji central animé */}
      <Animated.Text
        style={[styles.emoji, { transform: [{ scale }] }]}
        accessibilityLabel={`Urgence ${level}`}
      >
        {emoji}
      </Animated.Text>

      {/* Indicateur coloré inférieur */}
      <View style={[styles.bottomBar, { backgroundColor: bg }]} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    overflow: 'hidden',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 8,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 8,
  },
  emoji: {
    fontSize: 96,
    textAlign: 'center',
  },
});

export default UrgencyBanner;

// Sawt Atlas Urgence — Mode accompagnement silencieux post-alerte rouge
// Fichier créé le 2026-05-07

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { RootStackParamList } from '../types';
import { useTriageStore } from '../store/triageStore';
import { speakWithCallback } from '../engine/TTSModule';
import networkMonitor from '../utils/network-monitor';
import { COLORS } from '../constants/colors';
import { COMPANION_REMINDER_MS } from '../constants/config';
import MicButton from '../components/MicButton';

type Props = NativeStackScreenProps<RootStackParamList, 'Companion'>;

// ─── Breathing circle animation ───────────────────────────────────────────────

const BreathingCircle: React.FC = () => {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.15, duration: 3000, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 3000, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 0.85, duration: 3000, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.3, duration: 3000, useNativeDriver: true }),
        ]),
      ])
    );
    breathe.start();
    return () => breathe.stop();
  }, [scale, opacity]);

  return (
    <View style={styles.breathingContainer}>
      {/* Outer ring */}
      <Animated.View style={[styles.breathingOuter, { transform: [{ scale }], opacity }]} />
      {/* Middle ring */}
      <Animated.View
        style={[
          styles.breathingMiddle,
          { transform: [{ scale: Animated.multiply(scale, new Animated.Value(0.78)) }] },
        ]}
      />
      {/* Inner solid circle */}
      <View style={styles.breathingInner}>
        <Text style={styles.breathingIcon}>♥</Text>
      </View>
    </View>
  );
};

// ─── Elapsed time counter ─────────────────────────────────────────────────────

const ElapsedTimer: React.FC<{ startTime: number }> = ({ startTime }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <Text style={styles.timer}>منذ الإنذار : {mm}:{ss}</Text>
  );
};

// ─── Main screen ──────────────────────────────────────────────────────────────

const CompanionScreen: React.FC<Props> = ({ navigation }) => {
  const { session, resetSession } = useTriageStore();
  const [reminderFired, setReminderFired] = useState(false);
  const startTime = useRef(Date.now());
  const isMounted = useRef(true);

  const networkState = networkMonitor.getCurrentState();
  const alertSent = networkState !== 'none';

  // Keep screen awake
  useEffect(() => {
    activateKeepAwakeAsync();
    return () => { deactivateKeepAwake(); };
  }, []);

  // One-time reminder after COMPANION_REMINDER_MS (10 min)
  useEffect(() => {
    isMounted.current = true;
    const timer = setTimeout(() => {
      if (!isMounted.current || reminderFired) return;
      setReminderFired(true);
      speakWithCallback(
        'أنا هنا معاكم. إلا حتاجتو شي حاجة عيطو لي.',
        () => {}
      );
    }, COMPANION_REMINDER_MS);

    return () => {
      isMounted.current = false;
      clearTimeout(timer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMicPress = useCallback(() => {
    speakWithCallback('كيفاش نقدر نعاونك؟', () => {});
  }, []);

  const handleReport = useCallback(() => {
    if (session) navigation.navigate('Report', { sessionId: session.id });
  }, [session, navigation]);

  const handleNewTriage = useCallback(() => {
    resetSession();
    navigation.replace('Home');
  }, [resetSession, navigation]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* Top info row */}
        <View style={styles.topRow}>
          <ElapsedTimer startTime={startTime.current} />
          <View style={[styles.networkBadge, { backgroundColor: alertSent ? COLORS.primarySoft : COLORS.orangeSoft }]}>
            <Text style={[styles.networkText, { color: alertSent ? COLORS.primary : COLORS.orange }]}>
              {alertSent ? '📡 الإنذار أُرسل ✅' : '📡 في انتظار الشبكة...'}
            </Text>
          </View>
        </View>

        {/* Central breathing animation */}
        <View style={styles.centerArea}>
          <BreathingCircle />
          <Text style={styles.calmText}>أنا هنا معاكم</Text>
          <Text style={styles.calmSubtext}>تنفسو بهدوء</Text>
        </View>

        {/* Mic button */}
        <View style={styles.micArea}>
          <Text style={styles.micHint}>اضغطو للكلام معي</Text>
          <MicButton state="idle" onPress={handleMicPress} size={90} />
        </View>

        {/* Bottom navigation */}
        <View style={styles.bottomRow}>
          <TouchableOpacity
            style={styles.bottomBtn}
            onPress={handleReport}
            accessibilityLabel="Voir le rapport"
          >
            <Text style={styles.bottomBtnText}>📄 الراپور</Text>
          </TouchableOpacity>
          <View style={styles.separator} />
          <TouchableOpacity
            style={styles.bottomBtn}
            onPress={handleNewTriage}
            accessibilityLabel="Nouveau triage"
          >
            <Text style={styles.bottomBtnText}>🔄 تريان جديد</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFF5F5',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
  },
  topRow: {
    gap: 10,
    marginBottom: 8,
  },
  timer: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  networkBadge: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  networkText: {
    fontSize: 14,
    fontWeight: '600',
    writingDirection: 'rtl',
  },
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  breathingContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breathingOuter: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: COLORS.red,
    opacity: 0.15,
  },
  breathingMiddle: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: COLORS.red,
    opacity: 0.2,
  },
  breathingInner: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breathingIcon: {
    fontSize: 36,
    color: COLORS.card,
  },
  calmText: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.red,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  calmSubtext: {
    fontSize: 16,
    color: COLORS.textMuted,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  micArea: {
    alignItems: 'center',
    gap: 8,
    paddingBottom: 16,
  },
  micHint: {
    fontSize: 14,
    color: COLORS.textMuted,
    writingDirection: 'rtl',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  bottomBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  bottomBtnText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  separator: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.border,
  },
});

export default CompanionScreen;

// Sawt Atlas Urgence — Résultat final du triage avec instructions vocales et visuelles
// Fichier créé le 2026-05-07

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useTriageStore } from '../store/triageStore';
import { speakWithCallback } from '../engine/TTSModule';
import { saveSession } from '../storage/database';
import { generateTextReport, saveReportToFile } from '../engine/ReportGenerator';
import networkMonitor from '../utils/network-monitor';
import UrgencyBanner from '../components/UrgencyBanner';
import { COLORS } from '../constants/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;

// ─── Hospital notification indicator ─────────────────────────────────────────

const HospitalIndicator: React.FC = () => {
  const pulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.6, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  return (
    <Animated.View style={[styles.hospitalBadge, { opacity: pulse }]}>
      <Text style={styles.hospitalText}>📡  السبيطار تعلم</Text>
    </Animated.View>
  );
};

// ─── Instruction row ──────────────────────────────────────────────────────────

const InstructionRow: React.FC<{ index: number; text: string; color: string }> = ({
  index,
  text,
  color,
}) => (
  <View style={styles.instructionRow}>
    <View style={[styles.instructionNumber, { backgroundColor: color }]}>
      <Text style={styles.instructionNumberText}>{index + 1}</Text>
    </View>
    <Text style={styles.instructionText}>{text}</Text>
  </View>
);

// ─── Main screen ──────────────────────────────────────────────────────────────

const ResultScreen: React.FC<Props> = ({ navigation, route }) => {
  const { session, resetSession } = useTriageStore();
  const [savedReportPath, setSavedReportPath] = useState<string | null>(null);
  const isMounted = useRef(true);

  const result = session?.finalResult ?? null;
  const level = result?.level ?? 'ORANGE';
  const accentColor =
    level === 'RED' ? COLORS.red :
    level === 'ORANGE' ? COLORS.orange :
    COLORS.green;

  const instructions = result?.instructions_darija ?? [];

  // ── Mount: speak result + persist session ─────────────────────────────────
  useEffect(() => {
    isMounted.current = true;

    // Speak result
    if (result?.speak_result_darija) {
      speakWithCallback(result.speak_result_darija, () => {});
    }

    // Persist session to SQLite and generate report
    if (session) {
      saveSession(session).catch(() => {});
      try {
        const reportText = generateTextReport(session);
        saveReportToFile(reportText, session.id)
          .then((path) => { if (isMounted.current) setSavedReportPath(path); })
          .catch(() => {});
      } catch {}
    }

    return () => { isMounted.current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewTriage = useCallback(() => {
    resetSession();
    navigation.replace('Home');
  }, [resetSession, navigation]);

  const handleReport = useCallback(() => {
    if (session) navigation.navigate('Report', { sessionId: session.id });
  }, [session, navigation]);

  const handleCompanion = useCallback(() => {
    navigation.navigate('Companion');
  }, [navigation]);

  const networkState = networkMonitor.getCurrentState();
  const hasNetwork = networkState !== 'none';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Urgency banner */}
        <View style={styles.bannerContainer}>
          <UrgencyBanner level={level} visible />
        </View>

        {/* Classification label */}
        <View style={[styles.classificationBadge, { borderColor: accentColor, backgroundColor: accentColor + '15' }]}>
          <Text style={[styles.classificationText, { color: accentColor }]}>
            {result?.label_darija ?? ''}
          </Text>
        </View>

        {/* Instructions */}
        {instructions.length > 0 && (
          <View style={styles.instructionsBlock}>
            <Text style={styles.sectionTitle}>التعليمات</Text>
            {instructions.map((inst, i) => (
              <InstructionRow key={i} index={i} text={inst} color={accentColor} />
            ))}
          </View>
        )}

        {/* RED extras */}
        {level === 'RED' && (
          <HospitalIndicator />
        )}

        {/* Action buttons */}
        <View style={styles.actions}>
          {level === 'RED' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.red }]}
              onPress={handleCompanion}
              accessibilityLabel="Mode accompagnement"
            >
              <Text style={styles.actionBtnText}>🤝  Mode accompagnement</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: COLORS.primary }]}
            onPress={handleReport}
            accessibilityLabel="Voir le rapport"
          >
            <Text style={styles.actionBtnText}>📄  الراپور</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtnOutline, { borderColor: accentColor }]}
            onPress={handleNewTriage}
            accessibilityLabel="Nouveau triage"
          >
            <Text style={[styles.actionBtnOutlineText, { color: accentColor }]}>
              🔄  تريان جديد
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sync status */}
        <View style={styles.syncRow}>
          <Text style={styles.syncText}>
            {hasNetwork ? '✅  متصل — البيانات محفوظة' : '⏳  في انتظار الشبكة'}
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    padding: 20,
    gap: 16,
    paddingBottom: 32,
  },
  bannerContainer: {
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
  },
  classificationBadge: {
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  classificationText: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  instructionsBlock: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  instructionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  instructionNumberText: {
    color: COLORS.card,
    fontSize: 14,
    fontWeight: '800',
  },
  instructionText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    lineHeight: 24,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  hospitalBadge: {
    backgroundColor: COLORS.redSoft,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.red,
  },
  hospitalText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.red,
    writingDirection: 'rtl',
  },
  actions: {
    gap: 10,
  },
  actionBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  actionBtnText: {
    color: COLORS.card,
    fontSize: 18,
    fontWeight: '700',
  },
  actionBtnOutline: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  actionBtnOutlineText: {
    fontSize: 18,
    fontWeight: '700',
  },
  syncRow: {
    alignItems: 'center',
    paddingTop: 4,
  },
  syncText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
});

export default ResultScreen;

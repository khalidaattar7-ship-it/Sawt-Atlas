// Sawt Atlas Urgence — Consultation et partage du rapport de triage
// Fichier créé le 2026-05-07

import React, { useEffect, useRef, useState } from 'react';
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
import * as Sharing from 'expo-sharing';
import { RootStackParamList, TriageSession } from '../types';
import { useTriageStore } from '../store/triageStore';
import { getSession } from '../storage/database';
import { generateTextReport, saveReportToFile } from '../engine/ReportGenerator';
import networkMonitor from '../utils/network-monitor';
import { COLORS } from '../constants/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Report'>;

// ─── Report section card ──────────────────────────────────────────────────────

const SectionCard: React.FC<{
  icon: string;
  title: string;
  children: React.ReactNode;
}> = ({ icon, title, children }) => (
  <View style={styles.sectionCard}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionIcon}>{icon}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    <View style={styles.sectionBody}>{children}</View>
  </View>
);

const FieldRow: React.FC<{ label: string; value: string; highlight?: boolean }> = ({
  label,
  value,
  highlight,
}) => (
  <View style={styles.fieldRow}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Text style={[styles.fieldValue, highlight && styles.fieldValueHighlight]}>{value}</Text>
  </View>
);

// ─── Sync status indicator ────────────────────────────────────────────────────

const SyncPulse: React.FC = () => {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return (
    <Animated.Text style={[styles.syncDot, { opacity }]}>⏳</Animated.Text>
  );
};

// ─── Helper formatters ────────────────────────────────────────────────────────

const formatAge = (cat: string | null) => {
  if (cat === 'child') return 'دري صغير (أقل من 5 سنين)';
  if (cat === 'elderly') return 'مسن (أكثر من 65 سنة)';
  if (cat === 'adult') return 'بالغ';
  return 'مش معروف';
};

const formatSessionId = (session: TriageSession): string => {
  const d = new Date(session.createdAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  return `SAU-${date}-${session.id.slice(0, 6).toUpperCase()}`;
};

const formatDateTime = (ts: number): string => {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}  ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// ─── Main screen ──────────────────────────────────────────────────────────────

const ReportScreen: React.FC<Props> = ({ navigation, route }) => {
  const { session: storeSession } = useTriageStore();
  const [session, setSession] = useState<TriageSession | null>(storeSession);
  const [reportPath, setReportPath] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const isMounted = useRef(true);

  const networkState = networkMonitor.getCurrentState();
  const hasNetwork = networkState !== 'none';

  useEffect(() => {
    isMounted.current = true;

    // Load session from DB if needed
    const loadSession = async () => {
      if (!storeSession || storeSession.id !== route.params.sessionId) {
        const dbSession = await getSession(route.params.sessionId);
        if (isMounted.current && dbSession) setSession(dbSession);
      }
    };
    loadSession().catch(() => {});

    // Generate and save report file
    const sess = storeSession ?? session;
    if (sess) {
      try {
        const text = generateTextReport(sess);
        saveReportToFile(text, sess.id)
          .then((path) => { if (isMounted.current) setReportPath(path); })
          .catch(() => {});
      } catch {}
    }

    return () => { isMounted.current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleShare = async () => {
    if (!reportPath || sharing) return;
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) return;
      setSharing(true);
      await Sharing.shareAsync(reportPath, {
        mimeType: 'text/plain',
        dialogTitle: 'Partager le rapport Sawt Atlas',
      });
    } catch {
    } finally {
      if (isMounted.current) setSharing(false);
    }
  };

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const p = session.patientProfile;
  const result = session.finalResult;
  const level = result?.level ?? null;
  const accentColor =
    level === 'RED' ? COLORS.red :
    level === 'ORANGE' ? COLORS.orange :
    level === 'GREEN' ? COLORS.green :
    COLORS.primary;

  return (
    <SafeAreaView style={styles.safe}>

      {/* Report header */}
      <View style={[styles.reportHeader, { backgroundColor: COLORS.primary }]}>
        <View>
          <Text style={styles.reportTitle}>🏥  Sawt Atlas Urgence</Text>
          <Text style={styles.reportId}>#{formatSessionId(session)}</Text>
          <Text style={styles.reportDate}>{formatDateTime(session.createdAt)}</Text>
        </View>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Retour"
        >
          <Text style={styles.backBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* 👤 Patient */}
        <SectionCard icon="👤" title="المريض">
          <FieldRow label="الجنس" value={p.sex === 'male' ? 'ذكر' : p.sex === 'female' ? 'أنثى' : 'غير معروف'} />
          <FieldRow label="العمر" value={formatAge(p.ageCategory)} />
          {p.isPregnant && (
            <FieldRow label="الحمل" value={p.pregnancyMonths ? `${p.pregnancyMonths} أشهر` : 'نعم'} />
          )}
          <FieldRow label="المتحدث" value={session.interlocutorMode === 'companion' ? 'مرافق' : 'المريض نفسه'} />
        </SectionCard>

        {/* 💊 Antécédents */}
        <SectionCard icon="💊" title="الأمراض المعروفة">
          <FieldRow label="السكري" value={p.knownConditions.diabetes ? 'نعم' : 'لا'} />
          <FieldRow label="الضغط" value={p.knownConditions.hypertension ? 'نعم' : 'لا'} />
          <FieldRow label="القلب" value={p.knownConditions.cardiac ? 'نعم' : 'لا'} />
          <FieldRow label="مخفف الدم" value={p.knownConditions.bloodThinner ? 'نعم' : 'لا'} />
          <FieldRow label="الحساسية" value={p.allergies ?? 'لا'} />
          <FieldRow label="تكرار" value={p.isRecurrent ? 'نعم — سبق وحدث' : 'لا'} />
        </SectionCard>

        {/* 🧠 AVPU */}
        <SectionCard icon="🧠" title="التقييم العصبي">
          <FieldRow label="AVPU" value={session.avpuLevel ?? 'لم يُقيَّم'} />
        </SectionCard>

        {/* 📋 Symptômes */}
        {session.answers.length > 0 && (
          <SectionCard icon="📋" title="الأعراض">
            {session.answers.map((a, i) => (
              <View key={i} style={styles.answerRow}>
                <Text style={[styles.answerNode, a.isRedDetected && { color: COLORS.red }]}>
                  {a.nodeId}{a.isRedDetected ? '  🔴' : ''}
                </Text>
                <Text style={styles.answerValue}>{a.extractedValue || '—'}</Text>
              </View>
            ))}
          </SectionCard>
        )}

        {/* 🔥 Brûlures */}
        {session.burnZones.length > 0 && (
          <SectionCard icon="🔥" title="الحروق">
            <FieldRow label="النسبة" value={`${session.burnPercentage.toFixed(0)}% من الجسم`} highlight />
            <FieldRow label="المناطق" value={session.burnZones.join(' — ')} />
          </SectionCard>
        )}

        {/* ⚡ Classification */}
        {result && (
          <View style={[styles.sectionCard, { borderColor: accentColor, borderWidth: 2 }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>⚡</Text>
              <Text style={[styles.sectionTitle, { color: accentColor }]}>التصنيف</Text>
            </View>
            <View style={styles.sectionBody}>
              <Text style={[styles.classificationLevel, { color: accentColor }]}>
                {level}
              </Text>
              <Text style={styles.classificationLabel}>{result.label_darija}</Text>
              {result.instructions_darija.map((inst, i) => (
                <Text key={i} style={styles.classificationInstruction}>
                  {i + 1}. {inst}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* 📞 Alertes */}
        <SectionCard icon="📞" title="الإنذارات">
          <FieldRow
            label="حالة الإنذار"
            value={
              session.alertStatus === 'confirmed' ? '✅ مُؤكد' :
              session.alertStatus === 'sent' ? '📤 مُرسَل' :
              session.alertStatus === 'failed' ? '❌ فشل' : '⏳ في الانتظار'
            }
          />
          {session.samuCallTimestamp && (
            <FieldRow label="مكالمة SAMU" value={formatDateTime(session.samuCallTimestamp)} />
          )}
        </SectionCard>

      </ScrollView>

      {/* Bottom: share + sync status */}
      <View style={styles.footer}>
        <View style={styles.syncRow}>
          {hasNetwork ? (
            <Text style={styles.syncText}>✅  راپور محفوظ</Text>
          ) : (
            <View style={styles.syncWaiting}>
              <SyncPulse />
              <Text style={styles.syncText}>في انتظار الشبكة</Text>
            </View>
          )}
          {session.smsTimestamps.length > 0 && (
            <Text style={styles.smsSentText}>📱  ملخص SMS مُرسَل</Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.shareBtn, !reportPath && { opacity: 0.4 }]}
          onPress={handleShare}
          disabled={!reportPath || sharing}
          accessibilityLabel="Partager le rapport"
        >
          <Text style={styles.shareBtnText}>
            {sharing ? '...' : '📤  مشاركة الراپور'}
          </Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: COLORS.textMuted,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.card,
  },
  reportId: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  reportDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 1,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    color: COLORS.card,
    fontSize: 15,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 16,
  },
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: COLORS.bg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionIcon: {
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  sectionBody: {
    padding: 12,
    gap: 6,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  fieldLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
    flex: 1,
  },
  fieldValue: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
    textAlign: 'right',
    flex: 2,
    writingDirection: 'rtl',
  },
  fieldValueHighlight: {
    fontWeight: '800',
    fontSize: 15,
  },
  answerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  answerNode: {
    fontSize: 12,
    color: COLORS.textMuted,
    flex: 2,
  },
  answerValue: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  classificationLevel: {
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
  },
  classificationLabel: {
    fontSize: 15,
    color: COLORS.text,
    textAlign: 'center',
    fontWeight: '600',
    writingDirection: 'rtl',
    marginBottom: 8,
  },
  classificationInstruction: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 22,
    writingDirection: 'rtl',
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 10,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  syncWaiting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  syncDot: {
    fontSize: 14,
  },
  syncText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  smsSentText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
  },
  shareBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  shareBtnText: {
    color: COLORS.card,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ReportScreen;

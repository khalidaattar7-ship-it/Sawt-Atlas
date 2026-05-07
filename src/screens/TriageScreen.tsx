// Sawt Atlas Urgence — Écran de triage principal : flux vocal AVPU+ABC+9 domaines
// Fichier créé le 2026-05-07

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  InterlocutorMode,
  PatientProfile,
  RootStackParamList,
  TriageResult,
  UrgencyLevel,
} from '../types';
import { useTriageStore } from '../store/triageStore';
import triageEngine from '../engine/TriageEngine';
import {
  speakWithCallback,
  speakFeedback,
  stop as stopTTS,
} from '../engine/TTSModule';
import {
  destroy as destroySTT,
  onError as onSTTError,
  onResult as onSTTResult,
  startListening,
  stopListening,
} from '../engine/STTModule';
import { SilenceDetector } from '../utils/silence-detector';
import networkMonitor from '../utils/network-monitor';
import { triggerRedAlert } from '../communication/AlertManager';
import { COLORS } from '../constants/colors';
import {
  SILENCE_ESCALATION_MS,
  SILENCE_WARNING_1_MS,
  SILENCE_WARNING_2_MS,
} from '../constants/config';
import StatusIndicator, { IndicatorPhase } from '../components/StatusIndicator';
import SpeechWave from '../components/SpeechWave';
import MicButton from '../components/MicButton';

type Props = NativeStackScreenProps<RootStackParamList, 'Triage'>;

// ─── Profiling question order ─────────────────────────────────────────────────

const PROFILING_QUESTIONS = [
  'interlocutor',
  'sex',
  'age',
  'pregnant',      // skipped when sex !== 'female'
  'diabetes',
  'hypertension',
  'cardiac',
  'blood_thinner',
  'allergies',
  'recurrent',
] as const;

type ProfilingId = typeof PROFILING_QUESTIONS[number];
type DotStatus = 'pending' | 'green' | 'orange' | 'red';
type FlowPhase = 'greeting' | 'profiling' | 'triage' | 'done';

// ─── Component ────────────────────────────────────────────────────────────────

const TriageScreen: React.FC<Props> = ({ navigation, route }) => {
  const {
    session,
    setPhase,
    setSpeaking,
    setListening,
    setProcessing,
    setAnswer,
    setResult,
    setRedDetected,
    nextNode,
    setSilenceState,
    updateSession,
  } = useTriageStore();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [indicatorPhase, setIndicatorPhase] = useState<IndicatorPhase>('waiting');
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [transcript, setTranscript] = useState('');
  const [currentIcon, setCurrentIcon] = useState('🏥');
  const [progressDots, setProgressDots] = useState<DotStatus[]>([]);

  // ── Flow refs (mutations never cause re-render) ───────────────────────────
  const isMounted = useRef(true);
  const flowPhase = useRef<FlowPhase>('greeting');
  const interlocutorMode = useRef<InterlocutorMode>('patient');
  const localProfile = useRef<PatientProfile>({
    id: session?.id ?? '',
    sex: null,
    ageCategory: null,
    isPregnant: false,
    pregnancyMonths: null,
    knownConditions: {
      diabetes: false,
      hypertension: false,
      cardiac: false,
      bloodThinner: false,
      other: null,
    },
    allergies: null,
    isRecurrent: false,
    medicationPhoto: null,
  });
  const profilingIndexRef = useRef(0);
  const nodeQueue = useRef<string[]>([]);
  const queueIndex = useRef(0);
  const currentNodeId = useRef('');
  const waitingForBurnReturn = useRef(false);
  const redDetectedRef = useRef(false);
  const sessionRef = useRef(session);
  const currentQuestionRef = useRef('');

  useEffect(() => { sessionRef.current = session; }, [session]);

  // SilenceDetector — created once, stable reference
  const sd = useRef(
    new SilenceDetector({
      warning1Ms: SILENCE_WARNING_1_MS,
      warning2Ms: SILENCE_WARNING_2_MS,
      escalationMs: SILENCE_ESCALATION_MS,
    })
  ).current;

  // ── Progress dot helpers ──────────────────────────────────────────────────

  const markDot = useCallback((index: number, status: DotStatus) => {
    setProgressDots((prev) => {
      if (index >= prev.length) return prev;
      const next = [...prev];
      next[index] = status;
      return next;
    });
  }, []);

  // ── Phase transition helpers ──────────────────────────────────────────────

  const startListeningPhase = useCallback(() => {
    if (!isMounted.current) return;
    setIndicatorPhase('listening');
    setSpeaking(false);
    setListening(true);
    sd.start();
    startListening('ar-MA');
  }, [setSpeaking, setListening, sd]);

  const stopListeningPhase = useCallback(() => {
    sd.stop();
    stopListening();
    setListening(false);
    setProcessing(true);
    setIndicatorPhase('processing');
  }, [setListening, setProcessing, sd]);

  // Speak text, then automatically activate STT when TTS completes
  const speakThenListen = useCallback((text: string) => {
    if (!isMounted.current) return;
    setIndicatorPhase('speaking');
    setSpeaking(true);
    setTranscript('');
    currentQuestionRef.current = text;
    setCurrentQuestion(text);
    speakWithCallback(text, () => {
      if (!isMounted.current) return;
      // 500ms buffer: lets TTS audio fully drain before mic opens
      setTimeout(() => {
        if (!isMounted.current) return;
        startListeningPhase();
      }, 500);
    });
  }, [setSpeaking, startListeningPhase]);

  // Speak text without starting STT afterward
  const speakOnly = useCallback((text: string, onDone?: () => void) => {
    if (!isMounted.current) return;
    setIndicatorPhase('speaking');
    setSpeaking(true);
    speakWithCallback(text, () => {
      if (!isMounted.current) return;
      setSpeaking(false);
      setIndicatorPhase('waiting');
      onDone?.();
    });
  }, [setSpeaking]);

  // ── Silence escalation handlers ───────────────────────────────────────────

  const handleSilenceWarning1 = useCallback(() => {
    if (!isMounted.current) return;
    setSilenceState('warning_15s');
    stopTTS();
    speakWithCallback('واش سمعتيني؟', () => {
      if (isMounted.current) setIndicatorPhase('listening');
    });
  }, [setSilenceState]);

  const handleSilenceWarning2 = useCallback(() => {
    if (!isMounted.current) return;
    setSilenceState('warning_30s');
    stopTTS();
    speakWithCallback('عيط لي واحد يساعدك!', () => {
      if (isMounted.current) setIndicatorPhase('listening');
    });
  }, [setSilenceState]);

  const handleSilenceEscalation = useCallback(() => {
    if (!isMounted.current) return;
    setSilenceState('escalated_40s');
    setRedDetected(true);
    stopTTS();
    stopListening();
    navigation.replace('Companion');
  }, [setSilenceState, setRedDetected, navigation]);

  // ── Forward refs for mutually recursive flow functions ────────────────────
  // Re-assigned after every render (no deps useEffect) so they never go stale.
  const advanceQueueRef = useRef<() => void>(() => {});
  const handleNodeAnswerRef = useRef<(nodeId: string, raw: string) => void>(() => {});
  const handleRedResultRef = useRef<(result: TriageResult) => void>(() => {});

  useEffect(() => {
    handleRedResultRef.current = (result: TriageResult) => {
      if (!isMounted.current) return;
      redDetectedRef.current = true;
      setRedDetected(true);
      speakOnly(result.speak_result_darija, () => {
        if (!isMounted.current) return;
        const sess = sessionRef.current;
        if (sess) {
          triggerRedAlert({ ...sess, finalResult: result, classification: 'RED' }).catch(() => {});
        }
        queueIndex.current++;
        advanceQueueRef.current();
      });
    };
  });

  useEffect(() => {
    handleNodeAnswerRef.current = (nodeId: string, raw: string) => {
      if (!isMounted.current) return;
      setProcessing(true);
      setIndicatorPhase('processing');

      const processed = triageEngine.processAnswer(nodeId, raw);
      const dotIdx = queueIndex.current;

      setAnswer({
        nodeId,
        questionDarija: currentQuestionRef.current,
        responseRaw: raw,
        extractedValue: processed.extractedValue,
        confidence: processed.confidence,
        timestamp: Date.now(),
        isRedDetected: processed.result?.level === 'RED',
      });

      setProcessing(false);

      // Burn body map special case — pause triage, navigate to BodyMap
      if (processed.flag === 'TRIGGER_BODY_MAP') {
        waitingForBurnReturn.current = true;
        setIndicatorPhase('waiting');
        navigation.navigate('BodyMap');
        return;
      }

      // Terminal result reached
      if (processed.result) {
        if (processed.result.level === 'RED') {
          markDot(dotIdx, 'red');
          handleRedResultRef.current(processed.result);
        } else {
          markDot(dotIdx, processed.result.level === 'ORANGE' ? 'orange' : 'green');
          setResult(processed.result);
          speakOnly(triageEngine.getClosingPhrase(processed.result.level), () => {
            const sid = sessionRef.current?.id;
            if (isMounted.current && sid) navigation.replace('Result', { sessionId: sid });
          });
        }
        return;
      }

      // Specific branch next node
      if (processed.nextNodeId) {
        markDot(dotIdx, 'green');
        const branch = triageEngine.getCurrentNode(processed.nextNodeId);
        if (branch) {
          currentNodeId.current = processed.nextNodeId;
          nextNode(processed.nextNodeId);
          setCurrentIcon(branch.icon ?? '❓');
          speakThenListen(triageEngine.getQuestionText(branch, interlocutorMode.current));
        } else {
          queueIndex.current++;
          advanceQueueRef.current();
        }
        return;
      }

      // Continue sequential queue
      markDot(dotIdx, 'green');
      queueIndex.current++;
      advanceQueueRef.current();
    };
  });

  useEffect(() => {
    advanceQueueRef.current = () => {
      if (!isMounted.current) return;

      if (queueIndex.current >= nodeQueue.current.length) {
        if (redDetectedRef.current) {
          // RED was detected — hand off to Companion mode
          navigation.replace('Companion');
        } else {
          // No definitive result → ORANGE by precaution
          const orangeResult: TriageResult = {
            level: 'ORANGE',
            label_fr: 'Triage complet — Consultation recommandée',
            label_darija: 'كمل التريان — راجعو الطبيب',
            confidence: 0.7,
            instructions_fr: ['Consultez un médecin', 'Appelez le 15 si aggravation'],
            instructions_darija: ['روحو للطبيب', 'عيطو للـ 15 إلا خاف عليكم'],
            speak_result_darija: triageEngine.getClosingPhrase('ORANGE'),
            alert_samu: false,
            sms_template: null,
          };
          setResult(orangeResult);
          speakOnly(orangeResult.speak_result_darija, () => {
            const sid = sessionRef.current?.id;
            if (isMounted.current && sid) navigation.replace('Result', { sessionId: sid });
          });
        }
        return;
      }

      const nodeId = nodeQueue.current[queueIndex.current];
      const node = triageEngine.getCurrentNode(nodeId);

      if (!node) {
        // Optional node missing in tree — skip silently
        queueIndex.current++;
        advanceQueueRef.current();
        return;
      }

      currentNodeId.current = nodeId;
      nextNode(nodeId);
      setCurrentIcon(node.icon ?? '❓');
      speakThenListen(triageEngine.getQuestionText(node, interlocutorMode.current));
    };
  });

  // ── Profiling helpers ─────────────────────────────────────────────────────

  const applyProfilingAnswer = useCallback((questionId: ProfilingId, raw: string) => {
    const p = localProfile.current;
    const isYes = (s: string) => /يه|واه|آه|oui|نعم|ih/i.test(s);

    switch (questionId) {
      case 'interlocutor': {
        const companion = /آخر|راجلي|مرتي|ولدي|بنتي|امي|بابا|جاري|صاحبي|هو|هي|autre|mari|femme|fils|fille/i.test(raw);
        interlocutorMode.current = companion ? 'companion' : 'patient';
        break;
      }
      case 'sex': {
        const female = /مرا|بنت|هي|انثى|مراة|femme|fille|tamghart/i.test(raw);
        localProfile.current = { ...p, sex: female ? 'female' : 'male' };
        break;
      }
      case 'age': {
        const child = /دري|طفل|صغير|رضيع|بيبي|شهور|enfant|bébé|arraw/i.test(raw);
        const elderly = /كبير|شايب|عجوز|ستين|سبعين|ثمانين|âgé|vieux/i.test(raw);
        localProfile.current = { ...p, ageCategory: child ? 'child' : elderly ? 'elderly' : 'adult' };
        break;
      }
      case 'pregnant':
        localProfile.current = { ...p, isPregnant: isYes(raw) };
        break;
      case 'diabetes':
        localProfile.current = {
          ...p,
          knownConditions: { ...p.knownConditions, diabetes: isYes(raw) },
        };
        break;
      case 'hypertension':
        localProfile.current = {
          ...p,
          knownConditions: { ...p.knownConditions, hypertension: isYes(raw) },
        };
        break;
      case 'cardiac':
        localProfile.current = {
          ...p,
          knownConditions: { ...p.knownConditions, cardiac: isYes(raw) },
        };
        break;
      case 'blood_thinner':
        localProfile.current = {
          ...p,
          knownConditions: { ...p.knownConditions, bloodThinner: isYes(raw) },
        };
        break;
      case 'allergies':
        localProfile.current = { ...p, allergies: isYes(raw) ? raw : null };
        break;
      case 'recurrent':
        localProfile.current = { ...p, isRecurrent: isYes(raw) };
        break;
    }
  }, []);

  const askNextProfilingQuestion = useCallback(() => {
    if (!isMounted.current) return;

    // Skip 'pregnant' for non-female patients
    while (profilingIndexRef.current < PROFILING_QUESTIONS.length) {
      const qId = PROFILING_QUESTIONS[profilingIndexRef.current];
      if (qId === 'pregnant' && localProfile.current.sex !== 'female') {
        profilingIndexRef.current++;
        continue;
      }
      break;
    }

    if (profilingIndexRef.current >= PROFILING_QUESTIONS.length) {
      // Profiling complete → persist profile + interlocutor mode → start triage
      updateSession({
        patientProfile: localProfile.current,
        interlocutorMode: interlocutorMode.current,
      });
      const queue = triageEngine.getRoutingForProfile(localProfile.current);
      nodeQueue.current = queue;
      queueIndex.current = 0;
      setProgressDots(queue.map(() => 'pending' as DotStatus));
      flowPhase.current = 'triage';
      setPhase('avpu');
      advanceQueueRef.current();
      return;
    }

    const questionId = PROFILING_QUESTIONS[profilingIndexRef.current];
    const text = triageEngine.getProfilingQuestion(questionId, interlocutorMode.current);
    setCurrentIcon('📋');
    speakThenListen(text);
  }, [updateSession, setPhase, speakThenListen]);

  // ── STT result callback (via ref so mount effect stays fresh) ─────────────

  const handleSTTResultRef = useRef<(raw: string) => void>(() => {});
  useEffect(() => {
    handleSTTResultRef.current = (raw: string) => {
      if (!isMounted.current || !raw.trim()) return;
      sd.reset();
      setTranscript(raw);
      stopListeningPhase();
      speakFeedback().catch(() => {});

      if (flowPhase.current === 'profiling') {
        const qId = PROFILING_QUESTIONS[profilingIndexRef.current];
        applyProfilingAnswer(qId, raw);
        profilingIndexRef.current++;
        askNextProfilingQuestion();
      } else if (flowPhase.current === 'triage') {
        handleNodeAnswerRef.current(currentNodeId.current, raw);
      }
    };
  });

  // ── Burn result returned from BodyMapScreen ───────────────────────────────

  useEffect(() => {
    const burnResult = route.params?.burnResult;
    if (!burnResult || !waitingForBurnReturn.current) return;
    waitingForBurnReturn.current = false;

    const { zones, percentage } = burnResult;
    const level: UrgencyLevel =
      percentage >= 18 ? 'RED' : percentage >= 9 ? 'ORANGE' : 'GREEN';

    setAnswer({
      nodeId: 'motive_burn',
      questionDarija: 'zones brûlées',
      responseRaw: zones.join(','),
      extractedValue: `${percentage.toFixed(0)}%`,
      confidence: 1.0,
      timestamp: Date.now(),
      isRedDetected: level === 'RED',
    });

    const result: TriageResult = {
      level,
      label_fr: `Brûlure ${percentage.toFixed(0)}% SCT`,
      label_darija: `حرقة ${percentage.toFixed(0)}% من الجسم`,
      confidence: 1.0,
      instructions_fr:
        level === 'RED'
          ? [
              'Refroidir avec eau tiède (15 min)',
              'Appeler le 15 immédiatement',
              'Ne pas décoller les vêtements',
            ]
          : ['Refroidir la brûlure à l\'eau', 'Couvrir avec un linge propre', 'Consulter un médecin'],
      instructions_darija:
        level === 'RED'
          ? ['برّدو بالماء الفاتر 15 دقيقة', 'عيطو للـ 15 دابا', 'ما تنعلو الهدوم']
          : ['برّدو الحرقة بالماء', 'غطيوها بحاجة نقية', 'روحو للطبيب'],
      speak_result_darija:
        level === 'RED'
          ? 'الحرقة خطيرة جدا. برّدو بالماء الفاتر وعيطو للـ 15 دابا دابا!'
          : 'عندكم حرقة محتاجة عناية. برّدو وروحو للطبيب.',
      alert_samu: level === 'RED',
      sms_template: null,
    };

    const dotIdx = queueIndex.current;
    if (level === 'RED') {
      markDot(dotIdx, 'red');
      handleRedResultRef.current(result);
    } else {
      markDot(dotIdx, level === 'ORANGE' ? 'orange' : 'green');
      setResult(result);
      speakOnly(result.speak_result_darija, () => {
        const sid = sessionRef.current?.id;
        if (isMounted.current && sid) navigation.replace('Result', { sessionId: sid });
      });
    }
  }, [route.params?.burnResult]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mount / Unmount ───────────────────────────────────────────────────────

  useEffect(() => {
    isMounted.current = true;

    // STT callbacks via indirection so the registered closure is always fresh
    onSTTResult((raw) => handleSTTResultRef.current(raw));
    onSTTError(() => {
      if (!isMounted.current) return;
      startListening('ar-MA');
    });

    sd.onWarning1(handleSilenceWarning1);
    sd.onWarning2(handleSilenceWarning2);
    sd.onEscalation(handleSilenceEscalation);

    networkMonitor.startMonitoring();

    // Kick off with greeting, then immediately enter profiling
    flowPhase.current = 'greeting';
    setCurrentIcon('🏥');
    speakWithCallback(triageEngine.getGreeting(), () => {
      if (!isMounted.current) return;
      flowPhase.current = 'profiling';
      profilingIndexRef.current = 0;
      setPhase('interlocutor');
      askNextProfilingQuestion();
    });

    return () => {
      isMounted.current = false;
      stopTTS();
      stopListening();
      sd.stop();
      destroySTT();
      networkMonitor.stopMonitoring();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fallback answer buttons (MVP — remplacer par STT natif en production) ──

  // FALLBACK MVP — remplacer par STT natif en production
  const handleFallbackAnswer = useCallback((answer: string) => {
    if (indicatorPhase !== 'listening') return;
    handleSTTResultRef.current(answer);
  }, [indicatorPhase]);

  // ── Manual mic tap ────────────────────────────────────────────────────────

  const handleMicPress = useCallback(() => {
    if (indicatorPhase !== 'listening') return;
    // Treat as empty answer — advances without escalating
    stopListeningPhase();
    if (flowPhase.current === 'profiling') {
      const qId = PROFILING_QUESTIONS[profilingIndexRef.current];
      applyProfilingAnswer(qId, '');
      profilingIndexRef.current++;
      askNextProfilingQuestion();
    } else if (flowPhase.current === 'triage') {
      handleNodeAnswerRef.current(currentNodeId.current, '');
    }
  }, [indicatorPhase, stopListeningPhase, applyProfilingAnswer, askNextProfilingQuestion]);

  // ── Derived UI ────────────────────────────────────────────────────────────

  const micState: 'disabled' | 'idle' | 'listening' =
    indicatorPhase === 'listening' ? 'listening' :
    indicatorPhase === 'waiting'   ? 'idle'      : 'disabled';

  const hintText =
    indicatorPhase === 'listening'  ? 'جاوب بالصوت...' :
    indicatorPhase === 'speaking'   ? 'كنهضر...'       :
    indicatorPhase === 'processing' ? 'كنفهم...'        : '';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* Header: status indicator + exit */}
        <View style={styles.header}>
          <StatusIndicator phase={indicatorPhase} />
          <TouchableOpacity
            style={styles.exitBtn}
            onPress={() => navigation.replace('Home')}
            accessibilityLabel="Quitter le triage"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.exitText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Progress dots — visible during triage phase */}
        {progressDots.length > 0 && (
          <View style={styles.progressRow}>
            {progressDots.map((status, i) => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  {
                    backgroundColor:
                      status === 'red'    ? COLORS.red    :
                      status === 'orange' ? COLORS.orange :
                      status === 'green'  ? COLORS.green  :
                      i === queueIndex.current ? COLORS.primary : COLORS.border,
                    opacity: i === queueIndex.current ? 1 : 0.55,
                    transform: [{ scale: i === queueIndex.current ? 1.3 : 1 }],
                  },
                ]}
              />
            ))}
          </View>
        )}

        {/* Main content area */}
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Domain icon */}
          <Text style={styles.icon} accessibilityElementsHidden>
            {currentIcon}
          </Text>

          {/* Current question (Darija, RTL) */}
          {currentQuestion ? (
            <Text style={styles.question}>{currentQuestion}</Text>
          ) : null}

          {/* Animated waveform */}
          <View style={styles.waveContainer}>
            <SpeechWave
              type={indicatorPhase === 'speaking' ? 'speaking' : 'listening'}
              active={indicatorPhase === 'speaking' || indicatorPhase === 'listening'}
              color={indicatorPhase === 'speaking' ? COLORS.primary : COLORS.red}
              barCount={20}
              maxHeight={48}
            />
          </View>

          {/* STT partial transcript */}
          {transcript ? (
            <Text style={styles.transcript}>{transcript}</Text>
          ) : null}
        </ScrollView>

        {/* Mic area */}
        <View style={styles.micArea}>
          {hintText ? <Text style={styles.hint}>{hintText}</Text> : null}
          <MicButton state={micState} onPress={handleMicPress} size={100} />

          {/* FALLBACK MVP — remplacer par STT natif en production */}
          {indicatorPhase === 'listening' && (
            <View style={styles.fallbackRow}>
              {([
                { label: 'إيه', value: 'واه' },
                { label: 'لا', value: 'لا' },
                { label: 'شوية', value: 'شوية' },
              ] as const).map(({ label, value }) => (
                <TouchableOpacity
                  key={label}
                  style={styles.fallbackBtn}
                  onPress={() => handleFallbackAnswer(value)}
                  accessibilityLabel={label}
                >
                  <Text style={styles.fallbackBtnText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

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
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  exitBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  exitText: {
    fontSize: 16,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 20,
  },
  icon: {
    fontSize: 72,
    textAlign: 'center',
  },
  question: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 36,
    paddingHorizontal: 8,
    writingDirection: 'rtl',
  },
  waveContainer: {
    width: '100%',
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transcript: {
    fontSize: 15,
    color: COLORS.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: 16,
    writingDirection: 'rtl',
  },
  micArea: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
  },
  hint: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  fallbackRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  fallbackBtn: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.primary,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackBtnText: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
    writingDirection: 'rtl',
  },
});

export default TriageScreen;

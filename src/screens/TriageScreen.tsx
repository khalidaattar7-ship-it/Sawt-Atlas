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
  PatientProfile,
  RootStackParamList,
  RuntimeProfile,
  TriageButton,
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

const TOTAL_PHASES = 9;
const FIRST_NODE = 'phase1_interlocutor';
const BUTTONS_DELAY_MS = 5000; // Show fallback buttons after 5s of silence

// Button color maps — subtle tinted style
const COLOR_MAP: Record<string, string> = {
  green: COLORS.green,
  orange: COLORS.orange,
  red: COLORS.red,
  primary: COLORS.primary,
};
const COLOR_BG_MAP: Record<string, string> = {
  green: 'rgba(21,128,61,0.12)',
  orange: 'rgba(194,65,12,0.12)',
  red: 'rgba(185,28,28,0.14)',
  primary: 'rgba(20,83,45,0.12)',
};

const DEFAULT_RUNTIME_PROFILE: RuntimeProfile = {
  interlocutorMode: 'patient',
  sex: null,
  ageCategory: null,
  isPregnant: false,
  pregnancyMonths: null,
  diabetes: false,
  hypertension: false,
  cardiac: false,
  bloodThinner: false,
  allergies: false,
  isRecurrent: false,
  avpuLevel: null,
  _maternity_done: false,
  _red_skip: false,
};

function buildPatientProfile(rp: RuntimeProfile, sessionId: string): PatientProfile {
  const monthsMap = { trimester1: 2, trimester2: 5, trimester3: 8 };
  return {
    id: sessionId,
    sex: rp.sex,
    ageCategory: rp.ageCategory,
    isPregnant: rp.isPregnant,
    pregnancyMonths: rp.pregnancyMonths ? (monthsMap[rp.pregnancyMonths] ?? null) : null,
    knownConditions: {
      diabetes: rp.diabetes,
      hypertension: rp.hypertension,
      cardiac: rp.cardiac,
      bloodThinner: rp.bloodThinner,
      other: null,
    },
    allergies: rp.allergies ? 'oui' : null,
    isRecurrent: rp.isRecurrent,
    medicationPhoto: null,
  };
}

const TriageScreen: React.FC<Props> = ({ navigation, route }) => {
  const {
    session,
    setSpeaking,
    setListening,
    setProcessing,
    setAnswer,
    setResult,
    setRedDetected,
    setSilenceState,
    updateSession,
    nextNode,
  } = useTriageStore();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [indicatorPhase, setIndicatorPhase] = useState<IndicatorPhase>('waiting');
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentIcon, setCurrentIcon] = useState('🏥');
  const [currentButtons, setCurrentButtons] = useState<TriageButton[]>([]);
  const [showButtons, setShowButtons] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [triagePhaseNum, setTriagePhaseNum] = useState(1);
  const [redBar, setRedBar] = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const isMounted          = useRef(true);
  const currentNodeIdRef   = useRef(FIRST_NODE);
  const currentButtonsRef  = useRef<TriageButton[]>([]);
  const runtimeProfileRef  = useRef<RuntimeProfile>({ ...DEFAULT_RUNTIME_PROFILE });
  const redDetectedRef     = useRef(false);
  const isListeningRef     = useRef(false);
  const buttonsTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waitingForBurnReturn = useRef(false);
  const sessionRef         = useRef(session);

  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { currentButtonsRef.current = currentButtons; }, [currentButtons]);

  // Silence detector — stable reference
  const sd = useRef(
    new SilenceDetector({
      warning1Ms: SILENCE_WARNING_1_MS,
      warning2Ms: SILENCE_WARNING_2_MS,
      escalationMs: SILENCE_ESCALATION_MS,
    })
  ).current;

  // ── Timer helpers ─────────────────────────────────────────────────────────
  const clearButtonsTimer = useCallback(() => {
    if (buttonsTimerRef.current) {
      clearTimeout(buttonsTimerRef.current);
      buttonsTimerRef.current = null;
    }
  }, []);

  // ── Speak-only helper (no mic) ────────────────────────────────────────────
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

  // ── Open mic: voice first, buttons appear after BUTTONS_DELAY_MS ─────────
  const openMic = useCallback(() => {
    if (!isMounted.current) return;
    isListeningRef.current = true;
    setShowButtons(false); // Voice is the primary mode — no buttons yet
    setIndicatorPhase('listening');
    setSpeaking(false);
    setListening(true);
    sd.start();
    startListening('ar-MA');

    // Fallback: reveal buttons after 5s if user hasn't spoken
    buttonsTimerRef.current = setTimeout(() => {
      if (isMounted.current && isListeningRef.current) {
        setShowButtons(true);
      }
    }, BUTTONS_DELAY_MS);
  }, [setSpeaking, setListening, sd]);

  // ── Close mic ─────────────────────────────────────────────────────────────
  const closeMic = useCallback(() => {
    isListeningRef.current = false;
    clearButtonsTimer();
    sd.stop();
    stopListening();
    setListening(false);
    setShowButtons(false);
    setProcessing(true);
    setIndicatorPhase('processing');
  }, [setListening, setProcessing, sd, clearButtonsTimer]);

  // ── Forward refs for mutually recursive functions ─────────────────────────
  const speakAndShowButtonsRef = useRef<(nodeId: string) => void>(() => {});
  const handleButtonRef        = useRef<(button: TriageButton) => void>(() => {});
  const continueToNextRef      = useRef<(nextId: string) => void>(() => {});
  const finishTriageRef        = useRef<() => void>(() => {});

  // ── finishTriage ──────────────────────────────────────────────────────────
  useEffect(() => {
    finishTriageRef.current = () => {
      if (!isMounted.current) return;
      const level: UrgencyLevel = redDetectedRef.current ? 'RED' : 'ORANGE';
      const closingText = triageEngine.getClosingPhrase(level);
      const disclaimer  = triageEngine.getDisclaimer();
      const sess = sessionRef.current;

      const result: TriageResult = {
        level,
        label_fr: level === 'RED' ? 'Urgence critique' : 'Consultation recommandée',
        label_darija: level === 'RED' ? 'حالة خطيرة' : 'استشر طبيبا',
        confidence: 1.0,
        instructions_fr: [],
        instructions_darija: [disclaimer],
        speak_result_darija: closingText,
        alert_samu: level === 'RED',
        sms_template: null,
      };

      if (sess) {
        updateSession({
          patientProfile: buildPatientProfile(runtimeProfileRef.current, sess.id),
          interlocutorMode: runtimeProfileRef.current.interlocutorMode,
        });
      }
      setResult(result);

      speakOnly(closingText, () => {
        if (!isMounted.current) return;
        const sid = sessionRef.current?.id;
        if (sid) navigation.replace('Result', { sessionId: sid });
      });
    };
  });

  // ── continueToNext ────────────────────────────────────────────────────────
  useEffect(() => {
    continueToNextRef.current = (nextId: string) => {
      if (!isMounted.current) return;

      if (nextId === '__BODY_MAP__') {
        waitingForBurnReturn.current = true;
        setIndicatorPhase('waiting');
        navigation.navigate('BodyMap');
        return;
      }

      if (nextId === '__FINISH__') {
        finishTriageRef.current();
        return;
      }

      // Entering maternity branch — mark done so subsequent __END__ → __FINISH__
      if (nextId === 'phase8g_contractions') {
        runtimeProfileRef.current = { ...runtimeProfileRef.current, _maternity_done: true };
      }

      currentNodeIdRef.current = nextId;
      speakAndShowButtonsRef.current(nextId);
    };
  });

  // ── handleButton ──────────────────────────────────────────────────────────
  useEffect(() => {
    handleButtonRef.current = (button: TriageButton) => {
      if (!isMounted.current) return;
      setProcessing(false);
      setIndicatorPhase('waiting');

      const nodeId = currentNodeIdRef.current;
      const node = triageEngine.getNode(nodeId);

      // Update local profile from this answer
      if (node) {
        runtimeProfileRef.current = triageEngine.updateProfile(
          runtimeProfileRef.current,
          node,
          button.value,
        );
      }

      // Record answer in store
      setAnswer({
        nodeId,
        questionDarija: node
          ? triageEngine.getQuestionText(node, runtimeProfileRef.current.interlocutorMode)
          : '',
        responseRaw: button.label,
        extractedValue: button.value,
        confidence: 1.0,
        timestamp: Date.now(),
        isRedDetected: button.triggerRed ?? false,
      });

      // RED flag must be set BEFORE routing so __ABC_DONE__ resolves to __FINISH__
      // when RED is detected in phases 5-6 (not just AVPU=U)
      if (button.triggerRed) {
        redDetectedRef.current = true;
        setRedDetected(true);
        setRedBar(true);
        runtimeProfileRef.current = { ...runtimeProfileRef.current, _red_skip: true };
      }

      const nextId = triageEngine.getNextNodeId(
        nodeId,
        button.value,
        runtimeProfileRef.current,
      );

      // If button has instructions (safety info or RED), speak them first
      if (button.instructions_darija) {
        const sess = sessionRef.current;
        speakOnly(button.instructions_darija, () => {
          if (button.triggerRed && sess) {
            triggerRedAlert({ ...sess, classification: 'RED' }).catch(() => {});
          }
          continueToNextRef.current(nextId);
        });
        return;
      }

      continueToNextRef.current(nextId);
    };
  });

  // ── speakAndShowButtons ───────────────────────────────────────────────────
  useEffect(() => {
    speakAndShowButtonsRef.current = (nodeId: string) => {
      if (!isMounted.current) return;

      const node = triageEngine.getNode(nodeId);
      if (!node) {
        finishTriageRef.current();
        return;
      }

      currentNodeIdRef.current = nodeId;
      nextNode(nodeId);
      setTriagePhaseNum(node.phase);
      setCurrentIcon(node.icon ?? '❓');
      setShowButtons(false);
      setTranscript('');

      const questionText = triageEngine.getQuestionText(
        node,
        runtimeProfileRef.current.interlocutorMode,
      );
      setCurrentQuestion(questionText);
      currentButtonsRef.current = node.buttons;
      setCurrentButtons(node.buttons);

      setIndicatorPhase('speaking');
      setSpeaking(true);
      speakWithCallback(questionText, () => {
        if (!isMounted.current) return;
        // Voice first — mic opens, buttons hidden until BUTTONS_DELAY_MS
        openMic();
      });
    };
  });

  // ── STT result: voice-first, show buttons on no-match ────────────────────
  const handleSTTResultRef = useRef<(raw: string) => void>(() => {});
  useEffect(() => {
    handleSTTResultRef.current = (raw: string) => {
      if (!isMounted.current || !raw.trim()) return;

      // Clear the 5s fallback timer — user has spoken
      isListeningRef.current = false;
      clearButtonsTimer();
      sd.reset();
      setTranscript(raw);

      const matched = triageEngine.matchSTTToButton(raw, currentButtonsRef.current);
      if (matched) {
        speakFeedback().catch(() => {});
        closeMic();
        handleButtonRef.current(matched);
      } else {
        // No keyword match — show buttons and prompt the user
        stopListening();
        setShowButtons(true);
        speakWithCallback('ما فهمتش مزيان، اختار من هاد الجوابات', () => {
          if (!isMounted.current) return;
          setIndicatorPhase('listening');
          startListening('ar-MA'); // Re-open STT alongside the visible buttons
        });
      }
    };
  });

  // ── Silence escalation ────────────────────────────────────────────────────
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

  // ── Button press — allowed whenever buttons are visible ───────────────────
  const handleButtonPress = useCallback((button: TriageButton) => {
    if (!showButtons) return;
    stopTTS();          // Stop any "ما فهمتش" feedback that may be playing
    sd.reset();
    isListeningRef.current = false;
    clearButtonsTimer();
    closeMic();
    handleButtonRef.current(button);
  }, [showButtons, sd, clearButtonsTimer, closeMic]);

  // ── Mic manual tap — restart STT ─────────────────────────────────────────
  const handleMicPress = useCallback(() => {
    if (indicatorPhase !== 'listening') return;
    stopListening();
    setTimeout(() => {
      if (isMounted.current) startListening('ar-MA');
    }, 300);
  }, [indicatorPhase]);

  // ── Burn result returned from BodyMapScreen ───────────────────────────────
  useEffect(() => {
    const burnResult = route.params?.burnResult;
    if (!burnResult || !waitingForBurnReturn.current) return;
    waitingForBurnReturn.current = false;

    const { zones, percentage } = burnResult;
    const level: UrgencyLevel =
      percentage >= 18 ? 'RED' : percentage >= 9 ? 'ORANGE' : 'GREEN';

    setAnswer({
      nodeId: 'phase8b_burn_body_map',
      questionDarija: 'zones brûlées',
      responseRaw: zones.join(','),
      extractedValue: `${percentage.toFixed(0)}%`,
      confidence: 1.0,
      timestamp: Date.now(),
      isRedDetected: level === 'RED',
    });

    const sess = sessionRef.current;

    if (level === 'RED') {
      redDetectedRef.current = true;
      setRedDetected(true);
      setRedBar(true);
      runtimeProfileRef.current = { ...runtimeProfileRef.current, _red_skip: true };
      const instructions = 'برّدو بالماء الفاتر 15 دقيقة، ما تنعلو الهدوم، عيطو للـ 15 دابا!';
      speakOnly(instructions, () => {
        if (sess) triggerRedAlert({ ...sess, classification: 'RED' }).catch(() => {});
        const nextId = triageEngine.resolveSentinel('__END__', runtimeProfileRef.current);
        continueToNextRef.current(nextId);
      });
    } else {
      const nextId = triageEngine.resolveSentinel('__END__', runtimeProfileRef.current);
      continueToNextRef.current(nextId);
    }
  }, [route.params?.burnResult]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mount / Unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;

    onSTTResult((raw) => handleSTTResultRef.current(raw));
    onSTTError(() => {
      if (!isMounted.current) return;
      startListening('ar-MA');
    });

    sd.onWarning1(handleSilenceWarning1);
    sd.onWarning2(handleSilenceWarning2);
    sd.onEscalation(handleSilenceEscalation);

    networkMonitor.startMonitoring();

    // Greeting → first node
    setIndicatorPhase('speaking');
    setSpeaking(true);
    speakWithCallback(triageEngine.getGreeting(), () => {
      if (!isMounted.current) return;
      speakAndShowButtonsRef.current(FIRST_NODE);
    });

    return () => {
      isMounted.current = false;
      clearButtonsTimer();
      stopTTS();
      stopListening();
      sd.stop();
      destroySTT();
      networkMonitor.stopMonitoring();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived UI ────────────────────────────────────────────────────────────
  const micState: 'disabled' | 'idle' | 'listening' =
    indicatorPhase === 'listening' ? 'listening' :
    indicatorPhase === 'waiting'   ? 'idle'      : 'disabled';

  const hintText =
    indicatorPhase === 'listening'  ? 'جاوب بالصوت...' :
    indicatorPhase === 'speaking'   ? 'كنهضر...'       :
    indicatorPhase === 'processing' ? 'كنفهم...'        : '';

  const progressFraction = Math.min(triagePhaseNum / TOTAL_PHASES, 1);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* Header */}
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

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progressFraction * 100}%` as `${number}%`,
                backgroundColor: redBar ? COLORS.red : COLORS.green,
              },
            ]}
          />
        </View>

        {/* Main content — centered icon + wave + question */}
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.icon} accessibilityElementsHidden>{currentIcon}</Text>

          <View style={styles.waveContainer}>
            <SpeechWave
              type={indicatorPhase === 'speaking' ? 'speaking' : 'listening'}
              active={indicatorPhase === 'speaking' || indicatorPhase === 'listening'}
              color={indicatorPhase === 'speaking' ? COLORS.primary : COLORS.green}
              barCount={20}
              maxHeight={44}
            />
          </View>

          {currentQuestion ? (
            <Text style={styles.question}>{currentQuestion}</Text>
          ) : null}

          {transcript ? (
            <Text style={styles.transcript}>{transcript}</Text>
          ) : null}
        </ScrollView>

        {/* Fixed bottom: mic button + fallback buttons */}
        <View style={styles.answerArea}>
          {hintText ? <Text style={styles.hint}>{hintText}</Text> : null}

          {/* MicButton — 70px, pulses green while listening */}
          <MicButton state={micState} onPress={handleMicPress} size={70} />

          {/* Fallback buttons — small, horizontal, visible only after 5s or no-match */}
          {showButtons && currentButtons.length > 0 && (
            <View style={styles.btnRow}>
              {currentButtons.map((btn) => (
                <TouchableOpacity
                  key={btn.value}
                  style={[
                    styles.answerBtn,
                    {
                      backgroundColor: COLOR_BG_MAP[btn.color_key] ?? COLOR_BG_MAP.primary,
                      borderColor: COLOR_MAP[btn.color_key] ?? COLORS.primary,
                    },
                  ]}
                  onPress={() => handleButtonPress(btn)}
                  activeOpacity={0.7}
                  accessibilityLabel={btn.label}
                >
                  <Text style={[
                    styles.answerBtnText,
                    { color: COLOR_MAP[btn.color_key] ?? COLORS.primary },
                  ]}>
                    {btn.label}
                  </Text>
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
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
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
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: 5,
    borderRadius: 3,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 18,
  },
  icon: {
    fontSize: 80,
    textAlign: 'center',
  },
  waveContainer: {
    width: '100%',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  question: {
    fontSize: 21,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 34,
    paddingHorizontal: 8,
    writingDirection: 'rtl',
  },
  transcript: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: 16,
    writingDirection: 'rtl',
  },
  answerArea: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 4,
  },
  hint: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  btnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 4,
  },
  answerBtn: {
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  answerBtnText: {
    fontSize: 14,
    fontWeight: '600',
    writingDirection: 'rtl',
    textAlign: 'center',
  },
});

export default TriageScreen;

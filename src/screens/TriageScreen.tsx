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

const COLOR_MAP: Record<string, string> = {
  green: COLORS.green,
  orange: COLORS.orange,
  red: COLORS.red,
  primary: COLORS.primary,
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
  _maternity_done: false,
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

  // ── Speak-only helper (no mic) ────────────────────────────────────────────
  const speakOnly = useCallback((text: string, onDone?: () => void) => {
    if (!isMounted.current) return;
    setIndicatorPhase('speaking');
    setSpeaking(true);
    setShowButtons(false);
    speakWithCallback(text, () => {
      if (!isMounted.current) return;
      setSpeaking(false);
      setIndicatorPhase('waiting');
      onDone?.();
    });
  }, [setSpeaking]);

  // ── Open / close mic ─────────────────────────────────────────────────────
  const openMic = useCallback(() => {
    if (!isMounted.current) return;
    setShowButtons(true);
    setIndicatorPhase('listening');
    setSpeaking(false);
    setListening(true);
    sd.start();
    startListening('ar-MA');
  }, [setSpeaking, setListening, sd]);

  const closeMic = useCallback(() => {
    sd.stop();
    stopListening();
    setListening(false);
    setShowButtons(false);
    setProcessing(true);
    setIndicatorPhase('processing');
  }, [setListening, setProcessing, sd]);

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

      const nextId = triageEngine.getNextNodeId(
        nodeId,
        button.value,
        runtimeProfileRef.current,
      );

      // If button has instructions to speak (safety info or RED)
      if (button.instructions_darija) {
        if (button.triggerRed) {
          redDetectedRef.current = true;
          setRedDetected(true);
          setRedBar(true);
        }
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
        openMic();
      });
    };
  });

  // ── STT result ────────────────────────────────────────────────────────────
  const handleSTTResultRef = useRef<(raw: string) => void>(() => {});
  useEffect(() => {
    handleSTTResultRef.current = (raw: string) => {
      if (!isMounted.current || !raw.trim()) return;
      sd.reset();
      setTranscript(raw);
      speakFeedback().catch(() => {});

      const matched = triageEngine.matchSTTToButton(raw, currentButtonsRef.current);
      if (matched) {
        closeMic();
        handleButtonRef.current(matched);
      }
      // No match → keep mic open, user can speak again or press a button
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

  // ── Button / mic press ────────────────────────────────────────────────────
  const handleButtonPress = useCallback((button: TriageButton) => {
    if (indicatorPhase !== 'listening') return;
    sd.reset();
    closeMic();
    handleButtonRef.current(button);
  }, [indicatorPhase, sd, closeMic]);

  const handleMicPress = useCallback(() => {
    if (indicatorPhase !== 'listening') return;
    // Restart STT on tap (clears buffer and retries)
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
    indicatorPhase === 'listening'  ? 'جاوب بالصوت أو اضغط زر...' :
    indicatorPhase === 'speaking'   ? 'كنهضر...'                   :
    indicatorPhase === 'processing' ? 'كنفهم...'                    : '';

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

        {/* Main scrollable content */}
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.icon} accessibilityElementsHidden>{currentIcon}</Text>

          {currentQuestion ? (
            <Text style={styles.question}>{currentQuestion}</Text>
          ) : null}

          <View style={styles.waveContainer}>
            <SpeechWave
              type={indicatorPhase === 'speaking' ? 'speaking' : 'listening'}
              active={indicatorPhase === 'speaking' || indicatorPhase === 'listening'}
              color={indicatorPhase === 'speaking' ? COLORS.primary : COLORS.red}
              barCount={20}
              maxHeight={48}
            />
          </View>

          {transcript ? (
            <Text style={styles.transcript}>{transcript}</Text>
          ) : null}
        </ScrollView>

        {/* Fixed bottom: mic + answer buttons */}
        <View style={styles.answerArea}>
          {hintText ? <Text style={styles.hint}>{hintText}</Text> : null}

          <MicButton state={micState} onPress={handleMicPress} size={80} />

          {showButtons && currentButtons.length > 0 && (
            <ScrollView
              style={styles.btnScroll}
              contentContainerStyle={styles.btnScrollContent}
              showsVerticalScrollIndicator={currentButtons.length > 4}
              keyboardShouldPersistTaps="always"
            >
              {currentButtons.map((btn) => (
                <TouchableOpacity
                  key={btn.value}
                  style={[
                    styles.answerBtn,
                    { backgroundColor: COLOR_MAP[btn.color_key] ?? COLORS.primary },
                  ]}
                  onPress={() => handleButtonPress(btn)}
                  activeOpacity={0.75}
                  accessibilityLabel={btn.label}
                >
                  <Text style={styles.answerBtnText}>{btn.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
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
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    marginBottom: 14,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 16,
  },
  icon: {
    fontSize: 64,
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
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transcript: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: 16,
    writingDirection: 'rtl',
  },
  answerArea: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 6,
  },
  hint: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  btnScroll: {
    maxHeight: 300,
    width: '100%',
  },
  btnScrollContent: {
    gap: 8,
    paddingBottom: 4,
  },
  answerBtn: {
    width: '100%',
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  answerBtnText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    writingDirection: 'rtl',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
});

export default TriageScreen;

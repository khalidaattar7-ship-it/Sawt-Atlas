// Sawt Atlas Urgence — Store Zustand global : état complet de la session de triage en cours
// Fichier créé le 2026-05-07

import { create } from 'zustand';
import {
  TriageSession,
  TriageAnswer,
  TriageResult,
  TriagePhase,
  SilenceState,
  NetworkState,
  InterlocutorMode,
  PatientProfile,
} from '../types';

interface TriageState {
  session: TriageSession | null;
  phase: TriagePhase;
  silenceState: SilenceState;
  networkState: NetworkState;
  isSpeaking: boolean;
  isListening: boolean;
  isProcessing: boolean;
  redDetectedDuringTriage: boolean;

  startSession: (mode: InterlocutorMode, profile: PatientProfile) => void;
  nextNode: (nodeId: string) => void;
  setAnswer: (answer: TriageAnswer) => void;
  setResult: (result: TriageResult) => void;
  setPhase: (phase: TriagePhase) => void;
  setSilenceState: (state: SilenceState) => void;
  setNetworkState: (state: NetworkState) => void;
  setSpeaking: (speaking: boolean) => void;
  setListening: (listening: boolean) => void;
  setProcessing: (processing: boolean) => void;
  setRedDetected: (detected: boolean) => void;
  updateSession: (updates: Partial<TriageSession>) => void;
  resetSession: () => void;
}

const buildNewSession = (mode: InterlocutorMode, profile: PatientProfile): TriageSession => ({
  id: profile.id,
  createdAt: Date.now(),
  interlocutorMode: mode,
  language: 'darija',
  patientProfile: profile,
  avpuLevel: null,
  currentNodeId: 'start',
  answers: [],
  flags: [],
  classification: null,
  finalResult: null,
  burnZones: [],
  burnPercentage: 0,
  alertStatus: 'pending',
  samuCallTimestamp: null,
  smsTimestamps: [],
  reportPath: null,
  syncStatus: 'local',
});

export const useTriageStore = create<TriageState>((set) => ({
  session: null,
  phase: 'greeting',
  silenceState: 'normal',
  networkState: 'none',
  isSpeaking: false,
  isListening: false,
  isProcessing: false,
  redDetectedDuringTriage: false,

  startSession: (mode, profile) =>
    set({
      session: buildNewSession(mode, profile),
      phase: 'greeting',
      silenceState: 'normal',
      redDetectedDuringTriage: false,
    }),

  nextNode: (nodeId) =>
    set((state) => ({
      session: state.session ? { ...state.session, currentNodeId: nodeId } : null,
    })),

  setAnswer: (answer) =>
    set((state) => {
      if (!state.session) return {};
      return {
        session: {
          ...state.session,
          answers: [...state.session.answers, answer],
        },
        redDetectedDuringTriage: state.redDetectedDuringTriage || answer.isRedDetected,
      };
    }),

  setResult: (result) =>
    set((state) => ({
      session: state.session
        ? { ...state.session, finalResult: result, classification: result.level }
        : null,
      phase: 'result',
    })),

  setPhase: (phase) => set({ phase }),

  setSilenceState: (silenceState) => set({ silenceState }),

  setNetworkState: (networkState) => set({ networkState }),

  setSpeaking: (isSpeaking) => set({ isSpeaking }),

  setListening: (isListening) => set({ isListening }),

  setProcessing: (isProcessing) => set({ isProcessing }),

  setRedDetected: (redDetectedDuringTriage) => set({ redDetectedDuringTriage }),

  updateSession: (updates) =>
    set((state) => ({
      session: state.session ? { ...state.session, ...updates } : null,
    })),

  resetSession: () =>
    set({
      session: null,
      phase: 'greeting',
      silenceState: 'normal',
      isSpeaking: false,
      isListening: false,
      isProcessing: false,
      redDetectedDuringTriage: false,
    }),
}));

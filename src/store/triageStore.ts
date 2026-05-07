// Sawt Atlas Urgence — Store Zustand global : état de la session de triage en cours
// Fichier créé le 2026-05-07

import { create } from 'zustand';
import { TriageSession, UrgencyLevel } from '../types';

interface TriageState {
  session: TriageSession | null;
  isListening: boolean;
  setSession: (session: TriageSession) => void;
  setUrgencyLevel: (level: UrgencyLevel) => void;
  setListening: (listening: boolean) => void;
  resetSession: () => void;
}

export const useTriageStore = create<TriageState>((set) => ({
  session: null,
  isListening: false,
  setSession: (session) => set({ session }),
  setUrgencyLevel: (level) =>
    set((state) => ({
      session: state.session ? { ...state.session, urgencyLevel: level } : null,
    })),
  setListening: (isListening) => set({ isListening }),
  resetSession: () => set({ session: null, isListening: false }),
}));

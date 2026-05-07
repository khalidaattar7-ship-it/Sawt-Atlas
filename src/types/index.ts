// Sawt Atlas Urgence — Types TypeScript globaux partagés dans toute l'application
// Fichier créé le 2026-05-07

export type UrgencyLevel = 'extreme' | 'relative' | 'non-urgent';

export type AppLanguage = 'darija' | 'arabic' | 'french';

export interface TriageSession {
  id: string;
  createdAt: string;
  language: AppLanguage;
  urgencyLevel?: UrgencyLevel;
  symptoms: string[];
  bodyZones: string[];
  avpuScore?: 'A' | 'V' | 'P' | 'U';
  transcript: string[];
  gpsCoordinates?: { latitude: number; longitude: number };
}

export type RootStackParamList = {
  Home: undefined;
  Triage: undefined;
  BodyMap: undefined;
  Result: { sessionId: string };
  Companion: undefined;
  Report: { sessionId: string };
};

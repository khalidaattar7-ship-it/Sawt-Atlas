// Sawt Atlas Urgence — Types TypeScript globaux partagés dans toute l'application
// Fichier créé le 2026-05-07

export type InterlocutorMode = 'patient' | 'companion';
export type PatientSex = 'male' | 'female';
export type AgeCategory = 'child' | 'adult' | 'elderly'; // child = <5ans, elderly = >65ans
export type UrgencyLevel = 'RED' | 'ORANGE' | 'GREEN';
export type AVPULevel = 'A' | 'V' | 'P' | 'U';
export type TriagePhase =
  | 'greeting'
  | 'interlocutor'
  | 'profiling'
  | 'history'
  | 'avpu'
  | 'abc'
  | 'motive'
  | 'specific_tree'
  | 'result'
  | 'companion_mode';
export type SilenceState = 'normal' | 'warning_15s' | 'warning_30s' | 'escalated_40s';
export type NetworkState = 'none' | 'gsm_2g' | 'mobile_3g4g' | 'wifi';
export type AlertStatus = 'pending' | 'sent' | 'confirmed' | 'failed';

export interface PatientProfile {
  id: string; // UUID anonyme
  sex: PatientSex | null;
  ageCategory: AgeCategory | null;
  isPregnant: boolean;
  pregnancyMonths: number | null;
  knownConditions: {
    diabetes: boolean;
    hypertension: boolean;
    cardiac: boolean;
    bloodThinner: boolean;
    other: string | null;
  };
  allergies: string | null;
  isRecurrent: boolean;
  medicationPhoto: string | null; // chemin local photo boîte
}

export interface TriageNode {
  id: string;
  category: string;
  icon: string;
  priority: number;
  question_fr: string;
  question_darija: string;
  speak_darija_patient: string; // tutoiement
  speak_darija_companion: string; // 3ème personne
  listen_for: Record<
    string,
    {
      keywords_darija: string[];
      keywords_fr: string[];
      keywords_arabe: string[];
      keywords_tamazight: string[];
      next?: string;
      flag?: string;
      result?: TriageResult;
    }
  >;
}

export interface TriageResult {
  level: UrgencyLevel;
  label_fr: string;
  label_darija: string;
  confidence: number;
  instructions_fr: string[];
  instructions_darija: string[];
  speak_result_darija: string;
  alert_samu: boolean;
  sms_template: string | null;
}

export interface TriageAnswer {
  nodeId: string;
  questionDarija: string;
  responseRaw: string;
  extractedValue: string;
  confidence: number;
  timestamp: number;
  isRedDetected: boolean;
}

export interface TriageSession {
  id: string;
  createdAt: number;
  interlocutorMode: InterlocutorMode;
  language: string;
  patientProfile: PatientProfile;
  avpuLevel: AVPULevel | null;
  currentNodeId: string;
  answers: TriageAnswer[];
  flags: string[];
  classification: UrgencyLevel | null;
  finalResult: TriageResult | null;
  burnZones: string[]; // zones du body map sélectionnées
  burnPercentage: number;
  alertStatus: AlertStatus;
  samuCallTimestamp: number | null;
  smsTimestamps: number[];
  reportPath: string | null;
  syncStatus: 'local' | 'sms_sent' | 'synced';
}

export interface SilenceEvent {
  startTimestamp: number;
  endTimestamp: number | null;
  duration: number;
  reason: 'medical' | 'non_medical' | 'unknown' | null;
  escalatedToRed: boolean;
}

export type RootStackParamList = {
  Home: undefined;
  Triage: undefined;
  BodyMap: undefined;
  Result: { sessionId: string };
  Companion: undefined;
  Report: { sessionId: string };
};

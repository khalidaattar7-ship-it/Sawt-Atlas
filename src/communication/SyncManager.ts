// Sawt Atlas Urgence — Gestionnaire de synchronisation : upload ou SMS selon la connectivité
// Fichier créé le 2026-05-07

import { TriageSession } from '../types';
import { EMERGENCY_CONTACTS } from '../constants/contacts';
import networkMonitor from '../utils/network-monitor';
import { sendReportSMS } from './SMSService';
import * as Location from 'expo-location';

// Sessions en attente de synchronisation (persistées en SQLite via SessionStore)
let pendingSessions: TriageSession[] = [];
let backgroundInterval: ReturnType<typeof setInterval> | null = null;

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const getGPSString = async (): Promise<string> => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return 'N/D';
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return `${loc.coords.latitude.toFixed(5)},${loc.coords.longitude.toFixed(5)}`;
  } catch {
    return 'N/D';
  }
};

/**
 * Tente de synchroniser une session selon la connectivité disponible.
 * - 3G/4G/WiFi : upload complet (placeholder — backend à brancher)
 * - 2G GSM seulement : rapport en 3 SMS
 * - Aucune connexion : mise en file locale
 */
export const syncSession = async (session: TriageSession): Promise<TriageSession> => {
  const netState = networkMonitor.getCurrentState();

  // Connexion données disponible → upload (placeholder pour le backend)
  if (netState === 'mobile_3g4g' || netState === 'wifi') {
    const uploaded = await uploadSession(session);
    if (uploaded) {
      return { ...session, syncStatus: 'synced' };
    }
  }

  // GSM 2G seulement → rapport SMS
  if (netState === 'gsm_2g') {
    const target = EMERGENCY_CONTACTS.medecin_referent || EMERGENCY_CONTACTS.relais_1;
    if (target) {
      const gps = await getGPSString();
      const sent = await sendReportSMS(session, target, gps);
      if (sent > 0) {
        return { ...session, syncStatus: 'sms_sent' };
      }
    }
  }

  // Aucune connexion → file d'attente locale
  queueSession(session);
  return session;
};

/**
 * Upload complet vers le backend (placeholder — à brancher sur l'API en production).
 * Retourne false tant qu'aucun backend n'est configuré.
 */
const uploadSession = async (_session: TriageSession): Promise<boolean> => {
  // TODO PRODUCTION : POST /api/sessions avec le rapport JSON + PDF
  return false;
};

/** Ajoute une session à la file d'attente locale si non déjà présente. */
const queueSession = (session: TriageSession): void => {
  const exists = pendingSessions.some((s) => s.id === session.id);
  if (!exists) pendingSessions.push(session);
};

/** Retourne les sessions en attente de synchronisation, triées par niveau d'urgence. */
export const getPendingSessions = (): TriageSession[] =>
  [...pendingSessions].sort((a, b) => {
    const priority = { RED: 0, ORANGE: 1, GREEN: 2 };
    return (priority[a.classification ?? 'GREEN'] ?? 2) - (priority[b.classification ?? 'GREEN'] ?? 2);
  });

/** Marque une session comme synchronisée et la retire de la file. */
export const markSynced = (sessionId: string): void => {
  pendingSessions = pendingSessions.filter((s) => s.id !== sessionId);
};

/**
 * Démarre la synchronisation en arrière-plan toutes les 5 minutes.
 * Traite les sessions par ordre de priorité (RED en premier).
 */
export const startBackgroundSync = (
  onSessionSynced?: (session: TriageSession) => void
): void => {
  if (backgroundInterval) return;

  backgroundInterval = setInterval(async () => {
    const pending = getPendingSessions();
    if (pending.length === 0) return;

    for (const session of pending) {
      const updated = await syncSession(session);
      if (updated.syncStatus !== 'local') {
        markSynced(session.id);
        onSessionSynced?.(updated);
      }
    }
  }, SYNC_INTERVAL_MS);
};

export const stopBackgroundSync = (): void => {
  if (backgroundInterval) {
    clearInterval(backgroundInterval);
    backgroundInterval = null;
  }
};

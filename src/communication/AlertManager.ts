// Sawt Atlas Urgence — Gestionnaire d'alerte en cascade : appel + SMS selon le niveau d'urgence
// Fichier créé le 2026-05-07

import * as Location from 'expo-location';
import { TriageSession, AlertStatus } from '../types';
import { EMERGENCY_CONTACTS } from '../constants/contacts';
import { SMS_RETRY_INTERVAL_MS } from '../constants/config';
import { callSAMU } from './CallService';
import { sendAlertSMS, sendReportSMS } from './SMSService';
import networkMonitor from '../utils/network-monitor';

export interface AlertQueueItem {
  sessionId: string;
  level: 'RED' | 'ORANGE' | 'GREEN';
  priority: number; // 1 = RED, 2 = ORANGE, 3 = GREEN
  attempts: number;
  lastAttempt: number | null;
  status: AlertStatus;
  phones: string[];
}

// File d'attente en mémoire (persistée dans SQLite via SyncManager)
let alertQueue: AlertQueueItem[] = [];
let retryInterval: ReturnType<typeof setInterval> | null = null;

// Récupère les coordonnées GPS actuelles (ne bloque pas si refus de permission)
const getGPSString = async (): Promise<string> => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return 'GPS refusé';
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return `${loc.coords.latitude.toFixed(5)},${loc.coords.longitude.toFixed(5)}`;
  } catch {
    return 'GPS indisponible';
  }
};

/**
 * Déclenche la cascade complète pour un RED :
 * 1. Appel SAMU (15) — ouvre le dialer
 * 2. SMS SAMU (15) en parallèle
 * 3. SMS médecin référent
 * 4. SMS relais communautaires (relais_1, relais_2)
 */
export const triggerRedAlert = async (session: TriageSession): Promise<TriageSession> => {
  const gps = await getGPSString();
  const centre = EMERGENCY_CONTACTS.hopital_gps.name || 'Centre médical local';

  // 1. Appel SAMU
  const callResult = await callSAMU(session);
  const updatedSession: TriageSession = {
    ...session,
    samuCallTimestamp: callResult.success ? callResult.timestamp : null,
  };

  // 2-4. SMS en parallèle (SAMU + médecin + relais)
  const phones = [
    EMERGENCY_CONTACTS.samu,
    EMERGENCY_CONTACTS.medecin_referent,
    EMERGENCY_CONTACTS.relais_1,
    EMERGENCY_CONTACTS.relais_2,
  ].filter(Boolean);

  const smsResults = await Promise.allSettled(
    phones.map((phone) =>
      sendAlertSMS(updatedSession, phone, gps, centre, EMERGENCY_CONTACTS.medecin_referent)
    )
  );

  const sentCount = smsResults.filter(
    (r) => r.status === 'fulfilled' && r.value
  ).length;

  const timestamps = sentCount > 0
    ? Array.from({ length: sentCount }, () => Date.now())
    : [];

  const finalSession: TriageSession = {
    ...updatedSession,
    alertStatus: sentCount > 0 ? 'sent' : 'failed',
    smsTimestamps: [...session.smsTimestamps, ...timestamps],
  };

  // Ajouter en file d'attente si des envois ont échoué
  if (sentCount < phones.length) {
    const failedPhones = phones.filter((_, i) => {
      const r = smsResults[i];
      return r.status === 'rejected' || (r.status === 'fulfilled' && !r.value);
    });

    alertQueue.push({
      sessionId: session.id,
      level: 'RED',
      priority: 1,
      attempts: 1,
      lastAttempt: Date.now(),
      status: 'pending',
      phones: failedPhones,
    });
  }

  return finalSession;
};

/**
 * Déclenche une alerte ORANGE : SMS au médecin référent uniquement.
 */
export const triggerOrangeAlert = async (session: TriageSession): Promise<TriageSession> => {
  const referent = EMERGENCY_CONTACTS.medecin_referent;
  if (!referent) return session;

  const gps = await getGPSString();
  const sent = await sendAlertSMS(session, referent, gps, '', referent);

  return {
    ...session,
    alertStatus: sent ? 'sent' : 'failed',
    smsTimestamps: sent ? [...session.smsTimestamps, Date.now()] : session.smsTimestamps,
  };
};

/**
 * Réessaie les alertes en échec dans la file d'attente.
 * Appelé toutes les SMS_RETRY_INTERVAL_MS par startRetryInterval().
 */
export const retryFailedAlerts = async (
  getSession: (id: string) => TriageSession | null
): Promise<void> => {
  if (!networkMonitor.isGSMAvailable()) return;

  const pending = alertQueue
    .filter((item) => item.status === 'pending' || item.status === 'failed')
    .sort((a, b) => a.priority - b.priority);

  for (const item of pending) {
    const session = getSession(item.sessionId);
    if (!session) continue;

    const gps = await getGPSString();
    const results = await Promise.allSettled(
      item.phones.map((phone) => sendAlertSMS(session, phone, gps))
    );

    const allSent = results.every(
      (r) => r.status === 'fulfilled' && r.value
    );

    item.attempts += 1;
    item.lastAttempt = Date.now();
    item.status = allSent ? 'sent' : 'failed';
  }

  // Purger les alertes confirmées
  alertQueue = alertQueue.filter((item) => item.status !== 'sent');
};

/** Retourne la file d'attente triée par priorité (RED en premier). */
export const getAlertQueue = (): AlertQueueItem[] =>
  [...alertQueue].sort((a, b) => a.priority - b.priority);

/** Démarre le retry automatique toutes les SMS_RETRY_INTERVAL_MS. */
export const startRetryInterval = (getSession: (id: string) => TriageSession | null): void => {
  if (retryInterval) return;
  retryInterval = setInterval(() => retryFailedAlerts(getSession), SMS_RETRY_INTERVAL_MS);
};

export const stopRetryInterval = (): void => {
  if (retryInterval) {
    clearInterval(retryInterval);
    retryInterval = null;
  }
};

/**
 * Envoie les 3 SMS de rapport structuré (mode dégradé 2G, pas de 3G).
 */
export const sendStructuredReport = async (
  session: TriageSession,
  targetPhone: string
): Promise<number> => {
  const gps = await getGPSString();
  return sendReportSMS(session, targetPhone, gps);
};

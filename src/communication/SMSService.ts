// Sawt Atlas Urgence — Service SMS : alertes d'urgence et rapport médical multi-SMS
// Fichier créé le 2026-05-07

import * as SMS from 'expo-sms';
import { TriageSession } from '../types';

const pad2 = (n: number): string => String(n).padStart(2, '0');

const formatTime = (ts: number): string => {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const formatProfile = (session: TriageSession): string => {
  const { sex, ageCategory, isPregnant } = session.patientProfile;
  const sexLabel = sex === 'male' ? 'H' : sex === 'female' ? 'F' : '?';
  const ageLabel = ageCategory === 'child' ? '<5ans' : ageCategory === 'elderly' ? '>65ans' : 'adulte';
  const pregnant = isPregnant ? ' enceinte' : '';
  return `${sexLabel}/${ageLabel}${pregnant}`;
};

const formatAntecedents = (session: TriageSession): string => {
  const cond = session.patientProfile.knownConditions;
  const flags: string[] = [];
  if (cond.diabetes) flags.push('DT');
  if (cond.hypertension) flags.push('HTA');
  if (cond.cardiac) flags.push('cardio');
  if (cond.bloodThinner) flags.push('anticoag');
  return flags.length ? flags.join('+') : 'aucun';
};

const formatGPS = (session: TriageSession): string => {
  const gps = session.patientProfile.medicationPhoto; // placeholder — sera remplacé par expo-location
  const coords = session.answers.find(() => true); // GPS stocké dans la session via expo-location
  void coords;
  return gps ? gps : 'GPS non disponible';
};

/**
 * Génère le SMS d'alerte unique (format court, pour RED/ORANGE).
 * Remplace les placeholders {gps}, {centre}, {time} du template.
 */
export const formatAlertSMS = (session: TriageSession): string => {
  const result = session.finalResult;
  const level = result?.level ?? session.classification ?? 'ORANGE';
  const emoji = level === 'RED' ? '🔴' : level === 'ORANGE' ? '🟡' : '🟢';
  const label = result?.label_fr ?? `Urgence ${level}`;
  const profile = formatProfile(session);
  const antecedents = formatAntecedents(session);
  const heure = formatTime(session.createdAt);

  // GPS sera injecté par AlertManager via expo-location
  return [
    `${emoji} ${level === 'RED' ? 'URGENCE EXTRÊME' : 'URGENCE RELATIVE'}`,
    label,
    `Profil: ${profile}`,
    `GPS: {gps}`,
    `Centre: {centre}`,
    `Heure: ${heure}`,
    `Antéc: ${antecedents}`,
    `Contact: {tel}`,
  ].join('\n');
};

/**
 * Découpe le rapport complet en 3 SMS (utilisé en mode 2G sans données).
 */
export const formatReportSMS = (session: TriageSession): [string, string, string] => {
  const profile = formatProfile(session);
  const antecedents = formatAntecedents(session);
  const heure = formatTime(session.createdAt);
  const result = session.finalResult;

  const sms1 = [
    `[1/3] Sawt Atlas — ${heure}`,
    `ID: ${session.id.slice(0, 8)}`,
    `Profil: ${profile}`,
    `Antéc: ${antecedents}`,
    `Mode: ${session.interlocutorMode}`,
    `GPS: {gps}`,
  ].join('\n');

  const symptoms = session.answers
    .map((a) => `${a.nodeId}: ${a.extractedValue}`)
    .slice(0, 5)
    .join(', ');
  const flags = session.flags.join(', ') || 'aucun';

  const sms2 = [
    `[2/3] Triage ${session.id.slice(0, 8)}`,
    `Classification: ${result?.level ?? session.classification ?? '?'}`,
    `Label: ${result?.label_fr ?? 'N/D'}`,
    `Symptômes: ${symptoms || 'N/D'}`,
    `Flags: ${flags}`,
    `AVPU: ${session.avpuLevel ?? '?'}`,
  ].join('\n');

  const instructions = result?.instructions_fr.slice(0, 3).join(' / ') ?? 'N/D';
  const sms3 = [
    `[3/3] Actions ${session.id.slice(0, 8)}`,
    `Instructions: ${instructions}`,
    `SAMU appelé: ${session.samuCallTimestamp ? formatTime(session.samuCallTimestamp) : 'non'}`,
    `SMS envoyés: ${session.smsTimestamps.length}`,
    `Sync: ${session.syncStatus}`,
    `Rapport: ${session.reportPath ? 'généré' : 'en attente'}`,
  ].join('\n');

  return [sms1, sms2, sms3];
};

/**
 * Envoie un SMS via expo-sms (compose automatiquement, l'utilisateur confirme).
 */
export const sendAlertSMS = async (
  session: TriageSession,
  phoneNumber: string,
  gps = 'N/D',
  centreName = 'N/D',
  contactTel = ''
): Promise<boolean> => {
  const available = await SMS.isAvailableAsync();
  if (!available) return false;

  const body = formatAlertSMS(session)
    .replace('{gps}', gps)
    .replace('{centre}', centreName)
    .replace('{tel}', contactTel || phoneNumber);

  const { result } = await SMS.sendSMSAsync([phoneNumber], body);
  return result === 'sent' || result === 'unknown'; // "unknown" sur certains Android = envoyé
};

/**
 * Envoie les 3 SMS de rapport (mode 2G).
 * Retourne le nombre de SMS envoyés avec succès.
 */
export const sendReportSMS = async (
  session: TriageSession,
  phoneNumber: string,
  gps = 'N/D'
): Promise<number> => {
  const available = await SMS.isAvailableAsync();
  if (!available) return 0;

  const [s1, s2, s3] = formatReportSMS(session);
  let sent = 0;

  for (const body of [s1, s2.replace('{gps}', gps), s3]) {
    try {
      const { result } = await SMS.sendSMSAsync([phoneNumber], body);
      if (result === 'sent' || result === 'unknown') sent++;
    } catch {
      // Continuer les SMS suivants même si l'un échoue
    }
  }

  return sent;
};

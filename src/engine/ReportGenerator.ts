// Sawt Atlas Urgence — Génération du rapport texte structuré post-triage
// Fichier créé le 2026-05-07

import {
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import { TriageSession } from '../types';

const LINE = '════════════════════════════════════════';
const pad2 = (n: number) => String(n).padStart(2, '0');

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const formatTime = (ts: number): string => {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const formatSessionId = (session: TriageSession): string => {
  const d = new Date(session.createdAt);
  const date = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
  return `SAU-${date}-${session.id.slice(0, 6).toUpperCase()}`;
};

const formatAge = (cat: string | null): string => {
  if (cat === 'child') return 'Enfant < 5 ans';
  if (cat === 'elderly') return 'Personne âgée > 65 ans';
  if (cat === 'adult') return 'Adulte';
  return 'Non renseigné';
};

const urgencyEmoji = (level: string | null): string => {
  if (level === 'RED') return '🔴';
  if (level === 'ORANGE') return '🟡';
  if (level === 'GREEN') return '🟢';
  return '⚪';
};

/**
 * Génère un rapport texte complet de la session de triage.
 */
export const generateTextReport = (session: TriageSession): string => {
  const p = session.patientProfile;
  const result = session.finalResult;
  const lines: string[] = [];

  // En-tête
  lines.push(LINE);
  lines.push('   SAWT ATLAS URGENCE — RAPPORT DE TRIAGE');
  lines.push(LINE);
  lines.push(`ID      : #${formatSessionId(session)}`);
  lines.push(`Date    : ${formatDate(session.createdAt)}  —  Heure : ${formatTime(session.createdAt)}`);
  lines.push(`GPS     : ${'{gps}'}`);    // injecté par l'appelant
  lines.push(`Centre  : ${'{centre}'}`); // injecté par l'appelant
  lines.push('');

  // Interlocuteur & profil
  lines.push('── CONTEXTE ──');
  lines.push(`Interlocuteur : ${session.interlocutorMode === 'companion' ? 'Accompagnant (3ème personne)' : 'Patient direct'}`);
  lines.push(`Langue        : ${session.language}`);
  lines.push(`Sexe patient  : ${p.sex === 'male' ? 'Homme' : p.sex === 'female' ? 'Femme' : 'Non renseigné'}`);
  lines.push(`Âge approx.   : ${formatAge(p.ageCategory)}`);
  if (p.isPregnant) {
    lines.push(`Grossesse     : Oui${p.pregnancyMonths ? ` — ${p.pregnancyMonths} mois` : ''}`);
  }
  lines.push('');

  // Antécédents
  lines.push('── ANTÉCÉDENTS ──');
  lines.push(`Diabète        : ${p.knownConditions.diabetes ? 'Oui' : 'Non'}`);
  lines.push(`Hypertension   : ${p.knownConditions.hypertension ? 'Oui' : 'Non'}`);
  lines.push(`Cardiopathie   : ${p.knownConditions.cardiac ? 'Oui' : 'Non'}`);
  lines.push(`Anticoagulant  : ${p.knownConditions.bloodThinner ? 'Oui' : 'Non'}`);
  lines.push(`Autre          : ${p.knownConditions.other ?? 'Aucun'}`);
  lines.push(`Allergies      : ${p.allergies ?? 'Aucune connue'}`);
  lines.push(`Récurrence     : ${p.isRecurrent ? 'Oui — épisode antérieur' : 'Non — premier épisode'}`);
  lines.push('');

  // AVPU
  lines.push('── ÉVALUATION NEUROLOGIQUE ──');
  lines.push(`Score AVPU : ${session.avpuLevel ?? 'Non évalué'}`);
  const avpuDesc: Record<string, string> = {
    A: 'Alert — Conscient, répond normalement',
    V: 'Voice — Répond uniquement à la voix',
    P: 'Pain — Réagit uniquement à la douleur',
    U: 'Unresponsive — Inconscient',
  };
  if (session.avpuLevel) lines.push(`         ${avpuDesc[session.avpuLevel] ?? ''}`);
  lines.push('');

  // Réponses collectées
  lines.push('── SYMPTÔMES DÉTECTÉS ──');
  if (session.answers.length === 0) {
    lines.push('Aucune réponse enregistrée.');
  } else {
    session.answers.forEach((a, i) => {
      const red = a.isRedDetected ? ' ⚠️ RED' : '';
      lines.push(`${String(i + 1).padStart(2)}. [${formatTime(a.timestamp)}] ${a.nodeId}`);
      lines.push(`    Q : ${a.questionDarija}`);
      lines.push(`    R : "${a.responseRaw}" → ${a.extractedValue} (confiance: ${Math.round(a.confidence * 100)}%)${red}`);
    });
  }
  lines.push('');

  // Flags détectés
  if (session.flags.length > 0) {
    lines.push('── FLAGS MÉDICAUX ──');
    session.flags.forEach((f) => lines.push(`  · ${f}`));
    lines.push('');
  }

  // Brûlures
  if (session.burnZones.length > 0) {
    lines.push('── BRÛLURES ──');
    lines.push(`Zones : ${session.burnZones.join(', ')}`);
    lines.push(`Surface corporelle : ${session.burnPercentage.toFixed(1)}% (règle des 9 de Wallace)`);
    lines.push('');
  }

  // Classification
  lines.push('── CLASSIFICATION ──');
  lines.push(`Niveau    : ${urgencyEmoji(session.classification)} ${session.classification ?? 'Non déterminé'}`);
  lines.push(`Label     : ${result?.label_fr ?? 'N/D'}`);
  lines.push(`Confiance : ${result ? Math.round(result.confidence * 100) + '%' : 'N/D'}`);
  lines.push('');

  // Instructions données
  if (result?.instructions_fr && result.instructions_fr.length > 0) {
    lines.push('── INSTRUCTIONS DONNÉES ──');
    result.instructions_fr.forEach((instr) => lines.push(`  · ${instr}`));
    lines.push('');
  }

  // Alertes
  lines.push('── ALERTES DÉCLENCHÉES ──');
  lines.push(`Appel SAMU (15)     : ${session.samuCallTimestamp ? `Oui — ${formatTime(session.samuCallTimestamp)}` : 'Non'}`);
  lines.push(`SMS envoyés         : ${session.smsTimestamps.length}`);
  if (session.smsTimestamps.length > 0) {
    session.smsTimestamps.forEach((ts, i) => lines.push(`  SMS ${i + 1} : ${formatTime(ts)}`));
  }
  lines.push(`Statut alertes      : ${session.alertStatus}`);
  lines.push(`Synchronisation     : ${session.syncStatus}`);
  lines.push('');

  // Pied de page
  lines.push(LINE);
  lines.push("⚠️  Ce rapport est un outil d'aide à l'orientation.");
  lines.push('    Il ne constitue pas un diagnostic médical.');
  lines.push('    Version MVP — Sawt Atlas Urgence v1.0');
  lines.push(LINE);

  return lines.join('\n');
};

/**
 * Sauvegarde le rapport texte dans le système de fichiers local.
 * Retourne le chemin absolu du fichier créé.
 */
export const saveReportToFile = async (
  report: string,
  sessionId: string
): Promise<string> => {
  const dir = (documentDirectory ?? '') + 'reports/';

  // Crée le dossier si nécessaire
  const dirInfo = await getInfoAsync(dir);
  if (!dirInfo.exists) {
    await makeDirectoryAsync(dir, { intermediates: true });
  }

  const filename = `rapport_${sessionId.slice(0, 8)}_${Date.now()}.txt`;
  const path = dir + filename;

  await writeAsStringAsync(path, report, { encoding: 'utf8' });

  return path;
};

/**
 * Point d'entrée principal : génère et sauvegarde le rapport.
 * Retourne le chemin du fichier créé.
 */
export const generateAndSaveReport = async (
  session: TriageSession,
  gps = 'N/D',
  centreName = 'N/D'
): Promise<string> => {
  const report = generateTextReport(session)
    .replace('{gps}', gps)
    .replace('{centre}', centreName);

  return saveReportToFile(report, session.id);
};

// Sawt Atlas Urgence — Génération du rapport médical PDF structuré après le triage
// Fichier créé le 2026-05-07

import { TriageSession } from '../types';

export interface ReportData {
  sessionId: string;
  timestamp: string;
  urgencyLevel: string;
  findings: string[];
  pdfPath?: string;
}

export const generateReport = async (_session: TriageSession): Promise<ReportData> => ({
  sessionId: _session.id,
  timestamp: new Date().toISOString(),
  urgencyLevel: _session.urgencyLevel ?? 'non-urgent',
  findings: [],
});

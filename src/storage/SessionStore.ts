// Sawt Atlas Urgence — Persistance des sessions de triage dans SQLite
// Fichier créé le 2026-05-07

import { TriageSession } from '../types';
import { getDatabase } from './database';

export const saveSession = async (_session: TriageSession): Promise<void> => {
  const db = getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO sessions (id, created_at, urgency_level, data) VALUES (?, ?, ?, ?)',
    [_session.id, _session.createdAt, _session.classification ?? null, JSON.stringify(_session)]
  );
};

export const getSession = async (_id: string): Promise<TriageSession | null> => null;

export const getAllSessions = async (): Promise<TriageSession[]> => [];

// Sawt Atlas Urgence — Base SQLite locale offline-first : sessions, réponses, silence, alertes
// Fichier créé le 2026-05-07

import * as SQLite from 'expo-sqlite';
import { TriageSession, TriageAnswer, SilenceEvent } from '../types';
import { AlertQueueItem } from '../communication/AlertManager';

let db: SQLite.SQLiteDatabase | null = null;

export const getDatabase = (): SQLite.SQLiteDatabase => {
  if (!db) db = SQLite.openDatabaseSync('sawt_atlas.db');
  return db;
};

// ─── Initialisation ──────────────────────────────────────────────────────────

export const initDatabase = async (): Promise<void> => {
  const d = getDatabase();

  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS sessions (
      id                   TEXT PRIMARY KEY,
      created_at           INTEGER NOT NULL,
      interlocutor_mode    TEXT,
      language             TEXT,
      patient_profile      TEXT,
      avpu_level           TEXT,
      classification       TEXT,
      confidence           REAL,
      alert_status         TEXT DEFAULT 'pending',
      samu_call_timestamp  INTEGER,
      report_path          TEXT,
      sync_status          TEXT DEFAULT 'local',
      burn_zones           TEXT,
      burn_percentage      REAL DEFAULT 0,
      flags                TEXT,
      final_result         TEXT
    );

    CREATE TABLE IF NOT EXISTS answers (
      id               TEXT PRIMARY KEY,
      session_id       TEXT NOT NULL REFERENCES sessions(id),
      node_id          TEXT,
      question_darija  TEXT,
      response_raw     TEXT,
      extracted_value  TEXT,
      confidence       REAL,
      timestamp        INTEGER,
      is_red_detected  INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS silence_events (
      id               TEXT PRIMARY KEY,
      session_id       TEXT NOT NULL REFERENCES sessions(id),
      start_timestamp  INTEGER,
      end_timestamp    INTEGER,
      duration         INTEGER,
      reason           TEXT,
      escalated_to_red INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS alert_queue (
      id           TEXT PRIMARY KEY,
      session_id   TEXT NOT NULL REFERENCES sessions(id),
      type         TEXT,
      priority     INTEGER DEFAULT 2,
      status       TEXT DEFAULT 'pending',
      message      TEXT,
      phone_number TEXT,
      created_at   INTEGER,
      last_attempt INTEGER,
      attempts     INTEGER DEFAULT 0
    );
  `);
};

// ─── Sessions ────────────────────────────────────────────────────────────────

export const saveSession = async (session: TriageSession): Promise<void> => {
  const d = getDatabase();
  await d.runAsync(
    `INSERT OR REPLACE INTO sessions
      (id, created_at, interlocutor_mode, language, patient_profile, avpu_level,
       classification, confidence, alert_status, samu_call_timestamp, report_path,
       sync_status, burn_zones, burn_percentage, flags, final_result)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      session.id,
      session.createdAt,
      session.interlocutorMode,
      session.language,
      JSON.stringify(session.patientProfile),
      session.avpuLevel ?? null,
      session.classification ?? null,
      session.finalResult?.confidence ?? null,
      session.alertStatus,
      session.samuCallTimestamp ?? null,
      session.reportPath ?? null,
      session.syncStatus,
      JSON.stringify(session.burnZones),
      session.burnPercentage,
      JSON.stringify(session.flags),
      session.finalResult ? JSON.stringify(session.finalResult) : null,
    ]
  );
};

export const getSession = async (id: string): Promise<TriageSession | null> => {
  const d = getDatabase();
  const row = await d.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM sessions WHERE id = ?',
    [id]
  );
  if (!row) return null;

  const answers = await d.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM answers WHERE session_id = ? ORDER BY timestamp ASC',
    [id]
  );

  return rowToSession(row, answers as Record<string, unknown>[]);
};

export const getAllSessions = async (): Promise<TriageSession[]> => {
  const d = getDatabase();
  const rows = await d.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM sessions ORDER BY created_at DESC'
  );
  return Promise.all(rows.map(async (row) => {
    const answers = await d.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM answers WHERE session_id = ? ORDER BY timestamp ASC',
      [row.id as string]
    );
    return rowToSession(row, answers);
  }));
};

export const getPendingSyncSessions = async (): Promise<TriageSession[]> => {
  const d = getDatabase();
  const rows = await d.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM sessions WHERE sync_status = 'local' ORDER BY created_at ASC"
  );
  return Promise.all(rows.map(async (row) => {
    const answers = await d.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM answers WHERE session_id = ? ORDER BY timestamp ASC',
      [row.id as string]
    );
    return rowToSession(row, answers);
  }));
};

export const updateSyncStatus = async (id: string, status: string): Promise<void> => {
  const d = getDatabase();
  await d.runAsync('UPDATE sessions SET sync_status = ? WHERE id = ?', [status, id]);
};

export const updateReportPath = async (id: string, path: string): Promise<void> => {
  const d = getDatabase();
  await d.runAsync('UPDATE sessions SET report_path = ? WHERE id = ?', [path, id]);
};

// ─── Réponses ────────────────────────────────────────────────────────────────

export const saveAnswer = async (sessionId: string, answer: TriageAnswer): Promise<void> => {
  const d = getDatabase();
  const rowId = `${sessionId}_${answer.nodeId}_${answer.timestamp}`;
  await d.runAsync(
    `INSERT OR REPLACE INTO answers
      (id, session_id, node_id, question_darija, response_raw, extracted_value,
       confidence, timestamp, is_red_detected)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      rowId,
      sessionId,
      answer.nodeId,
      answer.questionDarija,
      answer.responseRaw,
      answer.extractedValue,
      answer.confidence,
      answer.timestamp,
      answer.isRedDetected ? 1 : 0,
    ]
  );
};

// ─── Événements de silence ───────────────────────────────────────────────────

export const saveSilenceEvent = async (
  sessionId: string,
  event: SilenceEvent
): Promise<void> => {
  const d = getDatabase();
  const rowId = `${sessionId}_silence_${event.startTimestamp}`;
  await d.runAsync(
    `INSERT OR REPLACE INTO silence_events
      (id, session_id, start_timestamp, end_timestamp, duration, reason, escalated_to_red)
     VALUES (?,?,?,?,?,?,?)`,
    [
      rowId,
      sessionId,
      event.startTimestamp,
      event.endTimestamp ?? null,
      event.duration,
      event.reason ?? null,
      event.escalatedToRed ? 1 : 0,
    ]
  );
};

// ─── File d'alertes ──────────────────────────────────────────────────────────

export const addToAlertQueue = async (item: AlertQueueItem): Promise<void> => {
  const d = getDatabase();
  await d.runAsync(
    `INSERT OR REPLACE INTO alert_queue
      (id, session_id, type, priority, status, message, phone_number,
       created_at, last_attempt, attempts)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      item.sessionId + '_' + item.level + '_' + Date.now(),
      item.sessionId,
      item.level,
      item.priority,
      item.status,
      null,
      item.phones.join(','),
      Date.now(),
      item.lastAttempt ?? null,
      item.attempts,
    ]
  );
};

export const getAlertQueue = async (): Promise<AlertQueueItem[]> => {
  const d = getDatabase();
  const rows = await d.getAllAsync<{
    session_id: string;
    level: string;
    priority: number;
    status: string;
    phone_number: string;
    attempts: number;
    last_attempt: number | null;
  }>("SELECT * FROM alert_queue WHERE status != 'sent' ORDER BY priority ASC");

  return rows.map((row) => ({
    sessionId: row.session_id,
    level: row.level as 'RED' | 'ORANGE' | 'GREEN',
    priority: row.priority,
    status: row.status as 'pending' | 'sent' | 'confirmed' | 'failed',
    phones: row.phone_number ? row.phone_number.split(',') : [],
    attempts: row.attempts,
    lastAttempt: row.last_attempt,
  }));
};

export const updateAlertStatus = async (id: string, status: string): Promise<void> => {
  const d = getDatabase();
  await d.runAsync(
    'UPDATE alert_queue SET status = ?, last_attempt = ?, attempts = attempts + 1 WHERE id = ?',
    [status, Date.now(), id]
  );
};

// ─── Helpers de désérialisation ──────────────────────────────────────────────

const rowToSession = (
  row: Record<string, unknown>,
  answerRows: Record<string, unknown>[]
): TriageSession => ({
  id: row.id as string,
  createdAt: row.created_at as number,
  interlocutorMode: (row.interlocutor_mode as string ?? 'patient') as 'patient' | 'companion',
  language: row.language as string ?? 'darija',
  patientProfile: JSON.parse(row.patient_profile as string ?? '{}'),
  avpuLevel: (row.avpu_level as 'A' | 'V' | 'P' | 'U' | null) ?? null,
  currentNodeId: 'start',
  answers: answerRows.map((a) => ({
    nodeId: a.node_id as string,
    questionDarija: a.question_darija as string,
    responseRaw: a.response_raw as string,
    extractedValue: a.extracted_value as string,
    confidence: a.confidence as number,
    timestamp: a.timestamp as number,
    isRedDetected: (a.is_red_detected as number) === 1,
  })),
  flags: JSON.parse(row.flags as string ?? '[]'),
  classification: (row.classification as 'RED' | 'ORANGE' | 'GREEN' | null) ?? null,
  finalResult: row.final_result ? JSON.parse(row.final_result as string) : null,
  burnZones: JSON.parse(row.burn_zones as string ?? '[]'),
  burnPercentage: (row.burn_percentage as number) ?? 0,
  alertStatus: (row.alert_status as 'pending' | 'sent' | 'confirmed' | 'failed') ?? 'pending',
  samuCallTimestamp: (row.samu_call_timestamp as number | null) ?? null,
  smsTimestamps: [],
  reportPath: (row.report_path as string | null) ?? null,
  syncStatus: (row.sync_status as 'local' | 'sms_sent' | 'synced') ?? 'local',
});

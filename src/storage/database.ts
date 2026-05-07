// Sawt Atlas Urgence — Initialisation et accès à la base de données SQLite locale (offline-first)
// Fichier créé le 2026-05-07

import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export const getDatabase = (): SQLite.SQLiteDatabase => {
  if (!db) {
    db = SQLite.openDatabaseSync('sawt_atlas.db');
  }
  return db;
};

export const initDatabase = async (): Promise<void> => {
  const database = getDatabase();
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      urgency_level TEXT,
      data TEXT
    );
  `);
};

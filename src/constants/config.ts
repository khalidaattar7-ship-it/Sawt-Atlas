// Sawt Atlas Urgence — Configuration globale de l'application (timeouts, seuils, feature flags)
// Fichier créé le 2026-05-07

export const CONFIG = {
  sttTimeoutMs: 10000,
  silenceThresholdMs: 2500,
  maxSessionDurationMs: 600000,
  defaultLanguage: 'darija' as const,
  offlineMode: true,
  ttsRate: 0.85,
  ttsPitch: 1.0,
  minConfidenceScore: 0.6,
} as const;

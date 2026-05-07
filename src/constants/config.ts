// Sawt Atlas Urgence — Configuration globale : seuils de silence, timeouts, confiance STT
// Fichier créé le 2026-05-07

export const SILENCE_WARNING_1_MS = 15_000;  // 15s → première alerte vocale
export const SILENCE_WARNING_2_MS = 30_000;  // 30s → deuxième alerte + changement de langue
export const SILENCE_ESCALATION_MS = 40_000; // 40s → escalade RED automatique

export const SMS_RETRY_INTERVAL_MS = 30_000; // Intervalle de réessai SMS
export const CONFIDENCE_THRESHOLD = 0.6;     // Seuil minimal de confiance STT pour extraire une réponse
export const STT_TIMEOUT_MS = 10_000;        // Timeout d'écoute sans parole détectée
export const TTS_FEEDBACK_DELAY_MS = 300;    // Délai avant synthèse vocale (évite chevauchement)
export const COMPANION_REMINDER_MS = 600_000; // 10 min → rappel périodique en mode accompagnateur

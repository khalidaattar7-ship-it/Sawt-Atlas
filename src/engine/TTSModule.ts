// Sawt Atlas Urgence — Module Text-to-Speech : synthèse vocale en darija via expo-speech
// Fichier créé le 2026-05-07

// MVP : utilise expo-speech (TTS Android natif)
// PRODUCTION : remplacer par Piper TTS embarqué pour offline complet
// L'interface reste identique — seul ce fichier change

import * as Speech from 'expo-speech';
import { TTS_FEEDBACK_DELAY_MS } from '../constants/config';

let _speaking = false;

// Options TTS optimisées pour la compréhension en darija
const BASE_OPTIONS: Speech.SpeechOptions = {
  language: 'ar',
  rate: 0.9,   // légèrement plus lent pour la compréhension rurale
  pitch: 1.0,
};

/**
 * Synthétise le texte et retourne une promesse résolue quand la parole est terminée.
 * @param text     Texte à prononcer (darija en script arabe)
 * @param language Code langue BCP-47 (défaut : 'ar')
 */
export const speak = (text: string, language = 'ar'): Promise<void> => {
  return new Promise((resolve) => {
    _speaking = true;
    Speech.speak(text, {
      ...BASE_OPTIONS,
      language,
      onDone: () => {
        _speaking = false;
        resolve();
      },
      onStopped: () => {
        _speaking = false;
        resolve();
      },
      onError: () => {
        _speaking = false;
        resolve(); // Résoudre même en cas d'erreur pour ne pas bloquer le flux
      },
    });
  });
};

/**
 * Parle et exécute onDone uniquement après la fin complète de la synthèse.
 * CRITIQUE : le micro ne doit s'activer que dans ce callback.
 *
 * Flux standard du TriageScreen :
 *   speakWithCallback(question, () => STTModule.startListening())
 */
export const speakWithCallback = async (text: string, onDone: () => void): Promise<void> => {
  await speak(text);
  // Délai de sécurité pour éviter que le micro capte l'écho de la voix synthétique
  await new Promise<void>((r) => setTimeout(r, TTS_FEEDBACK_DELAY_MS));
  onDone();
};

/**
 * Arrête immédiatement la synthèse vocale en cours.
 */
export const stop = (): void => {
  if (_speaking) {
    Speech.stop();
    _speaking = false;
  }
};

/**
 * Indique si la synthèse vocale est actuellement en cours.
 */
export const isSpeaking = (): boolean => _speaking;

/**
 * Retour vocal rapide "سمعتك" (je t'ai entendu) après détection du début de parole.
 * Intentionnellement court pour ne pas interrompre le flux de réponse du patient.
 */
export const speakFeedback = (): Promise<void> => {
  // Court et familier en darija : ressenti immédiat de compréhension
  return speak('سمعتك', 'ar');
};

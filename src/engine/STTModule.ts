// Sawt Atlas Urgence — Module Speech-to-Text : reconnaissance vocale Android native
// Fichier créé le 2026-05-07

// MVP : utilise le STT natif Android (@react-native-voice/voice)
// PRODUCTION : remplacer par Whisper Small ONNX embarqué
// L'interface reste identique — seul ce fichier change

import Voice, {
  SpeechResultsEvent,
  SpeechPartialResultsEvent,
  SpeechErrorEvent,
} from '@react-native-voice/voice';
import { STT_TIMEOUT_MS } from '../constants/config';

type ResultCallback = (text: string, confidence: number) => void;
type PartialCallback = (text: string) => void;
type ErrorCallback = (error: string) => void;

let _resultCallback: ResultCallback | null = null;
let _partialCallback: PartialCallback | null = null;
let _errorCallback: ErrorCallback | null = null;
let _timeoutHandle: ReturnType<typeof setTimeout> | null = null;
let _listening = false;

const clearTimeout_ = () => {
  if (_timeoutHandle) {
    clearTimeout(_timeoutHandle);
    _timeoutHandle = null;
  }
};

const armTimeout = () => {
  clearTimeout_();
  _timeoutHandle = setTimeout(async () => {
    if (_listening) {
      await stopListening();
      _errorCallback?.('timeout');
    }
  }, STT_TIMEOUT_MS);
};

// Résout la confiance : Voice.js retourne un tableau, on prend le premier score ou 0.8 par défaut
const resolveConfidence = (event: SpeechResultsEvent): number => {
  const scores = (event as unknown as { value: string[]; confidence?: number[] }).confidence;
  if (Array.isArray(scores) && scores.length > 0) return scores[0];
  return 0.8;
};

Voice.onSpeechResults = (event: SpeechResultsEvent) => {
  clearTimeout_();
  _listening = false;
  const text = event.value?.[0] ?? '';
  const confidence = resolveConfidence(event);
  _resultCallback?.(text, confidence);
};

Voice.onSpeechPartialResults = (event: SpeechPartialResultsEvent) => {
  // Réarme le timeout à chaque activité vocale partielle
  armTimeout();
  const text = event.value?.[0] ?? '';
  _partialCallback?.(text);
};

Voice.onSpeechError = (event: SpeechErrorEvent) => {
  clearTimeout_();
  _listening = false;
  const code = event.error?.code ?? 'unknown';
  const message = event.error?.message ?? 'Erreur STT inconnue';
  _errorCallback?.(`${code}: ${message}`);
};

Voice.onSpeechEnd = () => {
  clearTimeout_();
  _listening = false;
};

/**
 * Active la reconnaissance vocale.
 * @param language Code BCP-47 de la langue (défaut : arabe marocain)
 */
export const startListening = async (language = 'ar-MA'): Promise<void> => {
  if (_listening) await stopListening();

  try {
    await Voice.start(language);
    _listening = true;
    armTimeout();
  } catch (e) {
    _listening = false;
    _errorCallback?.(`Impossible de démarrer le STT: ${String(e)}`);
  }
};

export const stopListening = async (): Promise<void> => {
  clearTimeout_();
  _listening = false;
  try {
    await Voice.stop();
  } catch {
    // Ignorer les erreurs d'arrêt (micro déjà inactif)
  }
};

/** Enregistre le callback pour les résultats finaux (texte + confiance). */
export const onResult = (callback: ResultCallback): void => {
  _resultCallback = callback;
};

/** Enregistre le callback pour les résultats partiels (alimente l'animation waveform). */
export const onPartialResult = (callback: PartialCallback): void => {
  _partialCallback = callback;
};

/** Enregistre le callback d'erreur. Reçoit "timeout" si silence > STT_TIMEOUT_MS. */
export const onError = (callback: ErrorCallback): void => {
  _errorCallback = callback;
};

/** Vérifie si la reconnaissance vocale est disponible sur l'appareil. */
export const isAvailable = async (): Promise<boolean> => {
  try {
    return await Voice.isAvailable();
  } catch {
    return false;
  }
};

/** Libère les ressources Voice. Appeler dans le cleanup du composant. */
export const destroy = (): void => {
  clearTimeout_();
  _listening = false;
  _resultCallback = null;
  _partialCallback = null;
  _errorCallback = null;
  Voice.destroy().catch(() => {});
};

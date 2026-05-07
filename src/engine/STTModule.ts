// Sawt Atlas Urgence — Module Speech-to-Text : transcription vocale en darija/arabe/français
// Fichier créé le 2026-05-07

export interface STTResult {
  transcript: string;
  confidence: number;
  language: string;
}

export const startListening = async (): Promise<void> => {};

export const stopListening = async (): Promise<STTResult> => ({
  transcript: '',
  confidence: 0,
  language: 'ar-MA',
});

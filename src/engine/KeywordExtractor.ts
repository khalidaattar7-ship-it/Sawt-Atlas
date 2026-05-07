// Sawt Atlas Urgence — Extraction de mots-clés médicaux dans la transcription vocale
// Fichier créé le 2026-05-07

export interface ExtractedKeywords {
  symptoms: string[];
  bodyParts: string[];
  severity: string | null;
  rawText: string;
}

export const extractKeywords = (_transcript: string): ExtractedKeywords => ({
  symptoms: [],
  bodyParts: [],
  severity: null,
  rawText: _transcript,
});

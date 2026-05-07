// Sawt Atlas Urgence — Module Text-to-Speech : synthèse vocale en darija (voix prioritaire)
// Fichier créé le 2026-05-07

export interface TTSOptions {
  language?: string;
  pitch?: number;
  rate?: number;
}

export const speak = async (_text: string, _options?: TTSOptions): Promise<void> => {};

export const stop = async (): Promise<void> => {};

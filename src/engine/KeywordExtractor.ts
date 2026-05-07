// Sawt Atlas Urgence — Extracteur de mots-clés multilingue avec fuzzy matching (darija + arabe + français + tamazight)
// Fichier créé le 2026-05-07

export interface KeywordMatch {
  match: string;
  confidence: number;
}

// Supprime les diacritiques arabes (harakat) pour normaliser la comparaison
const removeArabicDiacritics = (text: string): string =>
  text.replace(/[ً-ٰٟۖ-ۜ۟-۪ۤۧۨ-ۭ]/g, '');

// Normalise un texte pour la comparaison : minuscules, sans diacritiques, sans ponctuation
const normalizeText = (text: string): string =>
  removeArabicDiacritics(text)
    .toLowerCase()
    .replace(/[،,\.!؟?؛;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Distance de Levenshtein : mesure le nombre d'opérations pour transformer s1 en s2
const levenshteinDistance = (s1: string, s2: string): number => {
  const m = s1.length;
  const n = s2.length;

  if (m === 0) return n;
  if (n === 0) return m;

  // Optimisation : si les chaînes sont trop différentes en longueur, distance garantie élevée
  if (Math.abs(m - n) > Math.max(m, n) * 0.5) return Math.max(m, n);

  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        s1[i - 1] === s2[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
};

// Calcule le score de similarité (0-1) entre deux chaînes normalisées
const similarityScore = (a: string, b: string): number => {
  if (a === b) return 1.0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const distance = levenshteinDistance(a, b);
  return Math.max(0, 1 - distance / maxLen);
};

// Vérifie si un mot-clé est présent dans le texte (exact ou fuzzy dans les tokens)
const matchKeyword = (keyword: string, tokens: string[], normalized: string): number => {
  const normKeyword = normalizeText(keyword);

  // Correspondance exacte dans le texte complet
  if (normalized.includes(normKeyword)) return 1.0;

  // Correspondance fuzzy sur chaque token
  let best = 0;
  for (const token of tokens) {
    const score = similarityScore(normKeyword, token);
    // Seuil minimum de 0.75 pour éviter les faux positifs
    if (score > best && score >= 0.75) best = score;
  }

  return best;
};

/**
 * Cherche dans rawText les mots-clés de toutes les langues simultanément.
 * Retourne le label (clé de listen_for) avec la meilleure confiance.
 *
 * @param rawText       Transcription brute issue du STT
 * @param listenFor     Objet listen_for du nœud courant (clé → {keywords_darija, keywords_fr, ...})
 */
export const extractKeywords = (
  rawText: string,
  listenFor: Record<
    string,
    {
      keywords_darija: string[];
      keywords_fr: string[];
      keywords_arabe: string[];
      keywords_tamazight: string[];
    }
  >
): KeywordMatch => {
  const normalized = normalizeText(rawText);
  const tokens = normalized.split(' ').filter(Boolean);

  let bestMatch = '';
  let bestScore = 0;

  for (const [label, entry] of Object.entries(listenFor)) {
    const allKeywords = [
      ...entry.keywords_darija,
      ...entry.keywords_fr,
      ...entry.keywords_arabe,
      ...entry.keywords_tamazight,
    ];

    let labelScore = 0;
    let matchCount = 0;

    for (const keyword of allKeywords) {
      const score = matchKeyword(keyword, tokens, normalized);
      if (score > 0) {
        // Pondère le score par la longueur du mot-clé (mots longs = plus discriminants)
        const weight = Math.min(1, keyword.length / 5);
        labelScore += score * weight;
        matchCount++;
      }
    }

    // Normalise par le nombre de mots-clés pour éviter la victoire par volume
    if (matchCount > 0) {
      const normalized_score = labelScore / Math.max(1, allKeywords.length) * (1 + Math.log(matchCount + 1));
      if (normalized_score > bestScore) {
        bestScore = normalized_score;
        bestMatch = label;
      }
    }
  }

  // Clamp la confiance entre 0 et 1
  const confidence = Math.min(1, bestScore);

  return { match: bestMatch, confidence };
};

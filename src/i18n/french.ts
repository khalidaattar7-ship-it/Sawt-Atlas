// Sawt Atlas Urgence — Traductions en français (langue tertiaire pour les soignants)
// Fichier créé le 2026-05-07

export const french = {
  welcome: 'Bonjour, je suis Sawt Atlas. Comment puis-je vous aider ?',
  askPain: 'Où avez-vous mal ?',
  askBreathing: 'Pouvez-vous respirer normalement ?',
  askConsciousness: 'Êtes-vous bien conscient(e) ?',
  urgencyExtreme: 'Danger extrême ! Il faut appeler les secours immédiatement.',
  urgencyRelative: 'La situation nécessite une prise en charge médicale rapide.',
  urgencyNone: "La situation n'est pas grave. Consultez un médecin.",
} as const;

export type FrenchKey = keyof typeof french;

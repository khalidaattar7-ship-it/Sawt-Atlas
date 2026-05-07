// Sawt Atlas Urgence — Palette de couleurs officielle : urgence rouge/orange/vert + thème atlas
// Fichier créé le 2026-05-07

export const COLORS = {
  primary: '#14532D',
  primaryLight: '#166534',
  primarySoft: '#DCFCE7',
  accent: '#92400E',
  accentSoft: '#FEF3C7',
  red: '#B91C1C',
  redSoft: '#FEE2E2',
  orange: '#C2410C',
  orangeSoft: '#FFEDD5',
  green: '#15803D',
  greenSoft: '#DCFCE7',
  bg: '#F8FAF5',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#6B7280',
  textLight: '#9CA3AF',
  border: '#E5E7EB',
} as const;

export type ColorKey = keyof typeof COLORS;

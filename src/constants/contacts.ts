// Sawt Atlas Urgence — Contacts d'urgence marocains (SAMU, pompiers, gendarmerie)
// Fichier créé le 2026-05-07

export const EMERGENCY_CONTACTS = {
  samu: '15',
  pompiers: '15',
  gendarmerie: '177',
  policeSecours: '19',
  croissantRouge: '0537-65-45-25',
} as const;

export interface PersonalContact {
  name: string;
  phone: string;
  relation: string;
}

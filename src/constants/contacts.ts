// Sawt Atlas Urgence — Contacts d'urgence marocains + contacts locaux configurés à l'installation
// Fichier créé le 2026-05-07

export const EMERGENCY_CONTACTS = {
  samu: '15',
  protection_civile: '150',
  police: '19',
  gendarmerie: '177',
  anti_poison: '0537686464',
  // Configurés lors de l'installation par le relais de santé
  medecin_referent: '',
  relais_1: '',
  relais_2: '',
  hopital_gps: {
    lat: 0,
    lng: 0,
    name: '',
  },
} as const satisfies {
  samu: string;
  protection_civile: string;
  police: string;
  gendarmerie: string;
  anti_poison: string;
  medecin_referent: string;
  relais_1: string;
  relais_2: string;
  hopital_gps: { lat: number; lng: number; name: string };
};

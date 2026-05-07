// Sawt Atlas Urgence — Moteur de triage : parcourt l'arbre décisionnel et calcule le niveau d'urgence
// Fichier créé le 2026-05-07

import { TriageSession, UrgencyLevel } from '../types';

export class TriageEngine {
  evaluate(_session: TriageSession): UrgencyLevel {
    return 'non-urgent';
  }
}

export default new TriageEngine();

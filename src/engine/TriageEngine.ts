// Sawt Atlas Urgence — Moteur de triage : parcourt l'arbre AVPU+ABC+9 domaines et calcule le niveau d'urgence
// Fichier créé le 2026-05-07

import {
  TriageNode,
  TriageResult,
  UrgencyLevel,
  InterlocutorMode,
  PatientProfile,
} from '../types';
import { extractKeywords } from './KeywordExtractor';
import { CONFIDENCE_THRESHOLD } from '../constants/config';
import rawTree from './triage-tree.json';

// --- Types internes pour le JSON ---

interface ProfilingEntry {
  speak_darija_patient: string;
  speak_darija_companion: string;
  speak_fr: string;
  listen_for: Record<
    string,
    {
      keywords_darija: string[];
      keywords_fr: string[];
      keywords_arabe: string[];
      keywords_tamazight: string[];
    }
  >;
}

interface TriageTree {
  meta: { version: string; precaution_rules: string[] };
  greeting: { speak_darija: string; speak_fr: string };
  profiling_questions: Record<string, ProfilingEntry>;
  nodes: TriageNode[];
  closing_phrases: { red: string; orange: string; green: string };
}

// Règle des 9 de Wallace : pourcentage de surface corporelle par zone
const WALLACE_ZONES: Record<string, number> = {
  head: 9,
  neck: 1,
  chest_front: 9,
  chest_back: 9,
  abdomen_front: 9,
  abdomen_back: 9,
  arm_right: 9,
  arm_left: 9,
  thigh_right: 4.5,
  leg_right: 4.5,
  thigh_left: 4.5,
  leg_left: 4.5,
  genitals: 1,
};

export interface ProcessAnswerResult {
  extractedValue: string;
  confidence: number;
  nextNodeId?: string;
  result?: TriageResult;
  flag?: string;
}

export class TriageEngine {
  private tree: TriageTree;
  private nodeMap: Map<string, TriageNode>;

  constructor() {
    this.tree = rawTree as TriageTree;
    this.nodeMap = new Map(this.tree.nodes.map((n) => [n.id, n]));
  }

  // Retourne la phrase d'accueil en darija
  getGreeting(): string {
    return this.tree.greeting.speak_darija;
  }

  // Retourne la question de profilage adaptée au mode interlocuteur
  getProfilingQuestion(questionId: string, mode: InterlocutorMode = 'patient'): string {
    const entry = this.tree.profiling_questions[questionId];
    if (!entry) return '';
    return mode === 'companion' ? entry.speak_darija_companion : entry.speak_darija_patient;
  }

  // Retourne les options de réponse d'une question de profilage (pour le keyword extractor)
  getProfilingListenFor(questionId: string) {
    return this.tree.profiling_questions[questionId]?.listen_for ?? {};
  }

  // Retourne le nœud courant par son ID
  getCurrentNode(nodeId: string): TriageNode | undefined {
    return this.nodeMap.get(nodeId);
  }

  // Retourne le texte de la question selon le mode interlocuteur
  getQuestionText(node: TriageNode, mode: InterlocutorMode): string {
    return mode === 'companion' ? node.speak_darija_companion : node.speak_darija_patient;
  }

  /**
   * Traite la réponse vocale et retourne le résultat de routing.
   * Si la confiance est inférieure au seuil, force ORANGE par précaution.
   */
  processAnswer(nodeId: string, rawText: string): ProcessAnswerResult {
    const node = this.nodeMap.get(nodeId);
    if (!node) return { extractedValue: '', confidence: 0 };

    const { match, confidence } = extractKeywords(rawText, node.listen_for);

    // Confiance insuffisante → ORANGE par précaution (règle de sécurité)
    if (!match || confidence < CONFIDENCE_THRESHOLD) {
      return {
        extractedValue: match || '',
        confidence,
        result: this._lowConfidenceResult(),
      };
    }

    const entry = node.listen_for[match];

    return {
      extractedValue: match,
      confidence,
      nextNodeId: entry.next,
      result: entry.result as TriageResult | undefined,
      flag: entry.flag,
    };
  }

  /**
   * Retourne la liste ordonnée des nodeIds à parcourir selon le profil patient.
   * L'ordre reflète la priorité : AVPU → ABC → branches spécifiques → motif.
   */
  getRoutingForProfile(profile: PatientProfile): string[] {
    const base = ['avpu_alert', 'abc_airway', 'abc_breathing', 'abc_circulation'];

    // Branche pédiatrique prioritaire pour les enfants de moins de 5 ans
    if (profile.ageCategory === 'child') {
      base.push('ped_breathing', 'ped_dehydration', 'ped_fever', 'ped_foreign_body');
    }

    // Branche maternité pour les femmes enceintes
    if (profile.isPregnant) {
      base.push(
        'mat_contractions',
        'mat_bleeding',
        'mat_preeclampsia',
        'mat_convulsions',
        'mat_labor',
        'mat_fetal_movement'
      );
    }

    // Branches motif (toujours en dernier si aucun RED détecté avant)
    base.push(
      'motive_pain',
      'motive_chest',
      'motive_trauma',
      'motive_burn',
      'motive_fever',
      'motive_bite'
    );

    return base;
  }

  // Retourne la phrase de clôture selon le niveau d'urgence
  getClosingPhrase(level: UrgencyLevel): string {
    const key = level === 'RED' ? 'red' : level === 'ORANGE' ? 'orange' : 'green';
    return this.tree.closing_phrases[key];
  }

  // Vérifie si un résultat est RED
  isRedResult(result: TriageResult): boolean {
    return result.level === 'RED';
  }

  /**
   * Calcule le pourcentage de surface corporelle brûlée selon la règle des 9 de Wallace.
   * @param zones Liste des zones sélectionnées sur le body map
   */
  calculateBurnPercentage(zones: string[]): number {
    return zones.reduce((total, zone) => total + (WALLACE_ZONES[zone] ?? 0), 0);
  }

  // Résultat ORANGE retourné quand la confiance STT est insuffisante
  private _lowConfidenceResult(): TriageResult {
    return {
      level: 'ORANGE',
      label_fr: "Réponse non comprise — Classé ORANGE par précaution",
      label_darija: "ما فهمتك — مصنف برتقالي للسلامة",
      confidence: 0,
      instructions_fr: ["Consulter un médecin dès que possible", "En cas de doute appelez le 15"],
      instructions_darija: ["روحو للطبيب بسرعة", "إلا عندكم شك عيطو للـ 15"],
      speak_result_darija: "ما فهمتك مزيان. للسلامة ديالك، روحو للطبيب. إلا عندكم شك عيطو للـ 15.",
      alert_samu: false,
      sms_template: null,
    };
  }
}

export default new TriageEngine();

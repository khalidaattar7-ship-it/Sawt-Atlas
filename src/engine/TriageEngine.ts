import {
  TriageNodeV2,
  TriageButton,
  RuntimeProfile,
  InterlocutorMode,
  UrgencyLevel,
} from '../types';
import rawTree from './triage-tree.json';

interface TriageTreeV2 {
  meta: { version: string; protocol: string };
  greeting: { speak_darija: string };
  nodes: TriageNodeV2[];
  closing_phrases: { red: string; orange: string; green: string; disclaimer: string };
}

const WALLACE_ZONES: Record<string, number> = {
  head: 9, neck: 1,
  chest_front: 9, chest_back: 9,
  abdomen_front: 9, abdomen_back: 9,
  arm_right: 9, arm_left: 9,
  thigh_right: 4.5, leg_right: 4.5,
  thigh_left: 4.5, leg_left: 4.5,
  genitals: 1,
};

export class TriageEngine {
  private tree: TriageTreeV2;
  private nodeMap: Map<string, TriageNodeV2>;

  constructor() {
    this.tree = rawTree as unknown as TriageTreeV2;
    this.nodeMap = new Map(this.tree.nodes.map((n) => [n.id, n]));
  }

  getGreeting(): string {
    return this.tree.greeting.speak_darija;
  }

  getNode(id: string): TriageNodeV2 | undefined {
    return this.nodeMap.get(id);
  }

  getQuestionText(node: TriageNodeV2, mode: InterlocutorMode): string {
    return mode === 'companion'
      ? node.question_darija_companion
      : node.question_darija_patient;
  }

  /**
   * Returns the next node ID after the user answers a question.
   *
   * Conditional routing rules (applied in order):
   *  R1  male or child          → skip Q2c (pregnant) and Q2d (months) → phase3a
   *  R2  ageCategory = child    → __ABC_DONE__ → phase9_child_breathing (skip adult branches)
   *  R3  AVPU = unresponsive    → _red_skip is set before this call; handled by R11
   *  R4  Q6c bleeding = no      → already in JSON: next = __ABC_DONE__
   *  R5-9 phase7 complaint      → already in JSON: direct branch routing
   *  R10 female + pregnant      → __END__ → phase8g_contractions (maternity added after branch)
   *  R11 RED already detected   → __ABC_DONE__ → __FINISH__ (skip motif + branches)
   *                             → __END__       → __FINISH__ (skip extra branches / maternity)
   */
  getNextNodeId(nodeId: string, answerValue: string, session: RuntimeProfile): string {
    const node = this.nodeMap.get(nodeId);
    if (!node) return '__FINISH__';

    const button = node.buttons.find((b) => b.value === answerValue);
    if (!button) return '__FINISH__';

    let next = button.next;

    if (next === '__ABC_DONE__') {
      // R11 + R3: RED already detected (includes AVPU=U) → ABC was the report questions → finish
      if (session._red_skip) {
        next = '__FINISH__';
      } else {
        // R2: child → pediatric protocol; adult/elderly → complaint motif
        next = session.ageCategory === 'child' ? 'phase9_child_breathing' : 'phase7_complaint';
      }
    } else if (next === '__END__') {
      if (session._red_skip) {
        // R11: RED detected → no extra branches (maternity etc.), go straight to result
        next = '__FINISH__';
      } else if (
        session.isPregnant &&
        session.sex === 'female' &&   // R1: guard — males never reach maternity
        !session._maternity_done &&
        session.ageCategory !== 'child'
      ) {
        // R10: pregnant female → always append maternity branch after main branch
        next = 'phase8g_contractions';
      } else {
        next = '__FINISH__';
      }
    }

    // R1: male or child → skip pregnancy profiling nodes entirely
    if (
      (next === 'phase2c_pregnant' || next === 'phase2d_months') &&
      (session.sex !== 'female' || session.ageCategory === 'child')
    ) {
      next = 'phase3a_diabetes';
    }

    return next;
  }

  /**
   * Resolves a raw sentinel string using current session.
   * Use this when navigating after a burn (no button to resolve from).
   */
  resolveSentinel(sentinel: string, session: RuntimeProfile): string {
    if (sentinel === '__END__') {
      if (session._red_skip) return '__FINISH__';
      if (
        session.isPregnant &&
        session.sex === 'female' &&
        !session._maternity_done &&
        session.ageCategory !== 'child'
      ) {
        return 'phase8g_contractions';
      }
      return '__FINISH__';
    }
    if (sentinel === '__ABC_DONE__') {
      if (session._red_skip) return '__FINISH__';
      return session.ageCategory === 'child' ? 'phase9_child_breathing' : 'phase7_complaint';
    }
    return sentinel;
  }

  updateProfile(profile: RuntimeProfile, node: TriageNodeV2, buttonValue: string): RuntimeProfile {
    const key = node.profile_key;
    if (!key) return profile;

    const next = { ...profile };

    switch (key) {
      case 'interlocutorMode':
        next.interlocutorMode = buttonValue as InterlocutorMode;
        break;
      case 'sex':
        next.sex = buttonValue as 'male' | 'female';
        break;
      case 'ageCategory':
        next.ageCategory = buttonValue as 'child' | 'adult' | 'elderly';
        break;
      case 'avpuLevel':
        next.avpuLevel = buttonValue as 'alert' | 'voice' | 'unresponsive';
        break;
      case 'isPregnant':
        next.isPregnant = buttonValue === 'yes';
        break;
      case 'pregnancyMonths':
        next.pregnancyMonths = buttonValue as 'trimester1' | 'trimester2' | 'trimester3';
        break;
      case 'diabetes':
        next.diabetes = buttonValue === 'yes';
        break;
      case 'hypertension':
        next.hypertension = buttonValue === 'yes';
        break;
      case 'cardiac':
        next.cardiac = buttonValue === 'yes';
        break;
      case 'bloodThinner':
        next.bloodThinner = buttonValue === 'yes';
        break;
      case 'allergies':
        next.allergies = buttonValue === 'yes';
        break;
      case 'isRecurrent':
        next.isRecurrent = buttonValue === 'yes';
        break;
    }

    return next;
  }

  matchSTTToButton(input: string, buttons: TriageButton[]): TriageButton | null {
    if (!input.trim()) return null;
    const normalized = input.trim().toLowerCase();
    for (const btn of buttons) {
      if (!btn.keywords_darija) continue;
      for (const kw of btn.keywords_darija) {
        if (normalized.includes(kw.toLowerCase())) return btn;
      }
    }
    return null;
  }

  getClosingPhrase(level: UrgencyLevel): string {
    const key = level === 'RED' ? 'red' : level === 'ORANGE' ? 'orange' : 'green';
    return this.tree.closing_phrases[key];
  }

  getDisclaimer(): string {
    return this.tree.closing_phrases.disclaimer;
  }

  calculateBurnPercentage(zones: string[]): number {
    return zones.reduce((total, zone) => total + (WALLACE_ZONES[zone] ?? 0), 0);
  }
}

export default new TriageEngine();

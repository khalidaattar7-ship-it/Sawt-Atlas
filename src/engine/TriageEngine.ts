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
   * Resolves the next node ID from a button's `next` field.
   * Handles sentinels: __ABC_DONE__, __END__.
   * __BODY_MAP__ and __FINISH__ are returned as-is for the screen to handle.
   */
  getNextNodeId(nodeId: string, buttonValue: string, profile: RuntimeProfile): string {
    const node = this.nodeMap.get(nodeId);
    if (!node) return '__FINISH__';

    const button = node.buttons.find((b) => b.value === buttonValue);
    if (!button) return '__FINISH__';

    let next = button.next;

    if (next === '__ABC_DONE__') {
      next = profile.ageCategory === 'child' ? 'phase9_child_breathing' : 'phase7_complaint';
    } else if (next === '__END__') {
      if (profile.isPregnant && !profile._maternity_done && profile.ageCategory !== 'child') {
        next = 'phase8g_contractions';
      } else {
        next = '__FINISH__';
      }
    }

    // Skip pregnancy node for males or children (profile updated before this call)
    if (
      next === 'phase2c_pregnant' &&
      (profile.sex !== 'female' || profile.ageCategory === 'child')
    ) {
      next = 'phase3a_diabetes';
    }

    return next;
  }

  /**
   * Resolves a raw sentinel string using current profile.
   * Use this when navigating after a burn (no button to resolve from).
   */
  resolveSentinel(sentinel: string, profile: RuntimeProfile): string {
    if (sentinel === '__END__') {
      if (profile.isPregnant && !profile._maternity_done && profile.ageCategory !== 'child') {
        return 'phase8g_contractions';
      }
      return '__FINISH__';
    }
    if (sentinel === '__ABC_DONE__') {
      return profile.ageCategory === 'child' ? 'phase9_child_breathing' : 'phase7_complaint';
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

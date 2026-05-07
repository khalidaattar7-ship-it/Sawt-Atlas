// Sawt Atlas Urgence — Détecteur de silence : escalade automatique RED après 40s sans réponse vocale
// Fichier créé le 2026-05-07

import {
  SILENCE_WARNING_1_MS,
  SILENCE_WARNING_2_MS,
  SILENCE_ESCALATION_MS,
} from '../constants/config';

interface SilenceConfig {
  warning1Ms: number;
  warning2Ms: number;
  escalationMs: number;
}

export class SilenceDetector {
  private config: SilenceConfig;
  private startTime: number | null = null;
  private warning1Timer: ReturnType<typeof setTimeout> | null = null;
  private warning2Timer: ReturnType<typeof setTimeout> | null = null;
  private escalationTimer: ReturnType<typeof setTimeout> | null = null;

  private _onWarning1: (() => void) | null = null;
  private _onWarning2: (() => void) | null = null;
  private _onEscalation: (() => void) | null = null;

  constructor(config: SilenceConfig = {
    warning1Ms: SILENCE_WARNING_1_MS,
    warning2Ms: SILENCE_WARNING_2_MS,
    escalationMs: SILENCE_ESCALATION_MS,
  }) {
    this.config = config;
  }

  /** Démarre les timers dès que le micro devient actif. */
  start(): void {
    this.clearTimers();
    this.startTime = Date.now();

    this.warning1Timer = setTimeout(() => {
      this._onWarning1?.();
    }, this.config.warning1Ms);

    this.warning2Timer = setTimeout(() => {
      this._onWarning2?.();
    }, this.config.warning2Ms);

    this.escalationTimer = setTimeout(() => {
      this._onEscalation?.();
    }, this.config.escalationMs);
  }

  /**
   * Remet les timers à zéro quand de l'audio est détecté.
   * Appelé par STTModule.onPartialResult pour chaque fragment vocal reçu.
   */
  reset(): void {
    if (this.startTime === null) return;
    this.start();
  }

  /** Arrête tous les timers (micro inactif ou session terminée). */
  stop(): void {
    this.clearTimers();
    this.startTime = null;
  }

  /** Retourne le nombre de millisecondes de silence depuis le dernier reset()/start(). */
  getElapsedSilence(): number {
    if (this.startTime === null) return 0;
    return Date.now() - this.startTime;
  }

  // --- Enregistrement des callbacks ---

  /** 15 secondes de silence → l'app dit "واش سمعتيني؟" */
  onWarning1(callback: () => void): void {
    this._onWarning1 = callback;
  }

  /** 30 secondes de silence → l'app insiste "عيط لي إلا سمعتيني!" */
  onWarning2(callback: () => void): void {
    this._onWarning2 = callback;
  }

  /**
   * 40 secondes de silence → escalade RED automatique + appel SAMU.
   * Le TriageScreen doit ensuite demander la raison si le patient reparle.
   */
  onEscalation(callback: () => void): void {
    this._onEscalation = callback;
  }

  private clearTimers(): void {
    if (this.warning1Timer) { clearTimeout(this.warning1Timer); this.warning1Timer = null; }
    if (this.warning2Timer) { clearTimeout(this.warning2Timer); this.warning2Timer = null; }
    if (this.escalationTimer) { clearTimeout(this.escalationTimer); this.escalationTimer = null; }
  }
}

export default new SilenceDetector();

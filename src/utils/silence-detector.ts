// Sawt Atlas Urgence — Détecteur de silence : arrête l'enregistrement après inactivité vocale
// Fichier créé le 2026-05-07

import { CONFIG } from '../constants/config';

export class SilenceDetector {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onSilence: () => void;

  constructor(onSilence: () => void) {
    this.onSilence = onSilence;
  }

  reset(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(this.onSilence, CONFIG.silenceThresholdMs);
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

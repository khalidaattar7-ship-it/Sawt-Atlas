// Sawt Atlas Urgence — Moniteur réseau : détecte le type de connectivité pour adapter le comportement offline
// Fichier créé le 2026-05-07

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

type NetInfoUnsubscribe = () => void;
import { NetworkState } from '../types';

type NetworkChangeCallback = (state: NetworkState) => void;

// Convertit l'état NetInfo en NetworkState typé
const toNetworkState = (info: NetInfoState): NetworkState => {
  if (!info.isConnected) return 'none';

  const type = info.type;

  if (type === 'wifi') return 'wifi';

  if (type === 'cellular') {
    const generation = (info.details as { cellularGeneration?: string } | null)?.cellularGeneration;
    if (generation === '2g') return 'gsm_2g';
    if (generation === '3g' || generation === '4g' || generation === '5g') return 'mobile_3g4g';
    // Génération inconnue mais connecté → on suppose au moins 2G
    return 'gsm_2g';
  }

  // Autres types (bluetooth, ethernet, vpn…) → traité comme données disponibles
  return 'mobile_3g4g';
};

export class NetworkMonitor {
  private currentState: NetworkState = 'none';
  private callbacks: NetworkChangeCallback[] = [];
  private unsubscribe: NetInfoUnsubscribe | null = null;

  /** Retourne l'état réseau courant sans déclencher une vérification réseau. */
  getCurrentState(): NetworkState {
    return this.currentState;
  }

  /**
   * Démarre la surveillance des changements réseau.
   * Effectue une vérification immédiate pour initialiser l'état.
   */
  startMonitoring(): void {
    if (this.unsubscribe) return; // Déjà actif

    // Vérification initiale synchrone
    NetInfo.fetch().then((info) => {
      this.currentState = toNetworkState(info);
    });

    this.unsubscribe = NetInfo.addEventListener((info) => {
      const newState = toNetworkState(info);
      if (newState !== this.currentState) {
        this.currentState = newState;
        this.callbacks.forEach((cb) => cb(newState));
      }
    });
  }

  /** Arrête la surveillance et libère les ressources. */
  stopMonitoring(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.callbacks = [];
  }

  /** Enregistre un callback appelé à chaque changement d'état réseau. */
  onNetworkChange(callback: NetworkChangeCallback): void {
    this.callbacks.push(callback);
  }

  /** True si au moins une connexion GSM 2G est disponible (permet l'envoi de SMS). */
  isGSMAvailable(): boolean {
    return this.currentState !== 'none';
  }

  /** True si une connexion 3G/4G ou WiFi est disponible (permet la synchronisation). */
  isDataAvailable(): boolean {
    return this.currentState === 'mobile_3g4g' || this.currentState === 'wifi';
  }
}

export default new NetworkMonitor();

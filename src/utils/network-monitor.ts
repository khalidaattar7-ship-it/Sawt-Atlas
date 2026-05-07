// Sawt Atlas Urgence — Moniteur réseau : détecte la connectivité pour activer la synchronisation
// Fichier créé le 2026-05-07

export type NetworkStatus = 'online' | 'offline';

let currentStatus: NetworkStatus = 'offline';
const listeners: Array<(status: NetworkStatus) => void> = [];

export const getNetworkStatus = (): NetworkStatus => currentStatus;

export const onNetworkChange = (callback: (status: NetworkStatus) => void): (() => void) => {
  listeners.push(callback);
  return () => {
    const index = listeners.indexOf(callback);
    if (index !== -1) listeners.splice(index, 1);
  };
};

export const setNetworkStatus = (status: NetworkStatus): void => {
  currentStatus = status;
  listeners.forEach((cb) => cb(status));
};

// Sawt Atlas Urgence — Service d'appel téléphonique : ouvre le dialer Android vers le SAMU
// Fichier créé le 2026-05-07

// MVP : expo-linking ouvre le dialer (l'infirmier appuie sur le bouton vert)
// PRODUCTION : permission CALL_PHONE pour appel direct sans confirmation

import * as Linking from 'expo-linking';
import { TriageSession } from '../types';
import { EMERGENCY_CONTACTS } from '../constants/contacts';

/**
 * Ouvre le dialer Android avec le numéro 15 (SAMU).
 * Retourne true si l'URL tel: a pu être ouverte.
 * Le timestamp de l'appel est retourné pour être stocké dans la session.
 */
export const callSAMU = async (
  _session: TriageSession
): Promise<{ success: boolean; timestamp: number }> => {
  const url = `tel:${EMERGENCY_CONTACTS.samu}`;
  const timestamp = Date.now();

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) return { success: false, timestamp };

    await Linking.openURL(url);
    return { success: true, timestamp };
  } catch {
    return { success: false, timestamp };
  }
};

/**
 * Ouvre le dialer avec un numéro arbitraire (médecin référent, relais).
 */
export const callNumber = async (phoneNumber: string): Promise<boolean> => {
  const url = `tel:${phoneNumber}`;
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
};

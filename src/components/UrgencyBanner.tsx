// Sawt Atlas Urgence — Bannière colorée affichant le niveau d'urgence détecté
// Fichier créé le 2026-05-07

import React from 'react';
import { View } from 'react-native';

export type UrgencyLevel = 'extreme' | 'relative' | 'non-urgent';

interface UrgencyBannerProps {
  level?: UrgencyLevel;
}

const UrgencyBanner: React.FC<UrgencyBannerProps> = ({ level }) => {
  return <View />;
};

export default UrgencyBanner;

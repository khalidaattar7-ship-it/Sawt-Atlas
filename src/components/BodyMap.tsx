// Sawt Atlas Urgence — Carte du corps humain interactive pour localiser la douleur
// Fichier créé le 2026-05-07

import React from 'react';
import { View } from 'react-native';

interface BodyMapProps {
  onZoneSelect?: (zone: string) => void;
  selectedZones?: string[];
}

const BodyMap: React.FC<BodyMapProps> = ({ onZoneSelect, selectedZones = [] }) => {
  return <View />;
};

export default BodyMap;

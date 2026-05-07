// Sawt Atlas Urgence — Indicateur d'état réseau et GPS (offline/online)
// Fichier créé le 2026-05-07

import React from 'react';
import { View } from 'react-native';

interface StatusIndicatorProps {
  online?: boolean;
  gpsActive?: boolean;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ online = false, gpsActive = false }) => {
  return <View />;
};

export default StatusIndicator;

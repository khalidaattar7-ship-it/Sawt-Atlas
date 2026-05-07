// Sawt Atlas Urgence — Animation d'onde sonore affichée pendant la parole
// Fichier créé le 2026-05-07

import React from 'react';
import { View } from 'react-native';

interface SpeechWaveProps {
  active?: boolean;
}

const SpeechWave: React.FC<SpeechWaveProps> = ({ active = false }) => {
  return <View />;
};

export default SpeechWave;

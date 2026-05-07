// Sawt Atlas Urgence — Bouton microphone principal pour démarrer/arrêter l'enregistrement vocal
// Fichier créé le 2026-05-07

import React from 'react';
import { TouchableOpacity } from 'react-native';

interface MicButtonProps {
  onPress?: () => void;
  recording?: boolean;
}

const MicButton: React.FC<MicButtonProps> = ({ onPress, recording = false }) => {
  return (
    <TouchableOpacity onPress={onPress} />
  );
};

export default MicButton;

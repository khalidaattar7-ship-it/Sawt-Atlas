// Sawt Atlas Urgence — Écran de mode accompagnateur pour guider un proche en crise
// Fichier créé le 2026-05-07

import React from 'react';
import { View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Companion'>;

const CompanionScreen: React.FC<Props> = ({ navigation }) => {
  return <View />;
};

export default CompanionScreen;

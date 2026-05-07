// Sawt Atlas Urgence — Écran affichant le résultat du triage et les recommandations
// Fichier créé le 2026-05-07

import React from 'react';
import { View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;

const ResultScreen: React.FC<Props> = ({ navigation }) => {
  return <View />;
};

export default ResultScreen;

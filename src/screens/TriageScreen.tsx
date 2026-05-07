// Sawt Atlas Urgence — Écran de triage vocal guidé par questions AVPU+ABC
// Fichier créé le 2026-05-07

import React from 'react';
import { View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Triage'>;

const TriageScreen: React.FC<Props> = ({ navigation }) => {
  return <View />;
};

export default TriageScreen;

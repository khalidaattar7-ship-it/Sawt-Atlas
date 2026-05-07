// Sawt Atlas Urgence — Écran de génération et envoi du rapport médical PDF
// Fichier créé le 2026-05-07

import React from 'react';
import { View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Report'>;

const ReportScreen: React.FC<Props> = ({ navigation }) => {
  return <View />;
};

export default ReportScreen;

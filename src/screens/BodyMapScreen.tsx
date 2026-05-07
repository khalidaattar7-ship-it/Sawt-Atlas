// Sawt Atlas Urgence — Écran de sélection de la zone corporelle douloureuse
// Fichier créé le 2026-05-07

import React from 'react';
import { View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'BodyMap'>;

const BodyMapScreen: React.FC<Props> = ({ navigation }) => {
  return <View />;
};

export default BodyMapScreen;

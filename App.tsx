// Sawt Atlas Urgence — Point d'entrée principal avec React Navigation NativeStack
// Fichier créé le 2026-05-07

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootStackParamList } from './src/types';
import HomeScreen from './src/screens/HomeScreen';
import TriageScreen from './src/screens/TriageScreen';
import BodyMapScreen from './src/screens/BodyMapScreen';
import ResultScreen from './src/screens/ResultScreen';
import CompanionScreen from './src/screens/CompanionScreen';
import ReportScreen from './src/screens/ReportScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Triage" component={TriageScreen} />
          <Stack.Screen name="BodyMap" component={BodyMapScreen} />
          <Stack.Screen name="Result" component={ResultScreen} />
          <Stack.Screen name="Companion" component={CompanionScreen} />
          <Stack.Screen name="Report" component={ReportScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

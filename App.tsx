// Sawt Atlas Urgence — Point d'entrée principal avec React Navigation NativeStack
// Fichier créé le 2026-05-07

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import * as Location from 'expo-location';

import { RootStackParamList } from './src/types';
import { initDatabase } from './src/storage/database';
import { COLORS } from './src/constants/colors';
import HomeScreen from './src/screens/HomeScreen';
import TriageScreen from './src/screens/TriageScreen';
import BodyMapScreen from './src/screens/BodyMapScreen';
import ResultScreen from './src/screens/ResultScreen';
import CompanionScreen from './src/screens/CompanionScreen';
import ReportScreen from './src/screens/ReportScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

// ─── Permission types ─────────────────────────────────────────────────────────

type PermissionStatus = 'loading' | 'granted' | 'denied';

interface PermissionState {
  microphone: boolean;
  location: boolean;
}

// ─── Permission gate screen ───────────────────────────────────────────────────

const PermissionScreen: React.FC<{
  missing: string[];
  onRequest: () => void;
}> = ({ missing, onRequest }) => (
  <View style={permStyles.container}>
    <Text style={permStyles.icon}>🎙️</Text>
    <Text style={permStyles.title}>Permissions requises</Text>
    <Text style={permStyles.subtitle}>صوت الأطلس يحتاج إذن للعمل</Text>
    <View style={permStyles.list}>
      {missing.includes('microphone') && (
        <View style={permStyles.item}>
          <Text style={permStyles.itemIcon}>🎤</Text>
          <Text style={permStyles.itemText}>Microphone — للإستماع لصوتك</Text>
        </View>
      )}
      {missing.includes('location') && (
        <View style={permStyles.item}>
          <Text style={permStyles.itemIcon}>📍</Text>
          <Text style={permStyles.itemText}>Localisation — لإرسال الموقع للإسعاف</Text>
        </View>
      )}
    </View>
    <TouchableOpacity style={permStyles.btn} onPress={onRequest}>
      <Text style={permStyles.btnText}>أعطي الإذن — Autoriser</Text>
    </TouchableOpacity>
  </View>
);

// ─── Loading screen ───────────────────────────────────────────────────────────

const LoadingScreen: React.FC = () => (
  <View style={permStyles.container}>
    <ActivityIndicator size="large" color={COLORS.primary} />
    <Text style={permStyles.loadingText}>جاري التحضير...</Text>
  </View>
);

// ─── Main app ─────────────────────────────────────────────────────────────────

export default function App() {
  const [status, setStatus] = useState<PermissionStatus>('loading');
  const [permissions, setPermissions] = useState<PermissionState>({
    microphone: false,
    location: false,
  });

  const checkAndInit = async () => {
    setStatus('loading');

    // 1. Initialize SQLite database
    try {
      await initDatabase();
    } catch {
      // Non-blocking — app can still triage without DB
    }

    // 2. Request microphone permission (required for STT)
    let micGranted = false;
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      micGranted = granted;
    } catch {}

    // 3. Request location permission (for GPS in alerts — non-blocking)
    let locGranted = false;
    try {
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      locGranted = locStatus === 'granted';
    } catch {}

    const perms = { microphone: micGranted, location: locGranted };
    setPermissions(perms);

    // Microphone is the only hard requirement
    setStatus(micGranted ? 'granted' : 'denied');
  };

  useEffect(() => {
    checkAndInit();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'loading') {
    return (
      <SafeAreaProvider>
        <LoadingScreen />
      </SafeAreaProvider>
    );
  }

  const missingPerms: string[] = [];
  if (!permissions.microphone) missingPerms.push('microphone');
  if (!permissions.location) missingPerms.push('location');

  if (status === 'denied') {
    return (
      <SafeAreaProvider>
        <PermissionScreen missing={missingPerms} onRequest={checkAndInit} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
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

// ─── Styles for permission/loading screens ────────────────────────────────────

const permStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  icon: {
    fontSize: 64,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textMuted,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  list: {
    width: '100%',
    gap: 10,
    marginTop: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemIcon: {
    fontSize: 22,
  },
  itemText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  btn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    marginTop: 8,
    width: '100%',
    alignItems: 'center',
  },
  btnText: {
    color: COLORS.card,
    fontSize: 18,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textMuted,
    writingDirection: 'rtl',
  },
});

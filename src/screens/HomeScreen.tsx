// Sawt Atlas Urgence — Écran d'accueil : logo, bouton démarrage, stats, modal configuration
// Fichier créé le 2026-05-07

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Battery from 'expo-battery';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { COLORS } from '../constants/colors';
import { EMERGENCY_CONTACTS } from '../constants/contacts';
import { initDatabase } from '../storage/database';
import { useTriageStore } from '../store/triageStore';
import { RootStackParamList, PatientProfile } from '../types';
import networkMonitor from '../utils/network-monitor';
import { generateUUID } from '../utils/uuid';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

// ─── Icônes SVG inline ────────────────────────────────────────────────────────

const MicLogo = () => (
  <Svg width={52} height={52} viewBox="0 0 24 24" fill="none">
    <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill="#fff" />
    <Path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z" fill="#fff" />
  </Svg>
);

const PlayIcon = () => (
  <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
    <Path d="M8 5v14l11-7L8 5z" fill="#fff" />
  </Svg>
);

const GearIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path
      d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.07 7.07 0 0 0-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.37 1.04.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.57 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
      fill={COLORS.textMuted}
    />
  </Svg>
);

const BatteryIcon = ({ level }: { level: number }) => {
  const w = Math.round(level * 14);
  const color = level < 0.2 ? COLORS.red : level < 0.4 ? COLORS.orange : COLORS.green;
  return (
    <Svg width={24} height={12} viewBox="0 0 24 12">
      <Rect x={0} y={1} width={20} height={10} rx={2} stroke={COLORS.textLight} strokeWidth={1.5} fill="none" />
      <Rect x={20} y={4} width={3} height={4} rx={1} fill={COLORS.textLight} />
      <Rect x={1.5} y={2.5} width={w} height={7} rx={1} fill={color} />
    </Svg>
  );
};

// ─── Clés AsyncStorage ────────────────────────────────────────────────────────

const STORAGE_KEY = '@sawt_atlas_contacts';

interface ContactsConfig {
  medecin_referent: string;
  relais_1: string;
  relais_2: string;
  hopital_name: string;
  hopital_lat: string;
  hopital_lng: string;
}

const DEFAULT_CONFIG: ContactsConfig = {
  medecin_referent: EMERGENCY_CONTACTS.medecin_referent,
  relais_1: EMERGENCY_CONTACTS.relais_1,
  relais_2: EMERGENCY_CONTACTS.relais_2,
  hopital_name: EMERGENCY_CONTACTS.hopital_gps.name,
  hopital_lat: String(EMERGENCY_CONTACTS.hopital_gps.lat || ''),
  hopital_lng: String(EMERGENCY_CONTACTS.hopital_gps.lng || ''),
};

// ─── Profil patient vide pour nouvelle session ────────────────────────────────

const emptyProfile = (): PatientProfile => ({
  id: generateUUID(),
  sex: null,
  ageCategory: null,
  isPregnant: false,
  pregnancyMonths: null,
  knownConditions: {
    diabetes: false,
    hypertension: false,
    cardiac: false,
    bloodThinner: false,
    other: null,
  },
  allergies: null,
  isRecurrent: false,
  medicationPhoto: null,
});

// ─── Composant principal ─────────────────────────────────────────────────────

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const [time, setTime] = useState('');
  const [batteryLevel, setBatteryLevel] = useState(1);
  const [isOnline, setIsOnline] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contacts, setContacts] = useState<ContactsConfig>(DEFAULT_CONFIG);
  const [dbReady, setDbReady] = useState(false);

  const logoScale = useRef(new Animated.Value(0.8)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const statsOpacity = useRef(new Animated.Value(0)).current;

  const { startSession } = useTriageStore();

  // ─── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Animation d'entrée
    Animated.sequence([
      Animated.spring(logoScale, { toValue: 1, tension: 55, friction: 6, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(buttonOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(statsOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();

    // Horloge
    const tick = () => {
      const now = new Date();
      setTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    };
    tick();
    const clockInterval = setInterval(tick, 30000);

    // Batterie
    Battery.getBatteryLevelAsync().then((lvl) => setBatteryLevel(lvl)).catch(() => {});

    // Réseau
    networkMonitor.startMonitoring();
    setIsOnline(networkMonitor.isGSMAvailable());
    networkMonitor.onNetworkChange((state) => setIsOnline(state !== 'none'));

    // Base de données
    initDatabase()
      .then(() => setDbReady(true))
      .catch(() => setDbReady(true)); // continuer même si erreur

    // Chargement des contacts sauvegardés
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => { if (raw) setContacts(JSON.parse(raw)); })
      .catch(() => {});

    return () => {
      clearInterval(clockInterval);
      networkMonitor.stopMonitoring();
    };
  }, [logoScale, buttonOpacity, statsOpacity]);

  // ─── Démarrage de session ─────────────────────────────────────────────────

  const handleStart = useCallback(() => {
    if (!dbReady) return;
    const profile = emptyProfile();
    startSession('patient', profile);
    navigation.navigate('Triage');
  }, [dbReady, startSession, navigation]);

  // ─── Sauvegarde des contacts ──────────────────────────────────────────────

  const saveContacts = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
    setSettingsOpen(false);
  }, [contacts]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      {/* ── Barre de statut ──────────────────────────────────────── */}
      <View style={styles.statusBar}>
        <Text style={styles.timeText}>{time}</Text>

        {!isOnline && (
          <View style={styles.offlineBadge}>
            <Text style={styles.offlineText}>HORS LIGNE</Text>
          </View>
        )}

        <View style={styles.batteryRow}>
          <BatteryIcon level={batteryLevel} />
          <Text style={styles.batteryPct}>{Math.round(batteryLevel * 100)}%</Text>
        </View>
      </View>

      {/* ── Corps central ────────────────────────────────────────── */}
      <View style={styles.body}>

        {/* Logo */}
        <Animated.View style={[styles.logoBlock, { transform: [{ scale: logoScale }] }]}>
          <View style={styles.logoSquare}>
            <MicLogo />
          </View>
          <Text style={styles.appName}>Sawt Atlas Urgence</Text>
          <Text style={styles.appNameAr}>صوت الأطلس</Text>
        </Animated.View>

        {/* Bouton démarrage */}
        <Animated.View style={{ opacity: buttonOpacity, width: '100%', alignItems: 'center' }}>
          <TouchableOpacity
            style={[styles.startButton, !dbReady && styles.startButtonDisabled]}
            onPress={handleStart}
            activeOpacity={0.85}
          >
            <PlayIcon />
            <Text style={styles.startEmoji}>🏥</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Stats */}
        <Animated.View style={[styles.statsRow, { opacity: statsOpacity }]}>
          <StatCard top="100%" bottom="Offline" />
          <StatCard top="🗣️" bottom="Darija" />
          <StatCard top="< 2min" bottom="Triage" />
        </Animated.View>
      </View>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Aide à l'orientation uniquement</Text>
        <TouchableOpacity style={styles.gearButton} onPress={() => setSettingsOpen(true)}>
          <GearIcon />
        </TouchableOpacity>
      </View>

      {/* ── Modal configuration ───────────────────────────────────── */}
      <SettingsModal
        visible={settingsOpen}
        contacts={contacts}
        onChange={setContacts}
        onSave={saveContacts}
        onClose={() => setSettingsOpen(false)}
      />
    </View>
  );
};

// ─── StatCard ──────────────────────────────────────────────────────────────

const StatCard = ({ top, bottom }: { top: string; bottom: string }) => (
  <View style={styles.statCard}>
    <Text style={styles.statTop}>{top}</Text>
    <Text style={styles.statBottom}>{bottom}</Text>
  </View>
);

// ─── Modal de configuration des contacts ──────────────────────────────────

interface SettingsModalProps {
  visible: boolean;
  contacts: ContactsConfig;
  onChange: (c: ContactsConfig) => void;
  onSave: () => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  visible, contacts, onChange, onSave, onClose,
}) => {
  const field = (label: string, key: keyof ContactsConfig, placeholder: string) => (
    <View style={styles.fieldBlock} key={key}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={contacts[key]}
        onChangeText={(v) => onChange({ ...contacts, [key]: v })}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textLight}
        keyboardType={key.startsWith('hopital_l') ? 'decimal-pad' : 'phone-pad'}
        returnKeyType="next"
      />
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalSheet}
      >
        <View style={styles.modalHandle} />
        <Text style={styles.modalTitle}>⚙️  Contacts d'urgence</Text>
        <Text style={styles.modalSubtitle}>Configurés une fois lors de l'installation</Text>

        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {field('Médecin référent', 'medecin_referent', 'Ex: 0661234567')}
          {field('Relais communautaire 1', 'relais_1', 'Ex: 0612345678')}
          {field('Relais communautaire 2', 'relais_2', 'Ex: 0623456789')}
          {field("Nom de l'hôpital", 'hopital_name', 'Ex: Centre de santé Ait Benhaddou')}
          {field('GPS — Latitude', 'hopital_lat', 'Ex: 31.12345')}
          {field('GPS — Longitude', 'hopital_lng', 'Ex: -7.98765')}
        </ScrollView>

        <TouchableOpacity style={styles.saveButton} onPress={onSave}>
          <Text style={styles.saveButtonText}>Enregistrer</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  // Barre de statut
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  timeText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    letterSpacing: 1,
    minWidth: 44,
  },
  offlineBadge: {
    backgroundColor: COLORS.redSoft,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  offlineText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.red,
    letterSpacing: 0.5,
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 44,
    justifyContent: 'flex-end',
  },
  batteryPct: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },

  // Corps
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 40,
  },

  // Logo
  logoBlock: {
    alignItems: 'center',
    gap: 12,
  },
  logoSquare: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  appName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.3,
  },
  appNameAr: {
    fontSize: 17,
    fontWeight: '500',
    color: COLORS.accent,
    letterSpacing: 0.5,
  },

  // Bouton démarrage
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 200,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    gap: 12,
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  startButtonDisabled: {
    opacity: 0.5,
  },
  startEmoji: {
    fontSize: 26,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  statCard: {
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 80,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  statTop: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  statBottom: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 11,
    color: COLORS.textLight,
    fontStyle: 'italic',
    flex: 1,
  },
  gearButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: COLORS.border,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 32,
    maxHeight: '85%',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 20,
  },
  fieldBlock: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: COLORS.bg,
  },
  saveButton: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default HomeScreen;

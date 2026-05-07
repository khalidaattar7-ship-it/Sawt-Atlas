// Sawt Atlas Urgence — Sélection interactive des zones brûlées (règle de Wallace)
// Fichier créé le 2026-05-07

import React, { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { speakWithCallback } from '../engine/TTSModule';
import BodyMap, { ZONE_PERCENTAGES } from '../components/BodyMap';
import { COLORS } from '../constants/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'BodyMap'>;

const BodyMapScreen: React.FC<Props> = ({ navigation }) => {
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const isMounted = useRef(true);

  const totalPercentage = selectedZones.reduce(
    (sum, z) => sum + (ZONE_PERCENTAGES[z] ?? 0),
    0
  );

  const urgencyColor =
    totalPercentage > 20 ? COLORS.red :
    totalPercentage >= 10 ? COLORS.orange :
    COLORS.green;

  const urgencyBg =
    totalPercentage > 20 ? COLORS.redSoft :
    totalPercentage >= 10 ? COLORS.orangeSoft :
    COLORS.primarySoft;

  useEffect(() => {
    isMounted.current = true;
    speakWithCallback(
      'ورّيني فين الحرقة. ضغط على البلاصة اللي محروقة ف الصورة.',
      () => {}
    );
    return () => { isMounted.current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleZoneToggle = (zoneId: string) => {
    setSelectedZones((prev) =>
      prev.includes(zoneId)
        ? prev.filter((z) => z !== zoneId)
        : [...prev, zoneId]
    );
  };

  const handleValidate = () => {
    navigation.navigate('Triage', {
      burnResult: { zones: selectedZones, percentage: totalPercentage },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* Percentage header */}
        <View style={[styles.percentageHeader, { backgroundColor: urgencyBg, borderColor: urgencyColor }]}>
          <Text style={[styles.percentageValue, { color: urgencyColor }]}>
            {totalPercentage.toFixed(0)}%
          </Text>
          <Text style={[styles.percentageLabel, { color: urgencyColor }]}>
            من الجسم محروق
          </Text>
        </View>

        {/* Interactive body map */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <BodyMap
            selectedZones={selectedZones}
            onZoneToggle={handleZoneToggle}
            totalPercentage={totalPercentage}
          />
          <Text style={styles.instruction}>
            ضغط على البلاصة اللي محروقة
          </Text>
        </ScrollView>

        {/* Validate button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.validateBtn,
              { backgroundColor: selectedZones.length === 0 ? COLORS.border : COLORS.green },
            ]}
            onPress={handleValidate}
            disabled={selectedZones.length === 0}
            accessibilityLabel="Valider les zones brûlées"
          >
            <Text style={[
              styles.validateText,
              { color: selectedZones.length === 0 ? COLORS.textMuted : COLORS.card },
            ]}>
              ✓  تأكيد
            </Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    flex: 1,
  },
  percentageHeader: {
    alignItems: 'center',
    paddingVertical: 16,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 2,
  },
  percentageValue: {
    fontSize: 64,
    fontWeight: '900',
    lineHeight: 70,
  },
  percentageLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
    writingDirection: 'rtl',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  instruction: {
    textAlign: 'center',
    fontSize: 16,
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: 4,
    writingDirection: 'rtl',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 8,
  },
  validateBtn: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  validateText: {
    fontSize: 22,
    fontWeight: '800',
  },
});

export default BodyMapScreen;

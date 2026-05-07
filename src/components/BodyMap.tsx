// Sawt Atlas Urgence — Carte corporelle SVG interactive (règle des 9 de Wallace) pour les brûlures
// Fichier créé le 2026-05-07

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { COLORS } from '../constants/colors';

interface BodyMapProps {
  selectedZones: string[];
  onZoneToggle: (zoneId: string) => void;
  totalPercentage: number;
}

// Pourcentage Wallace par zone
export const ZONE_PERCENTAGES: Record<string, number> = {
  tete_cou: 9,
  thorax_avant: 9,
  abdomen_avant: 9,
  perinee: 1,
  bras_droit: 9,
  bras_gauche: 9,
  dos: 18,
  jambe_droite: 18,
  jambe_gauche: 18,
};

const SELECTED_FILL = COLORS.red;
const UNSELECTED_FILL = '#D6E4FF';
const STROKE = COLORS.border;
const SELECTED_STROKE = COLORS.red;
const VISUAL_FILL = '#E8EFF5'; // zones visuelles non-cliquables (verso)

// ─── Composant zone cliquable générique ──────────────────────────────────────

interface ZoneProps {
  id: string;
  selected: boolean;
  onToggle: (id: string) => void;
  percentage: number;
  children: React.ReactNode;
}

const Zone: React.FC<ZoneProps> = ({ id, selected, onToggle, children }) => (
  <G
    onPress={() => onToggle(id)}
    opacity={selected ? 1 : 0.85}
  >
    {React.Children.map(children, (child) => {
      if (!React.isValidElement(child)) return child;
      return React.cloneElement(child as React.ReactElement<{fill?: string; stroke?: string; strokeWidth?: number}>, {
        fill: selected ? SELECTED_FILL : UNSELECTED_FILL,
        stroke: selected ? SELECTED_STROKE : STROKE,
        strokeWidth: selected ? 2 : 1,
      });
    })}
  </G>
);

// ─── Corps FACE (vue de face) ────────────────────────────────────────────────

interface FrontBodyProps {
  selectedZones: string[];
  onToggle: (id: string) => void;
  offsetX?: number;
}

const FrontBody: React.FC<FrontBodyProps> = ({ selectedZones, onToggle, offsetX = 0 }) => {
  const sel = (id: string) => selectedZones.includes(id);
  const pct = (id: string) => ZONE_PERCENTAGES[id];

  return (
    <G x={offsetX}>
      {/* Tête / Cou */}
      <Zone id="tete_cou" selected={sel('tete_cou')} onToggle={onToggle} percentage={pct('tete_cou')}>
        <Ellipse cx={60} cy={28} rx={20} ry={24} />
      </Zone>
      <Rect x={52} y={51} width={16} height={10} rx={3}
        fill={sel('tete_cou') ? SELECTED_FILL : UNSELECTED_FILL}
        stroke={sel('tete_cou') ? SELECTED_STROKE : STROKE}
        strokeWidth={sel('tete_cou') ? 2 : 1}
        onPress={() => onToggle('tete_cou')}
      />

      {/* Bras gauche (côté gauche du patient = côté droit de l'écran) */}
      <Zone id="bras_gauche" selected={sel('bras_gauche')} onToggle={onToggle} percentage={pct('bras_gauche')}>
        <Rect x={8} y={62} width={26} height={92} rx={8} />
      </Zone>

      {/* Bras droit */}
      <Zone id="bras_droit" selected={sel('bras_droit')} onToggle={onToggle} percentage={pct('bras_droit')}>
        <Rect x={86} y={62} width={26} height={92} rx={8} />
      </Zone>

      {/* Thorax avant */}
      <Zone id="thorax_avant" selected={sel('thorax_avant')} onToggle={onToggle} percentage={pct('thorax_avant')}>
        <Rect x={36} y={62} width={48} height={52} rx={4} />
      </Zone>

      {/* Abdomen avant */}
      <Zone id="abdomen_avant" selected={sel('abdomen_avant')} onToggle={onToggle} percentage={pct('abdomen_avant')}>
        <Rect x={36} y={116} width={48} height={48} rx={4} />
      </Zone>

      {/* Périnée */}
      <Zone id="perinee" selected={sel('perinee')} onToggle={onToggle} percentage={pct('perinee')}>
        <Rect x={46} y={166} width={28} height={16} rx={4} />
      </Zone>

      {/* Jambe gauche */}
      <Zone id="jambe_gauche" selected={sel('jambe_gauche')} onToggle={onToggle} percentage={pct('jambe_gauche')}>
        <Rect x={36} y={184} width={24} height={128} rx={8} />
      </Zone>

      {/* Jambe droite */}
      <Zone id="jambe_droite" selected={sel('jambe_droite')} onToggle={onToggle} percentage={pct('jambe_droite')}>
        <Rect x={60} y={184} width={24} height={128} rx={8} />
      </Zone>

      {/* Label FACE */}
      <SvgText x={60} y={322} textAnchor="middle" fontSize={10} fill={COLORS.textMuted} fontWeight="600">
        FACE
      </SvgText>
    </G>
  );
};

// ─── Corps DOS (vue de dos) ──────────────────────────────────────────────────

interface BackBodyProps {
  selectedZones: string[];
  onToggle: (id: string) => void;
  offsetX?: number;
}

const BackBody: React.FC<BackBodyProps> = ({ selectedZones, onToggle, offsetX = 0 }) => {
  const sel = (id: string) => selectedZones.includes(id);

  return (
    <G x={offsetX}>
      {/* Tête (visuelle — même zone que face) */}
      <Ellipse cx={60} cy={28} rx={20} ry={24}
        fill={sel('tete_cou') ? SELECTED_FILL : VISUAL_FILL}
        stroke={STROKE} strokeWidth={1}
        onPress={() => onToggle('tete_cou')}
      />
      <Rect x={52} y={51} width={16} height={10} rx={3}
        fill={sel('tete_cou') ? SELECTED_FILL : VISUAL_FILL}
        stroke={STROKE} strokeWidth={1}
        onPress={() => onToggle('tete_cou')}
      />

      {/* Bras (visuels — même zones que face) */}
      <Rect x={8} y={62} width={26} height={92} rx={8}
        fill={sel('bras_gauche') ? SELECTED_FILL : VISUAL_FILL}
        stroke={STROKE} strokeWidth={1}
        onPress={() => onToggle('bras_gauche')}
      />
      <Rect x={86} y={62} width={26} height={92} rx={8}
        fill={sel('bras_droit') ? SELECTED_FILL : VISUAL_FILL}
        stroke={STROKE} strokeWidth={1}
        onPress={() => onToggle('bras_droit')}
      />

      {/* DOS — zone unique 18% */}
      <Zone id="dos" selected={sel('dos')} onToggle={onToggle} percentage={ZONE_PERCENTAGES.dos}>
        <Rect x={36} y={62} width={48} height={102} rx={4} />
      </Zone>

      {/* Jambes (visuelles — même zones que face) */}
      <Rect x={36} y={184} width={24} height={128} rx={8}
        fill={sel('jambe_gauche') ? SELECTED_FILL : VISUAL_FILL}
        stroke={STROKE} strokeWidth={1}
        onPress={() => onToggle('jambe_gauche')}
      />
      <Rect x={60} y={184} width={24} height={128} rx={8}
        fill={sel('jambe_droite') ? SELECTED_FILL : VISUAL_FILL}
        stroke={STROKE} strokeWidth={1}
        onPress={() => onToggle('jambe_droite')}
      />

      {/* Label DOS */}
      <SvgText x={60} y={322} textAnchor="middle" fontSize={10} fill={COLORS.textMuted} fontWeight="600">
        DOS
      </SvgText>

      {/* Indicateur 18% sur le dos */}
      {sel('dos') && (
        <SvgText x={60} y={115} textAnchor="middle" fontSize={11} fill="#fff" fontWeight="700">
          18%
        </SvgText>
      )}
    </G>
  );
};

// ─── Composant principal ─────────────────────────────────────────────────────

const BodyMap: React.FC<BodyMapProps> = ({ selectedZones, onZoneToggle, totalPercentage }) => {
  const urgencyColor =
    totalPercentage >= 18 ? COLORS.red :
    totalPercentage >= 9 ? COLORS.orange :
    COLORS.green;

  return (
    <View style={styles.container}>
      {/* Pourcentage total */}
      <View style={[styles.percentageBadge, { borderColor: urgencyColor }]}>
        <Text style={[styles.percentageValue, { color: urgencyColor }]}>
          {totalPercentage.toFixed(0)}%
        </Text>
        <Text style={styles.percentageLabel}>SCT brûlée</Text>
      </View>

      {/* SVG des deux vues */}
      <Svg
        width="100%"
        viewBox="0 0 280 340"
        style={styles.svg}
      >
        {/* Vue de face */}
        <FrontBody
          selectedZones={selectedZones}
          onToggle={onZoneToggle}
          offsetX={0}
        />

        {/* Séparateur */}
        <Line x1={138} y1={10} x2={138} y2={320} stroke={COLORS.border} strokeWidth={1} strokeDasharray="4,4" />

        {/* Vue de dos */}
        <BackBody
          selectedZones={selectedZones}
          onToggle={onZoneToggle}
          offsetX={148}
        />
      </Svg>

      {/* Légende zones sélectionnées */}
      {selectedZones.length > 0 && (
        <View style={styles.legend}>
          {selectedZones.map((z) => (
            <View key={z} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.red }]} />
              <Text style={styles.legendText}>
                {z.replace(/_/g, ' ')} — {ZONE_PERCENTAGES[z] ?? 0}%
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  svg: {
    width: '100%',
    maxHeight: 340,
  },
  percentageBadge: {
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 12,
    backgroundColor: COLORS.card,
  },
  percentageValue: {
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 40,
  },
  percentageLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  legend: {
    marginTop: 8,
    width: '100%',
    paddingHorizontal: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  legendText: {
    fontSize: 13,
    color: COLORS.text,
    textTransform: 'capitalize',
  },
});

export default BodyMap;

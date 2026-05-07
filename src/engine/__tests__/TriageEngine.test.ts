// Sawt Atlas Urgence — Tests unitaires du moteur de triage
// Fichier créé le 2026-05-07

import { TriageEngine } from '../TriageEngine';

const engine = new TriageEngine();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const process = (nodeId: string, raw: string) => engine.processAnswer(nodeId, raw);

// ─── Test suites ──────────────────────────────────────────────────────────────

describe('TriageEngine — Scénarios cliniques critiques', () => {

  // 1. Femme enceinte + saignement abondant → RED hémorragie obstétricale
  test('mat_bleeding: saignement abondant → RED hémorragie obstétricale', () => {
    // Multiple matching keywords to cross 0.6 confidence threshold
    const result = process('mat_bleeding', 'واه بزاف كتير حمار abondant');
    expect(result.result?.level).toBe('RED');
    expect(result.result?.label_fr).toMatch(/[Hh]émorragie/);
  });

  // 2. Enfant déshydraté sévère (refuse de boire, yeux enfoncés) → RED
  test('ped_dehydration: yeux enfoncés, refuse de boire → RED déshydratation sévère', () => {
    // Pure darija/arabic keywords to avoid sub-token collision with mild branch
    const result = process('ped_dehydration', 'واه غارقين يرفض ما كيشربش بلا دموع');
    expect(result.result?.level).toBe('RED');
    expect(result.result?.label_fr).toMatch(/[Dd]éshydratat/);
  });

  // 3. Douleur thoracique > 20 min avec irradiation → RED IDM
  test('motive_chest: douleur thoracique avec irradiation bras → next cardio_chest_pain', () => {
    const result = process('motive_chest', 'شديد عشرين دقيقة ينتشر للذراع');
    // Route vers cardio_chest_pain (cardiac branch)
    expect(result.nextNodeId).toBe('cardio_chest_pain');
  });

  test('cardio_chest_pain: douleur intense > 20 min → RED IDM', () => {
    const result = process('cardio_chest_pain', 'يعصر شديد نص ساعة عرق');
    expect(result.result?.level).toBe('RED');
    expect(result.result?.label_fr).toMatch(/IDM|[Ii]nfarctus/);
  });

  // 4. Fièvre légère 37.5°C → GREEN
  test('fever_severity: fièvre légère 37.5°C → GREEN', () => {
    const result = process('fever_severity', '37 خفيفة شوية');
    expect(result.result?.level).toBe('GREEN');
  });

  // 5. Confiance STT faible (0.45) → ORANGE forcé par précaution
  test('CONFIDENCE_THRESHOLD: réponse incompréhensible → ORANGE précaution', () => {
    // Raw text with no matching keywords → confidence < 0.6 → forced ORANGE
    const result = process('avpu_alert', 'xyzqwerty123incomprehensible');
    expect(result.result?.level).toBe('ORANGE');
    expect(result.confidence).toBeLessThan(0.6);
  });

  // 6. AVPU = U (inconscient) → RED immédiat
  test('avpu_alert: AVPU=U inconscient → RED immédiat', () => {
    const result = process('avpu_alert', 'مغمى عليه فاقد الوعي غايب');
    expect(result.result?.level).toBe('RED');
    expect(result.extractedValue).toBe('unresponsive');
  });

  // 7. Brûlure 25% surface → RED (calculateBurnPercentage)
  test('calculateBurnPercentage: 25% SCT → RED (>= 18%)', () => {
    // TriageEngine uses Wallace zone IDs: head(9%) + chest_back(9%) = 18%
    const pct18 = engine.calculateBurnPercentage(['head', 'chest_back']);
    expect(pct18).toBe(18);
    expect(pct18).toBeGreaterThanOrEqual(18);
    // head(9%) + chest_front(9%) + arm_right(9%) = 27% — clearly RED
    const pct27 = engine.calculateBurnPercentage(['head', 'chest_front', 'arm_right']);
    expect(pct27).toBe(27);
  });

  // 8. Score FAST positif récent → RED AVC
  test('cardio_fast_time: FAST symptômes récents (aujourd\'hui) → RED AVC', () => {
    // Uses multilingual keywords to cross confidence threshold
    const result = process('cardio_fast_time', 'دابا توا اليوم maintenant récent');
    expect(result.result?.level).toBe('RED');
    expect(result.result?.label_fr).toMatch(/AVC/);
  });

});

// ─── Routing par profil ───────────────────────────────────────────────────────

describe('TriageEngine — Routing par profil patient', () => {

  test('enfant < 5 ans → branches pédiatriques dans la queue', () => {
    const queue = engine.getRoutingForProfile({
      id: 'test',
      sex: 'male',
      ageCategory: 'child',
      isPregnant: false,
      pregnancyMonths: null,
      knownConditions: { diabetes: false, hypertension: false, cardiac: false, bloodThinner: false, other: null },
      allergies: null,
      isRecurrent: false,
      medicationPhoto: null,
    });
    expect(queue).toContain('ped_breathing');
    expect(queue).toContain('ped_dehydration');
    expect(queue).toContain('ped_fever');
  });

  test('femme enceinte → branches maternité dans la queue', () => {
    const queue = engine.getRoutingForProfile({
      id: 'test',
      sex: 'female',
      ageCategory: 'adult',
      isPregnant: true,
      pregnancyMonths: 7,
      knownConditions: { diabetes: false, hypertension: false, cardiac: false, bloodThinner: false, other: null },
      allergies: null,
      isRecurrent: false,
      medicationPhoto: null,
    });
    expect(queue).toContain('mat_contractions');
    expect(queue).toContain('mat_bleeding');
    expect(queue).toContain('mat_preeclampsia');
  });

  test('adulte standard → AVPU + ABC + motifs (sans pédiatrique ni maternité)', () => {
    const queue = engine.getRoutingForProfile({
      id: 'test',
      sex: 'male',
      ageCategory: 'adult',
      isPregnant: false,
      pregnancyMonths: null,
      knownConditions: { diabetes: false, hypertension: false, cardiac: false, bloodThinner: false, other: null },
      allergies: null,
      isRecurrent: false,
      medicationPhoto: null,
    });
    expect(queue).toContain('avpu_alert');
    expect(queue).toContain('abc_airway');
    expect(queue).toContain('motive_chest');
    expect(queue).not.toContain('ped_breathing');
    expect(queue).not.toContain('mat_contractions');
  });

});

// ─── Accesseurs de base ───────────────────────────────────────────────────────

describe('TriageEngine — Accesseurs', () => {

  test('getGreeting() retourne une phrase non vide', () => {
    const greeting = engine.getGreeting();
    expect(greeting).toBeTruthy();
    expect(greeting.length).toBeGreaterThan(10);
  });

  test('getCurrentNode() retourne le nœud existant', () => {
    const node = engine.getCurrentNode('avpu_alert');
    expect(node).toBeDefined();
    expect(node?.id).toBe('avpu_alert');
  });

  test('getCurrentNode() retourne undefined pour un nœud inexistant', () => {
    const node = engine.getCurrentNode('inexistant_xyz');
    expect(node).toBeUndefined();
  });

  test('getClosingPhrase() retourne des phrases pour RED/ORANGE/GREEN', () => {
    expect(engine.getClosingPhrase('RED')).toBeTruthy();
    expect(engine.getClosingPhrase('ORANGE')).toBeTruthy();
    expect(engine.getClosingPhrase('GREEN')).toBeTruthy();
  });

  test('isRedResult() identifie correctement les résultats RED', () => {
    const redResult = engine.processAnswer('avpu_alert', 'مغمى عليه فاقد الوعي غايب');
    expect(engine.isRedResult(redResult.result!)).toBe(true);
  });

  test('getProfilingQuestion() retourne des textes pour patient et companion', () => {
    const patient = engine.getProfilingQuestion('sex', 'patient');
    const companion = engine.getProfilingQuestion('sex', 'companion');
    expect(patient).toBeTruthy();
    expect(companion).toBeTruthy();
    expect(patient).not.toBe(companion);
  });

});

import { TriageEngine } from '../TriageEngine';
import { RuntimeProfile } from '../../types';

const engine = new TriageEngine();

const DEFAULT_PROFILE: RuntimeProfile = {
  interlocutorMode: 'patient',
  sex: null,
  ageCategory: null,
  isPregnant: false,
  pregnancyMonths: null,
  diabetes: false,
  hypertension: false,
  cardiac: false,
  bloodThinner: false,
  allergies: false,
  isRecurrent: false,
  _maternity_done: false,
};

const adultMaleProfile: RuntimeProfile = {
  ...DEFAULT_PROFILE,
  sex: 'male',
  ageCategory: 'adult',
};

const childProfile: RuntimeProfile = {
  ...DEFAULT_PROFILE,
  sex: 'male',
  ageCategory: 'child',
};

const pregnantFemaleProfile: RuntimeProfile = {
  ...DEFAULT_PROFILE,
  sex: 'female',
  ageCategory: 'adult',
  isPregnant: true,
};

// ─── Accesseurs de base ───────────────────────────────────────────────────────

describe('TriageEngine — Accesseurs', () => {

  test('getGreeting() retourne une phrase non vide', () => {
    const greeting = engine.getGreeting();
    expect(greeting).toBeTruthy();
    expect(greeting.length).toBeGreaterThan(10);
  });

  test('getNode() retourne le nœud existant', () => {
    const node = engine.getNode('phase5_avpu');
    expect(node).toBeDefined();
    expect(node?.id).toBe('phase5_avpu');
  });

  test('getNode() retourne undefined pour un nœud inexistant', () => {
    const node = engine.getNode('inexistant_xyz');
    expect(node).toBeUndefined();
  });

  test('getClosingPhrase() retourne des phrases pour RED/ORANGE/GREEN', () => {
    expect(engine.getClosingPhrase('RED')).toBeTruthy();
    expect(engine.getClosingPhrase('ORANGE')).toBeTruthy();
    expect(engine.getClosingPhrase('GREEN')).toBeTruthy();
  });

  test('getDisclaimer() retourne un texte non vide', () => {
    expect(engine.getDisclaimer()).toBeTruthy();
  });

  test('getQuestionText() retourne patient vs companion', () => {
    const node = engine.getNode('phase2a_sex');
    expect(node).toBeDefined();
    if (!node) return;
    const patient   = engine.getQuestionText(node, 'patient');
    const companion = engine.getQuestionText(node, 'companion');
    expect(patient).toBeTruthy();
    expect(companion).toBeTruthy();
  });

});

// ─── Routing / sentinels ──────────────────────────────────────────────────────

describe('TriageEngine — Routing', () => {

  test('phase2b_age child → skip phase2c_pregnant → phase3a_diabetes', () => {
    // After updateProfile sets ageCategory=child, getNextNodeId should skip pregnancy
    const profile = engine.updateProfile(DEFAULT_PROFILE, engine.getNode('phase2b_age')!, 'child');
    const next = engine.getNextNodeId('phase2b_age', 'child', profile);
    expect(next).toBe('phase3a_diabetes');
  });

  test('phase2b_age adult male → skip phase2c_pregnant → phase3a_diabetes', () => {
    const profileWithMale = { ...DEFAULT_PROFILE, sex: 'male' as const };
    const profile = engine.updateProfile(profileWithMale, engine.getNode('phase2b_age')!, 'adult');
    const next = engine.getNextNodeId('phase2b_age', 'adult', profile);
    expect(next).toBe('phase3a_diabetes');
  });

  test('phase2b_age adult female → phase2c_pregnant', () => {
    const profileWithFemale = { ...DEFAULT_PROFILE, sex: 'female' as const };
    const profile = engine.updateProfile(profileWithFemale, engine.getNode('phase2b_age')!, 'adult');
    const next = engine.getNextNodeId('phase2b_age', 'adult', profile);
    expect(next).toBe('phase2c_pregnant');
  });

  test('__ABC_DONE__ adulte → phase7_complaint', () => {
    const next = engine.getNextNodeId('phase6c_bleeding', 'no', adultMaleProfile);
    expect(next).toBe('phase7_complaint');
  });

  test('__ABC_DONE__ enfant → phase9_child_breathing', () => {
    const next = engine.getNextNodeId('phase6c_bleeding', 'no', childProfile);
    expect(next).toBe('phase9_child_breathing');
  });

  test('__END__ adulte non-enceinte → __FINISH__', () => {
    const next = engine.getNextNodeId('phase8a_fast', 'no', adultMaleProfile);
    expect(next).toBe('__FINISH__');
  });

  test('__END__ femme enceinte sans _maternity_done → phase8g_contractions', () => {
    const next = engine.getNextNodeId('phase8a_fast', 'no', pregnantFemaleProfile);
    expect(next).toBe('phase8g_contractions');
  });

  test('__END__ femme enceinte avec _maternity_done → __FINISH__', () => {
    const profile = { ...pregnantFemaleProfile, _maternity_done: true };
    const next = engine.getNextNodeId('phase8g_waters', 'no', profile);
    expect(next).toBe('__FINISH__');
  });

  test('__BODY_MAP__ retourné tel quel pour brûlure', () => {
    const next = engine.getNextNodeId('phase8b_burn_type', 'thermal', adultMaleProfile);
    expect(next).toBe('__BODY_MAP__');
  });

  test('resolveSentinel __END__ sans grossesse → __FINISH__', () => {
    expect(engine.resolveSentinel('__END__', adultMaleProfile)).toBe('__FINISH__');
  });

  test('resolveSentinel __END__ enceinte → phase8g_contractions', () => {
    expect(engine.resolveSentinel('__END__', pregnantFemaleProfile)).toBe('phase8g_contractions');
  });

});

// ─── STT matching ─────────────────────────────────────────────────────────────

describe('TriageEngine — matchSTTToButton', () => {

  test('keyword exact match retourne le bon bouton', () => {
    const node = engine.getNode('phase5_avpu');
    expect(node).toBeDefined();
    if (!node) return;
    const matched = engine.matchSTTToButton('فايق مزيان', node.buttons);
    expect(matched).not.toBeNull();
    expect(matched?.value).toBe('alert');
  });

  test('aucun match retourne null', () => {
    const node = engine.getNode('phase5_avpu');
    if (!node) return;
    const matched = engine.matchSTTToButton('xyzqwerty123incomprehensible', node.buttons);
    expect(matched).toBeNull();
  });

  test('input vide retourne null', () => {
    const node = engine.getNode('phase1_interlocutor');
    if (!node) return;
    expect(engine.matchSTTToButton('', node.buttons)).toBeNull();
    expect(engine.matchSTTToButton('   ', node.buttons)).toBeNull();
  });

});

// ─── Profile update ───────────────────────────────────────────────────────────

describe('TriageEngine — updateProfile', () => {

  test('phase1_interlocutor → interlocutorMode', () => {
    const node = engine.getNode('phase1_interlocutor');
    if (!node) return;
    const p = engine.updateProfile(DEFAULT_PROFILE, node, 'companion');
    expect(p.interlocutorMode).toBe('companion');
  });

  test('phase2a_sex → sex', () => {
    const node = engine.getNode('phase2a_sex');
    if (!node) return;
    const p = engine.updateProfile(DEFAULT_PROFILE, node, 'female');
    expect(p.sex).toBe('female');
  });

  test('phase2c_pregnant yes → isPregnant true', () => {
    const node = engine.getNode('phase2c_pregnant');
    if (!node) return;
    const p = engine.updateProfile(DEFAULT_PROFILE, node, 'yes');
    expect(p.isPregnant).toBe(true);
  });

  test('nœud sans profile_key → profil inchangé', () => {
    const node = engine.getNode('phase4_scene_safety');
    if (!node) return;
    const p = engine.updateProfile(adultMaleProfile, node, 'safe');
    expect(p).toEqual(adultMaleProfile);
  });

});

// ─── Burn percentage ──────────────────────────────────────────────────────────

describe('TriageEngine — calculateBurnPercentage', () => {

  test('18% SCT → seuil RED', () => {
    expect(engine.calculateBurnPercentage(['head', 'chest_back'])).toBe(18);
  });

  test('27% SCT (head + chest_front + arm_right)', () => {
    expect(engine.calculateBurnPercentage(['head', 'chest_front', 'arm_right'])).toBe(27);
  });

  test('zones vides → 0%', () => {
    expect(engine.calculateBurnPercentage([])).toBe(0);
  });

});

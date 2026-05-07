// Sawt Atlas Urgence — Traductions en darija marocain (langue vocale principale de l'app)
// Fichier créé le 2026-05-07

export const darija = {
  welcome: 'مرحبا، أنا صوت الأطلس. واش كاين شي حاجة تبغي تقول؟',
  askPain: 'فين كيوجعك؟',
  askBreathing: 'واش كتقدر تتنفس مزيان؟',
  askConsciousness: 'واش راك واعي مزيان؟',
  urgencyExtreme: 'خطر كبير! خصنا نتصلو بالإسعاف دابا.',
  urgencyRelative: 'الحالة تحتاج عناية طبية قريبة.',
  urgencyNone: 'الحالة ماشي خطيرة. يمكن تتابع مع الطبيب.',
} as const;

export type DarijaKey = keyof typeof darija;

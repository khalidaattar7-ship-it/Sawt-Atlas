// Sawt Atlas Urgence — Traductions en arabe standard (langue secondaire)
// Fichier créé le 2026-05-07

export const arabic = {
  welcome: 'مرحباً، أنا صوت الأطلس. كيف يمكنني مساعدتك؟',
  askPain: 'أين تشعر بالألم؟',
  askBreathing: 'هل تستطيع التنفس بشكل طبيعي؟',
  askConsciousness: 'هل أنت في وعيك التام؟',
  urgencyExtreme: 'خطر شديد! يجب الاتصال بالإسعاف فوراً.',
  urgencyRelative: 'الحالة تستدعي الرعاية الطبية العاجلة.',
  urgencyNone: 'الحالة غير خطيرة. يُنصح بمراجعة الطبيب.',
} as const;

export type ArabicKey = keyof typeof arabic;

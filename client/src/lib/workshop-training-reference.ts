/**
 * Public-safe projection of a private, user-provided Workshop reference.
 * Raw P6/XER and Excel sources are intentionally excluded from this module.
 */
export const WORKSHOP_NO8_TRAINING_REFERENCE = {
  referenceKey: "WORKSHOP_NO8_P6_23_12",
  title: "Workshop NO8 — مرجع TIA مرفوع من المستخدم",
  sourceScope: "ملفات المستخدم الأصلية محفوظة خارج حزمة التطبيق وقاعدة البيانات؛ السجل المحفوظ يقتصر على metadata والبصمات والنتائج المشتقة.",
  baseline: { activities: 9, relationships: 9, wbs: 3, calendars: 1 },
  postTia: { activities: 13, relationships: 15, wbs: 3, calendars: 1 },
  localEngine: { baselineDurationDays: 80, postTiaDurationDays: 97, durationDeltaDays: 17 },
  excelDeclared: { asPlannedCompletion: "07 Aug 2021", completion: "24 Aug 2021", cumulativeImpactDays: 17 },
  status: "يلزم فحص يدوي داخل P6 23.12 قبل أي اعتماد مهني أو استيراد عكسي.",
} as const;

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
  calendarScope: "المستورد يراجع اسم التقويم ويحسب 8 ساعات كيوم عمل، لكنه لا يفك ترميز نمط تقويم P6 أو الاستثناءات تلقائياً.",
  manualP6Checks: [
    "استورد Baseline وPost-TIA كمشروعين منفصلين داخل نسخة P6 غير إنتاجية.",
    "راجع Project Calendars: أيام العمل، الساعات، والعطل أو الاستثناءات قبل تفسير تواريخ النهاية.",
    "نفّذ Schedule (F9) بإعدادات P6 الأصلية وسجل تاريخ النهاية والمسار الحرج والـfloat.",
    "طابق العدادات: 9/9/3 في Baseline و13/15/3 في Post-TIA، ثم راجع الأنشطة والعلاقات المضافة.",
    "دوّن أي فرق مع النتيجة المحلية (+17 يوم عمل) في Manifest أو محضر مراجعة؛ لا تُخفِ الفرق بتعديل البيانات.",
  ],
} as const;

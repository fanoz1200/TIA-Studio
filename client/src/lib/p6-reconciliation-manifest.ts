/**
 * P6 Reconciliation Manifest
 *
 * أثر تدقيقي محلي لمقارنة مدخلات TIA Studio ونتائج CPM بمصدر P6 أو مدقق مستقل.
 * لا يقرأ أو يكتب ملف XER، ولا يثبت تكافؤ Primavera من تلقاء نفسه.
 */
import type { CpmResult, Schedule, TiaResult } from "./cpm";
import type { XerImportSummary } from "./xer";

export type P6ReconciliationManifest = {
  schemaVersion: "1.0";
  purpose: "local-cpm-reconciliation";
  scopeNotice: string;
  inputFingerprint: string;
  schedule: {
    id: string;
    name: string;
    source: Schedule["source"] | "unknown";
    startDate: string;
    dataDate: string | null;
    calendar: {
      id: string;
      name: string;
      workingWeekdays: number[];
      holidays: string[];
      hoursPerDay: number | null;
    };
  };
  counts: {
    wbsNodes: number;
    activities: number;
    relationships: number;
    relationshipsByType: Record<"FS" | "SS" | "FF" | "SF", number>;
    resourceAssignments: number;
  };
  importIntegrity: {
    importer: "xer" | "p6-xml" | "manual-or-other";
    tablesFound: string[];
    activitiesRead: number | null;
    relationshipsRead: number | null;
    relationshipsSkipped: number;
    resourceAssignmentsRead: number | null;
    resourceAssignmentsSkipped: number;
    warnings: string[];
  };
  cpm: {
    projectDuration: number;
    completionDate: string;
    criticalActivityCount: number;
    criticalActivityIds: string[];
    warnings: string[];
  };
  tia: {
    fragnetId: string;
    impactDays: number;
    baselineCompletionDate: string;
    impactedCompletionDate: string;
    outcome: TiaResult["outcome"];
  } | null;
  reconciliationState: "ready-for-comparison" | "review-required";
  reviewReasons: string[];
};

export type BuildP6ReconciliationManifestInput = {
  schedule: Schedule;
  cpm: CpmResult;
  xerSummary?: XerImportSummary | null;
  tia?: TiaResult | null;
};

function stableHash(value: string): string {
  // FNV-1a 32-bit: بصمة اتساق، لا آلية حماية أو توقيع تشفيري.
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function scheduleFingerprintPayload(schedule: Schedule): string {
  const activities = [...schedule.activities]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(activity => [activity.id, activity.duration, activity.wbsId ?? activity.wbs ?? "", activity.calendarId ?? "", activity.remainingDuration ?? "", activity.percentComplete ?? ""].join("|"));
  const relationships = [...schedule.relationships]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(relationship => [relationship.id, relationship.predecessorId, relationship.successorId, relationship.type, relationship.lag ?? 0].join("|"));
  const calendar = schedule.calendar;
  return [
    schedule.id,
    schedule.name,
    schedule.startDate,
    schedule.dataDate ?? "",
    calendar?.id ?? "",
    [...(calendar?.workingWeekdays ?? [])].sort((left, right) => left - right).join(","),
    [...(calendar?.holidays ?? [])].sort().join(","),
    activities.join(";"),
    relationships.join(";"),
  ].join("\n");
}

function uniqueSorted(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim())).map(value => value.trim()))).sort((left, right) => left.localeCompare(right));
}

/**
 * يبني أثر مقارنة قابل لإعادة الإنتاج من بيانات الجدول والنتيجة التي حسبها المحرك.
 * يجب مقارنة هذا الأثر مع P6 أو مدقق مستقل على الجهاز نفسه قبل أي وصف للتطابق.
 */
export function buildP6ReconciliationManifest({ schedule, cpm, xerSummary, tia = null }: BuildP6ReconciliationManifestInput): P6ReconciliationManifest {
  if (cpm.scheduleId !== schedule.id) {
    throw new Error("لا يمكن إنشاء ملف تحقق: نتيجة CPM لا ترتبط بالبرنامج المحدد.");
  }
  const expectedPreTiaId = tia ? `${schedule.id}--pre-tia--${tia.fragnetId}` : null;
  if (tia && (tia.baseline.scheduleId !== expectedPreTiaId || tia.baselineCompletionDate !== cpm.completionDate)) {
    throw new Error("لا يمكن إنشاء ملف تحقق: نتيجة TIA لا تستخدم خط الأساس الذي حُسب للبرنامج المحدد.");
  }

  const relationshipTypes: P6ReconciliationManifest["counts"]["relationshipsByType"] = { FS: 0, SS: 0, FF: 0, SF: 0 };
  schedule.relationships.forEach(relationship => {
    relationshipTypes[relationship.type] += 1;
  });

  const relationshipsSkipped = xerSummary?.relationshipsSkipped ?? 0;
  const resourceAssignmentsSkipped = xerSummary?.resourceAssignmentsSkipped ?? 0;
  const importWarnings = uniqueSorted([...(schedule.importNotes ?? []), ...(xerSummary?.warnings ?? [])]);
  const cpmWarnings = uniqueSorted(cpm.warnings);
  const reviewReasons = uniqueSorted([
    relationshipsSkipped > 0 ? `استُبعدت ${relationshipsSkipped} علاقة XER لعدم ارتباطها بنشاط مقروء.` : null,
    resourceAssignmentsSkipped > 0 ? `استُبعدت ${resourceAssignmentsSkipped} إسنادات موارد XER لعدم ارتباطها بنشاط مقروء.` : null,
    importWarnings.length > 0 ? "توجد تحذيرات استيراد يجب مراجعتها قبل المقارنة." : null,
    cpmWarnings.length > 0 ? "توجد تحذيرات من حساب CPM يجب مراجعتها قبل المقارنة." : null,
  ]);
  const calendar = cpm.calendar;

  return {
    schemaVersion: "1.0",
    purpose: "local-cpm-reconciliation",
    scopeNotice: "هذا ملف تحقق محلي لمدخلات TIA Studio ونتيجة CPM، ولا يثبت وحده تكافؤ Primavera P6 أو صلاحية التصدير. يلزم اختبار عكسي في P6 غير إنتاجي قبل الاعتماد.",
    inputFingerprint: stableHash(scheduleFingerprintPayload(schedule)),
    schedule: {
      id: schedule.id,
      name: schedule.name,
      source: schedule.source ?? "unknown",
      startDate: schedule.startDate,
      dataDate: schedule.dataDate ?? null,
      calendar: {
        id: calendar.id,
        name: calendar.name,
        workingWeekdays: [...calendar.workingWeekdays].sort((left, right) => left - right),
        holidays: [...calendar.holidays].sort(),
        hoursPerDay: calendar.hoursPerDay ?? null,
      },
    },
    counts: {
      wbsNodes: schedule.wbsNodes?.length ?? 0,
      activities: schedule.activities.length,
      relationships: schedule.relationships.length,
      relationshipsByType: relationshipTypes,
      resourceAssignments: schedule.resourceAssignments?.length ?? 0,
    },
    importIntegrity: {
      importer: schedule.source === "xer" ? "xer" : schedule.source === "p6-xml" ? "p6-xml" : "manual-or-other",
      tablesFound: [...(xerSummary?.tablesFound ?? [])].sort(),
      activitiesRead: xerSummary?.activitiesRead ?? null,
      relationshipsRead: xerSummary?.relationshipsRead ?? null,
      relationshipsSkipped,
      resourceAssignmentsRead: xerSummary?.resourceAssignmentsRead ?? null,
      resourceAssignmentsSkipped,
      warnings: importWarnings,
    },
    cpm: {
      projectDuration: cpm.projectDuration,
      completionDate: cpm.completionDate,
      criticalActivityCount: cpm.criticalActivityIds.length,
      criticalActivityIds: [...cpm.criticalActivityIds].sort(),
      warnings: cpmWarnings,
    },
    tia: tia ? {
      fragnetId: tia.fragnetId,
      impactDays: tia.impactDays,
      baselineCompletionDate: tia.baselineCompletionDate,
      impactedCompletionDate: tia.impactedCompletionDate,
      outcome: tia.outcome,
    } : null,
    reconciliationState: reviewReasons.length ? "review-required" : "ready-for-comparison",
    reviewReasons,
  };
}

export function serializeP6ReconciliationManifest(manifest: P6ReconciliationManifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

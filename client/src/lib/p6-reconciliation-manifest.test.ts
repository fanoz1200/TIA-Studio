import { describe, expect, it } from "vitest";
import { runCPM, runTIA, type Fragnet, type Schedule } from "./cpm";
import { buildP6ReconciliationManifest, serializeP6ReconciliationManifest } from "./p6-reconciliation-manifest";

const schedule: Schedule = {
  id: "p6-reconcile-1",
  name: "برنامج تحقق P6",
  startDate: "2026-01-05",
  dataDate: "2026-01-08",
  source: "xer",
  calendar: { id: "cal-5", name: "أسبوع عمل", workingWeekdays: [1, 2, 3, 4, 5], holidays: ["2026-01-12"], hoursPerDay: 8 },
  wbsNodes: [{ id: "wbs-1", code: "A", name: "الأعمال", path: "الأعمال" }],
  activities: [
    { id: "A100", name: "بدء", duration: 2, wbsId: "wbs-1" },
    { id: "A200", name: "إنهاء", duration: 3, wbsId: "wbs-1" },
  ],
  relationships: [{ id: "R100", predecessorId: "A100", successorId: "A200", type: "FS", lag: 1 }],
  resourceAssignments: [{ id: "RS-1", activityId: "A100", resourceType: "labor", source: "xer", targetCost: 100 }],
};

const fragnet: Fragnet = {
  id: "F-1",
  title: "تأخير اختبار",
  description: "اختبار أثر Fragnet",
  cause: "employer",
  occurrenceDate: "2026-01-08",
  activities: [{ id: "F-A", name: "حدث", duration: 2, kind: "fragnet" }],
  relationships: [
    { id: "F-R1", predecessorId: "A100", successorId: "F-A", type: "FS" },
    { id: "F-R2", predecessorId: "F-A", successorId: "A200", type: "FS" },
  ],
  replacedRelationshipIds: ["R100"],
};

describe("P6 reconciliation manifest", () => {
  it("ينشئ أثراً ثابتاً للمدخلات ونتيجة CPM ويطلب مراجعة عند استبعاد صفوف XER", () => {
    const cpm = runCPM(schedule);
    const manifest = buildP6ReconciliationManifest({
      schedule,
      cpm,
      xerSummary: {
        projectName: schedule.name,
        activitiesRead: 2,
        relationshipsRead: 1,
        relationshipsSkipped: 1,
        wbsRead: 1,
        resourcesRead: 1,
        resourceAssignmentsRead: 1,
        resourceAssignmentsSkipped: 2,
        assignmentsWithCosts: 1,
        activitiesWithProgress: 0,
        warnings: ["صف علاقة يتيم", "صف مورد يتيم"],
        tablesFound: ["TASK", "TASKPRED", "TASKRSRC"],
      },
    });

    expect(manifest.inputFingerprint).toMatch(/^fnv1a32-[0-9a-f]{8}$/);
    expect(manifest.counts).toMatchObject({ wbsNodes: 1, activities: 2, relationships: 1, resourceAssignments: 1, relationshipsByType: { FS: 1, SS: 0, FF: 0, SF: 0 } });
    expect(manifest.importIntegrity).toMatchObject({ relationshipsSkipped: 1, resourceAssignmentsSkipped: 2, importer: "xer" });
    expect(manifest.reconciliationState).toBe("review-required");
    expect(manifest.reviewReasons.join(" ")).toContain("استُبعدت 1 علاقة XER");
    expect(manifest.scopeNotice).toContain("لا يثبت وحده تكافؤ Primavera P6");
    expect(serializeP6ReconciliationManifest(manifest)).toContain('"schemaVersion": "1.0"');
  });

  it("يثبت مدخلات متطابقة ويضم أثر TIA من خط الأساس نفسه فقط", () => {
    const cpm = runCPM(schedule);
    const tia = runTIA(schedule, fragnet);
    const first = buildP6ReconciliationManifest({ schedule, cpm, tia });
    const second = buildP6ReconciliationManifest({ schedule, cpm, tia });

    expect(first.inputFingerprint).toBe(second.inputFingerprint);
    expect(first.tia).toMatchObject({ fragnetId: "F-1", impactDays: tia.impactDays, baselineCompletionDate: cpm.completionDate });
  });

  it("يرفض خلط نتيجة CPM من برنامج آخر", () => {
    const cpm = runCPM(schedule);
    expect(() => buildP6ReconciliationManifest({ schedule: { ...schedule, id: "other-project" }, cpm })).toThrow("نتيجة CPM لا ترتبط بالبرنامج المحدد");
  });
});

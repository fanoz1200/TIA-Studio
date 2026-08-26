import { describe, expect, it } from "vitest";
import type { TimeSliceSnapshot } from "@/lib/cpm";
import {
  assessUpdateToUpdateReadiness,
  buildUpdateToUpdateChangeRegister,
  createUpdateToUpdatePair,
  inspectUpdateToUpdatePair,
  projectCompletionTarget,
  runHalfZeroStepAnalysis,
} from "@/lib/update-to-update-analysis";

const previous: TimeSliceSnapshot = {
  id: "UP-01",
  label: "Update 01",
  fileName: "update-01.xer",
  schedule: {
    id: "project-01",
    name: "Project update 01",
    startDate: "2026-01-01",
    dataDate: "2026-01-31",
    calendar: { id: "cal", name: "Calendar", workingWeekdays: [1, 2, 3, 4, 5], holidays: ["2026-01-07"] },
    activities: [{ id: "A100", name: "Activity", duration: 10, constraintAudit: [{ slot: "primary", code: "CS_SNET", status: "supported", note: "Read" }] }],
    relationships: [],
  },
};

const current: TimeSliceSnapshot = {
  ...previous,
  id: "UP-02",
  label: "Update 02",
  fileName: "update-02.xer",
  schedule: { ...previous.schedule, dataDate: "2026-02-28" },
};

describe("عقد المقارنة بين تحديثين", () => {
  it("ينسخ اللقطات محلياً ويحفظ Data Date الصريح للجاهزية", () => {
    const pair = createUpdateToUpdatePair({ previous, current });

    expect(pair.previous.declaredDataDate).toBe("2026-01-31");
    expect(pair.current.effectiveDate).toBe("2026-02-28");
    expect(pair.target).toEqual(projectCompletionTarget);
    expect(pair.previous.schedule).not.toBe(previous.schedule);
    expect(pair.previous.schedule.calendar).not.toBe(previous.schedule.calendar);
    expect(pair.previous.schedule.activities[0].constraintAudit).not.toBe(previous.schedule.activities[0].constraintAudit);

    pair.previous.schedule.calendar?.holidays.push("2026-01-08");
    pair.previous.schedule.activities[0].name = "Analytical copy";
    expect(previous.schedule.calendar?.holidays).toEqual(["2026-01-07"]);
    expect(previous.schedule.activities[0].name).toBe("Activity");
  });

  it("يرفض اختيار اللقطة نفسها مرتين بدلاً من إنتاج مقارنة وهمية", () => {
    expect(() => createUpdateToUpdatePair({ previous, current: previous })).toThrow("لقطتين مختلفتين");
  });
});

describe("بوابة جاهزية وسجل تغييرات Update-to-Update", () => {
  const reviewablePrevious: TimeSliceSnapshot = {
    id: "UP-10",
    label: "Update 10",
    fileName: "update-10.xer",
    schedule: {
      id: "project-ready",
      name: "Reviewable update 10",
      startDate: "2026-01-01",
      dataDate: "2026-01-31",
      calendar: { id: "cal", name: "Calendar", workingWeekdays: [1, 2, 3, 4, 5], holidays: [] },
      activities: [
        { id: "A100", name: "Design", duration: 10, percentComplete: 20, actualStart: "2026-01-05", remainingDuration: 8 },
        { id: "A200", name: "Build", duration: 8, percentComplete: 0 },
      ],
      relationships: [{ id: "R1", predecessorId: "A100", successorId: "A200", type: "FS" }],
    },
  };

  const reviewableCurrent: TimeSliceSnapshot = {
    ...reviewablePrevious,
    id: "UP-11",
    label: "Update 11",
    fileName: "update-11.xer",
    schedule: {
      ...reviewablePrevious.schedule,
      dataDate: "2026-02-28",
      activities: [
        { ...reviewablePrevious.schedule.activities[0], percentComplete: 70 },
        { ...reviewablePrevious.schedule.activities[1] },
      ],
    },
  };

  it("يمر زوجاً مرتباً بتقدم مسجل ويعزل فرق التقدم عن تعديلات البرنامج", () => {
    const pair = createUpdateToUpdatePair({ previous: reviewablePrevious, current: reviewableCurrent });
    const inspection = inspectUpdateToUpdatePair(pair);

    expect(inspection.readiness.status).toBe("ready");
    expect(inspection.readiness.checks.find((check) => check.code === "data-date-order")?.status).toBe("pass");
    expect(inspection.changeRegister.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "progress", classification: "progress", activityId: "A100" }),
    ]));
    expect(inspection.changeRegister.counts).toMatchObject({ progress: 1, blocker: 0 });
  });

  it("يحجب Half–Zero عند Data Date مقلوب بدلاً من استخدام ترتيب واجهة مضلل", () => {
    const pair = createUpdateToUpdatePair({
      previous: reviewablePrevious,
      current: { ...reviewableCurrent, schedule: { ...reviewableCurrent.schedule, dataDate: "2026-01-15" } },
    });

    const report = assessUpdateToUpdateReadiness(pair);
    expect(report.status).toBe("blocked");
    expect(report.checks.find((check) => check.code === "data-date-order")?.status).toBe("blocked");
  });

  it("لا يصنف المدة المتبقية أو تغييرات المدة تلقائياً كتقدم أو مسؤولية", () => {
    const pair = createUpdateToUpdatePair({
      previous: {
        ...reviewablePrevious,
        schedule: {
          ...reviewablePrevious.schedule,
          activities: [{ ...reviewablePrevious.schedule.activities[0], remainingDuration: 8 }, reviewablePrevious.schedule.activities[1]],
        },
      },
      current: {
        ...reviewableCurrent,
        schedule: {
          ...reviewableCurrent.schedule,
          activities: [{ ...reviewableCurrent.schedule.activities[0], duration: 12, remainingDuration: 5 }, reviewableCurrent.schedule.activities[1]],
        },
      },
    });

    const register = buildUpdateToUpdateChangeRegister(pair);
    expect(register.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "remaining-duration", classification: "needs-analyst-review" }),
      expect.objectContaining({ category: "duration", classification: "needs-analyst-review" }),
    ]));
    expect(assessUpdateToUpdateReadiness(pair).status).toBe("ready-with-review");
  });

  it("يُظهر منطق/تقويم/قيود البرنامج كتغييرات مراجعة منفصلة", () => {
    const pair = createUpdateToUpdatePair({
      previous: reviewablePrevious,
      current: {
        ...reviewableCurrent,
        schedule: {
          ...reviewableCurrent.schedule,
          calendar: { ...reviewableCurrent.schedule.calendar!, holidays: ["2026-02-22"] },
          activities: [
            {
              ...reviewableCurrent.schedule.activities[0],
              calendarId: "cal-activity-02",
              constraint: { type: "start-on-or-after", date: "2026-02-10", sourceCode: "CS_SNET" },
            },
            reviewableCurrent.schedule.activities[1],
          ],
          relationships: [{ id: "R1", predecessorId: "A100", successorId: "A200", type: "FS", lag: 2 }],
        },
      },
    });

    const register = buildUpdateToUpdateChangeRegister(pair);
    expect(register.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "logic", classification: "revision" }),
      expect.objectContaining({ category: "calendar", classification: "revision" }),
      expect.objectContaining({ category: "constraint", classification: "revision" }),
    ]));
  });

  it("يحجب الحساب عند نشاط مضاف أو محذوف بلا خريطة هوية معلنة", () => {
    const pair = createUpdateToUpdatePair({
      previous: reviewablePrevious,
      current: {
        ...reviewableCurrent,
        schedule: {
          ...reviewableCurrent.schedule,
          activities: [reviewableCurrent.schedule.activities[0], { id: "A300", name: "Added package", duration: 3, percentComplete: 0 }],
        },
      },
    });

    const inspection = inspectUpdateToUpdatePair(pair);
    expect(inspection.changeRegister.unpairedPreviousActivityIds).toEqual(["A200"]);
    expect(inspection.changeRegister.unpairedCurrentActivityIds).toEqual(["A300"]);
    expect(inspection.changeRegister.counts.blocker).toBe(2);
    expect(inspection.readiness.status).toBe("blocked");
    expect(inspection.readiness.checks.find((check) => check.code === "scope-and-activity-identity")?.status).toBe("blocked");
  });
});

describe("محرك حالات Half–Zero Step", () => {
  const previous: TimeSliceSnapshot = {
    id: "UP-20",
    label: "Update 20",
    fileName: "update-20.xer",
    schedule: {
      id: "half-zero-project",
      name: "Half Zero 20",
      startDate: "2026-01-01",
      dataDate: "2026-01-31",
      calendar: { id: "cal", name: "Calendar", workingWeekdays: [1, 2, 3, 4, 5], holidays: [] },
      activities: [
        { id: "A100", name: "Package A", duration: 10, percentComplete: 20, actualStart: "2026-01-05", remainingDuration: 8 },
        { id: "A200", name: "Package B", duration: 5, percentComplete: 0 },
      ],
      relationships: [{ id: "R1", predecessorId: "A100", successorId: "A200", type: "FS" }],
    },
  };

  const current: TimeSliceSnapshot = {
    ...previous,
    id: "UP-21",
    label: "Update 21",
    fileName: "update-21.xer",
    schedule: {
      ...previous.schedule,
      dataDate: "2026-02-28",
      activities: [
        { ...previous.schedule.activities[0], percentComplete: 70, remainingDuration: 3 },
        { ...previous.schedule.activities[1], duration: 9 },
      ],
    },
  };

  it("يبني A/H/Z/B من نسخ مستقلة ولا يعرض توزيعاً قبل تصنيف المدد المتغيرة", () => {
    const pair = createUpdateToUpdatePair({ previous, current });
    const analysis = runHalfZeroStepAnalysis(pair);

    expect(analysis.status).toBe("blocked");
    expect(analysis.unresolvedChangeKeys).toEqual(expect.arrayContaining(["A100:remaining-duration", "A200:duration"]));
    expect(analysis.states).toBeUndefined();
    expect(analysis.blockingReasons.map((reason) => reason.en).join(" ")).toContain("Unclassified");
  });

  it("يتصالح في المسارين بعد تصنيف محلل صريح ويكشف حساسية ترتيب المكونات عند وجودها", () => {
    const pair = createUpdateToUpdatePair({ previous, current });
    const analysis = runHalfZeroStepAnalysis(pair, {
      analystClassifications: {
        "A100:remaining-duration": "progress",
        "A200:duration": "revision",
      },
    });

    expect(analysis.status).toBe("review-ready");
    expect(analysis.states).toMatchObject({
      A: { planSource: "previous", progressSource: "previous" },
      H: { planSource: "previous", progressSource: "current" },
      Z: { planSource: "current", progressSource: "previous" },
      B: { planSource: "current", progressSource: "current" },
    });
    expect(analysis.states?.A.schedule).not.toBe(pair.previous.schedule);
    expect(analysis.states?.B.schedule).not.toBe(pair.current.schedule);
    expect(analysis.halfPath).toMatchObject({ firstComponent: "progress", secondComponent: "revision", balanced: true, residualDays: 0 });
    expect(analysis.zeroPath).toMatchObject({ firstComponent: "revision", secondComponent: "progress", balanced: true, residualDays: 0 });
    expect(analysis.halfPath?.netDays).toBe(analysis.zeroPath?.netDays);
    expect(analysis.sensitivity?.disclosure.en).toMatch(/order sensitivity|No allocation difference/);
  });

  it("يحجب تكوين الحالة عندما يكون نشاط جارٍ بلا Remaining Duration معلنة", () => {
    const pair = createUpdateToUpdatePair({
      previous: {
        ...previous,
        schedule: {
          ...previous.schedule,
          activities: [{ ...previous.schedule.activities[0], remainingDuration: undefined }, previous.schedule.activities[1]],
        },
      },
      current,
    });
    const analysis = runHalfZeroStepAnalysis(pair, {
      analystClassifications: { "A100:remaining-duration": "progress", "A200:duration": "revision" },
    });

    expect(analysis.status).toBe("blocked");
    expect(analysis.readiness.checks.find((check) => check.code === "remaining-duration-classification")?.status).toBe("blocked");
    expect(analysis.states).toBeUndefined();
  });
});

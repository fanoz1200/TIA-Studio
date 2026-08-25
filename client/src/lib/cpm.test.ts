import { describe, expect, it } from "vitest";
import { buildActivitySplitFragnet, buildMultiActivitySplitFragnet, calculateFinancialImpact, createTiaAnalyticalCopies, dateToRelativeDay, getFragnetDelayDuration, insertFragnet, resourceAssignmentsForEvent, runCPM, runTIA, type Fragnet, type Schedule } from "./cpm";

const baseSchedule: Schedule = {
  id: "baseline-01",
  name: "Baseline — Building Envelope",
  startDate: "2026-01-05",
  activities: [
    { id: "A100", name: "Mobilization", duration: 5 },
    { id: "A200", name: "Foundation works", duration: 8 },
    { id: "A300", name: "Structural frame", duration: 10 },
    { id: "A400", name: "Envelope", duration: 7 },
    { id: "B100", name: "Procure fixtures", duration: 5 },
    { id: "B200", name: "Install fixtures", duration: 5 },
  ],
  relationships: [
    { id: "R1", predecessorId: "A100", successorId: "A200", type: "FS" },
    { id: "R2", predecessorId: "A200", successorId: "A300", type: "FS" },
    { id: "R3", predecessorId: "A300", successorId: "A400", type: "FS" },
    { id: "R4", predecessorId: "B100", successorId: "B200", type: "FS" },
  ],
};

describe("CPM engine", () => {
  it("calculates early/late dates, project duration and float on a branched network", () => {
    const result = runCPM(baseSchedule);
    expect(result.projectDuration).toBe(30);
    expect(result.completionDate).toBe("2026-02-04");
    expect(result.criticalActivityIds).toEqual(["A100", "A200", "A300", "A400"]);
    expect(result.activities.find((activity) => activity.id === "B100")?.totalFloat).toBe(20);
    expect(result.activities.find((activity) => activity.id === "B200")?.freeFloat).toBe(20);
  });

  it("honours SS, FF and lag constraints", () => {
    const result = runCPM({
      id: "relations",
      name: "Relationship types",
      startDate: "2026-01-01",
      activities: [
        { id: "P", name: "Predecessor", duration: 5 },
        { id: "SS", name: "SS activity", duration: 4 },
        { id: "FF", name: "FF activity", duration: 2 },
      ],
      relationships: [
        { id: "SS-R", predecessorId: "P", successorId: "SS", type: "SS", lag: 2 },
        { id: "FF-R", predecessorId: "P", successorId: "FF", type: "FF", lag: 3 },
      ],
    });
    expect(result.activities.find((activity) => activity.id === "SS")?.earlyStart).toBe(2);
    expect(result.activities.find((activity) => activity.id === "FF")?.earlyStart).toBe(6);
    expect(result.projectDuration).toBe(8);
  });

  it("applies verified SNET and FNET lower-bound constraints using the selected schedule calendar", () => {
    const result = runCPM({
      id: "xer-lower-bound-constraints",
      name: "قيود XER السفلية",
      startDate: "2026-01-05",
      calendar: { id: "five-day", name: "خمسة أيام", workingWeekdays: [1, 2, 3, 4, 5], holidays: [], hoursPerDay: 8 },
      activities: [
        { id: "SNET", name: "قيد بدء", duration: 2, constraint: { type: "start-on-or-after", date: "2026-01-12", sourceCode: "CS_SNET" } },
        { id: "FNET", name: "قيد إتمام", duration: 2, constraint: { type: "finish-on-or-after", date: "2026-01-19", sourceCode: "CS_FNET" } },
      ],
      relationships: [],
    });

    expect(result.activities.find((activity) => activity.id === "SNET")).toMatchObject({ earlyStart: 5, earlyFinish: 7 });
    expect(result.activities.find((activity) => activity.id === "FNET")).toMatchObject({ earlyStart: 8, earlyFinish: 10 });
    expect(result.projectDuration).toBe(10);
    expect(result.warnings.join(" ")).toContain("قيد/قيود سفلية");
  });

  it("does not claim negative float or Primavera parity for unsupported imported constraint types", () => {
    const result = runCPM({
      id: "review-only-constraint",
      name: "قيد مراجعة فقط",
      startDate: "2026-01-05",
      activities: [{ id: "MFO", name: "Must Finish On", duration: 2, constraintAudit: [{ slot: "primary", code: "CS_MFO", date: "2026-01-06", status: "review-required", note: "لا يحسب محلياً" }] }],
      relationships: [],
    });

    expect(result.activities[0]?.totalFloat).toBe(0);
    expect(result.warnings.join(" ")).toContain("غير محسوبة محلياً");
  });

  it("preserves update metadata but warns that it is not a Primavera F9 reschedule", () => {
    const result = runCPM({
      id: "update-state-warning",
      name: "حالة تحديث محفوظة",
      startDate: "2026-01-05",
      activities: [{ id: "UPD", name: "نشاط محدّث", duration: 5, percentComplete: 40, remainingDuration: 3, actualStart: "2026-01-05" }],
      relationships: [],
    });

    expect(result.projectDuration).toBe(5);
    expect(result.warnings.join(" ")).toContain("لا يعيد جدولة تحديث P6");
  });

  it("rejects logical cycles instead of producing misleading dates", () => {
    expect(() =>
      runCPM({
        id: "cycle",
        name: "Cycle",
        startDate: "2026-01-01",
        activities: [
          { id: "A", name: "A", duration: 1 },
          { id: "B", name: "B", duration: 1 },
        ],
        relationships: [
          { id: "A-B", predecessorId: "A", successorId: "B", type: "FS" },
          { id: "B-A", predecessorId: "B", successorId: "A", type: "FS" },
        ],
      }),
    ).toThrow("حلقة منطقية");
  });
});

describe("Time Impact Analysis", () => {
  it("adds a correctly tied fragnet and returns its extension to completion", () => {
    const fragnet: Fragnet = {
      id: "F-001",
      title: "Late revised drawings",
      description: "Additional structural engineering review.",
      cause: "employer",
      occurrenceDate: "2026-01-18",
      activities: [{ id: "F100", name: "Review revised structural drawings", duration: 6 }],
      replacedRelationshipIds: ["R3"],
      relationships: [
        { id: "F-R1", predecessorId: "A300", successorId: "F100", type: "FS" },
        { id: "F-R2", predecessorId: "F100", successorId: "A400", type: "FS" },
      ],
    };
    const result = runTIA(baseSchedule, fragnet);
    expect(result.impactDays).toBe(6);
    expect(result.baselineCompletionDate).toBe("2026-02-04");
    expect(result.impactedCompletionDate).toBe("2026-02-10");
    expect(result.outcome).toBe("delayed");
    expect(result.impacted.criticalActivityIds).toContain("F100");
  });

  it("reports float consumption when an event only delays a noncritical branch", () => {
    const fragnet: Fragnet = {
      id: "F-002",
      title: "Minor fixture delay",
      description: "Supplier confirmation period.",
      cause: "employer",
      occurrenceDate: "2026-01-12",
      activities: [{ id: "F200", name: "Supplier confirmation", duration: 10 }],
      replacedRelationshipIds: ["R4"],
      relationships: [
        { id: "F-R3", predecessorId: "B100", successorId: "F200", type: "FS" },
        { id: "F-R4", predecessorId: "F200", successorId: "B200", type: "FS" },
      ],
    };
    const result = runTIA(baseSchedule, fragnet);
    expect(result.impactDays).toBe(0);
    expect(result.outcome).toBe("float-consumed");
  });

  it("maps calendar dates to relative CPM days", () => {
    expect(dateToRelativeDay("2026-01-05", "2026-01-18")).toBe(13);
  });

  it("creates a Post-TIA-only Pre/Event/Post activity split without mutating the baseline", () => {
    const split = buildActivitySplitFragnet(baseSchedule, {
      id: "F-SPLIT-01",
      title: "تأخر اعتماد التعديل",
      description: "حدث مؤثر أثناء الأعمال الإنشائية.",
      cause: "employer",
      occurrenceDate: "2026-01-21",
      eventDuration: 4,
      targetActivityId: "A300",
    });
    const postTia = insertFragnet(baseSchedule, split);
    const result = runTIA(baseSchedule, split);

    expect(baseSchedule.activities.map((activity) => activity.id)).toContain("A300");
    expect(postTia.activities.map((activity) => activity.id)).not.toContain("A300");
    expect(postTia.activities.map((activity) => activity.id)).toEqual(expect.arrayContaining([
      "F-SPLIT-01--A300--pre", "F-SPLIT-01--A300--event", "F-SPLIT-01--A300--post",
    ]));
    expect(result.impactDays).toBe(4);
    expect(result.impacted.criticalActivityIds).toContain("F-SPLIT-01--A300--event");
    expect(getFragnetDelayDuration(split)).toBe(4);
  });

  it("creates one Post-TIA-only event for several independent affected activities", () => {
    const independentSchedule: Schedule = {
      id: "multi-baseline",
      name: "Independent workstreams",
      startDate: "2026-01-05",
      activities: [
        { id: "P100", name: "Package one", duration: 10 },
        { id: "P200", name: "Package two", duration: 10 },
      ],
      relationships: [],
    };
    const sourceBefore = JSON.stringify(independentSchedule);
    const split = buildMultiActivitySplitFragnet(independentSchedule, {
      id: "F-MULTI-01",
      title: "تصاريح متأخرة",
      description: "واقعة واحدة مرتبطة بمسارين مستقلين.",
      cause: "employer",
      occurrenceDate: "2026-01-10",
      eventDuration: 3,
      targetActivityIds: ["P100", "P200"],
    });
    const postTia = insertFragnet(independentSchedule, split);
    const result = runTIA(independentSchedule, split);

    expect(split.sourceActivityIds).toEqual(["P100", "P200"]);
    expect(split.replacedActivityIds).toEqual(["P100", "P200"]);
    expect(postTia.activities.map((activity) => activity.id)).not.toEqual(expect.arrayContaining(["P100", "P200"]));
    expect(postTia.activities.map((activity) => activity.id)).toEqual(expect.arrayContaining([
      "F-MULTI-01--P100--event", "F-MULTI-01--P200--event",
    ]));
    expect(result.impacted.activities.map((activity) => activity.id)).toContain("F-MULTI-01--P100--event");
    expect(JSON.stringify(independentSchedule)).toBe(sourceBefore);
  });

  it("rejects a grouped split when selected activities are directly linked", () => {
    expect(() => buildMultiActivitySplitFragnet(baseSchedule, {
      id: "F-MULTI-LINKED",
      title: "اختيار مترابط",
      description: "",
      cause: "employer",
      occurrenceDate: "2026-01-21",
      eventDuration: 2,
      targetActivityIds: ["A200", "A300"],
    })).toThrow("لا يدعم التقسيم المجمع نشاطين مرتبطين مباشرة");
  });

  it("creates independent Pre-TIA and Post-TIA copies while preserving the imported source schedule", () => {
    const sourceBefore = JSON.stringify(baseSchedule);
    const split = buildActivitySplitFragnet(baseSchedule, {
      id: "F-COPY-01",
      title: "تعليق أعمال مؤقت",
      description: "تمرين تحقق من عزل النسخ التحليلية.",
      cause: "employer",
      occurrenceDate: "2026-01-21",
      eventDuration: 3,
      targetActivityId: "A300",
    });
    const copies = createTiaAnalyticalCopies(baseSchedule, split);

    expect(copies.preTia).not.toBe(baseSchedule);
    expect(copies.preTia.activities).not.toBe(baseSchedule.activities);
    expect(copies.preTia.id).toContain("--pre-tia--F-COPY-01");
    expect(copies.postTia.id).toContain("--post-tia--F-COPY-01");
    expect(copies.preTia.activities.map((activity) => activity.id)).toContain("A300");
    expect(copies.postTia.activities.map((activity) => activity.id)).not.toContain("A300");
    expect(copies.postTia.activities.map((activity) => activity.id)).toContain("F-COPY-01--A300--event");
    expect(JSON.stringify(baseSchedule)).toBe(sourceBefore);
  });
});

describe("Financial delay impact", () => {
  it("selects only assignments attached to the event fragnet or its baseline connection points", () => {
    const schedule: Schedule = { ...baseSchedule, resourceAssignments: [
      { id: "A200-LAB", activityId: "A200", resourceType: "labor", source: "xer" },
      { id: "A400-LAB", activityId: "A400", resourceType: "labor", source: "xer" },
      { id: "B100-EQ", activityId: "B100", resourceType: "nonlabor", source: "xer" },
    ] };
    const event: Fragnet = { id: "EV-COST", title: "تأخر اعتماد", description: "", cause: "employer", occurrenceDate: "2026-01-10", activities: [{ id: "F-COST", name: "انتظار اعتماد", duration: 3 }], relationships: [{ id: "E1", predecessorId: "A200", successorId: "F-COST", type: "FS" }, { id: "E2", predecessorId: "F-COST", successorId: "A400", type: "FS" }] };
    expect(resourceAssignmentsForEvent(schedule, event).map(item => item.id)).toEqual(["A200-LAB", "A400-LAB"]);
  });

  it("derives daily extension exposure by resource type from P6 rate data", () => {
    const impact = calculateFinancialImpact(3, [
      { id: "LAB-1", activityId: "A200", resourceType: "labor", resourceName: "فريق الحفر", costPerUnit: 20, remainingQuantityPerHour: 2, source: "xer" },
      { id: "EQ-1", activityId: "A200", resourceType: "nonlabor", resourceName: "حفار", costPerUnit: 50, remainingQuantityPerHour: 1, source: "xer" },
      { id: "MAT-1", activityId: "A300", resourceType: "material", resourceName: "خرسانة", costPerUnit: 10, remainingQuantityPerHour: 4, source: "xer" },
    ]);

    expect(impact.dailyCost).toBe(1040);
    expect(impact.extensionCost).toBe(3120);
    expect(impact.byResourceType.labor).toMatchObject({ assignmentCount: 1, dailyCost: 320, extensionCost: 960 });
    expect(impact.byResourceType.nonlabor.extensionCost).toBe(1200);
    expect(impact.byResourceType.material.extensionCost).toBe(960);
  });

  it("falls back to allocated remaining cost and warns when no daily basis can be calculated", () => {
    const impact = calculateFinancialImpact(2, [
      { id: "FALLBACK", activityId: "A200", resourceType: "labor", remainingCost: 1000, activityRemainingDuration: 5, source: "p6-xml" },
      { id: "MISSING", activityId: "A300", resourceType: "unknown", source: "p6-xml" },
    ]);

    expect(impact.dailyCost).toBe(200);
    expect(impact.extensionCost).toBe(400);
    expect(impact.warnings).toHaveLength(1);
  });
});

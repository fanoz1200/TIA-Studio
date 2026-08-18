import { describe, expect, it } from "vitest";
import { calculateFinancialImpact, dateToRelativeDay, resourceAssignmentsForEvent, runCPM, runTIA, type Fragnet, type Schedule } from "./cpm";

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

import { describe, expect, it } from "vitest";
import type { Schedule } from "./cpm";
import { assessScheduleQuality } from "./schedule-quality";

const baseSchedule: Schedule = {
  id: "quality-test",
  name: "برنامج اختبار الجودة",
  startDate: "2026-01-05",
  dataDate: "2026-01-10",
  calendar: { id: "cal", name: "تقويم اختبار", workingWeekdays: [0, 1, 2, 3, 4], holidays: [], hoursPerDay: 8 },
  wbsNodes: [{ id: "W1", code: "1", name: "أعمال", path: "1" }],
  activities: [{ id: "A100", name: "بدء", duration: 2, wbsId: "W1" }, { id: "A200", name: "تنفيذ", duration: 3, wbsId: "W1" }],
  relationships: [{ id: "R1", predecessorId: "A100", successorId: "A200", type: "FS" }],
};

describe("schedule quality gate", () => {
  it("accepts a calculable network and keeps XER export conditional", () => {
    const assessment = assessScheduleQuality(baseSchedule);
    expect(assessment.analysisReadiness).toBe("ready");
    expect(assessment.exportReadiness).toBe("review");
    expect(assessment.rules.find((item) => item.id === "SQ-008")?.severity).toBe("pass");
  });

  it("blocks a relationship that references an absent activity", () => {
    const assessment = assessScheduleQuality({ ...baseSchedule, relationships: [{ id: "R2", predecessorId: "A100", successorId: "MISSING", type: "FS" }] });
    expect(assessment.analysisReadiness).toBe("blocked");
    expect(assessment.rules.find((item) => item.id === "SQ-005")?.severity).toBe("blocker");
  });

  it("raises review items for absent data date and WBS linkage", () => {
    const assessment = assessScheduleQuality({ ...baseSchedule, dataDate: undefined, activities: [{ id: "A100", name: "منفرد", duration: 2 }], relationships: [] });
    expect(assessment.analysisReadiness).toBe("review");
    expect(assessment.rules.find((item) => item.id === "SQ-010")?.severity).toBe("warning");
    expect(assessment.rules.find((item) => item.id === "SQ-011")?.severity).toBe("warning");
  });

  it("treats missing XER core tables as an explicit blocker", () => {
    const assessment = assessScheduleQuality(baseSchedule, { projectName: "x", activitiesRead: 2, relationshipsRead: 1, relationshipsSkipped: 0, wbsRead: 1, resourcesRead: 0, resourceAssignmentsRead: 0, resourceAssignmentsSkipped: 0, assignmentsWithCosts: 0, activitiesWithProgress: 0, warnings: [], tablesFound: ["PROJECT", "TASK"] });
    expect(assessment.rules.find((item) => item.id === "SQ-013")?.severity).toBe("blocker");
  });

  it("raises review when the importer had to exclude broken XER references", () => {
    const assessment = assessScheduleQuality(baseSchedule, { projectName: "x", activitiesRead: 2, relationshipsRead: 1, relationshipsSkipped: 2, wbsRead: 1, resourcesRead: 1, resourceAssignmentsRead: 1, resourceAssignmentsSkipped: 1, assignmentsWithCosts: 0, activitiesWithProgress: 0, calendarName: "Standard", warnings: [], tablesFound: ["PROJECT", "TASK", "TASKPRED"] });
    expect(assessment.analysisReadiness).toBe("review");
    expect(assessment.rules.find((item) => item.id === "SQ-015")).toMatchObject({ severity: "warning", affectedCount: 3 });
  });
});

import { describe, expect, it } from "vitest";
import { buildP6ReadinessGate, buildSplitPreview } from "./tia-readiness";
import { fiveDayCalendar, type Schedule } from "./cpm";

const schedule: Schedule = {
  id: "p6-1", name: "برنامج اختبار", startDate: "2026-01-01", dataDate: "2026-01-05",
  calendar: fiveDayCalendar,
  activities: [{ id: "A", name: "الحفر", duration: 2 }, { id: "B", name: "الأساسات", duration: 3 }],
  relationships: [{ id: "R-1", predecessorId: "A", successorId: "B", type: "FS" }],
};

describe("P6 readiness gate", () => {
  it("يعرض مراجعة التقويم والتحذيرات بدلاً من التصريح بأن ملف XER مكتمل تماماً", () => {
    const gate = buildP6ReadinessGate(schedule, { projectName: "P6", activitiesRead: 2, relationshipsRead: 1, wbsRead: 0, resourcesRead: 0, resourceAssignmentsRead: 0, assignmentsWithCosts: 0, activitiesWithProgress: 0, calendarName: "P6 Calendar", warnings: ["راجع نمط التقويم"], tablesFound: ["TASK"] });
    expect(gate.requiresAcknowledgement).toBe(true);
    expect(gate.checks.find(item => item.key === "calendar")?.status).toBe("review");
  });

  it("يبني معاينة Pre/Event/Post من العلاقة دون تعديل البرنامج المصدر", () => {
    expect(buildSplitPreview(schedule, "R-1", "FR-001")).toMatchObject({ predecessor: "الحفر", affectedActivity: "الأساسات", event: "FR-001", sourceRelationshipId: "R-1" });
    expect(schedule.activities).toHaveLength(2);
  });
});

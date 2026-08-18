import { describe, expect, it } from "vitest";
import type { Schedule } from "./cpm";
import { evaluateWorkflowReadiness, workflowReadinessSummary } from "./workflow-validation";

const schedule: Schedule = {
  id: "baseline",
  name: "برنامج أساس",
  source: "xer",
  dataDate: "2026-01-09",
  activities: [{ id: "A-100", name: "الأساسات", duration: 5, predecessors: [] }],
  relationships: [],
};

describe("evaluateWorkflowReadiness", () => {
  it("يمنع الانتقال إلى التقرير عند غياب الحدث أو تحليل TIA", () => {
    const checks = evaluateWorkflowReadiness({ schedule, selectedEvent: null, analysis: null, evidenceCount: 0, noticeCount: 0, reviewStatus: null, isAuthenticated: false, hasEventResources: false, templateReady: false });
    expect(checks.find((item) => item.id === "event")?.state).toBe("blocked");
    expect(checks.find((item) => item.id === "tia")?.state).toBe("blocked");
    expect(workflowReadinessSummary(checks)).toContain("مانعة");
  });

  it("يعرض المرور عندما تكتمل نتائج الحدث والمراجعة والقالب", () => {
    const event = { id: "EV-01", title: "تأخر أساسات", occurrenceDate: "2026-01-10", cause: "employer", activities: [{ id: "F-1", name: "معالجة", duration: 3 }], relationships: [{ predecessorId: "A-100", successorId: "F-1", type: "FS", lag: 0 }, { predecessorId: "F-1", successorId: "A-100", type: "FS", lag: 0 }] } as never;
    const analysis = { baseline: { completionDate: "2026-02-01", activities: [{ id: "A-100", totalFloat: 0 }] }, impacted: { completionDate: "2026-02-04", activities: [{ id: "F-1", totalFloat: 0 }], criticalActivityIds: ["F-1"] }, impactDays: 3 } as never;
    const checks = evaluateWorkflowReadiness({ schedule: { ...schedule, relationships: [{ predecessorId: "A-100", successorId: "A-100", type: "FS", lag: 0 }] }, selectedEvent: event, analysis, evidenceCount: 2, noticeCount: 1, reviewStatus: "ready_to_export", isAuthenticated: true, hasEventResources: true, templateReady: true });
    expect(checks.filter((item) => item.state === "pass")).toHaveLength(10);
    expect(workflowReadinessSummary(checks)).toContain("اجتازت");
  });
});

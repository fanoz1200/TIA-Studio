import { describe, expect, it } from "vitest";
import type { Fragnet, Schedule, TiaResult } from "./cpm";
import { evaluateTiaResultQuality } from "./tia-result-validation";

const schedule: Schedule = {
  id: "baseline", name: "برنامج اختبار", source: "xer", startDate: "2026-01-01", dataDate: "2026-01-08",
  activities: [{ id: "A", name: "أ", duration: 2 }, { id: "B", name: "ب", duration: 2 }],
  relationships: [{ id: "R", predecessorId: "A", successorId: "B", type: "FS" }],
};

const event: Fragnet = {
  id: "EV-1", title: "تأخر اعتماد", cause: "employer", occurrenceDate: "2026-01-09",
  activities: [{ id: "F", name: "حدث", duration: 2, kind: "fragnet" }],
  relationships: [{ id: "FR-1", predecessorId: "A", successorId: "F", type: "FS" }, { id: "FR-2", predecessorId: "F", successorId: "B", type: "FS" }],
};

function analysis(impactDays = 2, eventCritical = true, totalFloat = 0) {
  return {
    impactDays,
    baseline: { activities: [{ id: "A", totalFloat: 0 }], completionDate: "2026-01-05" },
    impacted: { activities: [{ id: "F", totalFloat }], criticalActivityIds: eventCritical ? ["F"] : [], completionDate: "2026-01-07" },
  } as unknown as TiaResult;
}

describe("evaluateTiaResultQuality", () => {
  it("يقبل نتيجة مكتملة منطقياً عندما يمر الحدث الحرج ضمن السماحية", () => {
    const quality = evaluateTiaResultQuality({ schedule, selectedEvent: event, analysis: analysis(), analystExpectedDays: 2 });
    expect(quality.state).toBe("accepted");
    expect(quality.checks.every((check) => check.state === "pass" || check.state === "info")).toBe(true);
  });

  it("يرفض النتيجة عند غياب التحليل أو وجود عائمة سالبة", () => {
    expect(evaluateTiaResultQuality({ schedule, selectedEvent: event, analysis: null }).state).toBe("rejected");
    expect(evaluateTiaResultQuality({ schedule, selectedEvent: event, analysis: analysis(2, true, -1) }).state).toBe("rejected");
  });

  it("يعلم النتيجة كمشروطة عند انحراف تقدير المحلل أو غياب Data Date", () => {
    const quality = evaluateTiaResultQuality({ schedule: { ...schedule, dataDate: undefined }, selectedEvent: event, analysis: analysis(5, false), analystExpectedDays: 1 });
    expect(quality.state).toBe("conditional");
    expect(quality.checks.find((check) => check.id === "analyst-comparison")?.state).toBe("warning");
  });
});

import { describe, expect, it } from "vitest";
import { buildUnifiedClaimNarrative } from "./claimContinuity";

describe("السرد الموحد للمطالبات المتتابعة", () => {
  it("يحافظ على مرجع المطالبة السابقة وفترة التحليل وحدود تقييم التزامن", () => {
    const narrative = buildUnifiedClaimNarrative({
      title: "مطالبة تحديث مايو",
      claimKey: "CLM-MAY-2026",
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
      parentLabel: "مطالبة تحديث أبريل",
      concurrency: [{ primaryEventKey: "EV-001", concurrentEventKey: "EV-002", analysisWindowKey: "WIN-004", overlapStart: new Date("2026-05-09T00:00:00Z"), overlapEnd: new Date("2026-05-12T00:00:00Z"), responsibility: "mixed", treatment: "apportioned", notes: "تم التحقق من التداخل في شبكة CPM." }],
    });

    expect(narrative).toContain("CLM-MAY-2026");
    expect(narrative).toContain("مطالبة تحديث أبريل");
    expect(narrative).toContain("2026-05-01 إلى 2026-05-31");
    expect(narrative).toContain("لا يُفترض استحقاق تلقائي");
    expect(narrative).toContain("Notice of Claim");
    expect(narrative).toContain("EV-001 × EV-002");
    expect(narrative).toContain("WIN-004");
    expect(narrative).toContain("تم التحقق من التداخل في شبكة CPM");
  });
});

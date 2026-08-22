import { describe, expect, it } from "vitest";
import { masterClaimCases } from "./master-claim-cases";
import { claimTrainingScenarios, fidicClaimReferences } from "./user-claim-references";

describe("محتوى المصادر التي رفعها المستخدم", () => {
  it("يعرض حالات D المنظمة المتاحة فقط دون الادعاء بوجود D-056 إلى D-088", () => {
    const expectedIds = Array.from({ length: 55 }, (_, index) => `D-${String(index + 1).padStart(3, "0")}`);

    expect(masterClaimCases).toHaveLength(55);
    expect(masterClaimCases.map((item) => item.case_id)).toEqual(expectedIds);
    expect(masterClaimCases.find((item) => item.case_id === "D-056")).toBeUndefined();
  });

  it("يحافظ على مراجع FIDIC والسيناريوهات المستقلة المستخرجة من ملفي المستخدم", () => {
    expect(fidicClaimReferences).toHaveLength(27);
    expect(fidicClaimReferences.every((item) => item.clause && item.title && item.source)).toBe(true);

    expect(claimTrainingScenarios).toHaveLength(5);
    expect(claimTrainingScenarios.map((item) => item.id)).toEqual([
      "scenario-1",
      "scenario-2",
      "scenario-3",
      "scenario-4",
      "scenario-5",
    ]);
  });
});

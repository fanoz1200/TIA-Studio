import { describe, expect, it } from "vitest";
import { masterClaimIntelligenceCases } from "./master-claim-intelligence-data";
import { qwenCaseIntakeCases, qwenCaseIntakeSource } from "./qwen-case-intake-data";

describe("Qwen case intake data", () => {
  it("preserves the user-supplied D-056 to D-088 intake range", () => {
    expect(qwenCaseIntakeSource.caseCount).toBe(33);
    expect(qwenCaseIntakeCases).toHaveLength(33);
    expect(qwenCaseIntakeCases.map(item => item.id)).toEqual(
      Array.from({ length: 33 }, (_, index) => `D-${String(index + 56).padStart(3, "0")}`)
    );
  });

  it("keeps the intake review-only until the original cited document is available", () => {
    expect(qwenCaseIntakeSource.originalSourceAvailable).toBe(false);
    expect(qwenCaseIntakeSource.reviewStatus).toMatch(/not independently verified/);
    const workbookIds = new Set(masterClaimIntelligenceCases.map(item => item.id));
    expect(qwenCaseIntakeCases.some(item => workbookIds.has(item.id))).toBe(false);
  });
});

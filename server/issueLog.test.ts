import { describe, expect, it } from "vitest";
import { buildFragnetProposal, issueKey } from "./issueLog";

describe("سجل قضايا البلانر", () => {
  it("يبني Fragnet مقترحاً محدداً من بيانات قضية قابلة للمراجعة", () => {
    const proposal = buildFragnetProposal({ issueNo: "iss-04", title: "تعذر الوصول", description: "تم منع الوصول إلى منطقة العمل بموجب تعليمات موقعية مثبتة.", occurrenceDate: "2026-06-04", proposedDurationDays: 4.5, replacedRelationshipId: "REL-12", affectedActivityIds: ["A-100", "A-101", "A-100"], delayCause: "employer", responsibleParty: "employer" });
    expect(proposal).toMatchObject({ id: "ISS-ISS-04", durationDays: 4.5, relationshipId: "REL-12", cause: "employer" });
    expect(proposal.affectedActivityIds).toEqual(["A-100", "A-101"]);
  });

  it("يرفض Fragnet غير مضبوط أو غير مربوط بعلاقة منطقية", () => {
    expect(issueKey("  !!! ")).toBe("ISSUE");
    expect(() => buildFragnetProposal({ issueNo: "I-1", title: "قضية", description: "وصف فني مفصل للقضية", occurrenceDate: "2026-06-04", proposedDurationDays: 0, replacedRelationshipId: "", affectedActivityIds: [], delayCause: "neutral", responsibleParty: "undetermined" })).toThrow("مدة Fragnet");
  });
});

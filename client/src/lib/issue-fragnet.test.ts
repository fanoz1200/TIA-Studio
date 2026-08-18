import { describe, expect, it } from "vitest";
import { issueProposalToFragnet } from "./issue-fragnet";

describe("تحويل قضية البلانر إلى Fragnet", () => {
  const proposal = { id: "ISS-001", title: "قضية تعليمات متأخرة", description: "تعليمات تغيير مثبتة بمحضر موقع.", occurrenceDate: "2026-06-04", durationDays: 3, relationshipId: "REL-1", affectedActivityIds: ["A-1"], cause: "employer" as const, responsibility: "employer" as const };
  const relationship = { id: "REL-1", predecessorId: "A-1", successorId: "A-2", type: "FS" as const, lag: 1 };

  it("يفصل العلاقة المرجعية بنشاط Fragnet مستقل مع الحفاظ على نوع الرابط والـ lag الداخل", () => {
    const event = issueProposalToFragnet(proposal, relationship);
    expect(event.replacedRelationshipIds).toEqual(["REL-1"]);
    expect(event.activities[0]).toMatchObject({ id: "FR-ISS-001", duration: 3, kind: "fragnet" });
    expect(event.relationships).toEqual([
      { id: "FR-ISS-001-IN", predecessorId: "A-1", successorId: "FR-ISS-001", type: "FS", lag: 1 },
      { id: "FR-ISS-001-OUT", predecessorId: "FR-ISS-001", successorId: "A-2", type: "FS" },
    ]);
  });

  it("يرفض التطبيق إذا تغيّرت العلاقة المرجعية في نسخة البرنامج", () => {
    expect(() => issueProposalToFragnet(proposal, { ...relationship, id: "REL-CHANGED" })).toThrow("العلاقة المرجعية");
  });
});

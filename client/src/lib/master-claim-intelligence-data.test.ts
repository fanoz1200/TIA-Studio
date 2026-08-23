import { describe, expect, it } from "vitest";
import { masterClaimIntelligenceCases, masterClaimIntelligenceSource, masterClaimSupportSheets } from "./master-claim-intelligence-data";

describe("Master Claim Intelligence المولّد من ملف المستخدم", () => {
  it("يحفظ عدد الحالات ومجموعاتها الواقعية دون اختراع سلسلة D إضافية", () => {
    expect(masterClaimIntelligenceSource.caseCount).toBe(70);
    expect(masterClaimIntelligenceCases).toHaveLength(70);
    expect(masterClaimIntelligenceSource.caseGroups).toEqual({ D: 55, DIS: 9, CON: 4, VAR: 1, RES: 1 });
    expect(masterClaimIntelligenceCases.some(item => item.id === "D-056")).toBe(false);
    expect(masterClaimIntelligenceCases.some(item => item.id === "DIS-009")).toBe(true);
  });

  it("يحفظ أوراق الإجراءات والدعم وروابطها الداخلية كما فُهرست", () => {
    expect(masterClaimIntelligenceSource.supportSheetCount).toBe(8);
    expect(masterClaimSupportSheets).toHaveLength(8);
    expect(masterClaimIntelligenceSource.internalLinkCount).toBe(99);
    expect(masterClaimSupportSheets.some(sheet => sheet.id === "00_Decision_Tree")).toBe(true);
    expect(masterClaimSupportSheets.flatMap(sheet => sheet.links)).toHaveLength(99);
  });

  it("يحفظ الحقول التفصيلية للحالات ولا يختزلها إلى عنوان فقط", () => {
    const caseDis009 = masterClaimIntelligenceCases.find(item => item.id === "DIS-009");
    expect(caseDis009).toBeDefined();
    expect([caseDis009?.description, caseDis009?.burden_of_proof, caseDis009?.recommended_solution].filter(Boolean)).toHaveLength(3);
  });
});

import { describe, expect, it } from "vitest";
import { buildEditableClaimEotDraft } from "./claim-template";

describe("buildEditableClaimEotDraft", () => {
  it("keeps source event wording while stating that the local draft is not an entitlement decision", () => {
    const draft = buildEditableClaimEotDraft({
      language: "en",
      projectName: "Project Atlas",
      referenceNo: "CLM-01",
      sender: "Contractor",
      recipient: "Engineer",
      contractClause: "8.4",
      eventId: "D-001",
      eventTitle: "Access restriction recorded by the project team",
      occurrenceDate: "2026-03-01",
      awarenessDate: "2026-03-02",
      noticeDueDate: "2026-03-09",
      timeImpactDays: 5,
      financialExposure: "123.45 currency units",
      narrative: "Source event narrative remains editable.",
      technicalNarrative: "Local analysis note.",
      evidenceReferences: ["E-01 — site diary"],
      windowAnalysisNote: "Two locally loaded update snapshots were compared.",
    });

    expect(draft).toContain("Access restriction recorded by the project team");
    expect(draft).toContain("does not decide entitlement");
    expect(draft).toContain("E-01 — site diary");
    expect(draft).toContain("5 day(s)");
  });

  it("keeps an Arabic working draft local and labels it as non-automatic", () => {
    const draft = buildEditableClaimEotDraft({
      language: "ar",
      projectName: "مشروع تجريبي",
      referenceNo: "",
      sender: "",
      recipient: "",
      contractClause: "",
      eventId: "D-002",
      eventTitle: "بيان واقعة من المصدر",
      occurrenceDate: "",
      awarenessDate: "",
      noticeDueDate: "",
      timeImpactDays: 0,
      financialExposure: "",
      narrative: "",
      technicalNarrative: "",
      evidenceReferences: [],
      windowAnalysisNote: "مراجعة فنية مطلوبة.",
    });

    expect(draft).toContain("مسودة عمل محلية فقط");
    expect(draft).toContain("لا يصدر قرار EOT");
    expect(draft).toContain("بيان واقعة من المصدر");
  });
});

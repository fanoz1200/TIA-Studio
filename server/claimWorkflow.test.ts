import { afterEach, describe, expect, it, vi } from "vitest";
import { getDb } from "./db";
import { addNoticePeriod, canAssignReviewParticipant, canRecordReviewDecision, createAutomaticNoticeDraft, nextReviewState } from "./claimWorkflow";

vi.mock("./db", () => ({ getDb: vi.fn() }));

describe("claim review workflow", () => {
  afterEach(() => vi.clearAllMocks());
  it("calculates a contractual notice due date from the awareness date without local-time drift", () => {
    expect(addNoticePeriod("2026-02-25", 7)).toBe("2026-03-04");
  });

  it("advances only through the defined planning, contracts, and claims-manager sequence", () => {
    expect(nextReviewState("draft", "draft", "submitted")).toEqual({ stage: "planning_review", status: "in_review" });
    expect(nextReviewState("planning_review", "in_review", "approved")).toEqual({ stage: "contract_review", status: "in_review" });
    expect(nextReviewState("contract_review", "in_review", "approved")).toEqual({ stage: "claims_manager_approval", status: "in_review" });
    expect(nextReviewState("claims_manager_approval", "in_review", "approved")).toEqual({ stage: "ready_to_export", status: "ready_to_export" });
  });

  it("keeps comments immutable to the stage and permits reopening only after rejection", () => {
    expect(nextReviewState("contract_review", "in_review", "commented")).toEqual({ stage: "contract_review", status: "in_review" });
    expect(nextReviewState("contract_review", "in_review", "rejected")).toEqual({ stage: "rejected", status: "rejected" });
    expect(nextReviewState("rejected", "rejected", "reopened")).toEqual({ stage: "draft", status: "draft" });
    expect(() => nextReviewState("draft", "draft", "approved")).toThrow("غير متاح");
  });

  it("allows a stage approval only for its assigned reviewer and rejects an unassigned user", () => {
    expect(canRecordReviewDecision({ isOwner: false, currentStage: "planning_review", decision: "approved", isAssignedReviewer: true })).toBe(true);
    expect(canRecordReviewDecision({ isOwner: false, currentStage: "planning_review", decision: "approved", isAssignedReviewer: false })).toBe(false);
    expect(canRecordReviewDecision({ isOwner: true, currentStage: "contract_review", decision: "approved", isAssignedReviewer: false })).toBe(false);
    expect(canRecordReviewDecision({ isOwner: true, currentStage: "draft", decision: "submitted", isAssignedReviewer: false })).toBe(true);
  });

  it("restricts stage-reviewer assignment to the claim owner inside the server workflow", () => {
    expect(canAssignReviewParticipant(17, 17)).toBe(true);
    expect(canAssignReviewParticipant(17, 18)).toBe(false);
  });

  it("creates one automatic notice per event, retains evidence references, and returns the existing draft on retry", async () => {
    let stored: { id: number; noticeNo: string } | undefined;
    let inserted: Record<string, unknown> | undefined;
    const fakeDb = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => stored ? [stored] : [] }) }) }),
      insert: () => ({ values: async (values: Record<string, unknown>) => { inserted = values; stored = { id: 77, noticeNo: String(values.noticeNo) }; return [{ insertId: 77 }]; } }),
    };
    vi.mocked(getDb).mockResolvedValue(fakeDb as never);
    const input = { projectKey: "P-1", claimKey: "C-1", eventKey: "EV-19", eventTitle: "عائق موقعي", awarenessDate: "2026-03-01", noticePeriodDays: 7, timeImpactDays: 3, costImpact: 1200, evidenceReferenceIds: ["E-11", "E-12"] };
    await expect(createAutomaticNoticeDraft(9, input)).resolves.toEqual({ id: 77, created: true, noticeNo: "AUTO-EV-19" });
    expect(inserted).toMatchObject({ userId: 9, eventKey: "EV-19", noticeNo: "AUTO-EV-19", status: "draft", evidenceReferenceIds: JSON.stringify(["E-11", "E-12"]) });
    await expect(createAutomaticNoticeDraft(9, input)).resolves.toEqual({ id: 77, created: false, noticeNo: "AUTO-EV-19" });
  });
});

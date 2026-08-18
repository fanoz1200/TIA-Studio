import { afterEach, describe, expect, it, vi } from "vitest";
import { getDb } from "./db";
import { addNoticePeriod, buildAutomaticNoticeNarrative, canAssignReviewParticipant, canRecordReviewDecision, canServeReviewStage, createAutomaticNoticeDraft, hashInvitationToken, invitationExpiry, listProjectMembers, nextReviewState } from "./claimWorkflow";

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

  it("hashes invitation tokens deterministically and applies a seven-day UTC expiry", () => {
    expect(hashInvitationToken("safe-invitation-token")).toHaveLength(64);
    expect(hashInvitationToken("safe-invitation-token")).toBe(hashInvitationToken("safe-invitation-token"));
    expect(invitationExpiry(new Date("2026-08-18T12:00:00.000Z")).toISOString()).toBe("2026-08-25T12:00:00.000Z");
  });

  it("limits each review gate to the matching project role while preserving the owner's override", () => {
    expect(canServeReviewStage("planner", "planning_review")).toBe(true);
    expect(canServeReviewStage("contracts", "contract_review")).toBe(true);
    expect(canServeReviewStage("claims_manager", "claims_manager_approval")).toBe(true);
    expect(canServeReviewStage("viewer", "planning_review")).toBe(false);
    expect(canServeReviewStage("contracts", "planning_review")).toBe(false);
    expect(canServeReviewStage("owner", "contract_review")).toBe(true);
  });

  it("returns project reviewers as named members with their operational roles", async () => {
    const ownerQuery = { from: () => ({ where: () => ({ limit: async () => [{ id: 17, name: "م. هدى", email: "owner@example.com" }] }) }) };
    const membersQuery = { from: () => ({ innerJoin: () => ({ where: () => ({ orderBy: async () => [{ id: 9, memberUserId: 21, projectRole: "planner", name: "م. كريم", email: "planner@example.com", addedAt: new Date("2026-08-01") }] }) }) }) };
    vi.mocked(getDb).mockResolvedValue({ select: vi.fn().mockReturnValueOnce(ownerQuery).mockReturnValueOnce(membersQuery) } as never);
    await expect(listProjectMembers(17, "P-TIA")).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ memberUserId: 17, name: "م. هدى", projectRole: "owner", isOwner: true }),
      expect.objectContaining({ memberUserId: 21, name: "م. كريم", projectRole: "planner", isOwner: false }),
    ]));
  });

  it("creates one automatic notice per event, retains evidence references, and returns the existing draft on retry", async () => {
    let stored: { id: number; noticeNo: string } | undefined;
    let inserted: Record<string, unknown> | undefined;
    const fakeDb = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => stored ? [stored] : [] }) }) }),
      insert: () => ({ values: async (values: Record<string, unknown>) => { inserted = values; stored = { id: 77, noticeNo: String(values.noticeNo) }; return [{ insertId: 77 }]; } }),
    };
    vi.mocked(getDb).mockResolvedValue(fakeDb as never);
    const input = { projectKey: "P-1", claimKey: "C-1", eventKey: "EV-19", eventTitle: "عائق موقعي", awarenessDate: "2026-03-01", noticePeriodDays: 7, timeImpactDays: 3, costImpact: 1200, evidenceReferenceIds: ["E-11", "E-12"], concurrencySummary: "EV-19 × EV-22 — نافذة WIN-03، من 2026-03-02 إلى 2026-03-04؛ المسؤولية: mixed؛ المعالجة: apportioned." };
    await expect(createAutomaticNoticeDraft(9, input)).resolves.toEqual({ id: 77, created: true, noticeNo: "AUTO-EV-19" });
    expect(inserted).toMatchObject({ userId: 9, eventKey: "EV-19", noticeNo: "AUTO-EV-19", status: "draft", evidenceReferenceIds: JSON.stringify(["E-11", "E-12"]) });
    expect(String(inserted?.narrative)).toContain("نافذة WIN-03");
    expect(String(inserted?.narrative)).toContain("المعالجة: apportioned");
    await expect(createAutomaticNoticeDraft(9, input)).resolves.toEqual({ id: 77, created: false, noticeNo: "AUTO-EV-19" });
  });

  it("builds an automatic notice draft that preserves the technical concurrency summary for review", () => {
    const narrative = buildAutomaticNoticeNarrative("تعليمات تغيير", "2026-05-09", "EV-1 × EV-2 — نافذة WIN-11؛ المسؤولية: mixed؛ المعالجة: apportioned.");
    expect(narrative).toContain("تعليمات تغيير");
    expect(narrative).toContain("نافذة WIN-11");
    expect(narrative).toContain("المسؤولية: mixed");
    expect(narrative).toContain("المعالجة: apportioned");
  });
});

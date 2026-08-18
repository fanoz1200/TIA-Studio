import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildClaimDocxBlob, buildClaimPdfBlob, type ClaimReportPayload } from "../client/src/lib/claim-export";
import { calculateFinancialImpact, resourceAssignmentsForEvent, type Fragnet } from "../client/src/lib/cpm";
import { importXerSchedule } from "../client/src/lib/xer";
import { getDb } from "./db";
import { assignReviewParticipant, createAutomaticNoticeDraft, getOrCreateClaimReview, recordReviewDecision } from "./claimWorkflow";

vi.mock("./db", () => ({ getDb: vi.fn() }));

type ReviewRow = { id: number; userId: number; projectKey: string; claimKey: string; claimTitle: string; createdBy: number; currentStage: string; status: string };

function fakeDb(limitRows: unknown[][], onUpdate?: (values: Record<string, unknown>) => void, onInsert?: (values: Record<string, unknown>) => void) {
  let limitIndex = 0;
  const chain = () => ({
    where: () => chain(),
    innerJoin: () => chain(),
    limit: async () => limitRows[limitIndex++] ?? [],
    orderBy: async () => [],
  });
  return {
    select: () => ({ from: () => chain() }),
    insert: () => ({ values: (values: Record<string, unknown>) => {
      onInsert?.(values);
      const result = Promise.resolve([{ insertId: 55 }]) as Promise<Array<{ insertId: number }>> & { onDuplicateKeyUpdate: (input: unknown) => Promise<Array<{ insertId: number }>> };
      result.onDuplicateKeyUpdate = async () => [{ insertId: 55 }];
      return result;
    } }),
    update: () => ({ set: (values: Record<string, unknown>) => { onUpdate?.(values); return { where: async () => undefined }; } }),
    transaction: async <T>(callback: (tx: ReturnType<typeof fakeDb>) => Promise<T>) => callback(fakeDb(limitRows.slice(limitIndex), onUpdate, onInsert) as ReturnType<typeof fakeDb>),
  };
}

const xerFlow = `%T\tPROJECT
%F\tproj_short_name\tplan_start_date
%R\tبرج تدفق المطالبة\t2026-03-01
%E
%T\tTASK
%F\ttask_id\ttask_code\ttask_name\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\tearly_start_date
%R\tT-100\tA100\tأعمال الأساسات\t80\t40\t2026-03-01
%E
%T\tRSRC
%F\trsrc_id\trsrc_name\trsrc_type
%R\tR-EXC\tحفار\tNonLabor
%E
%T\tTASKRSRC
%F\ttaskrsrc_id\ttask_id\trsrc_id\trsrc_type\tremain_cost\tcost_per_qty\tremain_qty_per_hr
%R\tTR-01\tT-100\tR-EXC\tNonLabor\t2500\t50\t1
%E`;

describe("full delay-claim workflow", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; vi.clearAllMocks(); });

  it("imports P6 resources, creates the automatic notice, routes approvals, then produces DOCX and PDF", async () => {
    const { schedule } = importXerSchedule(xerFlow, "full-flow.xer");
    const event: Fragnet = {
      id: "EV-501", title: "تعذر الوصول لمنطقة الأساسات", description: "عائق موقع", cause: "employer", occurrenceDate: "2026-03-05",
      activities: [{ id: "F-501", name: "انتظار معالجة العائق", duration: 3 }], relationships: [{ id: "L-501", predecessorId: "T-100", successorId: "F-501", type: "FS" }],
    };
    const financial = calculateFinancialImpact(3, resourceAssignmentsForEvent(schedule, event), 8);
    expect(financial.extensionCost).toBe(1200);

    let noticeValues: Record<string, unknown> | undefined;
    vi.mocked(getDb).mockResolvedValue(fakeDb([[]], undefined, values => { noticeValues = values; }) as never);
    const notice = await createAutomaticNoticeDraft(9, { projectKey: schedule.id, claimKey: "CL-501", eventKey: event.id, eventTitle: event.title, awarenessDate: event.occurrenceDate, noticePeriodDays: 7, timeImpactDays: 3, costImpact: financial.extensionCost, evidenceReferenceIds: ["E-501"] });
    expect(notice).toEqual({ id: 55, created: true, noticeNo: "AUTO-EV-501" });
    expect(noticeValues).toMatchObject({ evidenceReferenceIds: JSON.stringify(["E-501"]), noticeDueDate: expect.any(Date), costImpact: "1200" });

    const review: ReviewRow = { id: 55, userId: 9, projectKey: schedule.id, claimKey: "CL-501", claimTitle: "مطالبة العائق", createdBy: 9, currentStage: "draft", status: "draft" };
    vi.mocked(getDb).mockResolvedValue(fakeDb([[], [review]]) as never);
    await expect(getOrCreateClaimReview(9, { projectKey: schedule.id, claimKey: "CL-501", claimTitle: review.claimTitle })).resolves.toMatchObject({ id: 55 });

    const participant = { id: 1, claimReviewId: 55, stage: "planning_review", reviewerId: 9, assignedBy: 9 };
    vi.mocked(getDb).mockResolvedValue(fakeDb([[review], [{ id: 9 }], [review]]) as never);
    await assignReviewParticipant(9, { reviewId: review.id, stage: "planning_review", reviewerId: 9 });

    const decide = async (decision: "submitted" | "approved", assigned: boolean) => {
      const assignment = assigned ? [{ ...participant, stage: review.currentStage, reviewerId: 9 }] : [];
      vi.mocked(getDb).mockResolvedValue(fakeDb([[review], assignment, [review]], values => Object.assign(review, values)) as never);
      await recordReviewDecision(9, { reviewId: review.id, decision, comment: "اختبار مسار المطالبة" });
    };
    await decide("submitted", false);
    await decide("approved", true);
    await decide("approved", true);
    await decide("approved", true);
    expect(review).toMatchObject({ currentStage: "ready_to_export", status: "ready_to_export" });

    const report: ClaimReportPayload = {
      projectName: schedule.name, baselineFinish: "2026-03-10", impactedFinish: "2026-03-13", impactDays: 3, methodology: "TIA", narrative: "سرد اختبار لمسار مطالبة كامل", generatedAt: "2026-03-06",
      template: { title: "مطالبة أثر التأخير", recipient: "المهندس", contractReference: "8.4", introduction: "", entitlementPosition: "", reliefRequested: "", closing: "" },
      events: [{ id: event.id, title: event.title, occurrenceDate: event.occurrenceDate, duration: 3, cause: event.cause }], evidence: [{ title: "محضر عائق", fileName: "E-501.pdf", evidenceType: "محضر" }],
      financialImpact: { dailyCost: financial.dailyCost, extensionCost: financial.extensionCost, byResourceType: [{ label: "معدات / غير عمالة", dailyCost: financial.dailyCost, extensionCost: financial.extensionCost }] },
      notices: [{ noticeNo: notice.noticeNo, eventKey: event.id, status: "draft", narrative: String(noticeValues?.narrative), timeImpactDays: 3, costImpact: financial.extensionCost, noticeDueDate: "2026-03-12" }],
      review: { currentStage: review.currentStage, status: review.status, auditCount: 5, participants: [{ stage: "planning_review", reviewerId: 9 }] },
    };
    const docx = await buildClaimDocxBlob(report);
    expect(new TextDecoder().decode((await docx.arrayBuffer()).slice(0, 2))).toBe("PK");
    const font = await readFile(path.resolve(import.meta.dirname, "../../webdev-static-assets/Amiri-Regular.ttf"));
    globalThis.fetch = vi.fn(async () => new Response(font, { status: 200 }));
    const pdf = await buildClaimPdfBlob(report);
    expect(new TextDecoder().decode((await pdf.arrayBuffer()).slice(0, 4))).toBe("%PDF");
  });
});

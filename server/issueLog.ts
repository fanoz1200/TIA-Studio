import { and, desc, eq } from "drizzle-orm";
import { plannerIssueLogs } from "../drizzle/schema";
import { getDb } from "./db";

export type IssueStatus = "open" | "ready_for_fragnet" | "applied" | "rejected" | "closed";
export type IssueCause = "employer" | "contractor" | "neutral";
export type IssueResponsibility = "employer" | "contractor" | "engineer" | "third_party" | "undetermined";
export type IssueCriticality = "unknown" | "potentially_critical" | "critical" | "noncritical";

export type FragnetProposal = {
  id: string;
  title: string;
  occurrenceDate: string;
  durationDays: number;
  relationshipId: string;
  affectedActivityIds: string[];
  cause: IssueCause;
  responsibility: IssueResponsibility;
  description: string;
};

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات سجل القضايا غير متاحة حالياً.");
  return db;
}

function dateAtUtc(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("تاريخ الواقعة غير صالح.");
  return date;
}

export function issueKey(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) || "ISSUE";
}

export function buildFragnetProposal(input: { issueNo: string; title: string; description: string; occurrenceDate: string; proposedDurationDays: number; replacedRelationshipId: string; affectedActivityIds: string[]; delayCause: IssueCause; responsibleParty: IssueResponsibility }): FragnetProposal {
  if (!input.title.trim()) throw new Error("عنوان القضية مطلوب.");
  if (!input.description.trim()) throw new Error("الوصف الفني للقضية مطلوب.");
  if (!Number.isFinite(input.proposedDurationDays) || input.proposedDurationDays <= 0 || input.proposedDurationDays > 3650) throw new Error("مدة Fragnet يجب أن تكون أكبر من صفر وأقل من 3650 يوماً.");
  if (!input.replacedRelationshipId.trim()) throw new Error("اختر علاقة منطقية واحدة لاستبدالها بالـ Fragnet المقترح.");
  const affectedActivityIds = Array.from(new Set(input.affectedActivityIds.map(value => value.trim()).filter(Boolean)));
  if (!affectedActivityIds.length || affectedActivityIds.length > 100) throw new Error("حدد من 1 إلى 100 نشاط متأثر.");
  dateAtUtc(input.occurrenceDate);
  const key = issueKey(input.issueNo);
  return {
    id: `ISS-${key}`,
    title: `قضية ${input.issueNo.trim()} — ${input.title.trim()}`.slice(0, 255),
    occurrenceDate: input.occurrenceDate,
    durationDays: Number(input.proposedDurationDays.toFixed(2)),
    relationshipId: input.replacedRelationshipId.trim(),
    affectedActivityIds,
    cause: input.delayCause,
    responsibility: input.responsibleParty,
    description: input.description.trim(),
  };
}

export async function listPlannerIssues(ownerUserId: number, projectKey: string) {
  const db = await requireDb();
  return db.select().from(plannerIssueLogs).where(and(eq(plannerIssueLogs.ownerUserId, ownerUserId), eq(plannerIssueLogs.projectKey, projectKey))).orderBy(desc(plannerIssueLogs.occurrenceDate), desc(plannerIssueLogs.id));
}

export async function createPlannerIssue(ownerUserId: number, input: { projectKey: string; issueNo: string; title: string; description: string; impactSummary: string; referenceNotes: string; occurrenceDate: string; reportedBy?: string; responsibleParty: IssueResponsibility; delayCause: IssueCause; affectedActivityIds: string[]; replacedRelationshipId: string; proposedDurationDays: number; criticality: IssueCriticality }) {
  const db = await requireDb();
  const proposal = buildFragnetProposal({ issueNo: input.issueNo, title: input.title, description: input.description, occurrenceDate: input.occurrenceDate, proposedDurationDays: Number(input.proposedDurationDays), replacedRelationshipId: input.replacedRelationshipId, affectedActivityIds: input.affectedActivityIds, delayCause: input.delayCause as IssueCause, responsibleParty: input.responsibleParty as IssueResponsibility });
  const result = await db.insert(plannerIssueLogs).values({ ...input, ownerUserId, impactSummary: input.impactSummary.trim(), referenceNotes: input.referenceNotes.trim(), occurrenceDate: dateAtUtc(input.occurrenceDate), affectedActivityIds: JSON.stringify(proposal.affectedActivityIds), proposedDurationDays: String(proposal.durationDays), fragnetProposalJson: JSON.stringify(proposal), status: "open" });
  return Number(result[0].insertId);
}

export async function createPlannerIssueBatch(ownerUserId: number, projectKey: string, inputs: Array<{ issueNo: string; title: string; description: string; impactSummary: string; referenceNotes: string; occurrenceDate: string; reportedBy?: string; responsibleParty: IssueResponsibility; delayCause: IssueCause; affectedActivityIds: string[]; replacedRelationshipId: string; proposedDurationDays: number; criticality: IssueCriticality }>) {
  if (!inputs.length || inputs.length > 500) throw new Error("يجب أن تحتوي دفعة الاستيراد على 1 إلى 500 قضية.");
  const normalized = inputs.map(input => ({ ...input, issueNo: input.issueNo.trim(), proposal: buildFragnetProposal(input) }));
  const seen = new Set<string>();
  normalized.forEach(item => {
    const key = item.issueNo.toUpperCase();
    if (seen.has(key)) throw new Error(`رقم القضية مكرر داخل ملف الاستيراد: ${item.issueNo}.`);
    seen.add(key);
  });
  const db = await requireDb();
  return db.transaction(async tx => {
    const existing = await tx.select({ issueNo: plannerIssueLogs.issueNo }).from(plannerIssueLogs).where(and(eq(plannerIssueLogs.ownerUserId, ownerUserId), eq(plannerIssueLogs.projectKey, projectKey)));
    const duplicate = existing.find(item => seen.has(item.issueNo.toUpperCase()));
    if (duplicate) throw new Error(`رقم القضية موجود مسبقاً في سجل المشروع: ${duplicate.issueNo}. لم يُحفظ أي صف من الدفعة.`);
    await tx.insert(plannerIssueLogs).values(normalized.map(item => ({ projectKey, issueNo: item.issueNo, title: item.title.trim(), description: item.description.trim(), impactSummary: item.impactSummary.trim(), referenceNotes: item.referenceNotes.trim(), occurrenceDate: dateAtUtc(item.occurrenceDate), reportedBy: item.reportedBy?.trim() || null, responsibleParty: item.responsibleParty, delayCause: item.delayCause, affectedActivityIds: JSON.stringify(item.proposal.affectedActivityIds), replacedRelationshipId: item.replacedRelationshipId.trim(), proposedDurationDays: String(item.proposal.durationDays), criticality: item.criticality, fragnetProposalJson: JSON.stringify(item.proposal), status: "open" as const, ownerUserId })));
    return normalized.length;
  });
}

async function getOwnedIssue(ownerUserId: number, id: number) {
  const db = await requireDb();
  const [issue] = await db.select().from(plannerIssueLogs).where(and(eq(plannerIssueLogs.id, id), eq(plannerIssueLogs.ownerUserId, ownerUserId))).limit(1);
  if (!issue) throw new Error("القضية غير موجودة أو لا تملك صلاحية الوصول إليها.");
  return { db, issue };
}

export async function prepareIssueFragnet(ownerUserId: number, id: number) {
  const { db, issue } = await getOwnedIssue(ownerUserId, id);
  if (issue.status !== "open") throw new Error("يمكن تجهيز قضية مفتوحة فقط للتحويل إلى Fragnet.");
  await db.update(plannerIssueLogs).set({ status: "ready_for_fragnet", reviewedBy: ownerUserId, reviewedAt: new Date() }).where(eq(plannerIssueLogs.id, id));
  return issue.fragnetProposalJson;
}

export async function recordIssueFragnetApplied(ownerUserId: number, id: number) {
  const { db, issue } = await getOwnedIssue(ownerUserId, id);
  if (issue.status !== "ready_for_fragnet") throw new Error("اعتمد Fragnet المقترح أولاً قبل تسجيل التطبيق في البرنامج.");
  await db.update(plannerIssueLogs).set({ status: "applied", reviewedBy: ownerUserId, reviewedAt: new Date(), appliedAt: new Date() }).where(eq(plannerIssueLogs.id, id));
  return issue.fragnetProposalJson;
}

export async function setIssueStatus(ownerUserId: number, id: number, status: Extract<IssueStatus, "rejected" | "closed">) {
  const { db, issue } = await getOwnedIssue(ownerUserId, id);
  if (issue.status === "applied") throw new Error("لا يمكن تغيير حالة قضية تم تسجيل تطبيقها؛ أضف قضية تصحيحية جديدة للحفاظ على أثر التدقيق.");
  await db.update(plannerIssueLogs).set({ status, reviewedBy: ownerUserId, reviewedAt: new Date() }).where(eq(plannerIssueLogs.id, id));
}

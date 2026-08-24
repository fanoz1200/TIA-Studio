import { and, desc, eq, inArray } from "drizzle-orm";
import { claimCandidates, claimChains, claimDeadlineTrackers, claimRisks, plannerIssueLogs, projectContractProfiles } from "../drizzle/schema";
import { getDb } from "./db";

export type SourceStatus = "sourced" | "to_enrich" | "review_required" | "rejected";
export type RiskStatus = "open" | "monitoring" | "escalated" | "closed";
export type CandidateStatus = "draft" | "under_review" | "ready_for_notice" | "linked_to_claim" | "closed";
export type DeadlineKind = "notice" | "particulars" | "substantiation" | "other";
export type DeadlineMode = "manual_date" | "calendar_days";
export type DeadlineStatus = "unconfigured" | "tracking" | "review_required" | "completed" | "superseded";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات Claim Console غير متاحة حالياً.");
  return db;
}

function asUtcDate(value?: string | null) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

/**
 * حساب تاريخ تقويمي معلن فقط؛ لا يعرف التطبيق إن كانت القاعدة صحيحة عقدياً أو
 * إن كان العد يبدأ من تاريخ العلم أو الإخطار أو أي واقعة أخرى.
 */
export function calculateCalendarDeadline(referenceDate: string, calendarDays: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) throw new Error("التاريخ المرجعي يجب أن يكون بصيغة YYYY-MM-DD.");
  if (!Number.isInteger(calendarDays) || calendarDays < 0 || calendarDays > 36_500) throw new Error("المدة التقويمية يجب أن تكون عدداً صحيحاً بين 0 و36500.");
  const value = new Date(`${referenceDate}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + calendarDays);
  return value.toISOString().slice(0, 10);
}

async function assertRiskBelongsToProject(userId: number, projectKey: string, riskId?: number | null) {
  if (!riskId) return null;
  const db = await requireDb();
  const [risk] = await db.select().from(claimRisks).where(and(eq(claimRisks.id, riskId), eq(claimRisks.ownerUserId, userId), eq(claimRisks.projectKey, projectKey))).limit(1);
  if (!risk) throw new Error("المخاطرة المختارة لا تنتمي إلى هذا المشروع أو لا تملك صلاحية الوصول إليها.");
  return risk;
}

async function assertIssueBelongsToProject(userId: number, projectKey: string, issueId?: number | null) {
  if (!issueId) return null;
  const db = await requireDb();
  const [issue] = await db.select().from(plannerIssueLogs).where(and(eq(plannerIssueLogs.id, issueId), eq(plannerIssueLogs.ownerUserId, userId), eq(plannerIssueLogs.projectKey, projectKey))).limit(1);
  if (!issue) throw new Error("الواقعة المختارة لا تنتمي إلى هذا المشروع أو لا تملك صلاحية الوصول إليها.");
  return issue;
}

async function assertChainBelongsToProject(userId: number, projectKey: string, claimChainId?: number | null) {
  if (!claimChainId) return null;
  const db = await requireDb();
  const [chain] = await db.select().from(claimChains).where(and(eq(claimChains.id, claimChainId), eq(claimChains.ownerUserId, userId), eq(claimChains.projectKey, projectKey))).limit(1);
  if (!chain) throw new Error("سلسلة المطالبة المختارة لا تنتمي إلى هذا المشروع أو لا تملك صلاحية الوصول إليها.");
  return chain;
}

export async function listClaimConsole(userId: number, projectKey: string) {
  const db = await requireDb();
  const [profile] = await db.select().from(projectContractProfiles).where(and(eq(projectContractProfiles.ownerUserId, userId), eq(projectContractProfiles.projectKey, projectKey))).limit(1);
  const risks = await db.select().from(claimRisks).where(and(eq(claimRisks.ownerUserId, userId), eq(claimRisks.projectKey, projectKey))).orderBy(desc(claimRisks.updatedAt));
  const candidates = await db.select().from(claimCandidates).where(and(eq(claimCandidates.ownerUserId, userId), eq(claimCandidates.projectKey, projectKey))).orderBy(desc(claimCandidates.updatedAt));
  const deadlines = candidates.length ? await db.select().from(claimDeadlineTrackers).where(and(eq(claimDeadlineTrackers.ownerUserId, userId), eq(claimDeadlineTrackers.projectKey, projectKey), inArray(claimDeadlineTrackers.claimCandidateId, candidates.map(candidate => candidate.id)))).orderBy(claimDeadlineTrackers.dueDate) : [];
  const issues = await db.select({ id: plannerIssueLogs.id, issueNo: plannerIssueLogs.issueNo, title: plannerIssueLogs.title, status: plannerIssueLogs.status, occurrenceDate: plannerIssueLogs.occurrenceDate }).from(plannerIssueLogs).where(and(eq(plannerIssueLogs.ownerUserId, userId), eq(plannerIssueLogs.projectKey, projectKey))).orderBy(desc(plannerIssueLogs.updatedAt));
  const chains = await db.select({ id: claimChains.id, claimKey: claimChains.claimKey, title: claimChains.title, status: claimChains.status }).from(claimChains).where(and(eq(claimChains.ownerUserId, userId), eq(claimChains.projectKey, projectKey))).orderBy(desc(claimChains.updatedAt));
  return { profile: profile ?? null, risks, candidates, deadlines, issues, chains };
}

export async function upsertContractProfile(userId: number, input: {
  projectKey: string; contractTitle?: string | null; contractForm?: string | null; contractEdition?: string | null; specialConditionsReference?: string | null; governingLaw?: string | null; claimClauseReference?: string | null; noticeTriggerDescription?: string | null; sourceReference?: string | null; sourceStatus: SourceStatus; reviewNotes?: string | null;
}) {
  const db = await requireDb();
  const values = {
    contractTitle: input.contractTitle?.trim() || null,
    contractForm: input.contractForm?.trim() || null,
    contractEdition: input.contractEdition?.trim() || null,
    specialConditionsReference: input.specialConditionsReference?.trim() || null,
    governingLaw: input.governingLaw?.trim() || null,
    claimClauseReference: input.claimClauseReference?.trim() || null,
    noticeTriggerDescription: input.noticeTriggerDescription?.trim() || null,
    sourceReference: input.sourceReference?.trim() || null,
    sourceStatus: input.sourceStatus,
    reviewNotes: input.reviewNotes?.trim() || null,
  };
  const [existing] = await db.select().from(projectContractProfiles).where(and(eq(projectContractProfiles.ownerUserId, userId), eq(projectContractProfiles.projectKey, input.projectKey))).limit(1);
  if (existing) {
    await db.update(projectContractProfiles).set(values).where(eq(projectContractProfiles.id, existing.id));
    const [updated] = await db.select().from(projectContractProfiles).where(eq(projectContractProfiles.id, existing.id)).limit(1);
    return updated;
  }
  const result = await db.insert(projectContractProfiles).values({ ownerUserId: userId, projectKey: input.projectKey, ...values });
  const [created] = await db.select().from(projectContractProfiles).where(eq(projectContractProfiles.id, Number(result[0].insertId))).limit(1);
  return created;
}

export async function createClaimRisk(userId: number, input: {
  projectKey: string; riskKey: string; title: string; description: string; identifiedDate?: string | null; ownerRole?: string | null; sourceReference?: string | null; sourceStatus: SourceStatus; status: RiskStatus; linkedPlannerIssueId?: number | null; reviewNotes?: string | null;
}) {
  await assertIssueBelongsToProject(userId, input.projectKey, input.linkedPlannerIssueId);
  const db = await requireDb();
  const [duplicate] = await db.select().from(claimRisks).where(and(eq(claimRisks.ownerUserId, userId), eq(claimRisks.projectKey, input.projectKey), eq(claimRisks.riskKey, input.riskKey))).limit(1);
  if (duplicate) throw new Error("مفتاح المخاطرة مستخدم بالفعل في هذا المشروع.");
  const result = await db.insert(claimRisks).values({ ownerUserId: userId, projectKey: input.projectKey, riskKey: input.riskKey, title: input.title, description: input.description, identifiedDate: asUtcDate(input.identifiedDate), ownerRole: input.ownerRole?.trim() || null, sourceReference: input.sourceReference?.trim() || null, sourceStatus: input.sourceStatus, status: input.status, linkedPlannerIssueId: input.linkedPlannerIssueId ?? null, reviewNotes: input.reviewNotes?.trim() || null });
  const [created] = await db.select().from(claimRisks).where(eq(claimRisks.id, Number(result[0].insertId))).limit(1);
  return created;
}

export async function createClaimCandidate(userId: number, input: {
  projectKey: string; candidateKey: string; title: string; riskId?: number | null; plannerIssueLogId?: number | null; claimChainId?: number | null; contractClauseReference?: string | null; basisSummary: string; sourceReference?: string | null; sourceStatus: SourceStatus; status: CandidateStatus; reviewNotes?: string | null;
}) {
  await Promise.all([assertRiskBelongsToProject(userId, input.projectKey, input.riskId), assertIssueBelongsToProject(userId, input.projectKey, input.plannerIssueLogId), assertChainBelongsToProject(userId, input.projectKey, input.claimChainId)]);
  if (!input.riskId && !input.plannerIssueLogId && !input.claimChainId) throw new Error("اربط مرشح المطالبة بمخاطرة أو واقعة أو سلسلة مطالبة واحدة على الأقل.");
  const db = await requireDb();
  const [duplicate] = await db.select().from(claimCandidates).where(and(eq(claimCandidates.ownerUserId, userId), eq(claimCandidates.projectKey, input.projectKey), eq(claimCandidates.candidateKey, input.candidateKey))).limit(1);
  if (duplicate) throw new Error("مفتاح مرشح المطالبة مستخدم بالفعل في هذا المشروع.");
  const result = await db.insert(claimCandidates).values({ ownerUserId: userId, projectKey: input.projectKey, candidateKey: input.candidateKey, title: input.title, riskId: input.riskId ?? null, plannerIssueLogId: input.plannerIssueLogId ?? null, claimChainId: input.claimChainId ?? null, contractClauseReference: input.contractClauseReference?.trim() || null, basisSummary: input.basisSummary, sourceReference: input.sourceReference?.trim() || null, sourceStatus: input.sourceStatus, status: input.status, reviewNotes: input.reviewNotes?.trim() || null });
  const [created] = await db.select().from(claimCandidates).where(eq(claimCandidates.id, Number(result[0].insertId))).limit(1);
  return created;
}

export async function createClaimDeadlineTracker(userId: number, input: {
  projectKey: string; claimCandidateId: number; deadlineKey: string; title: string; deadlineKind: DeadlineKind; calculationMode: DeadlineMode; referenceDate?: string | null; calendarDays?: number | null; dueDate?: string | null; ruleDescription: string; sourceReference?: string | null; sourceStatus: SourceStatus; status: DeadlineStatus; reviewNotes?: string | null;
}) {
  const db = await requireDb();
  const [candidate] = await db.select().from(claimCandidates).where(and(eq(claimCandidates.id, input.claimCandidateId), eq(claimCandidates.ownerUserId, userId), eq(claimCandidates.projectKey, input.projectKey))).limit(1);
  if (!candidate) throw new Error("مرشح المطالبة لا ينتمي إلى هذا المشروع أو لا تملك صلاحية الوصول إليه.");
  const [duplicate] = await db.select().from(claimDeadlineTrackers).where(and(eq(claimDeadlineTrackers.claimCandidateId, candidate.id), eq(claimDeadlineTrackers.deadlineKey, input.deadlineKey))).limit(1);
  if (duplicate) throw new Error("مفتاح الموعد مستخدم بالفعل لمرشح المطالبة هذا.");
  const calculatedDueDate = input.calculationMode === "calendar_days"
    ? calculateCalendarDeadline(input.referenceDate ?? "", input.calendarDays ?? -1)
    : input.dueDate ?? null;
  if (input.calculationMode === "manual_date" && !calculatedDueDate) throw new Error("أدخل التاريخ النهائي اليدوي أو اختر الحساب التقويمي الموثق.");
  const result = await db.insert(claimDeadlineTrackers).values({ ownerUserId: userId, projectKey: input.projectKey, claimCandidateId: candidate.id, deadlineKey: input.deadlineKey, title: input.title, deadlineKind: input.deadlineKind, calculationMode: input.calculationMode, referenceDate: asUtcDate(input.referenceDate), calendarDays: input.calculationMode === "calendar_days" ? input.calendarDays ?? null : null, dueDate: asUtcDate(calculatedDueDate), ruleDescription: input.ruleDescription, sourceReference: input.sourceReference?.trim() || null, sourceStatus: input.sourceStatus, status: input.status, reviewNotes: input.reviewNotes?.trim() || null });
  const [created] = await db.select().from(claimDeadlineTrackers).where(eq(claimDeadlineTrackers.id, Number(result[0].insertId))).limit(1);
  return created;
}

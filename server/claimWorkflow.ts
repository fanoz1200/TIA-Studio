import { and, asc, desc, eq } from "drizzle-orm";
import { claimReviewParticipants, claimReviews, claimReviewStages, noticeRegister, projectMembers, resourceAssignments, users } from "../drizzle/schema";
import { getDb } from "./db";

export type ReviewStage = "draft" | "planning_review" | "contract_review" | "claims_manager_approval" | "ready_to_export" | "rejected";
export type ReviewStatus = "draft" | "in_review" | "approved" | "rejected" | "ready_to_export";
export type ReviewDecision = "created" | "submitted" | "approved" | "rejected" | "commented" | "reopened";

type ClaimReviewAuditResponse = {
  review: typeof claimReviews.$inferSelect;
  audit: Array<typeof claimReviewStages.$inferSelect & { reviewerName?: string | null; reviewerEmail?: string | null }>;
  participants: Array<typeof claimReviewParticipants.$inferSelect>;
  isOwner: boolean;
};

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات سجل المطالبة غير متاحة حالياً.");
  return db;
}

function decimal(value: number | undefined) {
  return String(Math.max(0, Number.isFinite(value) ? value ?? 0 : 0));
}

function optional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function dateFromIso(value: string | null | undefined) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

export function addNoticePeriod(awarenessDate: string, noticePeriodDays: number) {
  const dueDate = dateFromIso(awarenessDate);
  if (!dueDate) throw new Error("تاريخ العلم مطلوب لاحتساب موعد الإشعار.");
  dueDate.setUTCDate(dueDate.getUTCDate() + noticePeriodDays);
  return dueDate.toISOString().slice(0, 10);
}

export function nextReviewState(currentStage: ReviewStage, currentStatus: ReviewStatus, decision: Exclude<ReviewDecision, "created">): { stage: ReviewStage; status: ReviewStatus } {
  if (decision === "commented") return { stage: currentStage, status: currentStatus };
  if (decision === "submitted" && currentStage === "draft") return { stage: "planning_review", status: "in_review" };
  if (decision === "approved" && currentStage === "planning_review") return { stage: "contract_review", status: "in_review" };
  if (decision === "approved" && currentStage === "contract_review") return { stage: "claims_manager_approval", status: "in_review" };
  if (decision === "approved" && currentStage === "claims_manager_approval") return { stage: "ready_to_export", status: "ready_to_export" };
  if (decision === "rejected" && currentStage !== "ready_to_export") return { stage: "rejected", status: "rejected" };
  if (decision === "reopened" && currentStage === "rejected") return { stage: "draft", status: "draft" };
  throw new Error("قرار المراجعة غير متاح في المرحلة الحالية.");
}

export function canRecordReviewDecision(input: { isOwner: boolean; currentStage: ReviewStage; decision: Exclude<ReviewDecision, "created">; isAssignedReviewer: boolean }) {
  const ownerAction = (input.decision === "submitted" && input.currentStage === "draft") || (input.decision === "reopened" && input.currentStage === "rejected");
  const stageAction = (input.decision === "approved" || input.decision === "rejected") && input.isAssignedReviewer;
  const commentAction = input.decision === "commented" && (input.isOwner || input.isAssignedReviewer);
  return (input.isOwner && ownerAction) || stageAction || commentAction;
}

/** تعيين المراجعين قرار إداري حصري لمنشئ مسار المطالبة، ويُفرض داخل الخادم. */
export function canAssignReviewParticipant(ownerUserId: number, actingUserId: number) {
  return ownerUserId === actingUserId;
}

export type ProjectMemberRole = "planner" | "contracts" | "claims_manager" | "viewer";

export async function listProjectMembers(ownerUserId: number, projectKey: string) {
  const db = await requireDb();
  const [owner] = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, ownerUserId)).limit(1);
  const members = await db.select({ id: projectMembers.id, memberUserId: projectMembers.memberUserId, projectRole: projectMembers.projectRole, addedAt: projectMembers.addedAt, name: users.name, email: users.email }).from(projectMembers).innerJoin(users, eq(projectMembers.memberUserId, users.id)).where(and(eq(projectMembers.ownerUserId, ownerUserId), eq(projectMembers.projectKey, projectKey))).orderBy(asc(users.name));
  return [
    ...(owner ? [{ id: 0, memberUserId: owner.id, projectRole: "owner" as const, name: owner.name || "مالك المشروع", email: owner.email, addedAt: null, isOwner: true }] : []),
    ...members.map(member => ({ ...member, name: member.name || member.email || `عضو ${member.memberUserId}`, isOwner: false })),
  ];
}

export async function addProjectMember(ownerUserId: number, input: { projectKey: string; email: string; projectRole: ProjectMemberRole }) {
  const db = await requireDb();
  const normalizedEmail = input.email.trim().toLowerCase();
  const [member] = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (!member) throw new Error("لا يوجد مستخدم مسجل بهذا البريد. اطلب من العضو تسجيل الدخول إلى التطبيق مرة واحدة أولاً.");
  if (member.id === ownerUserId) throw new Error("مالك المشروع موجود بالفعل في قائمة الأعضاء.");
  await db.insert(projectMembers).values({ ownerUserId, projectKey: input.projectKey, memberUserId: member.id, projectRole: input.projectRole, addedBy: ownerUserId }).onDuplicateKeyUpdate({ set: { projectRole: input.projectRole, addedBy: ownerUserId, updatedAt: new Date() } });
  return { memberUserId: member.id, name: member.name || member.email || "عضو المشروع", email: member.email, projectRole: input.projectRole };
}

export async function updateProjectMemberRole(ownerUserId: number, input: { projectKey: string; memberUserId: number; projectRole: ProjectMemberRole }) {
  const db = await requireDb();
  const result = await db.update(projectMembers).set({ projectRole: input.projectRole, addedBy: ownerUserId, updatedAt: new Date() }).where(and(eq(projectMembers.ownerUserId, ownerUserId), eq(projectMembers.projectKey, input.projectKey), eq(projectMembers.memberUserId, input.memberUserId)));
  if (!result[0]?.affectedRows) throw new Error("عضو المشروع غير موجود أو لا تملك صلاحية تعديل دوره.");
}

export async function removeProjectMember(ownerUserId: number, input: { projectKey: string; memberUserId: number }) {
  const db = await requireDb();
  const result = await db.delete(projectMembers).where(and(eq(projectMembers.ownerUserId, ownerUserId), eq(projectMembers.projectKey, input.projectKey), eq(projectMembers.memberUserId, input.memberUserId)));
  if (!result[0]?.affectedRows) throw new Error("عضو المشروع غير موجود أو لا تملك صلاحية حذفه.");
}

export async function replaceResourceAssignments(userId: number, input: {
  projectKey: string;
  sourceFormat: "xer" | "p6-xml" | "manual";
  assignments: Array<{
    id: string; activityId: string; resourceId?: string; resourceName?: string; resourceType: "labor" | "nonlabor" | "material" | "unknown";
    costAccountId?: string; wbsId?: string; targetQuantity?: number; remainingQuantity?: number; actualRegularQuantity?: number; actualOvertimeQuantity?: number;
    targetCost?: number; remainingCost?: number; actualRegularCost?: number; actualOvertimeCost?: number; costPerUnit?: number;
  }>;
}) {
  const db = await requireDb();
  const sourceFormat: "xer" | "p6_xml" | "manual" = input.sourceFormat === "p6-xml" ? "p6_xml" : input.sourceFormat;
  await db.transaction(async tx => {
    await tx.delete(resourceAssignments).where(and(eq(resourceAssignments.userId, userId), eq(resourceAssignments.projectKey, input.projectKey)));
    if (!input.assignments.length) return;
    await tx.insert(resourceAssignments).values(input.assignments.map(assignment => ({
      userId,
      projectKey: input.projectKey,
      activityId: assignment.activityId,
      assignmentKey: assignment.id,
      resourceId: optional(assignment.resourceId),
      resourceName: optional(assignment.resourceName),
      resourceType: assignment.resourceType,
      costAccountId: optional(assignment.costAccountId),
      wbsId: optional(assignment.wbsId),
      targetQuantity: decimal(assignment.targetQuantity),
      remainingQuantity: decimal(assignment.remainingQuantity),
      actualRegularQuantity: decimal(assignment.actualRegularQuantity),
      actualOvertimeQuantity: decimal(assignment.actualOvertimeQuantity),
      targetCost: decimal(assignment.targetCost),
      remainingCost: decimal(assignment.remainingCost),
      actualRegularCost: decimal(assignment.actualRegularCost),
      actualOvertimeCost: decimal(assignment.actualOvertimeCost),
      costPerUnit: decimal(assignment.costPerUnit),
      sourceFormat,
    })));
  });
  return { saved: input.assignments.length };
}

export async function listResourceAssignments(userId: number, projectKey: string) {
  const db = await requireDb();
  return db.select().from(resourceAssignments).where(and(eq(resourceAssignments.userId, userId), eq(resourceAssignments.projectKey, projectKey))).orderBy(asc(resourceAssignments.activityId), asc(resourceAssignments.id));
}

export async function listNotices(userId: number, projectKey: string, claimKey?: string) {
  const db = await requireDb();
  const filters = [eq(noticeRegister.userId, userId), eq(noticeRegister.projectKey, projectKey)];
  if (claimKey) filters.push(eq(noticeRegister.claimKey, claimKey));
  const notices = await db.select().from(noticeRegister).where(and(...filters)).orderBy(desc(noticeRegister.updatedAt));
  const today = new Date().toISOString().slice(0, 10);
  return notices.map(notice => ({
    ...notice,
    computedStatus: notice.status !== "sent" && notice.status !== "cancelled" && notice.noticeDueDate && notice.noticeDueDate.toISOString().slice(0, 10) < today ? "overdue" : notice.status,
  }));
}

export async function createNotice(userId: number, input: {
  projectKey: string; claimKey: string; eventKey: string; noticeNo: string; sender?: string; recipient?: string; contractClause?: string;
  awarenessDate?: string | null; noticeDueDate?: string | null; sentDate?: string | null; status: "draft" | "under_review" | "sent" | "overdue" | "cancelled";
  narrative: string; timeImpactDays?: number; costImpact?: number; evidenceReferenceIds?: string[];
}) {
  const db = await requireDb();
  const result = await db.insert(noticeRegister).values({
    userId, projectKey: input.projectKey, claimKey: input.claimKey, eventKey: input.eventKey, noticeNo: input.noticeNo.trim(),
    sender: optional(input.sender), recipient: optional(input.recipient), contractClause: optional(input.contractClause),
    awarenessDate: dateFromIso(input.awarenessDate), noticeDueDate: dateFromIso(input.noticeDueDate), sentDate: dateFromIso(input.sentDate), status: input.status,
    narrative: input.narrative.trim(), timeImpactDays: decimal(input.timeImpactDays), costImpact: decimal(input.costImpact),
    evidenceReferenceIds: input.evidenceReferenceIds?.length ? JSON.stringify(input.evidenceReferenceIds) : null,
  });
  return Number(result[0].insertId);
}

/**
 * ينشئ مسودة واحدة قابلة للتتبع لكل حدث. لا يرسل أي مراسلات، ويعيد المسودة القائمة
 * عند تكرار الضغط بدلاً من إنشاء Notice مكرر.
 */
export async function createAutomaticNoticeDraft(userId: number, input: {
  projectKey: string; claimKey: string; eventKey: string; eventTitle: string; awarenessDate: string;
  noticePeriodDays: number; timeImpactDays?: number; costImpact?: number; evidenceReferenceIds?: string[];
}) {
  const db = await requireDb();
  const noticeNo = `AUTO-${input.eventKey}`.slice(0, 128);
  const [existing] = await db.select().from(noticeRegister).where(and(
    eq(noticeRegister.userId, userId),
    eq(noticeRegister.projectKey, input.projectKey),
    eq(noticeRegister.noticeNo, noticeNo),
  )).limit(1);
  if (existing) return { id: existing.id, created: false, noticeNo: existing.noticeNo };
  const noticeDueDate = addNoticePeriod(input.awarenessDate, input.noticePeriodDays);
  const id = await createNotice(userId, {
    projectKey: input.projectKey,
    claimKey: input.claimKey,
    eventKey: input.eventKey,
    noticeNo,
    awarenessDate: input.awarenessDate,
    noticeDueDate,
    status: "draft",
    narrative: `مسودة إشعار أولي بواقعة «${input.eventTitle}» المؤرخة في ${input.awarenessDate}، مع حفظ الحقوق التعاقدية لحين اكتمال المراجعة الفنية والتعاقدية.`,
    timeImpactDays: input.timeImpactDays,
    costImpact: input.costImpact,
    evidenceReferenceIds: input.evidenceReferenceIds,
  });
  return { id, created: true, noticeNo };
}

export async function updateNotice(userId: number, id: number, input: {
  sender?: string; recipient?: string; contractClause?: string; awarenessDate?: string | null; noticeDueDate?: string | null; sentDate?: string | null;
  status: "draft" | "under_review" | "sent" | "overdue" | "cancelled"; narrative: string; timeImpactDays?: number; costImpact?: number; evidenceReferenceIds?: string[];
}) {
  const db = await requireDb();
  const [existing] = await db.select().from(noticeRegister).where(and(eq(noticeRegister.id, id), eq(noticeRegister.userId, userId))).limit(1);
  if (!existing) throw new Error("الإشعار غير موجود أو لا تملك صلاحية تعديله.");
  if (existing.status === "sent" || existing.status === "cancelled") throw new Error("لا يمكن تعديل إشعار مرسل أو ملغى؛ أنشئ إشعاراً لاحقاً عند الحاجة.");
  await db.update(noticeRegister).set({
    sender: optional(input.sender), recipient: optional(input.recipient), contractClause: optional(input.contractClause),
    awarenessDate: dateFromIso(input.awarenessDate), noticeDueDate: dateFromIso(input.noticeDueDate), sentDate: dateFromIso(input.sentDate), status: input.status,
    narrative: input.narrative.trim(), timeImpactDays: decimal(input.timeImpactDays), costImpact: decimal(input.costImpact),
    evidenceReferenceIds: input.evidenceReferenceIds?.length ? JSON.stringify(input.evidenceReferenceIds) : null,
  }).where(and(eq(noticeRegister.id, id), eq(noticeRegister.userId, userId)));
}

export async function getOrCreateClaimReview(userId: number, input: { projectKey: string; claimKey: string; claimTitle: string }) {
  const db = await requireDb();
  const [existing] = await db.select().from(claimReviews).where(and(eq(claimReviews.userId, userId), eq(claimReviews.projectKey, input.projectKey), eq(claimReviews.claimKey, input.claimKey))).limit(1);
  if (existing) return existing;
  const result = await db.insert(claimReviews).values({ userId, projectKey: input.projectKey, claimKey: input.claimKey, claimTitle: input.claimTitle.trim(), createdBy: userId });
  const id = Number(result[0].insertId);
  await db.insert(claimReviewStages).values({ claimReviewId: id, stage: "draft", reviewerId: userId, decision: "created", comment: "تم إنشاء مسار المراجعة." });
  await db.insert(claimReviewParticipants).values([
    { claimReviewId: id, stage: "planning_review", reviewerId: userId, assignedBy: userId },
    { claimReviewId: id, stage: "contract_review", reviewerId: userId, assignedBy: userId },
    { claimReviewId: id, stage: "claims_manager_approval", reviewerId: userId, assignedBy: userId },
  ]);
  const [created] = await db.select().from(claimReviews).where(eq(claimReviews.id, id)).limit(1);
  return created;
}

export async function getClaimReviewWithAudit(userId: number, projectKey: string, claimKey: string): Promise<ClaimReviewAuditResponse | null> {
  const db = await requireDb();
  const [ownedReview] = await db.select().from(claimReviews).where(and(eq(claimReviews.userId, userId), eq(claimReviews.projectKey, projectKey), eq(claimReviews.claimKey, claimKey))).limit(1);
  const [assignedReview] = ownedReview ? [] : await db.select({ review: claimReviews }).from(claimReviewParticipants).innerJoin(claimReviews, eq(claimReviewParticipants.claimReviewId, claimReviews.id)).where(and(eq(claimReviewParticipants.reviewerId, userId), eq(claimReviews.projectKey, projectKey), eq(claimReviews.claimKey, claimKey))).limit(1);
  const review = ownedReview ?? assignedReview?.review;
  if (!review) return null;
  const audit = await db.select().from(claimReviewStages).where(eq(claimReviewStages.claimReviewId, review.id)).orderBy(asc(claimReviewStages.recordedAt), asc(claimReviewStages.id));
  const participants = await db.select().from(claimReviewParticipants).where(eq(claimReviewParticipants.claimReviewId, review.id)).orderBy(asc(claimReviewParticipants.stage));
  return { review, audit, participants, isOwner: review.userId === userId };
}

export async function assignReviewParticipant(userId: number, input: { reviewId: number; stage: "planning_review" | "contract_review" | "claims_manager_approval"; reviewerId: number }) {
  const db = await requireDb();
  await db.transaction(async tx => {
    const [review] = await tx.select().from(claimReviews).where(and(eq(claimReviews.id, input.reviewId), eq(claimReviews.userId, userId))).limit(1);
    if (!review || !canAssignReviewParticipant(review.userId, userId)) throw new Error("لا يملك سوى منشئ المطالبة تعيين مراجعي مراحلها.");
    const [reviewer] = await tx.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, input.reviewerId)).limit(1);
    if (!reviewer) throw new Error("معرّف المراجع غير صحيح.");
    if (reviewer.id !== review.userId) {
      const [membership] = await tx.select({ id: projectMembers.id }).from(projectMembers).where(and(eq(projectMembers.ownerUserId, review.userId), eq(projectMembers.projectKey, review.projectKey), eq(projectMembers.memberUserId, reviewer.id))).limit(1);
      if (!membership) throw new Error("لا يمكن تعيين مراجع خارج قائمة أعضاء هذا المشروع.");
    }
    await tx.insert(claimReviewParticipants).values({ claimReviewId: review.id, stage: input.stage, reviewerId: input.reviewerId, assignedBy: userId }).onDuplicateKeyUpdate({ set: { reviewerId: input.reviewerId, assignedBy: userId, assignedAt: new Date() } });
    await tx.insert(claimReviewStages).values({ claimReviewId: review.id, stage: input.stage, reviewerId: userId, decision: "commented", comment: `تم تعيين المراجع «${reviewer.name || reviewer.email || "عضو المشروع"}» لهذه المرحلة.` });
  });
  return getClaimReviewById(userId, input.reviewId);
}

export async function recordReviewDecision(userId: number, input: { reviewId: number; decision: Exclude<ReviewDecision, "created">; comment?: string }) {
  const db = await requireDb();
  await db.transaction(async tx => {
    const [review] = await tx.select().from(claimReviews).where(eq(claimReviews.id, input.reviewId)).limit(1);
    if (!review) throw new Error("مسار المراجعة غير موجود.");
    const isOwner = review.userId === userId;
    const stage = review.currentStage as ReviewStage;
    const [assignment] = await tx.select().from(claimReviewParticipants).where(and(eq(claimReviewParticipants.claimReviewId, review.id), eq(claimReviewParticipants.stage, stage as "planning_review" | "contract_review" | "claims_manager_approval"), eq(claimReviewParticipants.reviewerId, userId))).limit(1);
    if (!canRecordReviewDecision({ isOwner, currentStage: stage, decision: input.decision, isAssignedReviewer: Boolean(assignment) })) throw new Error("لا تملك صلاحية اتخاذ هذا القرار في مرحلة المراجعة الحالية.");
    const next = nextReviewState(review.currentStage as ReviewStage, review.status as ReviewStatus, input.decision);
    await tx.update(claimReviews).set({ currentStage: next.stage, status: next.status }).where(eq(claimReviews.id, review.id));
    await tx.insert(claimReviewStages).values({ claimReviewId: review.id, stage: review.currentStage, reviewerId: userId, decision: input.decision, comment: optional(input.comment) });
  });
  return getClaimReviewById(userId, input.reviewId);
}

async function getClaimReviewById(userId: number, reviewId: number): Promise<ClaimReviewAuditResponse> {
  const db = await requireDb();
  const [ownedReview] = await db.select().from(claimReviews).where(and(eq(claimReviews.id, reviewId), eq(claimReviews.userId, userId))).limit(1);
  const [assignedReview] = ownedReview ? [] : await db.select({ review: claimReviews }).from(claimReviewParticipants).innerJoin(claimReviews, eq(claimReviewParticipants.claimReviewId, claimReviews.id)).where(and(eq(claimReviewParticipants.claimReviewId, reviewId), eq(claimReviewParticipants.reviewerId, userId))).limit(1);
  const review = ownedReview ?? assignedReview?.review;
  if (!review) throw new Error("تعذر استرجاع مسار المراجعة بعد تحديثه.");
  const audit = await db.select().from(claimReviewStages).where(eq(claimReviewStages.claimReviewId, review.id)).orderBy(asc(claimReviewStages.recordedAt), asc(claimReviewStages.id));
  const participants = await db.select().from(claimReviewParticipants).where(eq(claimReviewParticipants.claimReviewId, review.id)).orderBy(asc(claimReviewParticipants.stage));
  return { review, audit, participants, isOwner: review.userId === userId };
}

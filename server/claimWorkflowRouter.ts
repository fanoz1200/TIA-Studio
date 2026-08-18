import { z } from "zod";
import { acceptProjectInvitation, addProjectMember, assignReviewParticipant, cancelProjectInvitation, createAutomaticNoticeDraft, createNotice, createProjectInvitation, getClaimReviewWithAudit, getOrCreateClaimReview, listNotices, listProjectInvitations, listProjectMembers, listResourceAssignments, recordReviewDecision, removeProjectMember, replaceResourceAssignments, updateNotice, updateProjectMemberRole } from "./claimWorkflow";
import { protectedProcedure, router } from "./_core/trpc";

const key = z.string().trim().min(1).max(128);
const optionalText = z.string().trim().max(8_000).optional();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();
const nonNegative = z.number().finite().min(0).optional();
const resourceType = z.enum(["labor", "nonlabor", "material", "unknown"]);
const noticeStatus = z.enum(["draft", "under_review", "sent", "overdue", "cancelled"]);
const projectRole = z.enum(["planner", "contracts", "claims_manager", "viewer"]);

const resourceAssignment = z.object({
  id: key, activityId: key, resourceId: z.string().trim().max(128).optional(), resourceName: z.string().trim().max(255).optional(), resourceType,
  costAccountId: z.string().trim().max(128).optional(), wbsId: z.string().trim().max(128).optional(),
  targetQuantity: nonNegative, remainingQuantity: nonNegative, actualRegularQuantity: nonNegative, actualOvertimeQuantity: nonNegative,
  targetCost: nonNegative, remainingCost: nonNegative, actualRegularCost: nonNegative, actualOvertimeCost: nonNegative, costPerUnit: nonNegative,
});

const noticeFields = z.object({
  sender: z.string().trim().max(255).optional(), recipient: z.string().trim().max(255).optional(), contractClause: z.string().trim().max(255).optional(),
  awarenessDate: date, noticeDueDate: date, sentDate: date, status: noticeStatus, narrative: z.string().trim().min(1).max(12_000),
  timeImpactDays: nonNegative, costImpact: nonNegative, evidenceReferenceIds: z.array(z.string().trim().min(1).max(128)).max(100).optional(),
});

export const resourceAssignmentRouter = router({
  list: protectedProcedure.input(z.object({ projectKey: key })).query(({ ctx, input }) => listResourceAssignments(ctx.user.id, input.projectKey)),
  replaceFromImport: protectedProcedure.input(z.object({ projectKey: key, sourceFormat: z.enum(["xer", "p6-xml", "manual"]), assignments: z.array(resourceAssignment).max(10_000) })).mutation(({ ctx, input }) => replaceResourceAssignments(ctx.user.id, input)),
});

export const noticeRouter = router({
  list: protectedProcedure.input(z.object({ projectKey: key, claimKey: key.optional() })).query(({ ctx, input }) => listNotices(ctx.user.id, input.projectKey, input.claimKey)),
  create: protectedProcedure.input(z.object({ projectKey: key, claimKey: key, eventKey: key, noticeNo: z.string().trim().min(1).max(128) }).merge(noticeFields)).mutation(({ ctx, input }) => createNotice(ctx.user.id, input)),
  createAutomaticDraft: protectedProcedure.input(z.object({
    projectKey: key, claimKey: key, eventKey: key, eventTitle: z.string().trim().min(1).max(255),
    awarenessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), noticePeriodDays: z.number().int().min(0).max(365).default(7),
    timeImpactDays: nonNegative, costImpact: nonNegative, evidenceReferenceIds: z.array(z.string().trim().min(1).max(128)).max(100).optional(), concurrencySummary: optionalText,
  })).mutation(({ ctx, input }) => createAutomaticNoticeDraft(ctx.user.id, input)),
  update: protectedProcedure.input(z.object({ id: z.number().int().positive() }).merge(noticeFields)).mutation(({ ctx, input }) => updateNotice(ctx.user.id, input.id, input)),
});

export const claimReviewRouter = router({
  getOrCreate: protectedProcedure.input(z.object({ projectKey: key, claimKey: key, claimTitle: z.string().trim().min(1).max(255) })).mutation(({ ctx, input }) => getOrCreateClaimReview(ctx.user.id, input)),
  get: protectedProcedure.input(z.object({ projectKey: key, claimKey: key })).query(({ ctx, input }) => getClaimReviewWithAudit(ctx.user.id, input.projectKey, input.claimKey)),
  assignParticipant: protectedProcedure.input(z.object({ reviewId: z.number().int().positive(), stage: z.enum(["planning_review", "contract_review", "claims_manager_approval"]), reviewerId: z.number().int().positive() })).mutation(({ ctx, input }) => assignReviewParticipant(ctx.user.id, input)),
  decide: protectedProcedure.input(z.object({ reviewId: z.number().int().positive(), decision: z.enum(["submitted", "approved", "rejected", "commented", "reopened"]), comment: optionalText })).mutation(({ ctx, input }) => recordReviewDecision(ctx.user.id, input)),
});

export const projectMemberRouter = router({
  list: protectedProcedure.input(z.object({ projectKey: key })).query(({ ctx, input }) => listProjectMembers(ctx.user.id, input.projectKey)),
  addByEmail: protectedProcedure.input(z.object({ projectKey: key, email: z.string().trim().email().max(320), projectRole })).mutation(({ ctx, input }) => addProjectMember(ctx.user.id, input)),
  updateRole: protectedProcedure.input(z.object({ projectKey: key, memberUserId: z.number().int().positive(), projectRole })).mutation(({ ctx, input }) => updateProjectMemberRole(ctx.user.id, input)),
  remove: protectedProcedure.input(z.object({ projectKey: key, memberUserId: z.number().int().positive() })).mutation(({ ctx, input }) => removeProjectMember(ctx.user.id, input)),
});

export const projectInvitationRouter = router({
  list: protectedProcedure.input(z.object({ projectKey: key })).query(({ ctx, input }) => listProjectInvitations(ctx.user.id, input.projectKey)),
  create: protectedProcedure.input(z.object({ projectKey: key, email: z.string().trim().email().max(320), projectRole, origin: z.string().url().max(512) })).mutation(({ ctx, input }) => createProjectInvitation(ctx.user.id, input)),
  cancel: protectedProcedure.input(z.object({ projectKey: key, invitationId: z.number().int().positive() })).mutation(({ ctx, input }) => cancelProjectInvitation(ctx.user.id, input)),
  accept: protectedProcedure.input(z.object({ token: z.string().trim().min(40).max(256) })).mutation(({ ctx, input }) => acceptProjectInvitation(ctx.user.id, input.token)),
});

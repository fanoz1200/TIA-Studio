import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { createPlannerIssue, listPlannerIssues, prepareIssueFragnet, recordIssueFragnetApplied, setIssueStatus } from "./issueLog";

const key = z.string().trim().min(1).max(128);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const issueInput = z.object({
  projectKey: key, issueNo: key, title: z.string().trim().min(3).max(255), description: z.string().trim().min(10).max(20000), occurrenceDate: date,
  reportedBy: z.string().trim().max(255).optional(), responsibleParty: z.enum(["employer", "contractor", "engineer", "third_party", "undetermined"]), delayCause: z.enum(["employer", "contractor", "neutral"]),
  affectedActivityIds: z.array(key).min(1).max(100), replacedRelationshipId: key, proposedDurationDays: z.number().finite().positive().max(3650), criticality: z.enum(["unknown", "potentially_critical", "critical", "noncritical"]),
});

export const issueLogRouter = router({
  list: protectedProcedure.input(z.object({ projectKey: key })).query(({ ctx, input }) => listPlannerIssues(ctx.user.id, input.projectKey)),
  create: protectedProcedure.input(issueInput).mutation(({ ctx, input }) => createPlannerIssue(ctx.user.id, input)),
  prepareFragnet: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => prepareIssueFragnet(ctx.user.id, input.id)),
  recordApplied: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => recordIssueFragnetApplied(ctx.user.id, input.id)),
  close: protectedProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["rejected", "closed"]) })).mutation(({ ctx, input }) => setIssueStatus(ctx.user.id, input.id, input.status)),
});

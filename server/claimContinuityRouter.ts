import { z } from "zod";
import { createClaimChain, createConcurrentDelayRecord, listClaimContinuity, updateClaimNarrative } from "./claimContinuity";
import { protectedProcedure, router } from "./_core/trpc";

const key = z.string().trim().min(1).max(128);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();

export const claimContinuityRouter = router({
  list: protectedProcedure.input(z.object({ projectKey: key })).query(({ ctx, input }) => listClaimContinuity(ctx.user.id, input.projectKey)),
  create: protectedProcedure.input(z.object({ projectKey: key, claimKey: key, title: z.string().trim().min(3).max(255), parentClaimId: z.number().int().positive().nullable().optional(), periodStart: date, periodEnd: date, methodology: z.string().trim().max(160).optional(), analystPosition: z.string().trim().max(8000).optional() })).mutation(({ ctx, input }) => createClaimChain(ctx.user.id, input)),
  updateNarrative: protectedProcedure.input(z.object({ id: z.number().int().positive(), title: z.string().trim().min(3).max(255).optional(), periodStart: date, periodEnd: date, methodology: z.string().trim().max(160).optional(), analystPosition: z.string().trim().max(8000).optional(), status: z.enum(["draft", "under_review", "ready_to_export", "closed"]).optional() })).mutation(({ ctx, input }) => updateClaimNarrative(ctx.user.id, input)),
  addConcurrency: protectedProcedure.input(z.object({ projectKey: key, claimChainId: z.number().int().positive(), analysisWindowKey: key, primaryEventKey: key, concurrentEventKey: key, overlapStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), overlapEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), responsibility: z.enum(["employer", "contractor", "neutral", "mixed", "undetermined"]), treatment: z.enum(["unresolved", "separate", "absorbed", "apportioned"]), notes: z.string().trim().min(5).max(12000) })).mutation(({ ctx, input }) => createConcurrentDelayRecord(ctx.user.id, input)),
});

import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { claimTemplateRouter, evidenceRouter } from "./evidenceRouter";
import { claimReviewRouter, noticeRouter, projectInvitationRouter, projectMemberRouter, resourceAssignmentRouter } from "./claimWorkflowRouter";
import { knowledgeCentreRouter } from "./knowledgeCentreRouter";
import { claimContinuityRouter } from "./claimContinuityRouter";
import { issueLogRouter } from "./issueLogRouter";
import { claimConsoleRouter } from "./claimConsoleRouter";
import { trainingReferenceRouter } from "./trainingReferenceRouter";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  evidence: evidenceRouter,
  claimTemplate: claimTemplateRouter,
  resourceAssignment: resourceAssignmentRouter,
  notice: noticeRouter,
  claimReview: claimReviewRouter,
  projectMember: projectMemberRouter,
  projectInvitation: projectInvitationRouter,
  knowledgeCentre: knowledgeCentreRouter,
  claimContinuity: claimContinuityRouter,
  issueLog: issueLogRouter,
  claimConsole: claimConsoleRouter,
  trainingReference: trainingReferenceRouter,
});

export type AppRouter = typeof appRouter;

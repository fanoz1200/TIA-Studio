import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { listTrainingReferences } from "./trainingReference";

const projectSchema = z.object({ projectKey: z.string().min(1).max(128) });

export const trainingReferenceRouter = router({
  list: protectedProcedure
    .input(projectSchema)
    .query(({ ctx, input }) => listTrainingReferences(ctx.user.id, input.projectKey)),
});

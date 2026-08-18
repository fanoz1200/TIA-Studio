import { z } from "zod";
import { storagePut } from "./storage";
import { deleteClaimTemplate, deleteEvidenceDocument, listClaimTemplates, listEvidenceForEvent, saveClaimTemplate, saveEvidenceDocument } from "./evidence";
import { protectedProcedure, router } from "./_core/trpc";

const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
const evidenceTypeSchema = z.enum(["correspondence", "instruction", "drawing", "programme", "photo", "report", "other"]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable();

function safeSegment(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "file";
}

function decodeBase64(data: string) {
  const payload = data.includes(",") ? data.slice(data.indexOf(",") + 1) : data;
  if (!/^[a-zA-Z0-9+/=\s]+$/.test(payload)) throw new Error("ترميز الملف غير صالح.");
  return Buffer.from(payload, "base64");
}

export const evidenceRouter = router({
  list: protectedProcedure.input(z.object({ projectKey: z.string().min(1).max(128), eventKey: z.string().min(1).max(128) })).query(({ ctx, input }) =>
    listEvidenceForEvent(ctx.user.id, input.projectKey, input.eventKey),
  ),
  upload: protectedProcedure.input(z.object({
    projectKey: z.string().min(1).max(128),
    eventKey: z.string().min(1).max(128),
    title: z.string().min(1).max(255),
    description: z.string().max(8_000).optional(),
    evidenceType: evidenceTypeSchema,
    receivedAt: dateSchema,
    fileName: z.string().min(1).max(512),
    mimeType: z.string().min(1).max(160),
    dataBase64: z.string().min(4).max(14_000_000),
  })).mutation(async ({ ctx, input }) => {
    const bytes = decodeBase64(input.dataBase64);
    if (!bytes.length) throw new Error("الملف المرفوع فارغ.");
    if (bytes.length > MAX_EVIDENCE_BYTES) throw new Error("الحد الأقصى لحجم المرفق هو 10 MB.");
    const name = safeSegment(input.fileName);
    const key = `tia-evidence/user-${ctx.user.id}/project-${safeSegment(input.projectKey)}/event-${safeSegment(input.eventKey)}/${name}`;
    const stored = await storagePut(key, bytes, input.mimeType || "application/octet-stream");
    const id = await saveEvidenceDocument({
      userId: ctx.user.id,
      projectKey: input.projectKey,
      eventKey: input.eventKey,
      title: input.title,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: bytes.length,
      evidenceType: input.evidenceType,
      storageKey: stored.key,
      storageUrl: stored.url,
      description: input.description || null,
      receivedAt: input.receivedAt ? new Date(`${input.receivedAt}T00:00:00.000Z`) : null,
    });
    return { id, url: stored.url };
  }),
  remove: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteEvidenceDocument(ctx.user.id, input.id)),
});

export const claimTemplateRouter = router({
  list: protectedProcedure.query(({ ctx }) => listClaimTemplates(ctx.user.id)),
  create: protectedProcedure.input(z.object({
    title: z.string().min(1).max(255),
    recipient: z.string().max(255).optional(),
    contractReference: z.string().max(255).optional(),
    introduction: z.string().max(12_000).optional(),
    entitlementPosition: z.string().max(12_000).optional(),
    reliefRequested: z.string().max(12_000).optional(),
    closing: z.string().max(12_000).optional(),
    isDefault: z.boolean().optional(),
  })).mutation(async ({ ctx, input }) => ({ id: await saveClaimTemplate({ ...input, userId: ctx.user.id, isDefault: input.isDefault ? 1 : 0 }) })),
  remove: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteClaimTemplate(ctx.user.id, input.id)),
});

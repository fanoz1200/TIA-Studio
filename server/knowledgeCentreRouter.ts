import { z } from "zod";
import { storagePut } from "./storage";
import { deleteMethodologyDocument, deleteTutorialVideo, hashMethodologyHtml, listMethodologyDocuments, listTutorialVideos, safeExternalVideoUrl, safeLibraryFileSegment, sanitizeMethodologyHtml, saveMethodologyDocument, saveTutorialVideo, readMethodologyDocument } from "./knowledgeCentre";
import { protectedProcedure, router } from "./_core/trpc";

const projectSchema = z.object({ projectKey: z.string().min(1).max(128) });
const MAX_LIBRARY_BYTES = 12 * 1024 * 1024;

function decodeBase64(data: string) {
  const payload = data.includes(",") ? data.slice(data.indexOf(",") + 1) : data;
  if (!/^[a-zA-Z0-9+/=\s]+$/.test(payload)) throw new Error("ترميز ملف المكتبة غير صالح.");
  return Buffer.from(payload, "base64");
}

export const knowledgeCentreRouter = router({
  videoList: protectedProcedure.input(projectSchema).query(({ ctx, input }) => listTutorialVideos(ctx.user.id, input.projectKey)),
  videoCreate: protectedProcedure.input(projectSchema.extend({
    title: z.string().min(3).max(255),
    track: z.enum(["tia", "concurrent", "primavera"]),
    description: z.string().max(3_000).optional(),
    videoUrl: z.string().url().max(2048),
  })).mutation(async ({ ctx, input }) => {
    const videoUrl = safeExternalVideoUrl(input.videoUrl);
    if (!videoUrl) throw new Error("استخدم رابط HTTPS من YouTube أو Vimeo فقط.");
    return { id: await saveTutorialVideo({ ...input, userId: ctx.user.id, videoUrl, description: input.description || null }) };
  }),
  videoRemove: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteTutorialVideo(ctx.user.id, input.id)),
  libraryList: protectedProcedure.input(projectSchema).query(({ ctx, input }) => listMethodologyDocuments(ctx.user.id, input.projectKey)),
  libraryUpload: protectedProcedure.input(projectSchema.extend({
    title: z.string().min(3).max(255),
    versionLabel: z.string().max(120).optional(),
    fileName: z.string().min(1).max(512),
    dataBase64: z.string().min(4).max(17_000_000),
  })).mutation(async ({ ctx, input }) => {
    if (!/\.html?$/i.test(input.fileName)) throw new Error("تقبل المكتبة ملفات HTML أو HTM فقط.");
    const bytes = decodeBase64(input.dataBase64);
    if (!bytes.length) throw new Error("ملف المكتبة فارغ.");
    if (bytes.length > MAX_LIBRARY_BYTES) throw new Error("الحد الأقصى لملف المكتبة هو 12 MB.");
    const sanitizedHtml = sanitizeMethodologyHtml(bytes.toString("utf8"));
    if (!sanitizedHtml || sanitizedHtml.replace(/<[^>]+>/g, "").trim().length < 20) throw new Error("لم يبق محتوى قرائي صالح بعد إزالة العناصر البرمجية وغير الآمنة.");
    const key = `tia-methodology/user-${ctx.user.id}/project-${safeLibraryFileSegment(input.projectKey)}/${safeLibraryFileSegment(input.fileName)}`;
    // Store with text/plain so a direct storage URL cannot execute as HTML.
    const stored = await storagePut(key, sanitizedHtml, "text/plain; charset=utf-8");
    const id = await saveMethodologyDocument({
      userId: ctx.user.id, projectKey: input.projectKey, title: input.title, versionLabel: input.versionLabel || null,
      fileName: input.fileName, storageKey: stored.key, storageUrl: stored.url, sizeBytes: Buffer.byteLength(sanitizedHtml, "utf8"), contentSha256: hashMethodologyHtml(sanitizedHtml),
    });
    return { id, url: stored.url };
  }),
  libraryRead: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(({ ctx, input }) => readMethodologyDocument(ctx.user.id, input.id)),
  libraryRemove: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteMethodologyDocument(ctx.user.id, input.id)),
});

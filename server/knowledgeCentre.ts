import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { methodologyLibraryDocuments, tutorialVideos, type InsertMethodologyLibraryDocument, type InsertTutorialVideo } from "../drizzle/schema";
import { getDb } from "./db";
import { storageGetSignedUrl } from "./storage";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات مركز المعرفة غير متاحة حالياً.");
  return db;
}

/** A conservative HTML reduction. It intentionally removes active, embedded, and navigation-capable features. */
export function sanitizeMethodologyHtml(value: string) {
  return value
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\s*(script|style|iframe|object|embed|link|base|meta|form|svg|math)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*\/?\s*(script|style|iframe|object|embed|link|base|meta|form|svg|math)[^>]*>/gi, "")
    .replace(/\s+(on[a-z]+|style|srcdoc)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(href|src)\s*=\s*("|')\s*(javascript:|data:)[\s\S]*?\2/gi, "")
    .replace(/\s+(href|src)\s*=\s*javascript:[^\s>]+/gi, "")
    .trim();
}

export function safeExternalVideoUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    const allowed = host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be" || host === "vimeo.com" || host.endsWith(".vimeo.com");
    return allowed ? url.toString() : null;
  } catch {
    return null;
  }
}

export function safeLibraryFileSegment(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "library";
}

export async function listTutorialVideos(userId: number, projectKey: string) {
  const db = await requireDb();
  return db.select().from(tutorialVideos).where(and(eq(tutorialVideos.userId, userId), eq(tutorialVideos.projectKey, projectKey))).orderBy(desc(tutorialVideos.createdAt));
}

export async function saveTutorialVideo(video: InsertTutorialVideo) {
  const db = await requireDb();
  const result = await db.insert(tutorialVideos).values(video);
  return Number(result[0].insertId);
}

export async function deleteTutorialVideo(userId: number, id: number) {
  const db = await requireDb();
  await db.delete(tutorialVideos).where(and(eq(tutorialVideos.id, id), eq(tutorialVideos.userId, userId)));
}

export async function listMethodologyDocuments(userId: number, projectKey: string) {
  const db = await requireDb();
  return db.select().from(methodologyLibraryDocuments).where(and(eq(methodologyLibraryDocuments.userId, userId), eq(methodologyLibraryDocuments.projectKey, projectKey))).orderBy(desc(methodologyLibraryDocuments.createdAt));
}

export async function saveMethodologyDocument(document: InsertMethodologyLibraryDocument) {
  const db = await requireDb();
  const result = await db.insert(methodologyLibraryDocuments).values(document);
  return Number(result[0].insertId);
}

export async function deleteMethodologyDocument(userId: number, id: number) {
  const db = await requireDb();
  await db.delete(methodologyLibraryDocuments).where(and(eq(methodologyLibraryDocuments.id, id), eq(methodologyLibraryDocuments.userId, userId)));
}

export async function readMethodologyDocument(userId: number, id: number) {
  const db = await requireDb();
  const [document] = await db.select().from(methodologyLibraryDocuments).where(and(eq(methodologyLibraryDocuments.id, id), eq(methodologyLibraryDocuments.userId, userId))).limit(1);
  if (!document) throw new Error("ملف المكتبة غير موجود أو لا تملك صلاحية عرضه.");
  const signedUrl = await storageGetSignedUrl(document.storageKey);
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error("تعذر استرجاع نسخة المكتبة المحفوظة.");
  const sanitizedHtml = await response.text();
  if (sanitizedHtml.length > 5_000_000) throw new Error("الملف كبير جداً للعرض داخل المتصفح؛ نزّله واقرأه محلياً.");
  return { document, sanitizedHtml };
}

export function hashMethodologyHtml(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

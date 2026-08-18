import { and, desc, eq } from "drizzle-orm";
import { claimTemplates, evidenceDocuments, type InsertClaimTemplate, type InsertEvidenceDocument } from "../drizzle/schema";
import { getDb } from "./db";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات الأدلة غير متاحة حالياً.");
  return db;
}

export async function listEvidenceForEvent(userId: number, projectKey: string, eventKey: string) {
  const db = await requireDb();
  return db.select().from(evidenceDocuments).where(and(eq(evidenceDocuments.userId, userId), eq(evidenceDocuments.projectKey, projectKey), eq(evidenceDocuments.eventKey, eventKey))).orderBy(desc(evidenceDocuments.createdAt));
}

export async function saveEvidenceDocument(document: InsertEvidenceDocument) {
  const db = await requireDb();
  const result = await db.insert(evidenceDocuments).values(document);
  return Number(result[0].insertId);
}

export async function deleteEvidenceDocument(userId: number, id: number) {
  const db = await requireDb();
  await db.delete(evidenceDocuments).where(and(eq(evidenceDocuments.id, id), eq(evidenceDocuments.userId, userId)));
}

export async function listClaimTemplates(userId: number) {
  const db = await requireDb();
  return db.select().from(claimTemplates).where(eq(claimTemplates.userId, userId)).orderBy(desc(claimTemplates.updatedAt));
}

export async function saveClaimTemplate(template: InsertClaimTemplate) {
  const db = await requireDb();
  const result = await db.insert(claimTemplates).values(template);
  return Number(result[0].insertId);
}

export async function deleteClaimTemplate(userId: number, id: number) {
  const db = await requireDb();
  await db.delete(claimTemplates).where(and(eq(claimTemplates.id, id), eq(claimTemplates.userId, userId)));
}

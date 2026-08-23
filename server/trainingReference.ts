import { and, desc, eq } from "drizzle-orm";
import { trainingReferences } from "../drizzle/schema";
import { getDb } from "./db";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات مراجع التدريب غير متاحة حالياً.");
  return db;
}

/**
 * Lists metadata-only training references scoped to their owner and project.
 * This table intentionally does not have file URLs, storage keys, or raw source content.
 */
export async function listTrainingReferences(ownerUserId: number, projectKey: string) {
  const db = await requireDb();
  return db
    .select({
      id: trainingReferences.id,
      referenceKey: trainingReferences.referenceKey,
      title: trainingReferences.title,
      sourceKind: trainingReferences.sourceKind,
      baselineSha256: trainingReferences.baselineSha256,
      postTiaSha256: trainingReferences.postTiaSha256,
      workbookSha256: trainingReferences.workbookSha256,
      baselineActivityCount: trainingReferences.baselineActivityCount,
      postTiaActivityCount: trainingReferences.postTiaActivityCount,
      baselineRelationshipCount: trainingReferences.baselineRelationshipCount,
      postTiaRelationshipCount: trainingReferences.postTiaRelationshipCount,
      localCpmDurationDeltaDays: trainingReferences.localCpmDurationDeltaDays,
      status: trainingReferences.status,
      limitations: trainingReferences.limitations,
      sourceFactsJson: trainingReferences.sourceFactsJson,
      createdAt: trainingReferences.createdAt,
      updatedAt: trainingReferences.updatedAt,
    })
    .from(trainingReferences)
    .where(and(eq(trainingReferences.ownerUserId, ownerUserId), eq(trainingReferences.projectKey, projectKey)))
    .orderBy(desc(trainingReferences.createdAt));
}

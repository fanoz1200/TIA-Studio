import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Metadata only: evidence bytes remain in private object storage. */
export const evidenceDocuments = mysqlTable("evidence_documents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectKey: varchar("projectKey", { length: 128 }).notNull(),
  eventKey: varchar("eventKey", { length: 128 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  fileName: varchar("fileName", { length: 512 }).notNull(),
  mimeType: varchar("mimeType", { length: 160 }).notNull(),
  sizeBytes: int("sizeBytes").notNull(),
  evidenceType: mysqlEnum("evidenceType", ["correspondence", "instruction", "drawing", "programme", "photo", "report", "other"]).notNull(),
  storageKey: varchar("storageKey", { length: 768 }).notNull(),
  storageUrl: varchar("storageUrl", { length: 1024 }).notNull(),
  receivedAt: timestamp("receivedAt"),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const claimTemplates = mysqlTable("claim_templates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  recipient: varchar("recipient", { length: 255 }),
  contractReference: varchar("contractReference", { length: 255 }),
  introduction: text("introduction"),
  entitlementPosition: text("entitlementPosition"),
  reliefRequested: text("reliefRequested"),
  closing: text("closing"),
  isDefault: int("isDefault").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EvidenceDocument = typeof evidenceDocuments.$inferSelect;
export type InsertEvidenceDocument = typeof evidenceDocuments.$inferInsert;
export type ClaimTemplate = typeof claimTemplates.$inferSelect;
export type InsertClaimTemplate = typeof claimTemplates.$inferInsert;

import { decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

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

/** أعضاء مشروع محدد؛ يحتفظ مالك المشروع بالتحكم في الإضافة والأدوار وتعيينات المراجعة. */
export const projectMembers = mysqlTable("project_members", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectKey: varchar("projectKey", { length: 128 }).notNull(),
  memberUserId: int("memberUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectRole: mysqlEnum("projectRole", ["planner", "contracts", "claims_manager", "viewer"]).notNull().default("viewer"),
  addedBy: int("addedBy").notNull().references(() => users.id),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("project_members_owner_project_member_uq").on(table.ownerUserId, table.projectKey, table.memberUserId),
  index("project_members_member_project_idx").on(table.memberUserId, table.projectKey),
]);

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

/**
 * A source-faithful snapshot of a P6 resource assignment (TASKRSRC or XML equivalent).
 * Monetary values are planning inputs for cost-exposure modelling, not a legal entitlement.
 */
export const resourceAssignments = mysqlTable("resource_assignments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectKey: varchar("projectKey", { length: 128 }).notNull(),
  activityId: varchar("activityId", { length: 128 }).notNull(),
  assignmentKey: varchar("assignmentKey", { length: 160 }).notNull(),
  resourceId: varchar("resourceId", { length: 128 }),
  resourceName: varchar("resourceName", { length: 255 }),
  resourceType: mysqlEnum("resourceType", ["labor", "nonlabor", "material", "unknown"]).notNull().default("unknown"),
  costAccountId: varchar("costAccountId", { length: 128 }),
  wbsId: varchar("wbsId", { length: 128 }),
  targetQuantity: decimal("targetQuantity", { precision: 18, scale: 4 }).notNull().default("0"),
  remainingQuantity: decimal("remainingQuantity", { precision: 18, scale: 4 }).notNull().default("0"),
  actualRegularQuantity: decimal("actualRegularQuantity", { precision: 18, scale: 4 }).notNull().default("0"),
  actualOvertimeQuantity: decimal("actualOvertimeQuantity", { precision: 18, scale: 4 }).notNull().default("0"),
  targetCost: decimal("targetCost", { precision: 18, scale: 4 }).notNull().default("0"),
  remainingCost: decimal("remainingCost", { precision: 18, scale: 4 }).notNull().default("0"),
  actualRegularCost: decimal("actualRegularCost", { precision: 18, scale: 4 }).notNull().default("0"),
  actualOvertimeCost: decimal("actualOvertimeCost", { precision: 18, scale: 4 }).notNull().default("0"),
  costPerUnit: decimal("costPerUnit", { precision: 18, scale: 4 }).notNull().default("0"),
  sourceFormat: mysqlEnum("sourceFormat", ["xer", "p6_xml", "manual"]).notNull(),
  importedAt: timestamp("importedAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("resource_assignments_user_project_assignment_uq").on(table.userId, table.projectKey, table.assignmentKey),
  index("resource_assignments_user_project_activity_idx").on(table.userId, table.projectKey, table.activityId),
]);

/** Event-linked notice register. A record represents a prepared and tracked notice, never an automatic legal dispatch. */
export const noticeRegister = mysqlTable("notice_register", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectKey: varchar("projectKey", { length: 128 }).notNull(),
  claimKey: varchar("claimKey", { length: 128 }).notNull(),
  eventKey: varchar("eventKey", { length: 128 }).notNull(),
  noticeNo: varchar("noticeNo", { length: 128 }).notNull(),
  sender: varchar("sender", { length: 255 }),
  recipient: varchar("recipient", { length: 255 }),
  contractClause: varchar("contractClause", { length: 255 }),
  awarenessDate: timestamp("awarenessDate"),
  noticeDueDate: timestamp("noticeDueDate"),
  sentDate: timestamp("sentDate"),
  status: mysqlEnum("status", ["draft", "under_review", "sent", "overdue", "cancelled"]).notNull().default("draft"),
  narrative: text("narrative").notNull(),
  timeImpactDays: decimal("timeImpactDays", { precision: 12, scale: 2 }).notNull().default("0"),
  costImpact: decimal("costImpact", { precision: 18, scale: 4 }).notNull().default("0"),
  evidenceReferenceIds: text("evidenceReferenceIds"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("notice_register_user_project_notice_uq").on(table.userId, table.projectKey, table.noticeNo),
  index("notice_register_user_project_event_idx").on(table.userId, table.projectKey, table.eventKey),
]);

/** The current electronic-review state for a locally identified claim. */
export const claimReviews = mysqlTable("claim_reviews", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectKey: varchar("projectKey", { length: 128 }).notNull(),
  claimKey: varchar("claimKey", { length: 128 }).notNull(),
  claimTitle: varchar("claimTitle", { length: 255 }).notNull(),
  currentStage: mysqlEnum("currentStage", ["draft", "planning_review", "contract_review", "claims_manager_approval", "ready_to_export", "rejected"]).notNull().default("draft"),
  status: mysqlEnum("status", ["draft", "in_review", "approved", "rejected", "ready_to_export"]).notNull().default("draft"),
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("claim_reviews_user_project_claim_uq").on(table.userId, table.projectKey, table.claimKey),
]);

/** Append-only audit history of every review action. No update or delete procedure is exposed. */
export const claimReviewStages = mysqlTable("claim_review_stages", {
  id: int("id").autoincrement().primaryKey(),
  claimReviewId: int("claimReviewId").notNull().references(() => claimReviews.id, { onDelete: "cascade" }),
  stage: mysqlEnum("stage", ["draft", "planning_review", "contract_review", "claims_manager_approval", "ready_to_export", "rejected"]).notNull(),
  reviewerId: int("reviewerId").notNull().references(() => users.id),
  decision: mysqlEnum("decision", ["created", "submitted", "approved", "rejected", "commented", "reopened"]).notNull(),
  comment: text("comment"),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
}, table => [
  index("claim_review_stages_claim_recorded_idx").on(table.claimReviewId, table.recordedAt),
]);

/** Assigned reviewers are the authorization boundary for each gate in the claim-review workflow. */
export const claimReviewParticipants = mysqlTable("claim_review_participants", {
  id: int("id").autoincrement().primaryKey(),
  claimReviewId: int("claimReviewId").notNull().references(() => claimReviews.id, { onDelete: "cascade" }),
  stage: mysqlEnum("stage", ["planning_review", "contract_review", "claims_manager_approval"]).notNull(),
  reviewerId: int("reviewerId").notNull().references(() => users.id),
  assignedBy: int("assignedBy").notNull().references(() => users.id),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("claim_review_participants_review_stage_uq").on(table.claimReviewId, table.stage),
  index("claim_review_participants_reviewer_stage_idx").on(table.reviewerId, table.stage),
]);

export type EvidenceDocument = typeof evidenceDocuments.$inferSelect;
export type InsertEvidenceDocument = typeof evidenceDocuments.$inferInsert;
export type ClaimTemplate = typeof claimTemplates.$inferSelect;
export type InsertClaimTemplate = typeof claimTemplates.$inferInsert;
export type ResourceAssignment = typeof resourceAssignments.$inferSelect;
export type InsertResourceAssignment = typeof resourceAssignments.$inferInsert;
export type NoticeRegisterEntry = typeof noticeRegister.$inferSelect;
export type InsertNoticeRegisterEntry = typeof noticeRegister.$inferInsert;
export type ClaimReview = typeof claimReviews.$inferSelect;
export type InsertClaimReview = typeof claimReviews.$inferInsert;
export type ClaimReviewStage = typeof claimReviewStages.$inferSelect;
export type InsertClaimReviewStage = typeof claimReviewStages.$inferInsert;
export type ClaimReviewParticipant = typeof claimReviewParticipants.$inferSelect;
export type InsertClaimReviewParticipant = typeof claimReviewParticipants.$inferInsert;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type InsertProjectMember = typeof projectMembers.$inferInsert;

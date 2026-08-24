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
  /** ينتهي حق المراجع في مساحة الفريق عند هذا الموعد؛ null محفوظ للعضويات القديمة فقط. */
  accessExpiresAt: timestamp("accessExpiresAt"),
  addedBy: int("addedBy").notNull().references(() => users.id),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("project_members_owner_project_member_uq").on(table.ownerUserId, table.projectKey, table.memberUserId),
  index("project_members_member_project_idx").on(table.memberUserId, table.projectKey),
]);

/** دعوة مختصرة العمر؛ لا يُخزن الرمز الخام، بل بصمة SHA-256 منه فقط. */
export const projectInvitations = mysqlTable("project_invitations", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectKey: varchar("projectKey", { length: 128 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  projectRole: mysqlEnum("projectRole", ["planner", "contracts", "claims_manager", "viewer"]).notNull().default("viewer"),
  /** مدة العضوية بعد القبول، منفصلة عن صلاحية رابط الدعوة ذات الأيام السبعة. */
  accessDurationDays: int("accessDurationDays").notNull().default(30),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["pending", "accepted", "cancelled", "expired"]).notNull().default("pending"),
  expiresAt: timestamp("expiresAt").notNull(),
  acceptedByUserId: int("acceptedByUserId").references(() => users.id, { onDelete: "set null" }),
  acceptedAt: timestamp("acceptedAt"),
  sentBy: int("sentBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("project_invitations_owner_project_email_uq").on(table.ownerUserId, table.projectKey, table.email),
  uniqueIndex("project_invitations_token_hash_uq").on(table.tokenHash),
  index("project_invitations_owner_project_status_idx").on(table.ownerUserId, table.projectKey, table.status),
]);

/** روابط تدريبية يضيفها مالك المشروع؛ يحتفظ التطبيق بالبيانات الوصفية فقط ولا يعيد نشر الفيديو. */
export const tutorialVideos = mysqlTable("tutorial_videos", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectKey: varchar("projectKey", { length: 128 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  track: mysqlEnum("track", ["tia", "concurrent", "primavera"]).notNull(),
  description: text("description"),
  videoUrl: varchar("videoUrl", { length: 2048 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("tutorial_videos_user_project_track_idx").on(table.userId, table.projectKey, table.track),
]);

/** Metadata only: the sanitised methodology document stays as inert plain text in object storage. */
export const methodologyLibraryDocuments = mysqlTable("methodology_library_documents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectKey: varchar("projectKey", { length: 128 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  versionLabel: varchar("versionLabel", { length: 120 }),
  fileName: varchar("fileName", { length: 512 }).notNull(),
  storageKey: varchar("storageKey", { length: 768 }).notNull(),
  storageUrl: varchar("storageUrl", { length: 1024 }).notNull(),
  sizeBytes: int("sizeBytes").notNull(),
  contentSha256: varchar("contentSha256", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("methodology_library_docs_user_project_created_idx").on(table.userId, table.projectKey, table.createdAt),
]);

/**
 * Private, metadata-only reference to a user-provided training case.
 * Raw P6/XER and Excel source files must remain outside the database and are
 * deliberately not represented by a storage key or URL in this table.
 */
export const trainingReferences = mysqlTable("training_references", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectKey: varchar("projectKey", { length: 128 }).notNull(),
  referenceKey: varchar("referenceKey", { length: 128 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  sourceKind: mysqlEnum("sourceKind", ["user_provided_private"]).notNull().default("user_provided_private"),
  baselineSha256: varchar("baselineSha256", { length: 64 }).notNull(),
  postTiaSha256: varchar("postTiaSha256", { length: 64 }).notNull(),
  workbookSha256: varchar("workbookSha256", { length: 64 }).notNull(),
  baselineActivityCount: int("baselineActivityCount").notNull(),
  postTiaActivityCount: int("postTiaActivityCount").notNull(),
  baselineRelationshipCount: int("baselineRelationshipCount").notNull(),
  postTiaRelationshipCount: int("postTiaRelationshipCount").notNull(),
  localCpmDurationDeltaDays: int("localCpmDurationDeltaDays").notNull(),
  status: mysqlEnum("status", ["locally_verified", "manual_p6_review_required"]).notNull().default("manual_p6_review_required"),
  limitations: text("limitations").notNull(),
  sourceFactsJson: text("sourceFactsJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("training_references_owner_project_key_uq").on(table.ownerUserId, table.projectKey, table.referenceKey),
  index("training_references_owner_project_created_idx").on(table.ownerUserId, table.projectKey, table.createdAt),
]);

/** سلسلة مطالبات مستمرة لكل برنامج؛ يتحقق الخادم من الأبوة وملكية السلسلة قبل أي كتابة. */
export const claimChains = mysqlTable("claim_chains", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectKey: varchar("projectKey", { length: 128 }).notNull(),
  claimKey: varchar("claimKey", { length: 128 }).notNull(),
  parentClaimId: int("parentClaimId"),
  title: varchar("title", { length: 255 }).notNull(),
  periodStart: timestamp("periodStart"),
  periodEnd: timestamp("periodEnd"),
  methodology: varchar("methodology", { length: 160 }).notNull().default("TIA / AACE RP 29R-03 / SCL Protocol"),
  status: mysqlEnum("status", ["draft", "under_review", "ready_to_export", "closed"]).notNull().default("draft"),
  unifiedNarrative: text("unifiedNarrative").notNull(),
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("claim_chains_owner_project_key_uq").on(table.ownerUserId, table.projectKey, table.claimKey),
  index("claim_chains_owner_project_created_idx").on(table.ownerUserId, table.projectKey, table.createdAt),
  index("claim_chains_parent_idx").on(table.parentClaimId),
]);

/** نتيجة موثقة لتداخل حدثين؛ هي سجل فني للمراجعة وليست حكماً بالاستحقاق. */
export const concurrentDelayRecords = mysqlTable("concurrent_delay_records", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectKey: varchar("projectKey", { length: 128 }).notNull(),
  claimChainId: int("claimChainId").notNull().references(() => claimChains.id, { onDelete: "cascade" }),
  analysisWindowKey: varchar("analysisWindowKey", { length: 128 }).notNull().default("LEGACY_WINDOW_UNMAPPED"),
  primaryEventKey: varchar("primaryEventKey", { length: 128 }).notNull(),
  concurrentEventKey: varchar("concurrentEventKey", { length: 128 }).notNull(),
  overlapStart: timestamp("overlapStart").notNull(),
  overlapEnd: timestamp("overlapEnd").notNull(),
  responsibility: mysqlEnum("responsibility", ["employer", "contractor", "neutral", "mixed", "undetermined"]).notNull().default("undetermined"),
  treatment: mysqlEnum("treatment", ["unresolved", "separate", "absorbed", "apportioned"]).notNull().default("unresolved"),
  notes: text("notes").notNull(),
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("concurrent_delay_records_owner_project_claim_window_idx").on(table.ownerUserId, table.projectKey, table.claimChainId, table.analysisWindowKey),
]);

/** سجل منظم لإدخالات البلانر؛ لا يغير شبكة البرنامج تلقائياً وإنما يحفظ مقترح Fragnet وخطوات مراجعته. */
export const plannerIssueLogs = mysqlTable("planner_issue_logs", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectKey: varchar("projectKey", { length: 128 }).notNull(),
  issueNo: varchar("issueNo", { length: 128 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  occurrenceDate: timestamp("occurrenceDate").notNull(),
  reportedBy: varchar("reportedBy", { length: 255 }),
  responsibleParty: mysqlEnum("responsibleParty", ["employer", "contractor", "engineer", "third_party", "undetermined"]).notNull().default("undetermined"),
  delayCause: mysqlEnum("delayCause", ["employer", "contractor", "neutral"]).notNull().default("neutral"),
  affectedActivityIds: text("affectedActivityIds").notNull(),
  replacedRelationshipId: varchar("replacedRelationshipId", { length: 128 }).notNull(),
  proposedDurationDays: decimal("proposedDurationDays", { precision: 12, scale: 2 }).notNull(),
  impactSummary: text("impactSummary").notNull(),
  referenceNotes: text("referenceNotes").notNull(),
  criticality: mysqlEnum("criticality", ["unknown", "potentially_critical", "critical", "noncritical"]).notNull().default("unknown"),
  status: mysqlEnum("status", ["open", "ready_for_fragnet", "applied", "rejected", "closed"]).notNull().default("open"),
  fragnetProposalJson: text("fragnetProposalJson").notNull(),
  reviewedBy: int("reviewedBy").references(() => users.id),
  reviewedAt: timestamp("reviewedAt"),
  appliedAt: timestamp("appliedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("planner_issue_logs_owner_project_issue_uq").on(table.ownerUserId, table.projectKey, table.issueNo),
  index("planner_issue_logs_owner_project_status_idx").on(table.ownerUserId, table.projectKey, table.status),
  index("planner_issue_logs_owner_project_date_idx").on(table.ownerUserId, table.projectKey, table.occurrenceDate),
]);

/**
 * أساس عقدي يعرّفه المستخدم لكل مشروع. لا يستنتج التطبيق البنود أو القانون
 * الحاكم أو المدد؛ وتظل جميع هذه الحقول نقاط مراجعة قبل إعداد أي Notice.
 */
export const projectContractProfiles = mysqlTable("project_contract_profiles", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectKey: varchar("projectKey", { length: 128 }).notNull(),
  contractTitle: varchar("contractTitle", { length: 255 }),
  contractForm: varchar("contractForm", { length: 255 }),
  contractEdition: varchar("contractEdition", { length: 160 }),
  specialConditionsReference: varchar("specialConditionsReference", { length: 255 }),
  governingLaw: varchar("governingLaw", { length: 255 }),
  claimClauseReference: varchar("claimClauseReference", { length: 255 }),
  noticeTriggerDescription: text("noticeTriggerDescription"),
  sourceReference: text("sourceReference"),
  sourceStatus: mysqlEnum("sourceStatus", ["sourced", "to_enrich", "review_required", "rejected"]).notNull().default("to_enrich"),
  reviewNotes: text("reviewNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("project_contract_profiles_owner_project_uq").on(table.ownerUserId, table.projectKey),
]);

/** سجل مخاطر قبل حدوث الواقعة؛ ينقلها المستخدم إلى Issue قائم بعد التحقق، ولا يقرر مسؤولية أو استحقاق. */
export const claimRisks = mysqlTable("claim_risks", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectKey: varchar("projectKey", { length: 128 }).notNull(),
  riskKey: varchar("riskKey", { length: 128 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  identifiedDate: timestamp("identifiedDate"),
  ownerRole: varchar("ownerRole", { length: 120 }),
  sourceReference: text("sourceReference"),
  sourceStatus: mysqlEnum("sourceStatus", ["sourced", "to_enrich", "review_required", "rejected"]).notNull().default("to_enrich"),
  status: mysqlEnum("status", ["open", "monitoring", "escalated", "closed"]).notNull().default("open"),
  linkedPlannerIssueId: int("linkedPlannerIssueId").references(() => plannerIssueLogs.id, { onDelete: "set null" }),
  reviewNotes: text("reviewNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("claim_risks_owner_project_key_uq").on(table.ownerUserId, table.projectKey, table.riskKey),
  index("claim_risks_owner_project_status_idx").on(table.ownerUserId, table.projectKey, table.status),
]);

/**
 * جسر تدقيقي بين المخاطرة والواقعة الفنية والمطالبة المتتابعة. وجوده لا يثبت
 * أن الواقعة منشئة للمطالبة ولا أن البيانات كافية أو أن الحق قائم.
 */
export const claimCandidates = mysqlTable("claim_candidates", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectKey: varchar("projectKey", { length: 128 }).notNull(),
  candidateKey: varchar("candidateKey", { length: 128 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  riskId: int("riskId").references(() => claimRisks.id, { onDelete: "set null" }),
  plannerIssueLogId: int("plannerIssueLogId").references(() => plannerIssueLogs.id, { onDelete: "set null" }),
  claimChainId: int("claimChainId").references(() => claimChains.id, { onDelete: "set null" }),
  contractClauseReference: varchar("contractClauseReference", { length: 255 }),
  basisSummary: text("basisSummary").notNull(),
  sourceReference: text("sourceReference"),
  sourceStatus: mysqlEnum("sourceStatus", ["sourced", "to_enrich", "review_required", "rejected"]).notNull().default("to_enrich"),
  status: mysqlEnum("status", ["draft", "under_review", "ready_for_notice", "linked_to_claim", "closed"]).notNull().default("draft"),
  reviewNotes: text("reviewNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("claim_candidates_owner_project_key_uq").on(table.ownerUserId, table.projectKey, table.candidateKey),
  index("claim_candidates_owner_project_status_idx").on(table.ownerUserId, table.projectKey, table.status),
]);

/**
 * متابعة مواعيد يحدد مصدرها المستخدم أو فريق العقود. لا تعني "overdue" سقوط
 * الحق ولا تحوّل القاعدة إلى مهلة FIDIC تلقائية؛ الوضع دائماً إشعار مراجعة.
 */
export const claimDeadlineTrackers = mysqlTable("claim_deadline_trackers", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectKey: varchar("projectKey", { length: 128 }).notNull(),
  claimCandidateId: int("claimCandidateId").notNull().references(() => claimCandidates.id, { onDelete: "cascade" }),
  deadlineKey: varchar("deadlineKey", { length: 128 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  deadlineKind: mysqlEnum("deadlineKind", ["notice", "particulars", "substantiation", "other"]).notNull().default("notice"),
  calculationMode: mysqlEnum("calculationMode", ["manual_date", "calendar_days"]).notNull().default("manual_date"),
  referenceDate: timestamp("referenceDate"),
  calendarDays: int("calendarDays"),
  dueDate: timestamp("dueDate"),
  ruleDescription: text("ruleDescription").notNull(),
  sourceReference: text("sourceReference"),
  sourceStatus: mysqlEnum("sourceStatus", ["sourced", "to_enrich", "review_required", "rejected"]).notNull().default("to_enrich"),
  status: mysqlEnum("status", ["unconfigured", "tracking", "review_required", "completed", "superseded"]).notNull().default("unconfigured"),
  reviewNotes: text("reviewNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("claim_deadline_trackers_candidate_key_uq").on(table.claimCandidateId, table.deadlineKey),
  index("claim_deadline_trackers_owner_project_due_idx").on(table.ownerUserId, table.projectKey, table.dueDate),
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
export type ProjectInvitation = typeof projectInvitations.$inferSelect;
export type InsertProjectInvitation = typeof projectInvitations.$inferInsert;
export type TutorialVideo = typeof tutorialVideos.$inferSelect;
export type InsertTutorialVideo = typeof tutorialVideos.$inferInsert;
export type MethodologyLibraryDocument = typeof methodologyLibraryDocuments.$inferSelect;
export type InsertMethodologyLibraryDocument = typeof methodologyLibraryDocuments.$inferInsert;
export type ClaimChain = typeof claimChains.$inferSelect;
export type InsertClaimChain = typeof claimChains.$inferInsert;
export type ConcurrentDelayRecord = typeof concurrentDelayRecords.$inferSelect;
export type InsertConcurrentDelayRecord = typeof concurrentDelayRecords.$inferInsert;
export type PlannerIssueLog = typeof plannerIssueLogs.$inferSelect;
export type InsertPlannerIssueLog = typeof plannerIssueLogs.$inferInsert;

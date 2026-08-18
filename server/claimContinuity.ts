import { and, desc, eq, inArray } from "drizzle-orm";
import { claimChains, concurrentDelayRecords } from "../drizzle/schema";
import { getDb } from "./db";

type ChainStatus = "draft" | "under_review" | "ready_to_export" | "closed";
type Responsibility = "employer" | "contractor" | "neutral" | "mixed" | "undetermined";
type Treatment = "unresolved" | "separate" | "absorbed" | "apportioned";
type NarrativeConcurrency = { primaryEventKey: string; concurrentEventKey: string; analysisWindowKey: string; overlapStart: Date; overlapEnd: Date; responsibility: Responsibility; treatment: Treatment; notes: string };

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات سلسلة المطالبات غير متاحة حالياً.");
  return db;
}

function asUtcDate(value?: string | null) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function dateOnly(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "غير محدد";
}

export function buildUnifiedClaimNarrative(input: {
  title: string; claimKey: string; periodStart?: string | null; periodEnd?: string | null; methodology?: string; parentLabel?: string | null; analystPosition?: string; concurrency?: NarrativeConcurrency[];
}) {
  const period = input.periodStart || input.periodEnd ? `${input.periodStart ?? "بداية غير محددة"} إلى ${input.periodEnd ?? "نهاية غير محددة"}` : "فترة التحليل المحددة في البرنامج";
  const concurrentNarrative = input.concurrency?.length ? input.concurrency.map((record, index) => `${index + 1}. **${record.primaryEventKey} × ${record.concurrentEventKey}** — نافذة **${record.analysisWindowKey}**، من ${dateOnly(record.overlapStart)} إلى ${dateOnly(record.overlapEnd)}؛ المسؤولية الظاهرة: ${record.responsibility}؛ المعالجة: ${record.treatment}. ${record.notes}`).join("\n") : "لا توجد سجلات تزامن محفوظة لهذه المطالبة حتى الآن.";
  return [
    `## السرد الموحد للمطالبة — ${input.title}`,
    `**مرجع المطالبة:** ${input.claimKey}  \n**فترة التحليل:** ${period}  \n**المنهج:** ${input.methodology ?? "TIA / AACE RP 29R-03 / SCL Protocol"}.`,
    `### 1. نطاق واستمرارية التحليل\nتغطي هذه المطالبة نافذة ${period}. ${input.parentLabel ? `وهي امتداد فني للمطالبة السابقة «${input.parentLabel}»؛ لذلك تبقى نتائجها، وافتراضاتها، ونقطة قطع البيانات جزءاً من سجل المراجعة.` : "وهي أول مطالبة مسجلة في هذه السلسلة؛ ويجب تحديد نسخة البرنامج المعتمدة ونقطة قطع البيانات قبل التقديم."}`,
    `### 2. الوقائع والأدلة\nيُدرج كل حدث كـ Fragnet قابل للتتبع داخل شبكة CPM، ويربط بمراسلاته وتعليماته وبرنامجه المرجعي. لا يعد هذا السجل بديلاً عن التحقق من أصالة الأدلة أو شروط العقد.`,
    `### 3. منهج الأثر الزمني والتزامن\nيقاس الأثر بمقارنة النسخة المرجعية مع نسخة TIA المتأثرة، وفق تقويم المشروع وعلاقاته المنطقية. تسجل أي فترة تزامن بصورة مستقلة مع مسؤوليتها والمعالجة المقترحة، ولا يُفترض استحقاق تلقائي بسبب مجرد وجود تداخل زمني.\n\n#### سجل التزامن المدمج\n${concurrentNarrative}`,
    `### 4. الموقف والطلب\n${input.analystPosition?.trim() || "يقدم التحليل دعماً فنياً لمراجعة أثر الوقت وحفظ الحقوق. يراجع فريق العقود الاستحقاق والمهل والإشعارات قبل أي إرسال أو اعتماد."}`,
    `### 5. Notice of Claim المختصر\nنحيطكم علماً بواقعة أو وقائع التأخير الواقعة ضمن الفترة المذكورة أعلاه، مع الاحتفاظ بجميع الحقوق التعاقدية. يرجى اعتبار هذا السجل مسودة فنية داخلية إلى أن يراجع تاريخ العلم، بند العقد، المستلم، ووسيلة الإرسال وفق العقد.`
  ].join("\n\n");
}

export async function listClaimContinuity(userId: number, projectKey: string) {
  const db = await requireDb();
  const chains = await db.select().from(claimChains).where(and(eq(claimChains.ownerUserId, userId), eq(claimChains.projectKey, projectKey))).orderBy(desc(claimChains.createdAt));
  if (!chains.length) return { chains, concurrency: [] };
  const concurrency = await db.select().from(concurrentDelayRecords).where(and(eq(concurrentDelayRecords.ownerUserId, userId), eq(concurrentDelayRecords.projectKey, projectKey), inArray(concurrentDelayRecords.claimChainId, chains.map(item => item.id)))).orderBy(desc(concurrentDelayRecords.createdAt));
  return { chains, concurrency };
}

export async function createClaimChain(userId: number, input: { projectKey: string; claimKey: string; title: string; parentClaimId?: number | null; periodStart?: string | null; periodEnd?: string | null; methodology?: string; analystPosition?: string }) {
  if (input.periodStart && input.periodEnd && input.periodStart > input.periodEnd) throw new Error("بداية فترة المطالبة يجب أن تسبق نهايتها.");
  const db = await requireDb();
  const [duplicate] = await db.select().from(claimChains).where(and(eq(claimChains.ownerUserId, userId), eq(claimChains.projectKey, input.projectKey), eq(claimChains.claimKey, input.claimKey))).limit(1);
  if (duplicate) throw new Error("مفتاح المطالبة مستخدم بالفعل في هذا المشروع.");
  let parent = null as typeof claimChains.$inferSelect | null;
  if (input.parentClaimId) {
    [parent] = await db.select().from(claimChains).where(and(eq(claimChains.id, input.parentClaimId), eq(claimChains.ownerUserId, userId), eq(claimChains.projectKey, input.projectKey))).limit(1);
    if (!parent) throw new Error("المطالبة السابقة المختارة لا تنتمي إلى هذا المشروع.");
  } else {
    [parent] = await db.select().from(claimChains).where(and(eq(claimChains.ownerUserId, userId), eq(claimChains.projectKey, input.projectKey))).orderBy(desc(claimChains.createdAt)).limit(1);
  }
  const unifiedNarrative = buildUnifiedClaimNarrative({ ...input, parentLabel: parent?.title ?? null });
  const result = await db.insert(claimChains).values({ ownerUserId: userId, projectKey: input.projectKey, claimKey: input.claimKey, parentClaimId: parent?.id ?? null, title: input.title, periodStart: asUtcDate(input.periodStart), periodEnd: asUtcDate(input.periodEnd), methodology: input.methodology || "TIA / AACE RP 29R-03 / SCL Protocol", unifiedNarrative, createdBy: userId });
  const id = Number(result[0].insertId);
  const [created] = await db.select().from(claimChains).where(eq(claimChains.id, id)).limit(1);
  return created;
}

export async function updateClaimNarrative(userId: number, input: { id: number; title?: string; periodStart?: string | null; periodEnd?: string | null; methodology?: string; analystPosition?: string; status?: ChainStatus }) {
  const db = await requireDb();
  const [current] = await db.select().from(claimChains).where(and(eq(claimChains.id, input.id), eq(claimChains.ownerUserId, userId))).limit(1);
  if (!current) throw new Error("سجل المطالبة غير موجود أو لا تملك صلاحية تعديله.");
  const start = input.periodStart === undefined ? dateOnly(current.periodStart) : input.periodStart;
  const end = input.periodEnd === undefined ? dateOnly(current.periodEnd) : input.periodEnd;
  if (start && end && start > end) throw new Error("بداية فترة المطالبة يجب أن تسبق نهايتها.");
  let parentLabel: string | null = null;
  if (current.parentClaimId) {
    const [parent] = await db.select().from(claimChains).where(and(eq(claimChains.id, current.parentClaimId), eq(claimChains.ownerUserId, userId))).limit(1);
    parentLabel = parent?.title ?? null;
  }
  const title = input.title?.trim() || current.title;
  const methodology = input.methodology?.trim() || current.methodology;
  const concurrency = await db.select().from(concurrentDelayRecords).where(and(eq(concurrentDelayRecords.claimChainId, current.id), eq(concurrentDelayRecords.ownerUserId, userId))).orderBy(desc(concurrentDelayRecords.createdAt));
  const unifiedNarrative = buildUnifiedClaimNarrative({ title, claimKey: current.claimKey, periodStart: start === "غير محدد" ? null : start, periodEnd: end === "غير محدد" ? null : end, methodology, parentLabel, analystPosition: input.analystPosition, concurrency });
  await db.update(claimChains).set({ title, methodology, periodStart: start === "غير محدد" ? null : asUtcDate(start), periodEnd: end === "غير محدد" ? null : asUtcDate(end), status: input.status ?? current.status, unifiedNarrative }).where(and(eq(claimChains.id, current.id), eq(claimChains.ownerUserId, userId)));
  const [updated] = await db.select().from(claimChains).where(eq(claimChains.id, current.id)).limit(1);
  return updated;
}

export async function createConcurrentDelayRecord(userId: number, input: { projectKey: string; claimChainId: number; analysisWindowKey: string; primaryEventKey: string; concurrentEventKey: string; overlapStart: string; overlapEnd: string; responsibility: Responsibility; treatment: Treatment; notes: string }) {
  if (input.primaryEventKey === input.concurrentEventKey) throw new Error("يجب أن يختلف الحدثان في سجل التزامن.");
  if (input.overlapStart > input.overlapEnd) throw new Error("بداية فترة التزامن يجب أن تسبق نهايتها.");
  const db = await requireDb();
  const [chain] = await db.select().from(claimChains).where(and(eq(claimChains.id, input.claimChainId), eq(claimChains.ownerUserId, userId), eq(claimChains.projectKey, input.projectKey))).limit(1);
  if (!chain) throw new Error("لا يمكن ربط التزامن بمطالبة خارج المشروع.");
  const result = await db.insert(concurrentDelayRecords).values({ ...input, ownerUserId: userId, createdBy: userId, overlapStart: asUtcDate(input.overlapStart)!, overlapEnd: asUtcDate(input.overlapEnd)! });
  const concurrency = await db.select().from(concurrentDelayRecords).where(and(eq(concurrentDelayRecords.claimChainId, chain.id), eq(concurrentDelayRecords.ownerUserId, userId))).orderBy(desc(concurrentDelayRecords.createdAt));
  let parentLabel: string | null = null;
  if (chain.parentClaimId) {
    const [parent] = await db.select().from(claimChains).where(and(eq(claimChains.id, chain.parentClaimId), eq(claimChains.ownerUserId, userId))).limit(1);
    parentLabel = parent?.title ?? null;
  }
  await db.update(claimChains).set({ unifiedNarrative: buildUnifiedClaimNarrative({ title: chain.title, claimKey: chain.claimKey, periodStart: dateOnly(chain.periodStart) === "غير محدد" ? null : dateOnly(chain.periodStart), periodEnd: dateOnly(chain.periodEnd) === "غير محدد" ? null : dateOnly(chain.periodEnd), methodology: chain.methodology, parentLabel, concurrency }) }).where(eq(claimChains.id, chain.id));
  const [created] = await db.select().from(concurrentDelayRecords).where(eq(concurrentDelayRecords.id, Number(result[0].insertId))).limit(1);
  return created;
}

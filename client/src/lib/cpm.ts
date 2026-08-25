/**
 * TIA Studio — غرفة التحكم المعمارية
 * محرك CPM/TIA محلي قابل للتتبع: تقويم واضح، Fragnets موثقة، ونوافذ تحليل.
 */

export type RelationshipType = "FS" | "SS" | "FF" | "SF";
export type DelayCause = "employer" | "contractor" | "neutral" | "concurrent";

export type WorkingCalendar = {
  id: string;
  name: string;
  workingWeekdays: number[];
  holidays: string[];
  /** اسم الإجازة اختياري للعرض؛ الحساب يعتمد على التاريخ فقط. */
  holidayLabels?: Record<string, string>;
  hoursPerDay?: number;
  /** رمز بلد اختياري؛ لا يغير الحساب ما لم تتحول الإجازات إلى تواريخ في القائمة. */
  countryCode?: string;
  /** مصدر آخر تحميل للإجازات، للشفافية عند مراجعة التحليل. */
  holidaySource?: string;
  holidaysLastCheckedAt?: string;
  /** يظل صحيحاً حتى يراجع المحلل التواريخ المتغيرة أو قرارات الترحيل. */
  holidayReviewRequired?: boolean;
};

export const calendarDayCalendar: WorkingCalendar = {
  id: "calendar-days",
  name: "أيام تقويمية (7/7)",
  workingWeekdays: [0, 1, 2, 3, 4, 5, 6],
  holidays: [],
  hoursPerDay: 8,
};

export const fiveDayCalendar: WorkingCalendar = {
  id: "five-day-week",
  name: "أسبوع عمل 5 أيام (الإثنين–الجمعة)",
  workingWeekdays: [1, 2, 3, 4, 5],
  holidays: [],
  hoursPerDay: 8,
};

/** قيد زمني محدود يدعمه الحساب المحلي بعد استيراده من XER. */
export type ActivityConstraint = {
  type: "start-on-or-after" | "finish-on-or-after";
  date: string;
  sourceCode: "CS_SNET" | "CS_FNET";
};

/** الأثر الخام الذي قرأه المستورد، بما في ذلك ما لا يحاول CPM المحلي حسابه. */
export type ActivityConstraintAudit = {
  slot: "primary" | "secondary";
  code: string;
  date?: string;
  rawDate?: string;
  status: "supported" | "not-applicable" | "review-required";
  note: string;
};

export type Activity = {
  id: string;
  name: string;
  duration: number;
  wbs?: string;
  wbsId?: string;
  owner?: string;
  kind?: "base" | "fragnet";
  plannedStart?: number;
  percentComplete?: number;
  percentCompleteType?: "duration" | "physical" | "units" | "unknown";
  remainingDuration?: number;
  actualStart?: string;
  actualFinish?: string;
  /** معرف تقويم النشاط كما ظهر في TASK.clndr_id؛ لا يعني أن نمط P6 فُك محلياً. */
  calendarId?: string;
  /** قيد أولي محدود فقط؛ القيود الأخرى تظل في constraintAudit للمراجعة. */
  constraint?: ActivityConstraint;
  constraintAudit?: ActivityConstraintAudit[];
};

export type WbsNode = {
  id: string;
  code?: string;
  name: string;
  parentId?: string;
  path: string;
};

/** مورد مسند إلى نشاط كما ورد من P6 أو أُدخل محلياً للتحليل. */
export type ResourceAssignment = {
  id: string;
  activityId: string;
  resourceId?: string;
  resourceName?: string;
  resourceType: "labor" | "nonlabor" | "material" | "unknown";
  costAccountId?: string;
  wbsId?: string;
  targetQuantity?: number;
  remainingQuantity?: number;
  actualRegularQuantity?: number;
  actualOvertimeQuantity?: number;
  targetCost?: number;
  remainingCost?: number;
  actualRegularCost?: number;
  actualOvertimeCost?: number;
  costPerUnit?: number;
  targetQuantityPerHour?: number;
  remainingQuantityPerHour?: number;
  activityRemainingDuration?: number;
  source: "xer" | "p6-xml" | "manual";
};

export type FinancialImpactBucket = {
  assignmentCount: number;
  dailyCost: number;
  extensionCost: number;
};

export type FinancialImpact = {
  delayDays: number;
  hoursPerDay: number;
  dailyCost: number;
  extensionCost: number;
  byResourceType: Record<ResourceAssignment["resourceType"], FinancialImpactBucket>;
  warnings: string[];
};

/**
 * يحدد إسنادات الموارد الخاصة بنطاق حدث TIA عبر أنشطة الـ Fragnet ونقطتي الربط
 * مع برنامج الأساس. لا يخلط هذا التقدير موارد المشروع غير المتصلة بالحدث.
 */
export function resourceAssignmentsForEvent(schedule: Schedule, event?: Fragnet | null): ResourceAssignment[] {
  if (!event) return schedule.resourceAssignments ?? [];
  const eventActivityIds = new Set(event.activities.map(activity => activity.id));
  const baseActivityIds = new Set(schedule.activities.map(activity => activity.id));
  const connectedBaseActivityIds = event.relationships
    .flatMap(relationship => [relationship.predecessorId, relationship.successorId])
    .filter(id => baseActivityIds.has(id));
  const selectedActivityIds = new Set(Array.from(eventActivityIds).concat(connectedBaseActivityIds, event.sourceActivityIds ?? []));
  return (schedule.resourceAssignments ?? []).filter(assignment => selectedActivityIds.has(assignment.activityId));
}

export type Relationship = {
  id: string;
  predecessorId: string;
  successorId: string;
  type: RelationshipType;
  lag?: number;
};

export type Schedule = {
  id: string;
  name: string;
  startDate: string;
  dataDate?: string;
  activities: Activity[];
  relationships: Relationship[];
  calendar?: WorkingCalendar;
  source?: "manual" | "json" | "csv" | "xer" | "p6-xml";
  importNotes?: string[];
  wbsNodes?: WbsNode[];
  resourceAssignments?: ResourceAssignment[];
};

export type Fragnet = {
  id: string;
  title: string;
  description: string;
  cause: DelayCause;
  occurrenceDate: string;
  activities: Activity[];
  relationships: Relationship[];
  replacedRelationshipIds?: string[];
  /** نشاط من المصدر يستبدل داخل نسخة Post-TIA فقط؛ لا يتغير ملف P6 المستورد. */
  replacedActivityIds?: string[];
  /** مرجع النشاط الأصلي لتتبع الموارد والتدقيق بعد إنشاء نسخة التحليل. */
  sourceActivityIds?: string[];
  model?: "relationship-fragnet" | "activity-split";
};

export type ActivitySplitInput = {
  id: string;
  title: string;
  description: string;
  cause: DelayCause;
  occurrenceDate: string;
  eventDuration: number;
  targetActivityId: string;
};

/** مجموعة أنشطة لواقعة واحدة؛ تُرفض العلاقات المباشرة بينها لحماية منطق الشبكة. */
export type MultiActivitySplitInput = Omit<ActivitySplitInput, "targetActivityId"> & {
  targetActivityIds: string[];
};

export type AnalysisWindow = {
  id: string;
  name: string;
  from: string;
  to: string;
  scheduleId: string;
  status: "draft" | "review" | "final";
  notes?: string;
};

export type ActivityMetrics = Activity & {
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  totalFloat: number;
  freeFloat: number;
  isCritical: boolean;
};

export type CpmResult = {
  scheduleId: string;
  scheduleName: string;
  projectDuration: number;
  completionDate: string;
  calendar: WorkingCalendar;
  activities: ActivityMetrics[];
  relationships: Relationship[];
  topologicalOrder: string[];
  criticalActivityIds: string[];
  warnings: string[];
};

export type TiaResult = {
  fragnetId: string;
  fragnetTitle: string;
  baseline: CpmResult;
  impacted: CpmResult;
  impactDays: number;
  baselineCompletionDate: string;
  impactedCompletionDate: string;
  outcome: "delayed" | "float-consumed" | "accelerated";
  notes: string[];
};

export type ConcurrentFinding = {
  eventIds: [string, string];
  overlapStart: string;
  overlapEnd: string;
  classification: "same-cause-overlap" | "calendar-overlap-only" | "potential-concurrency" | "critical-concurrency-candidate";
  explanation: string;
};

export type WindowEventResult = {
  eventId: string;
  eventTitle: string;
  cause: DelayCause;
  incrementalImpactDays: number;
  cumulativeImpactDays: number;
};

export type WindowTiaResult = {
  window: AnalysisWindow;
  events: Fragnet[];
  baseline: CpmResult;
  impacted: CpmResult;
  totalImpactDays: number;
  eventResults: WindowEventResult[];
  concurrentFindings: ConcurrentFinding[];
  notes: string[];
};

export type NarrativeContext = {
  analyst?: string;
  contractReference?: string;
  evidenceSummary?: string;
  claimPosition?: string;
};

const EPSILON = 0.00001;

function cloneCalendar(calendar?: WorkingCalendar): WorkingCalendar {
  const source = calendar ?? calendarDayCalendar;
  return {
    id: source.id,
    name: source.name,
    workingWeekdays: [...source.workingWeekdays],
    holidays: [...source.holidays],
    holidayLabels: source.holidayLabels ? { ...source.holidayLabels } : undefined,
    hoursPerDay: source.hoursPerDay ?? 8,
    countryCode: source.countryCode,
    holidaySource: source.holidaySource,
    holidaysLastCheckedAt: source.holidaysLastCheckedAt,
    holidayReviewRequired: source.holidayReviewRequired,
  };
}

function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("صيغة التاريخ غير صالحة. استخدم YYYY-MM-DD.");
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("التاريخ غير صالح. استخدم YYYY-MM-DD.");
  return date;
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function ensureValidCalendar(calendar: WorkingCalendar) {
  if (!calendar.id.trim() || !calendar.name.trim()) throw new Error("التقويم يحتاج معرفاً واسماً.");
  if (!calendar.workingWeekdays.length || calendar.workingWeekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    throw new Error("حدد يوماً واحداً على الأقل ضمن أيام العمل في التقويم.");
  }
  for (const holiday of calendar.holidays) parseIsoDate(holiday);
  if (!Number.isFinite(calendar.hoursPerDay ?? 8) || (calendar.hoursPerDay ?? 8) <= 0) throw new Error("ساعات العمل اليومية في التقويم غير صالحة.");
}

function ensureValidSchedule(schedule: Schedule) {
  parseIsoDate(schedule.startDate);
  if (schedule.dataDate) parseIsoDate(schedule.dataDate);
  ensureValidCalendar(cloneCalendar(schedule.calendar));
  if (!schedule.activities.length) throw new Error("لا يمكن إجراء CPM من دون أنشطة في البرنامج.");

  const activityIds = new Set<string>();
  for (const activity of schedule.activities) {
    if (!activity.id.trim()) throw new Error("يوجد نشاط بلا معرف.");
    if (activityIds.has(activity.id)) throw new Error(`معرف النشاط مكرر: ${activity.id}`);
    if (!Number.isFinite(activity.duration) || activity.duration < 0) throw new Error(`مدة النشاط ${activity.id} يجب أن تكون رقماً غير سالب.`);
    if (activity.percentComplete !== undefined && (!Number.isFinite(activity.percentComplete) || activity.percentComplete < 0 || activity.percentComplete > 100)) {
      throw new Error(`نسبة إنجاز النشاط ${activity.id} يجب أن تكون بين 0 و100.`);
    }
    if (activity.constraint) {
      parseIsoDate(activity.constraint.date);
      if (activity.constraint.type !== "start-on-or-after" && activity.constraint.type !== "finish-on-or-after") {
        throw new Error(`نوع قيد النشاط ${activity.id} غير مدعوم في الحساب المحلي.`);
      }
    }
    activityIds.add(activity.id);
  }

  const relationshipIds = new Set<string>();
  for (const rel of schedule.relationships) {
    if (relationshipIds.has(rel.id)) throw new Error(`معرف العلاقة مكرر: ${rel.id}`);
    relationshipIds.add(rel.id);
    if (!activityIds.has(rel.predecessorId) || !activityIds.has(rel.successorId)) throw new Error(`العلاقة ${rel.id} تشير إلى نشاط غير موجود.`);
    if (rel.predecessorId === rel.successorId) throw new Error(`العلاقة ${rel.id} تربط النشاط بنفسه.`);
    if (!Number.isFinite(rel.lag ?? 0)) throw new Error(`الـ lag في العلاقة ${rel.id} غير صالح.`);
  }
}

export function isWorkingDate(date: string, calendar?: WorkingCalendar) {
  const resolved = cloneCalendar(calendar);
  const parsed = parseIsoDate(date);
  return resolved.workingWeekdays.includes(parsed.getUTCDay()) && !resolved.holidays.includes(date);
}

/** يحول نهاية زمنية بوحدة أيام العمل إلى تاريخ وفق التقويم المحدد. */
export function addWorkingDays(startDate: string, workingDays: number, calendar?: WorkingCalendar) {
  const resolved = cloneCalendar(calendar);
  ensureValidCalendar(resolved);
  const result = parseIsoDate(startDate);
  const direction = workingDays < 0 ? -1 : 1;
  let remaining = Math.abs(Math.round(workingDays));
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + direction);
    const iso = formatIsoDate(result);
    if (resolved.workingWeekdays.includes(result.getUTCDay()) && !resolved.holidays.includes(iso)) remaining -= 1;
  }
  return formatIsoDate(result);
}

function relationshipConstraint(predecessor: ActivityMetrics, successor: Activity, relationship: Relationship) {
  const lag = relationship.lag ?? 0;
  switch (relationship.type) {
    case "FS": return predecessor.earlyFinish + lag;
    case "SS": return predecessor.earlyStart + lag;
    case "FF": return predecessor.earlyFinish + lag - successor.duration;
    case "SF": return predecessor.earlyStart + lag - successor.duration;
  }
}

function predecessorLatestStartConstraint(predecessor: Activity, successor: ActivityMetrics, relationship: Relationship) {
  const lag = relationship.lag ?? 0;
  switch (relationship.type) {
    case "FS": return successor.lateStart - lag - predecessor.duration;
    case "SS": return successor.lateStart - lag;
    case "FF": return successor.lateFinish - lag - predecessor.duration;
    case "SF": return successor.lateFinish - lag;
  }
}

function relationshipFreeFloat(predecessor: ActivityMetrics, successor: ActivityMetrics, relationship: Relationship) {
  const lag = relationship.lag ?? 0;
  switch (relationship.type) {
    case "FS": return successor.earlyStart - predecessor.earlyFinish - lag;
    case "SS": return successor.earlyStart - predecessor.earlyStart - lag;
    case "FF": return successor.earlyFinish - predecessor.earlyFinish - lag;
    case "SF": return successor.earlyFinish - predecessor.earlyStart - lag;
  }
}

/** يحول القيد السفلي إلى أول يوم CPM مسموح لبداية النشاط وفق تقويم الجدول المختار. */
function lowerBoundConstraintStart(activity: Activity, scheduleStartDate: string, calendar: WorkingCalendar) {
  if (!activity.constraint) return undefined;
  const constraintDay = dateToRelativeDay(scheduleStartDate, activity.constraint.date, calendar);
  return activity.constraint.type === "start-on-or-after" ? constraintDay : constraintDay - activity.duration;
}

export function runCPM(schedule: Schedule): CpmResult {
  ensureValidSchedule(schedule);
  const calendar = cloneCalendar(schedule.calendar);
  const activityById = new Map(schedule.activities.map((activity) => [activity.id, activity]));
  const incoming = new Map<string, Relationship[]>();
  const outgoing = new Map<string, Relationship[]>();
  const indegree = new Map<string, number>();
  const originalIndex = new Map(schedule.activities.map((activity, index) => [activity.id, index]));

  for (const activity of schedule.activities) {
    incoming.set(activity.id, []);
    outgoing.set(activity.id, []);
    indegree.set(activity.id, 0);
  }
  for (const relationship of schedule.relationships) {
    incoming.get(relationship.successorId)?.push(relationship);
    outgoing.get(relationship.predecessorId)?.push(relationship);
    indegree.set(relationship.successorId, (indegree.get(relationship.successorId) ?? 0) + 1);
  }

  const ready = schedule.activities.filter((activity) => (indegree.get(activity.id) ?? 0) === 0).map((activity) => activity.id);
  const topologicalOrder: string[] = [];
  while (ready.length) {
    ready.sort((a, b) => (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0));
    const activityId = ready.shift();
    if (!activityId) break;
    topologicalOrder.push(activityId);
    for (const relationship of outgoing.get(activityId) ?? []) {
      const nextDegree = (indegree.get(relationship.successorId) ?? 0) - 1;
      indegree.set(relationship.successorId, nextDegree);
      if (nextDegree === 0) ready.push(relationship.successorId);
    }
  }
  if (topologicalOrder.length !== schedule.activities.length) {
    const cyclicIds = schedule.activities.filter((activity) => !topologicalOrder.includes(activity.id)).map((activity) => activity.id).join(", ");
    throw new Error(`يوجد حلقة منطقية تمنع حساب CPM: ${cyclicIds}`);
  }

  const metrics = new Map<string, ActivityMetrics>();
  for (const activityId of topologicalOrder) {
    const activity = activityById.get(activityId)!;
    const constraints = (incoming.get(activityId) ?? []).map((relationship) => relationshipConstraint(metrics.get(relationship.predecessorId)!, activity, relationship));
    const lowerBound = lowerBoundConstraintStart(activity, schedule.startDate, calendar);
    const earlyStart = Math.max(0, activity.plannedStart ?? 0, lowerBound ?? Number.NEGATIVE_INFINITY, ...constraints);
    metrics.set(activityId, { ...activity, earlyStart, earlyFinish: earlyStart + activity.duration, lateStart: 0, lateFinish: 0, totalFloat: 0, freeFloat: 0, isCritical: false });
  }

  const projectDuration = Math.max(...Array.from(metrics.values()).map((activity) => activity.earlyFinish));
  for (const activityId of [...topologicalOrder].reverse()) {
    const activity = activityById.get(activityId)!;
    const successors = outgoing.get(activityId) ?? [];
    const defaultLatestStart = projectDuration - activity.duration;
    const latestStartConstraints = successors.map((relationship) => predecessorLatestStartConstraint(activity, metrics.get(relationship.successorId)!, relationship));
    const lateStart = Math.min(defaultLatestStart, ...latestStartConstraints);
    const metric = metrics.get(activityId)!;
    metric.lateStart = lateStart;
    metric.lateFinish = lateStart + activity.duration;
    metric.totalFloat = lateStart - metric.earlyStart;
  }

  for (const activity of Array.from(metrics.values())) {
    const successors = outgoing.get(activity.id) ?? [];
    const floats = successors.map((relationship) => relationshipFreeFloat(activity, metrics.get(relationship.successorId)!, relationship));
    activity.freeFloat = Math.max(0, floats.length ? Math.min(...floats) : projectDuration - activity.earlyFinish);
    activity.isCritical = Math.abs(activity.totalFloat) < EPSILON;
  }

  const activities = schedule.activities.map((activity) => metrics.get(activity.id)!);
  const warnings: string[] = [];
  const openEnds = activities.filter((activity) => (incoming.get(activity.id)?.length ?? 0) === 0 || (outgoing.get(activity.id)?.length ?? 0) === 0);
  if (openEnds.length > 2) warnings.push(`يوجد ${openEnds.length} أنشطة ذات نهاية مفتوحة؛ راجع منطق الشبكة قبل اعتماد التحليل.`);
  if (activities.some((activity) => activity.totalFloat < -EPSILON)) warnings.push("يوجد عائمة سالبة في الشبكة؛ راجع القيود والمنطق.");
  if (calendar.id !== calendarDayCalendar.id) warnings.push(`تاريخ الإكمال محول وفق تقويم «${calendar.name}»؛ بينما تُعرض ES/EF وTF بوحدة أيام العمل.`);
  const appliedConstraints = activities.filter((activity) => activity.constraint).length;
  const reviewConstraints = activities.flatMap((activity) => activity.constraintAudit ?? []).filter((item) => item.status === "review-required").length;
  const taskCalendarIds = Array.from(new Set(activities.map((activity) => activity.calendarId).filter((value): value is string => Boolean(value))));
  const activitiesWithUpdateState = activities.filter((activity) => activity.percentComplete !== undefined || activity.remainingDuration !== undefined || activity.actualStart || activity.actualFinish).length;
  if (appliedConstraints) warnings.push(`طُبق ${appliedConstraints} قيد/قيود سفلية فقط في التمرير الأمامي المحلي؛ راجع النتيجة داخل P6.`);
  if (reviewConstraints) warnings.push(`يوجد ${reviewConstraints} قيد/قيود XER غير محسوبة محلياً؛ لا تعتمد نتيجة CPM قبل مراجعتها.`);
  if (taskCalendarIds.length > 1) warnings.push(`يستخدم الملف ${taskCalendarIds.length} معرفات تقويم على مستوى النشاط، بينما الحساب المحلي يطبق تقويماً واحداً فقط.`);
  if (activitiesWithUpdateState) warnings.push(`حُفظت حالة تحديث لـ${activitiesWithUpdateState} نشاطاً (Actuals/Remaining/Progress)، لكن CPM المحلي لا يعيد جدولة تحديث P6 أو يحاكي F9؛ لا تستخدم النتيجة كتحديث مكافئ لـPrimavera.`);

  return { scheduleId: schedule.id, scheduleName: schedule.name, projectDuration, completionDate: addWorkingDays(schedule.startDate, projectDuration, calendar), calendar, activities, relationships: schedule.relationships, topologicalOrder, criticalActivityIds: activities.filter((activity) => activity.isCritical).map((activity) => activity.id), warnings };
}

export function insertFragnet(schedule: Schedule, fragnet: Fragnet): Schedule {
  const baseActivityIds = new Set(schedule.activities.map((activity) => activity.id));
  const replacedActivities = new Set(fragnet.replacedActivityIds ?? []);
  for (const activityId of Array.from(replacedActivities)) {
    if (!baseActivityIds.has(activityId)) throw new Error(`لا يمكن تقسيم النشاط «${activityId}» لأنه غير موجود في نسخة Pre-TIA.`);
  }
  const fragnetActivityIds = new Set<string>();
  for (const activity of fragnet.activities) {
    if (baseActivityIds.has(activity.id) || fragnetActivityIds.has(activity.id)) throw new Error(`معرف نشاط الـ Fragnet مكرر أو موجود مسبقاً: ${activity.id}`);
    fragnetActivityIds.add(activity.id);
  }
  const replaced = new Set(fragnet.replacedRelationshipIds ?? []);
  const keptRelationships = schedule.relationships.filter((relationship) => !replaced.has(relationship.id) && !replacedActivities.has(relationship.predecessorId) && !replacedActivities.has(relationship.successorId));
  const relationshipIds = new Set(keptRelationships.map((relationship) => relationship.id));
  for (const relationship of fragnet.relationships) {
    if (relationshipIds.has(relationship.id)) throw new Error(`معرف علاقة الـ Fragnet مكرر: ${relationship.id}`);
    relationshipIds.add(relationship.id);
  }
  return {
    ...schedule,
    id: `${schedule.id}--${fragnet.id}`,
    name: `${schedule.name} + ${fragnet.title}`,
    activities: [...schedule.activities.filter((activity) => !replacedActivities.has(activity.id)).map((activity) => ({ ...activity, kind: activity.kind ?? "base" as const })), ...fragnet.activities.map((activity) => ({ ...activity, kind: activity.kind ?? "fragnet" as const }))],
    relationships: [...keptRelationships, ...fragnet.relationships],
  };
}

export function insertFragnets(schedule: Schedule, fragments: Fragnet[]) {
  return fragments.reduce((current, fragnet) => insertFragnet(current, fragnet), schedule);
}

/**
 * ينشئ Fragnet لتقسيم نشاط متأثر داخل نسخة تحليلية فقط. يقتصر التنفيذ الآلي
 * على روابط FS بلا Lag؛ أما الشبكات الأكثر تعقيداً فتحتاج نمذجة صريحة من المحلل.
 */
export function buildActivitySplitFragnet(schedule: Schedule, input: ActivitySplitInput): Fragnet {
  if (!input.id.trim() || !input.title.trim()) throw new Error("معرف الحدث وعنوانه مطلوبان لإنشاء تقسيم النشاط.");
  if (!Number.isFinite(input.eventDuration) || input.eventDuration < 0) throw new Error("مدة الحدث يجب أن تكون رقماً غير سالب.");
  parseIsoDate(input.occurrenceDate);
  const target = schedule.activities.find((activity) => activity.id === input.targetActivityId);
  if (!target) throw new Error("النشاط المتأثر غير موجود في نسخة Pre-TIA المختارة.");

  const targetRelations = schedule.relationships.filter((relationship) => relationship.predecessorId === target.id || relationship.successorId === target.id);
  if (targetRelations.some((relationship) => relationship.type !== "FS" || (relationship.lag ?? 0) !== 0)) {
    throw new Error("لا يدعم التقسيم الآلي لهذا النشاط روابط غير FS أو روابط ذات Lag؛ أنشئ Fragnet يدوياً وراجع المنطق.");
  }

  const metrics = runCPM(schedule).activities.find((activity) => activity.id === target.id);
  if (!metrics) throw new Error("تعذر حساب موضع النشاط المتأثر داخل برنامج Pre-TIA.");
  const targetStart = addWorkingDays(schedule.startDate, metrics.earlyStart, schedule.calendar);
  const targetFinish = addWorkingDays(schedule.startDate, metrics.earlyFinish, schedule.calendar);
  if (input.occurrenceDate < targetStart || input.occurrenceDate > targetFinish) {
    throw new Error(`تاريخ الحدث يجب أن يقع بين بداية النشاط ${targetStart} ونهايته ${targetFinish} وفق برنامج Pre-TIA.`);
  }

  const occurrenceDay = dateToRelativeDay(schedule.startDate, input.occurrenceDate, schedule.calendar);
  const preDuration = Math.min(target.duration, Math.max(0, occurrenceDay - metrics.earlyStart));
  const postDuration = Math.max(0, target.duration - preDuration);
  const baseId = `${input.id}--${target.id}`;
  const preId = `${baseId}--pre`;
  const eventId = `${baseId}--event`;
  const postId = `${baseId}--post`;
  const inbound = targetRelations.filter((relationship) => relationship.successorId === target.id);
  const outbound = targetRelations.filter((relationship) => relationship.predecessorId === target.id);

  return {
    id: input.id,
    title: input.title,
    description: input.description,
    cause: input.cause,
    occurrenceDate: input.occurrenceDate,
    model: "activity-split",
    replacedActivityIds: [target.id],
    sourceActivityIds: [target.id],
    activities: [
      { ...target, id: preId, name: `قبل الحدث — ${target.name}`, duration: preDuration, kind: "fragnet" },
      { ...target, id: eventId, name: `حدث TIA — ${input.title}`, duration: input.eventDuration, kind: "fragnet" },
      { ...target, id: postId, name: `بعد الحدث — ${target.name}`, duration: postDuration, kind: "fragnet" },
    ],
    relationships: [
      ...inbound.map((relationship) => ({ ...relationship, id: `${baseId}--in--${relationship.id}`, successorId: preId })),
      { id: `${baseId}--pre-event`, predecessorId: preId, successorId: eventId, type: "FS" as const },
      { id: `${baseId}--event-post`, predecessorId: eventId, successorId: postId, type: "FS" as const },
      ...outbound.map((relationship) => ({ ...relationship, id: `${baseId}--out--${relationship.id}`, predecessorId: postId })),
    ],
  };
}

/**
 * يبني Fragnet مركباً لواقعة واحدة مرتبطة بعدة أنشطة مستقلة في نسخة Post-TIA.
 * يظل قيد FS بلا Lag سارياً لكل نشاط؛ لا يحاول هذا المسار إعادة كتابة علاقة
 * مباشرة بين نشاطين مختارين لأن ذلك يحتاج نمذجة صريحة يراجعها المحلل.
 */
export function buildMultiActivitySplitFragnet(schedule: Schedule, input: MultiActivitySplitInput): Fragnet {
  const rawIds = input.targetActivityIds.filter(Boolean);
  const targetActivityIds = Array.from(new Set(rawIds));
  if (!targetActivityIds.length) throw new Error("اختر نشاطاً متأثراً واحداً على الأقل قبل إنشاء واقعة التقسيم.");
  if (targetActivityIds.length !== rawIds.length) throw new Error("معرفات الأنشطة المتأثرة مكررة؛ راجع الاختيار قبل إنشاء الواقعة.");

  const selected = new Set(targetActivityIds);
  const internalRelationship = schedule.relationships.find(
    (relationship) => selected.has(relationship.predecessorId) && selected.has(relationship.successorId)
  );
  if (internalRelationship) {
    throw new Error(`لا يدعم التقسيم المجمع نشاطين مرتبطين مباشرة (${internalRelationship.predecessorId} → ${internalRelationship.successorId}). أنشئهما كواقعتين أو نمذج العلاقة يدوياً.`);
  }

  const parts = targetActivityIds.map((targetActivityId) =>
    buildActivitySplitFragnet(schedule, {
      ...input,
      id: input.id,
      targetActivityId,
    })
  );
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    cause: input.cause,
    occurrenceDate: input.occurrenceDate,
    model: "activity-split",
    replacedActivityIds: targetActivityIds,
    sourceActivityIds: targetActivityIds,
    activities: parts.flatMap((part) => part.activities),
    relationships: parts.flatMap((part) => part.relationships),
  };
}

export type TiaAnalyticalCopies = {
  /** لقطة مستقلة قابلة للمراجعة من البرنامج كما كان قبل الحدث. */
  preTia: Schedule;
  /** نسخة مستقلة تحتوي على الـ Fragnet أو تقسيم Pre/Event/Post فقط. */
  postTia: Schedule;
};

function cloneScheduleForAnalysis(schedule: Schedule, id: string, name: string): Schedule {
  return {
    ...schedule,
    id,
    name,
    activities: schedule.activities.map((activity) => ({ ...activity })),
    relationships: schedule.relationships.map((relationship) => ({ ...relationship })),
    calendar: schedule.calendar ? {
      ...schedule.calendar,
      workingWeekdays: [...schedule.calendar.workingWeekdays],
      holidays: [...schedule.calendar.holidays],
    } : undefined,
    wbsNodes: schedule.wbsNodes?.map((node) => ({ ...node })),
    resourceAssignments: schedule.resourceAssignments?.map((assignment) => ({ ...assignment })),
  };
}

/**
 * ينشئ لقطتي عمل منفصلتين ولا يغيّر أبداً كائن البرنامج المستورد أو ملف XER المصدر.
 * تستخدم الأولى للحساب قبل الحدث، بينما تحتوي الثانية فقط على الإدراج التحليلي بعده.
 */
export function createTiaAnalyticalCopies(schedule: Schedule, fragnet: Fragnet): TiaAnalyticalCopies {
  const preTia = cloneScheduleForAnalysis(schedule, `${schedule.id}--pre-tia--${fragnet.id}`, `${schedule.name} — Pre-TIA (${fragnet.id})`);
  const insertedPostTia = insertFragnet(preTia, fragnet);
  const postTia = cloneScheduleForAnalysis(
    insertedPostTia,
    `${schedule.id}--post-tia--${fragnet.id}`,
    `${schedule.name} — Post-TIA (${fragnet.id})`,
  );
  return { preTia, postTia };
}

export function runTIA(schedule: Schedule, fragnet: Fragnet): TiaResult {
  const copies = createTiaAnalyticalCopies(schedule, fragnet);
  const baseline = runCPM(copies.preTia);
  const impacted = runCPM(copies.postTia);
  const impactDays = impacted.projectDuration - baseline.projectDuration;
  const tiedToBase = fragnet.relationships.filter((relationship) => schedule.activities.some((activity) => activity.id === relationship.predecessorId) || schedule.activities.some((activity) => activity.id === relationship.successorId)).length;
  const notes = [`تم الحساب على نسخة Pre-TIA مستقلة من: ${schedule.name}.`, `تاريخ الإكمال قبل الإدراج: ${baseline.completionDate}.`, `تاريخ الإكمال بعد الإدراج في Post-TIA: ${impacted.completionDate}.`, `التقويم المطبق: ${baseline.calendar.name}.`];
  if (tiedToBase < 2) notes.push("تحذير: الـ Fragnet لا يبدو مرتبطاً بشبكة الأساس عند نقطتي دخول وخروج؛ تحقق من الرابط المنطقي.");
  if (impactDays === 0) notes.push("لم يتغير تاريخ الإكمال؛ يستهلك الحدث عائمة متاحة أو لا يصل إلى مسار الإكمال.");
  if (impactDays < 0) notes.push("أنتجت الشبكة تاريخ إكمال أبكر؛ راجع الـ leads أو العلاقات المستبدلة.");
  return { fragnetId: fragnet.id, fragnetTitle: fragnet.title, baseline, impacted, impactDays, baselineCompletionDate: baseline.completionDate, impactedCompletionDate: impacted.completionDate, outcome: impactDays > EPSILON ? "delayed" : impactDays < -EPSILON ? "accelerated" : "float-consumed", notes };
}

/** مدة التأخير المدخلة، لا إجمالي مراحل النشاط بعد تقسيمه إلى Pre/Event/Post. */
export function getFragnetDelayDuration(event: Fragnet) {
  const modeledEvent = event.activities.find((activity) => activity.id.endsWith("--event"));
  return modeledEvent?.duration ?? event.activities.reduce((total, activity) => total + activity.duration, 0);
}

function eventEndDate(event: Fragnet, calendar?: WorkingCalendar) {
  const duration = getFragnetDelayDuration(event);
  return addWorkingDays(event.occurrenceDate, duration, calendar);
}

export function findConcurrentEvents(events: Fragnet[], impacted?: CpmResult): ConcurrentFinding[] {
  const findings: ConcurrentFinding[] = [];
  const calendar = impacted?.calendar;
  for (let left = 0; left < events.length; left += 1) {
    for (let right = left + 1; right < events.length; right += 1) {
      const a = events[left];
      const b = events[right];
      const aEnd = eventEndDate(a, calendar);
      const bEnd = eventEndDate(b, calendar);
      const overlapStart = a.occurrenceDate > b.occurrenceDate ? a.occurrenceDate : b.occurrenceDate;
      const overlapEnd = aEnd < bEnd ? aEnd : bEnd;
      if (overlapStart > overlapEnd) continue;
      const aCritical = a.activities.some((activity) => impacted?.criticalActivityIds.includes(activity.id));
      const bCritical = b.activities.some((activity) => impacted?.criticalActivityIds.includes(activity.id));
      const sameCause = a.cause === b.cause;
      const classification = sameCause ? "same-cause-overlap" : aCritical && bCritical ? "critical-concurrency-candidate" : aCritical || bCritical ? "potential-concurrency" : "calendar-overlap-only";
      const explanation = classification === "critical-concurrency-candidate"
        ? "توجد فترات متداخلة لأحداث مختلفة السبب، وتظهر أنشطة الحدثين على المسار الحرج في النسخة المجمعة؛ راجع السببية والوقائع المعاصرة قبل أي توزيع زمني."
        : classification === "potential-concurrency"
          ? "توجد فترات متداخلة لأحداث مختلفة السبب، ويحتاج اختبار المسار الحرج والسبب الفعال إلى مراجعة خبير."
          : classification === "same-cause-overlap"
            ? "تداخل زمني بين أحداث تحمل السبب نفسه؛ لا يمثل ذلك بحد ذاته تزامناً تعاقدياً بين طرفين."
            : "تداخل تقويمي فقط؛ لا تظهر بيانات كافية لربطه بتأخير حرج متزامن.";
      findings.push({ eventIds: [a.id, b.id], overlapStart, overlapEnd, classification, explanation });
    }
  }
  return findings;
}

export function runWindowTIA(schedule: Schedule, window: AnalysisWindow, allEvents: Fragnet[]): WindowTiaResult {
  if (window.scheduleId !== schedule.id) throw new Error("نافذة التحليل لا ترتبط بالبرنامج المحدد.");
  if (window.from > window.to) throw new Error("تاريخ بداية نافذة التحليل يجب أن يسبق تاريخ نهايتها.");
  const events = allEvents.filter((event) => event.occurrenceDate >= window.from && event.occurrenceDate <= window.to).sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate) || a.id.localeCompare(b.id));
  const baseline = runCPM(schedule);
  let workingSchedule = schedule;
  let previous = baseline;
  const eventResults: WindowEventResult[] = [];
  for (const event of events) {
    workingSchedule = insertFragnet(workingSchedule, event);
    const next = runCPM(workingSchedule);
    eventResults.push({ eventId: event.id, eventTitle: event.title, cause: event.cause, incrementalImpactDays: next.projectDuration - previous.projectDuration, cumulativeImpactDays: next.projectDuration - baseline.projectDuration });
    previous = next;
  }
  const impacted = previous;
  const concurrentFindings = findConcurrentEvents(events, impacted);
  const notes = [
    `النافذة: ${window.from} إلى ${window.to}.`,
    `تم اختيار ${events.length} حدث/أحداث حسب تاريخ الحدوث.`,
    `الأثر الإجمالي في النسخة المجمعة: ${impacted.projectDuration - baseline.projectDuration} يوم عمل.`,
  ];
  if (concurrentFindings.length) notes.push(`تم رصد ${concurrentFindings.length} حالة تداخل تحتاج فحص السببية والمسار الحرج.`);
  if (!events.length) notes.push("لا توجد أحداث داخل النافذة المختارة؛ لم يتغير البرنامج.");
  return { window, events, baseline, impacted, totalImpactDays: impacted.projectDuration - baseline.projectDuration, eventResults, concurrentFindings, notes };
}

export function generateDelayAnalysisNarrative(args: { schedule: Schedule; result?: TiaResult | WindowTiaResult | null; event?: Fragnet | null; context?: NarrativeContext }) {
  const { schedule, result, event, context } = args;
  const isWindow = result && "window" in result;
  const baselineDate = result ? result.baseline.completionDate : runCPM(schedule).completionDate;
  const impactedDate = result ? result.impacted.completionDate : baselineDate;
  const impactDays = result ? (isWindow ? result.totalImpactDays : result.impactDays) : 0;
  const scope = isWindow
    ? `نافذة التحليل «${result.window.name}» من ${result.window.from} إلى ${result.window.to}، وتضمنت ${result.events.length} حدث/أحداث.`
    : event
      ? `حدث التأخير «${event.title}» المؤرخ ${event.occurrenceDate} والمصنف «${event.cause}».`
      : "الحدث أو نافذة التحليل المختارة.";
  const causeText = event ? `وصف الحدث المدخل هو: ${event.description || "لم يُدخل وصف تفصيلي."}` : "تمت مراجعة الأحداث المدرجة ضمن النافذة وفق بياناتها المدخلة.";
  const method = isWindow ? "تحليل TIA مجمّع داخل نافذة زمنية" : "Time Impact Analysis (TIA)";
  const analyst = context?.analyst ? `وقد أُعدت هذه المسودة بواسطة ${context.analyst}.` : "";
  const evidence = context?.evidenceSummary ? `ويستند السجل الوصفي إلى: ${context.evidenceSummary}.` : "";
  const contractual = context?.contractReference ? `تمت الإشارة إلى ${context.contractReference} بوصفه مرجعاً تعاقدياً يحتاج مراجعة مستقلة.` : "";
  const position = context?.claimPosition ? `الموقف الذي أدخله المستخدم: ${context.claimPosition}.` : "";
  return [
    "1. التكليف والنطاق\nأُجري هذا التحليل لقياس الأثر الزمني الفني على برنامج المشروع، لا للفصل في الاستحقاق التعاقدي أو المالي. يشمل النطاق " + scope + " " + analyst,
    `2. البرنامج المرجعي\nاستُخدمت نسخة «${schedule.name}» بتاريخ بدء ${schedule.startDate}${schedule.dataDate ? ` وتاريخ بيانات ${schedule.dataDate}` : ""}. تم تطبيق تقويم «${cloneCalendar(schedule.calendar).name}». كان تاريخ الإكمال المحسوب قبل إدراج الأثر ${baselineDate}.`,
    `3. وصف الحدث والمنطق\n${causeText} جرى تمثيل الأثر عبر Fragnet مرتبط بمنطق البرنامج، ثم أُعيد حساب CPM لإظهار أثره على المسار وتاريخ الإكمال. ${evidence}`,
    `4. المنهجية والحساب\nاستُخدمت طريقة ${method}. يقارن التحليل نسخة البرنامج قبل الإدراج بالنسخة بعد الإدراج، ويعرض مدد الأنشطة والعائمة والمسار الحرج بوحدة أيام العمل. ${isWindow && result.concurrentFindings.length ? `كما رُصدت ${result.concurrentFindings.length} حالة تداخل زمني للتدقيق في السببية ولا تُعد هذه العلامات حكماً على التزامن التعاقدي.` : ""}`,
    `5. النتيجة والتحفظات\nأظهر الحساب فرقاً مقداره ${impactDays >= 0 ? "+" : ""}${impactDays} يوم عمل؛ فأصبح تاريخ الإكمال المحسوب ${impactedDate}. ${position} ${contractual} هذه مسودة فنية قابلة للتحرير، وتعتمد على صحة برنامج الأساس، حالة التقدم، منطق الـ Fragnet، والمستندات المعاصرة. يجب أن يراجع مختص العقد والوقائع قبل استخدامها في مطالبة أو نزاع.`,
  ].join("\n\n");
}

export function dateToRelativeDay(scheduleStartDate: string, targetDate: string, calendar?: WorkingCalendar) {
  const start = parseIsoDate(scheduleStartDate);
  const target = parseIsoDate(targetDate);
  if (!calendar) return Math.round((target.getTime() - start.getTime()) / 86_400_000);
  const direction = target.getTime() < start.getTime() ? -1 : 1;
  let cursor = new Date(start);
  let days = 0;
  while (formatIsoDate(cursor) !== formatIsoDate(target)) {
    cursor.setUTCDate(cursor.getUTCDate() + direction);
    if (isWorkingDate(formatIsoDate(cursor), calendar)) days += direction;
  }
  return days;
}

/**
 * يحسب تعرض تكلفة التمديد التخطيطي من مورد P6 المحلي. لا يمثل المبلغ استحقاقاً
 * تعاقدياً أو مطالبة جاهزة؛ فالتكاليف غير المباشرة والقيود التعاقدية تحتاج مراجعة مستقلة.
 */
export function calculateFinancialImpact(delayDays: number, assignments: ResourceAssignment[], hoursPerDay = 8): FinancialImpact {
  const safeDelayDays = Math.max(0, Number.isFinite(delayDays) ? delayDays : 0);
  const safeHoursPerDay = Math.max(0, Number.isFinite(hoursPerDay) ? hoursPerDay : 8);
  const byResourceType: FinancialImpact["byResourceType"] = {
    labor: { assignmentCount: 0, dailyCost: 0, extensionCost: 0 },
    nonlabor: { assignmentCount: 0, dailyCost: 0, extensionCost: 0 },
    material: { assignmentCount: 0, dailyCost: 0, extensionCost: 0 },
    unknown: { assignmentCount: 0, dailyCost: 0, extensionCost: 0 },
  };
  const warnings: string[] = [];
  for (const assignment of assignments) {
    const bucket = byResourceType[assignment.resourceType] ?? byResourceType.unknown;
    const costPerUnit = Math.max(0, assignment.costPerUnit ?? 0);
    const unitsPerHour = Math.max(0, assignment.remainingQuantityPerHour ?? assignment.targetQuantityPerHour ?? 0);
    const remainingCost = Math.max(0, assignment.remainingCost ?? 0);
    const targetCost = Math.max(0, assignment.targetCost ?? 0);
    const activityDays = Math.max(0, assignment.activityRemainingDuration ?? 0);
    const dailyCostFromRate = costPerUnit * unitsPerHour * safeHoursPerDay;
    const dailyCostFromAllocatedRemainingCost = activityDays > 0 ? remainingCost / activityDays : 0;
    const dailyCostFromAllocatedTargetCost = activityDays > 0 ? targetCost / activityDays : 0;
    const dailyCost = dailyCostFromRate || dailyCostFromAllocatedRemainingCost || dailyCostFromAllocatedTargetCost;
    if (!dailyCost) warnings.push(`لم يمكن اشتقاق تكلفة يومية للمورد «${assignment.resourceName || assignment.resourceId || assignment.id}»؛ لم يُدخل معدل أو مدة نشاط صالحة.`);
    bucket.assignmentCount += 1;
    bucket.dailyCost += dailyCost;
    bucket.extensionCost += dailyCost * safeDelayDays;
  }
  const dailyCost = Object.values(byResourceType).reduce((sum, bucket) => sum + bucket.dailyCost, 0);
  return { delayDays: safeDelayDays, hoursPerDay: safeHoursPerDay, dailyCost, extensionCost: dailyCost * safeDelayDays, byResourceType, warnings };
}

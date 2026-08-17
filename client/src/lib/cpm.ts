/**
 * TIA Studio — Engineering Editorial Modernism
 * CPM and Time Impact Analysis calculation engine. It keeps evidence explicit:
 * every result derives from a validated schedule, a named fragnet, and visible logic ties.
 */

export type RelationshipType = "FS" | "SS" | "FF" | "SF";

export type Activity = {
  id: string;
  name: string;
  duration: number;
  wbs?: string;
  owner?: string;
  kind?: "base" | "fragnet";
  plannedStart?: number;
};

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
};

export type Fragnet = {
  id: string;
  title: string;
  description: string;
  cause: "employer" | "contractor" | "neutral" | "concurrent";
  occurrenceDate: string;
  activities: Activity[];
  relationships: Relationship[];
  replacedRelationshipIds?: string[];
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

const EPSILON = 0.00001;

function ensureValidSchedule(schedule: Schedule) {
  if (!schedule.activities.length) {
    throw new Error("لا يمكن إجراء CPM من دون أنشطة في البرنامج.");
  }

  const activityIds = new Set<string>();
  for (const activity of schedule.activities) {
    if (!activity.id.trim()) throw new Error("يوجد نشاط بلا معرف.");
    if (activityIds.has(activity.id)) throw new Error(`معرف النشاط مكرر: ${activity.id}`);
    if (!Number.isFinite(activity.duration) || activity.duration < 0) {
      throw new Error(`مدة النشاط ${activity.id} يجب أن تكون رقماً غير سالب.`);
    }
    activityIds.add(activity.id);
  }

  const relationshipIds = new Set<string>();
  for (const rel of schedule.relationships) {
    if (relationshipIds.has(rel.id)) throw new Error(`معرف العلاقة مكرر: ${rel.id}`);
    relationshipIds.add(rel.id);
    if (!activityIds.has(rel.predecessorId) || !activityIds.has(rel.successorId)) {
      throw new Error(`العلاقة ${rel.id} تشير إلى نشاط غير موجود.`);
    }
    if (rel.predecessorId === rel.successorId) {
      throw new Error(`العلاقة ${rel.id} تربط النشاط بنفسه.`);
    }
    if (!Number.isFinite(rel.lag ?? 0)) throw new Error(`الـ lag في العلاقة ${rel.id} غير صالح.`);
  }
}

function daysToDate(startDate: string, days: number) {
  const parsed = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error("تاريخ بدء البرنامج غير صالح. استخدم YYYY-MM-DD.");
  parsed.setUTCDate(parsed.getUTCDate() + Math.round(days));
  return parsed.toISOString().slice(0, 10);
}

function relationshipConstraint(
  predecessor: ActivityMetrics,
  successor: ActivityMetrics,
  relationship: Relationship,
) {
  const lag = relationship.lag ?? 0;
  switch (relationship.type) {
    case "FS":
      return predecessor.earlyFinish + lag;
    case "SS":
      return predecessor.earlyStart + lag;
    case "FF":
      return predecessor.earlyFinish + lag - successor.duration;
    case "SF":
      return predecessor.earlyStart + lag - successor.duration;
  }
}

function predecessorLatestStartConstraint(
  predecessor: Activity,
  successor: ActivityMetrics,
  relationship: Relationship,
) {
  const lag = relationship.lag ?? 0;
  switch (relationship.type) {
    case "FS":
      return successor.lateStart - lag - predecessor.duration;
    case "SS":
      return successor.lateStart - lag;
    case "FF":
      return successor.lateFinish - lag - predecessor.duration;
    case "SF":
      return successor.lateFinish - lag;
  }
}

function relationshipFreeFloat(
  predecessor: ActivityMetrics,
  successor: ActivityMetrics,
  relationship: Relationship,
) {
  const lag = relationship.lag ?? 0;
  switch (relationship.type) {
    case "FS":
      return successor.earlyStart - predecessor.earlyFinish - lag;
    case "SS":
      return successor.earlyStart - predecessor.earlyStart - lag;
    case "FF":
      return successor.earlyFinish - predecessor.earlyFinish - lag;
    case "SF":
      return successor.earlyFinish - predecessor.earlyStart - lag;
  }
}

export function runCPM(schedule: Schedule): CpmResult {
  ensureValidSchedule(schedule);

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

  const ready = schedule.activities
    .filter((activity) => (indegree.get(activity.id) ?? 0) === 0)
    .map((activity) => activity.id);
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
    const cyclicIds = schedule.activities
      .filter((activity) => !topologicalOrder.includes(activity.id))
      .map((activity) => activity.id)
      .join(", ");
    throw new Error(`يوجد حلقة منطقية تمنع حساب CPM: ${cyclicIds}`);
  }

  const metrics = new Map<string, ActivityMetrics>();
  for (const activityId of topologicalOrder) {
    const activity = activityById.get(activityId)!;
    const constraints = (incoming.get(activityId) ?? []).map((relationship) =>
      relationshipConstraint(metrics.get(relationship.predecessorId)!, { ...activity, earlyStart: 0, earlyFinish: 0, lateStart: 0, lateFinish: 0, totalFloat: 0, freeFloat: 0, isCritical: false }, relationship),
    );
    const earlyStart = Math.max(0, activity.plannedStart ?? 0, ...constraints);
    metrics.set(activityId, {
      ...activity,
      earlyStart,
      earlyFinish: earlyStart + activity.duration,
      lateStart: 0,
      lateFinish: 0,
      totalFloat: 0,
      freeFloat: 0,
      isCritical: false,
    });
  }

  const projectDuration = Math.max(...Array.from(metrics.values()).map((activity) => activity.earlyFinish));

  for (const activityId of [...topologicalOrder].reverse()) {
    const activity = activityById.get(activityId)!;
    const successors = outgoing.get(activityId) ?? [];
    const defaultLatestStart = projectDuration - activity.duration;
    const latestStartConstraints = successors.map((relationship) =>
      predecessorLatestStartConstraint(activity, metrics.get(relationship.successorId)!, relationship),
    );
    const lateStart = Math.min(defaultLatestStart, ...latestStartConstraints);
    const metric = metrics.get(activityId)!;
    metric.lateStart = lateStart;
    metric.lateFinish = lateStart + activity.duration;
    metric.totalFloat = lateStart - metric.earlyStart;
  }

  for (const activity of Array.from(metrics.values())) {
    const successors = outgoing.get(activity.id) ?? [];
    const floats = successors.map((relationship) =>
      relationshipFreeFloat(activity, metrics.get(relationship.successorId)!, relationship),
    );
    activity.freeFloat = Math.max(0, floats.length ? Math.min(...floats) : projectDuration - activity.earlyFinish);
    activity.isCritical = Math.abs(activity.totalFloat) < EPSILON;
  }

  const activities = schedule.activities.map((activity) => metrics.get(activity.id)!);
  const warnings: string[] = [];
  const openEnds = activities.filter(
    (activity) => (incoming.get(activity.id)?.length ?? 0) === 0 || (outgoing.get(activity.id)?.length ?? 0) === 0,
  );
  if (openEnds.length > 2) warnings.push(`يوجد ${openEnds.length} أنشطة ذات نهاية مفتوحة؛ راجع منطق الشبكة قبل اعتماد التحليل.`);
  if (activities.some((activity) => activity.totalFloat < -EPSILON)) warnings.push("يوجد عائمة سالبة في الشبكة؛ راجع القيود والمنطق.");

  return {
    scheduleId: schedule.id,
    scheduleName: schedule.name,
    projectDuration,
    completionDate: daysToDate(schedule.startDate, projectDuration),
    activities,
    relationships: schedule.relationships,
    topologicalOrder,
    criticalActivityIds: activities.filter((activity) => activity.isCritical).map((activity) => activity.id),
    warnings,
  };
}

export function insertFragnet(schedule: Schedule, fragnet: Fragnet): Schedule {
  const baseActivityIds = new Set(schedule.activities.map((activity) => activity.id));
  const fragnetActivityIds = new Set<string>();
  for (const activity of fragnet.activities) {
    if (baseActivityIds.has(activity.id) || fragnetActivityIds.has(activity.id)) {
      throw new Error(`معرف نشاط الـ Fragnet مكرر أو موجود مسبقاً: ${activity.id}`);
    }
    fragnetActivityIds.add(activity.id);
  }
  const replaced = new Set(fragnet.replacedRelationshipIds ?? []);
  const keptRelationships = schedule.relationships.filter((relationship) => !replaced.has(relationship.id));
  const relationshipIds = new Set(keptRelationships.map((relationship) => relationship.id));
  for (const relationship of fragnet.relationships) {
    if (relationshipIds.has(relationship.id)) throw new Error(`معرف علاقة الـ Fragnet مكرر: ${relationship.id}`);
    relationshipIds.add(relationship.id);
  }

  return {
    ...schedule,
    id: `${schedule.id}--${fragnet.id}`,
    name: `${schedule.name} + ${fragnet.title}`,
    activities: [
      ...schedule.activities.map((activity) => ({ ...activity, kind: activity.kind ?? "base" as const })),
      ...fragnet.activities.map((activity) => ({ ...activity, kind: "fragnet" as const })),
    ],
    relationships: [...keptRelationships, ...fragnet.relationships],
  };
}

export function runTIA(schedule: Schedule, fragnet: Fragnet): TiaResult {
  const baseline = runCPM(schedule);
  const impactedSchedule = insertFragnet(schedule, fragnet);
  const impacted = runCPM(impactedSchedule);
  const impactDays = impacted.projectDuration - baseline.projectDuration;
  const tiedToBase = fragnet.relationships.filter(
    (relationship) =>
      schedule.activities.some((activity) => activity.id === relationship.predecessorId) ||
      schedule.activities.some((activity) => activity.id === relationship.successorId),
  ).length;
  const notes = [
    `تم الحساب على نسخة: ${schedule.name}.`,
    `تاريخ الإكمال قبل الإدراج: ${baseline.completionDate}.`,
    `تاريخ الإكمال بعد الإدراج: ${impacted.completionDate}.`,
  ];
  if (tiedToBase < 2) notes.push("تحذير: الـ Fragnet لا يبدو مرتبطاً بشبكة الأساس عند نقطتي دخول وخروج؛ تحقق من الرابط المنطقي.");
  if (impactDays === 0) notes.push("لم يتغير تاريخ الإكمال؛ يستهلك الحدث عائمة متاحة أو لا يصل إلى مسار الإكمال.");
  if (impactDays < 0) notes.push("أنتجت الشبكة تاريخ إكمال أبكر؛ راجع الـ leads أو العلاقات المستبدلة.");

  return {
    fragnetId: fragnet.id,
    fragnetTitle: fragnet.title,
    baseline,
    impacted,
    impactDays,
    baselineCompletionDate: baseline.completionDate,
    impactedCompletionDate: impacted.completionDate,
    outcome: impactDays > EPSILON ? "delayed" : impactDays < -EPSILON ? "accelerated" : "float-consumed",
    notes,
  };
}

export function dateToRelativeDay(scheduleStartDate: string, targetDate: string) {
  const start = new Date(`${scheduleStartDate}T00:00:00Z`).getTime();
  const target = new Date(`${targetDate}T00:00:00Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(target)) throw new Error("صيغة التاريخ غير صالحة. استخدم YYYY-MM-DD.");
  return Math.round((target - start) / 86_400_000);
}

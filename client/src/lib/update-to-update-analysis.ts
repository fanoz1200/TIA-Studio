import type {
  Activity,
  ResourceAssignment,
  Schedule,
  TimeSliceSnapshot,
  WbsNode,
  WorkingCalendar,
} from "@/lib/cpm";
import { runCPM, type CpmResult } from "@/lib/cpm";

/**
 * العقد المشترك بين قراءات Time Slice وHalf–Zero Step.
 * لا يغيّر هذا الملف اللقطات المستوردة؛ كل حالة تحليلية تبنى من نسخة مستقلة.
 */
export type UpdateToUpdateSnapshot = TimeSliceSnapshot & {
  /** يظل فارغاً عندما لا يرد Data Date صريح في المصدر؛ بوابة الجاهزية هي من تحكم عليه. */
  declaredDataDate?: string;
  /** تاريخ رصدي للعرض والترتيب الأولي فقط، وليس بديلاً عن Data Date في Half–Zero. */
  effectiveDate: string;
};

export type UpdateToUpdateTarget = {
  kind: "project-completion";
  id: "project-completion";
  label: string;
};

/**
 * خريطة معلنة فقط بين Activity IDs القديمة والجديدة. لا تنشئها المنصة تلقائياً
 * ولا تتعامل معها كدليل على أن النشاطين متكافئان.
 */
export type ActivityIdentityMapping = Record<string, string>;

export type UpdateToUpdatePair = {
  id: string;
  previous: UpdateToUpdateSnapshot;
  current: UpdateToUpdateSnapshot;
  target: UpdateToUpdateTarget;
  activityIdentityMapping?: ActivityIdentityMapping;
};

export type CreateUpdateToUpdatePairInput = {
  id?: string;
  previous: TimeSliceSnapshot;
  current: TimeSliceSnapshot;
  target?: UpdateToUpdateTarget;
  activityIdentityMapping?: ActivityIdentityMapping;
};

export const projectCompletionTarget: UpdateToUpdateTarget = {
  kind: "project-completion",
  id: "project-completion",
  label: "Project completion / نهاية المشروع",
};

function cloneCalendar(calendar?: WorkingCalendar): WorkingCalendar | undefined {
  if (!calendar) return undefined;
  return {
    ...calendar,
    workingWeekdays: [...calendar.workingWeekdays],
    holidays: [...calendar.holidays],
    holidayLabels: calendar.holidayLabels ? { ...calendar.holidayLabels } : undefined,
  };
}

function cloneActivity(activity: Activity): Activity {
  return {
    ...activity,
    constraint: activity.constraint ? { ...activity.constraint } : undefined,
    constraintAudit: activity.constraintAudit?.map((item) => ({ ...item })),
  };
}

function cloneWbsNode(node: WbsNode): WbsNode {
  return { ...node };
}

function cloneResourceAssignment(assignment: ResourceAssignment): ResourceAssignment {
  return { ...assignment };
}

/** ينشئ نسخة كاملة بما يكفي للحساب المحلي من دون تعديل الـsnapshot أو ملف P6/XER الأصلي. */
export function cloneScheduleForUpdateToUpdate(schedule: Schedule, id = schedule.id, name = schedule.name): Schedule {
  return {
    ...schedule,
    id,
    name,
    activities: schedule.activities.map(cloneActivity),
    relationships: schedule.relationships.map((relationship) => ({ ...relationship })),
    calendar: cloneCalendar(schedule.calendar),
    wbsNodes: schedule.wbsNodes?.map(cloneWbsNode),
    resourceAssignments: schedule.resourceAssignments?.map(cloneResourceAssignment),
    importNotes: schedule.importNotes ? [...schedule.importNotes] : undefined,
  };
}

/** يطبع اللقطة في شكل واحد تستخدمه طرق المقارنة المختلفة. */
export function normalizeUpdateToUpdateSnapshot(snapshot: TimeSliceSnapshot): UpdateToUpdateSnapshot {
  const schedule = cloneScheduleForUpdateToUpdate(snapshot.schedule);
  return {
    ...snapshot,
    schedule,
    declaredDataDate: schedule.dataDate,
    effectiveDate: schedule.dataDate ?? schedule.startDate,
  };
}

/**
 * يجهّز زوج تحديثات محلياً فقط. لا يتحقق عمداً من صلاحية Data Date أو completeness هنا:
 * تلك مسؤولية Readiness Gate كي تظهر كل مخالفة في تقرير قابل للمراجعة بدلاً من إخفائها برمي خطأ.
 */
export function createUpdateToUpdatePair(input: CreateUpdateToUpdatePairInput): UpdateToUpdatePair {
  if (input.previous.id === input.current.id) {
    throw new Error("يجب اختيار لقطتين مختلفتين للمقارنة بين التحديثات.");
  }
  const previous = normalizeUpdateToUpdateSnapshot(input.previous);
  const current = normalizeUpdateToUpdateSnapshot(input.current);
  return {
    id: input.id ?? `U2U-${previous.id}-${current.id}`,
    previous,
    current,
    target: { ...(input.target ?? projectCompletionTarget) },
    activityIdentityMapping: input.activityIdentityMapping ? { ...input.activityIdentityMapping } : undefined,
  };
}

export type LocalizedText = { ar: string; en: string };

export type ReadinessStatus = "ready" | "ready-with-review" | "blocked";
export type ReadinessCheckStatus = "pass" | "review" | "blocked";
export type ReadinessCheckCode =
  | "schedule-identity"
  | "data-date-order"
  | "progress-records"
  | "remaining-duration-classification"
  | "logic-and-lag"
  | "calendar-and-holidays"
  | "constraints"
  | "scope-and-activity-identity"
  | "analysis-target";

export type UpdateToUpdateReadinessCheck = {
  code: ReadinessCheckCode;
  status: ReadinessCheckStatus;
  message: LocalizedText;
  details?: LocalizedText[];
};

export type UpdateToUpdateReadinessReport = {
  status: ReadinessStatus;
  checks: UpdateToUpdateReadinessCheck[];
  blockingReasons: LocalizedText[];
  reviewNotes: LocalizedText[];
};

export type ScheduleChangeCategory =
  | "progress"
  | "remaining-duration"
  | "duration"
  | "logic"
  | "calendar"
  | "constraint"
  | "scope-identity"
  | "unknown";

export type ScheduleChangeClassification = "progress" | "revision" | "needs-analyst-review" | "blocker";

export type UpdateToUpdateChange = {
  id: string;
  category: ScheduleChangeCategory;
  classification: ScheduleChangeClassification;
  activityId?: string;
  previousActivityId?: string;
  summary: LocalizedText;
  before?: string | number | null;
  after?: string | number | null;
};

export type UpdateToUpdateChangeRegister = {
  changes: UpdateToUpdateChange[];
  counts: Record<ScheduleChangeClassification, number>;
  unpairedPreviousActivityIds: string[];
  unpairedCurrentActivityIds: string[];
};

export type UpdateToUpdateInspection = {
  pair: UpdateToUpdatePair;
  readiness: UpdateToUpdateReadinessReport;
  changeRegister: UpdateToUpdateChangeRegister;
};

function text(ar: string, en: string): LocalizedText {
  return { ar, en };
}

function valueOrNone(value: string | number | undefined) {
  return value === undefined || value === "" ? null : value;
}

function sameValue(left: unknown, right: unknown) {
  return left === right || (left === undefined && right === null) || (left === null && right === undefined);
}

function activityHasProgressRecord(activity: Activity) {
  return activity.actualStart !== undefined
    || activity.actualFinish !== undefined
    || activity.percentComplete !== undefined
    || activity.remainingDuration !== undefined;
}

function activityProgressSignature(activity: Activity) {
  return [activity.actualStart ?? "", activity.actualFinish ?? "", activity.percentComplete ?? ""].join("|");
}

function activityConstraintSignature(activity: Activity) {
  return JSON.stringify({
    constraint: activity.constraint ?? null,
    audit: (activity.constraintAudit ?? []).map((item) => ({
      slot: item.slot,
      code: item.code,
      date: item.date ?? null,
      rawDate: item.rawDate ?? null,
      status: item.status,
    })),
  });
}

function calendarSignature(calendar?: WorkingCalendar) {
  if (!calendar) return "";
  return JSON.stringify({
    id: calendar.id,
    workingWeekdays: [...calendar.workingWeekdays].sort((a, b) => a - b),
    holidays: [...calendar.holidays].sort(),
    hoursPerDay: calendar.hoursPerDay ?? null,
  });
}

function mapPreviousActivityId(pair: UpdateToUpdatePair, activityId: string) {
  return pair.activityIdentityMapping?.[activityId] ?? activityId;
}

function relationshipSignature(pair: UpdateToUpdatePair, relationship: { predecessorId: string; successorId: string; type: string; lag?: number }, previous = false) {
  const predecessorId = previous ? mapPreviousActivityId(pair, relationship.predecessorId) : relationship.predecessorId;
  const successorId = previous ? mapPreviousActivityId(pair, relationship.successorId) : relationship.successorId;
  return `${predecessorId}|${successorId}|${relationship.type}|${relationship.lag ?? 0}`;
}

function addChange(changes: UpdateToUpdateChange[], change: Omit<UpdateToUpdateChange, "id">) {
  changes.push({ ...change, id: `U2U-CHANGE-${changes.length + 1}` });
}

/**
 * يبني سجل فروق تقني فقط. لا ينسب السبب أو المسؤولية، ولا يصنف Remaining Duration
 * تلقائياً كـprogress أو revision لأنه يحتاج قاعدة تحديث ودليل محلل.
 */
export function buildUpdateToUpdateChangeRegister(pair: UpdateToUpdatePair): UpdateToUpdateChangeRegister {
  const changes: UpdateToUpdateChange[] = [];
  const currentById = new Map(pair.current.schedule.activities.map((activity) => [activity.id, activity]));
  const pairedCurrentIds = new Set<string>();
  const unpairedPreviousActivityIds: string[] = [];

  for (const previousActivity of pair.previous.schedule.activities) {
    const currentActivityId = mapPreviousActivityId(pair, previousActivity.id);
    const currentActivity = currentById.get(currentActivityId);
    if (!currentActivity) {
      unpairedPreviousActivityIds.push(previousActivity.id);
      addChange(changes, {
        category: "scope-identity",
        classification: "blocker",
        activityId: previousActivity.id,
        previousActivityId: previousActivity.id,
        summary: text(`النشاط ${previousActivity.id} غير موجود في التحديث الحالي ولا توجد خريطة هوية معلنة.`, `Activity ${previousActivity.id} is absent from the current update without a declared identity mapping.`),
        before: previousActivity.name,
        after: null,
      });
      continue;
    }
    pairedCurrentIds.add(currentActivityId);

    if (activityProgressSignature(previousActivity) !== activityProgressSignature(currentActivity)) {
      addChange(changes, {
        category: "progress",
        classification: "progress",
        activityId: currentActivityId,
        previousActivityId: previousActivity.id,
        summary: text(`تغيّر التقدم المسجل للنشاط ${currentActivityId}.`, `Recorded progress changed for activity ${currentActivityId}.`),
        before: activityProgressSignature(previousActivity),
        after: activityProgressSignature(currentActivity),
      });
    }
    if (!sameValue(previousActivity.remainingDuration, currentActivity.remainingDuration)) {
      addChange(changes, {
        category: "remaining-duration",
        classification: "needs-analyst-review",
        activityId: currentActivityId,
        previousActivityId: previousActivity.id,
        summary: text(`تغيّرت المدة المتبقية للنشاط ${currentActivityId} وتحتاج تصنيف محلل قبل التوزيع.`, `Remaining duration changed for activity ${currentActivityId} and needs analyst classification before allocation.`),
        before: valueOrNone(previousActivity.remainingDuration),
        after: valueOrNone(currentActivity.remainingDuration),
      });
    }
    if (!sameValue(previousActivity.duration, currentActivity.duration)) {
      addChange(changes, {
        category: "duration",
        classification: "needs-analyst-review",
        activityId: currentActivityId,
        previousActivityId: previousActivity.id,
        summary: text(`تغيّرت مدة النشاط ${currentActivityId}; لا تُنسب آلياً إلى progress أو revision.`, `Activity duration changed for ${currentActivityId}; it is not automatically allocated to progress or revision.`),
        before: previousActivity.duration,
        after: currentActivity.duration,
      });
    }
    if (!sameValue(previousActivity.calendarId, currentActivity.calendarId)) {
      addChange(changes, {
        category: "calendar",
        classification: "revision",
        activityId: currentActivityId,
        previousActivityId: previousActivity.id,
        summary: text(`تغيّر تقويم النشاط ${currentActivityId}.`, `Calendar assignment changed for activity ${currentActivityId}.`),
        before: valueOrNone(previousActivity.calendarId),
        after: valueOrNone(currentActivity.calendarId),
      });
    }
    if (activityConstraintSignature(previousActivity) !== activityConstraintSignature(currentActivity)) {
      addChange(changes, {
        category: "constraint",
        classification: "revision",
        activityId: currentActivityId,
        previousActivityId: previousActivity.id,
        summary: text(`تغيّرت القيود أو سجل قيود النشاط ${currentActivityId}.`, `Constraint data or audit changed for activity ${currentActivityId}.`),
      });
    }
    if (previousActivity.name !== currentActivity.name || previousActivity.wbsId !== currentActivity.wbsId || previousActivity.wbs !== currentActivity.wbs) {
      addChange(changes, {
        category: "scope-identity",
        classification: "needs-analyst-review",
        activityId: currentActivityId,
        previousActivityId: previousActivity.id,
        summary: text(`تغيّرت هوية/وصف نطاق النشاط ${currentActivityId}; راجع استمرار المطابقة.`, `Activity identity/scope description changed for ${currentActivityId}; review continuity of the match.`),
      });
    }
  }

  const unpairedCurrentActivityIds = pair.current.schedule.activities
    .filter((activity) => !pairedCurrentIds.has(activity.id))
    .map((activity) => activity.id);
  for (const activityId of unpairedCurrentActivityIds) {
    const activity = currentById.get(activityId)!;
    addChange(changes, {
      category: "scope-identity",
      classification: "blocker",
      activityId,
      summary: text(`النشاط ${activityId} أضيف في التحديث الحالي بلا خريطة هوية معلنة.`, `Activity ${activityId} was added in the current update without a declared identity mapping.`),
      before: null,
      after: activity.name,
    });
  }

  const previousRelationships = new Set(pair.previous.schedule.relationships.map((relationship) => relationshipSignature(pair, relationship, true)));
  const currentRelationships = new Set(pair.current.schedule.relationships.map((relationship) => relationshipSignature(pair, relationship)));
  const relationshipSignatures = Array.from(new Set(Array.from(previousRelationships).concat(Array.from(currentRelationships))));
  for (const signature of relationshipSignatures) {
    if (previousRelationships.has(signature) === currentRelationships.has(signature)) continue;
    addChange(changes, {
      category: "logic",
      classification: "revision",
      summary: text(`تغيّر منطق/lag العلاقة ${signature}.`, `Relationship logic/lag changed: ${signature}.`),
      before: previousRelationships.has(signature) ? signature : null,
      after: currentRelationships.has(signature) ? signature : null,
    });
  }

  if (calendarSignature(pair.previous.schedule.calendar) !== calendarSignature(pair.current.schedule.calendar)) {
    addChange(changes, {
      category: "calendar",
      classification: "revision",
      summary: text("تغيّر تقويم البرنامج أو أيام العمل أو العطلات بين التحديثين.", "Programme calendar, working week, or holidays changed between updates."),
    });
  }

  const counts: Record<ScheduleChangeClassification, number> = {
    progress: 0,
    revision: 0,
    "needs-analyst-review": 0,
    blocker: 0,
  };
  for (const change of changes) counts[change.classification] += 1;
  return { changes, counts, unpairedPreviousActivityIds, unpairedCurrentActivityIds };
}

function duplicateIds(activities: Activity[]) {
  const ids = new Set<string>();
  const duplicates = new Set<string>();
  for (const activity of activities) {
    if (ids.has(activity.id)) duplicates.add(activity.id);
    ids.add(activity.id);
  }
  return Array.from(duplicates).sort();
}

function check(code: ReadinessCheckCode, status: ReadinessCheckStatus, ar: string, en: string, details?: LocalizedText[]): UpdateToUpdateReadinessCheck {
  return { code, status, message: text(ar, en), details };
}

/**
 * بوابة بيانات Half–Zero. تسجل كل سبب بدل «إصلاح» أي ملف أو تحويل الحقول الغامضة
 * إلى توزيع تلقائي. لا تمنع Time Slice الرصدي من الاستمرار في مهمته المنفصلة.
 */
export function assessUpdateToUpdateReadiness(pair: UpdateToUpdatePair, changeRegister = buildUpdateToUpdateChangeRegister(pair)): UpdateToUpdateReadinessReport {
  const checks: UpdateToUpdateReadinessCheck[] = [];
  const previousDuplicates = duplicateIds(pair.previous.schedule.activities);
  const currentDuplicates = duplicateIds(pair.current.schedule.activities);
  const scheduleIdsMatch = pair.previous.schedule.id === pair.current.schedule.id;
  const hasDeclaredMapping = Boolean(pair.activityIdentityMapping && Object.keys(pair.activityIdentityMapping).length);
  checks.push(
    previousDuplicates.length || currentDuplicates.length
      ? check("schedule-identity", "blocked", "توجد Activity IDs مكررة؛ لا يمكن بناء مطابقة موثوقة.", "Duplicate Activity IDs prevent a reliable identity match.", [text(`سابق: ${previousDuplicates.join(", ") || "—"}; حالي: ${currentDuplicates.join(", ") || "—"}.`, `Previous: ${previousDuplicates.join(", ") || "—"}; current: ${currentDuplicates.join(", ") || "—"}.`)])
      : !scheduleIdsMatch && !hasDeclaredMapping
        ? check("schedule-identity", "blocked", "معرّف البرنامج مختلف ولا توجد خريطة هوية معلنة.", "Schedule IDs differ and no declared identity mapping is available.")
        : !scheduleIdsMatch
          ? check("schedule-identity", "review", "معرّف البرنامج مختلف؛ راجع خريطة الهوية المعلنة قبل الاعتماد.", "Schedule IDs differ; review the declared identity mapping before relying on the analysis.")
          : check("schedule-identity", "pass", "معرّف البرنامج وActivity IDs صالحان للمطابقة الأولية.", "Schedule ID and Activity IDs support an initial match."),
  );

  const previousDataDate = pair.previous.declaredDataDate;
  const currentDataDate = pair.current.declaredDataDate;
  checks.push(
    !previousDataDate || !currentDataDate
      ? check("data-date-order", "blocked", "يلزم Data Date صريح لكل تحديث؛ تاريخ البدء لا يعوضه في Half–Zero.", "Each update needs an explicit Data Date; start date cannot substitute for Half–Zero.")
      : previousDataDate >= currentDataDate
        ? check("data-date-order", "blocked", "يجب أن يأتي Data Date للتحديث الحالي بعد التحديث السابق.", "The current update Data Date must be later than the previous update.")
        : check("data-date-order", "pass", "Data Dates موجودة ومرتبة زمنياً.", "Data Dates are present and chronologically ordered."),
  );

  const previousProgressCount = pair.previous.schedule.activities.filter(activityHasProgressRecord).length;
  const currentProgressCount = pair.current.schedule.activities.filter(activityHasProgressRecord).length;
  const incompleteActuals = pair.current.schedule.activities.filter((activity) => Boolean(activity.actualFinish) && !activity.actualStart).map((activity) => activity.id);
  checks.push(
    !previousProgressCount || !currentProgressCount
      ? check("progress-records", "blocked", "تسجيل actuals/progress غير كافٍ في أحد التحديثين لتكوين Half-Step قابل للمراجعة.", "Actuals/progress records are insufficient in one update to construct a reviewable Half-Step.")
      : incompleteActuals.length
        ? check("progress-records", "review", "بعض Actual Finish بلا Actual Start؛ يلزم مراجعة حالة التقدم.", "Some Actual Finish values lack Actual Start; review progress status.", [text(incompleteActuals.join(", "), incompleteActuals.join(", "))])
        : check("progress-records", "pass", "سجل التقدم موجود في التحديثين؛ يبقى التصنيف التفصيلي خاضعاً للمراجعة.", "Progress records exist in both updates; detailed classification remains reviewable."),
  );

  const unclassifiedDurationChanges = changeRegister.changes.filter((change) => change.classification === "needs-analyst-review" && (change.category === "remaining-duration" || change.category === "duration"));
  const incompleteForecastActivities = [pair.previous, pair.current].flatMap((snapshot) => snapshot.schedule.activities
    .filter((activity) => !activity.actualFinish
      && activity.remainingDuration === undefined
      && (Boolean(activity.actualStart) || (activity.percentComplete !== undefined && activity.percentComplete > 0 && activity.percentComplete < 100)))
    .map((activity) => `${snapshot.id}:${activity.id}`));
  checks.push(
    incompleteForecastActivities.length
      ? check("remaining-duration-classification", "blocked", "يوجد نشاط جارٍ بلا Remaining Duration معلنة؛ لا يمكن إسقاط forecast قابل للمراجعة.", "An in-progress activity lacks a declared Remaining Duration; a reviewable forecast cannot be constructed.", [text(incompleteForecastActivities.join(", "), incompleteForecastActivities.join(", "))])
      : unclassifiedDurationChanges.length
      ? check("remaining-duration-classification", "review", "توجد مدد متبقية أو مدد أصلية متغيرة بلا تصنيف محلل؛ لا توزع تلقائياً بين progress وrevision.", "Changed remaining or original durations lack analyst classification; they are not allocated automatically between progress and revision.")
      : check("remaining-duration-classification", "pass", "لا توجد فروق مدة تحتاج تصنيفاً يدوياً في هذا الزوج.", "No duration variance requires manual classification in this pair."),
  );

  const logicChangeCount = changeRegister.changes.filter((change) => change.category === "logic").length;
  checks.push(
    logicChangeCount
      ? check("logic-and-lag", "review", "تغيّرات العلاقات أو الـlags ظاهرة في سجل التغييرات ولا تدخل Half-Step كتقدم.", "Relationship or lag changes are visible in the register and are not treated as Half-Step progress.")
      : check("logic-and-lag", "pass", "لا تظهر فروق علاقات أو lags في المطابقة الحالية.", "No relationship or lag variance appears in the current match."),
  );

  const calendarMissing = !pair.previous.schedule.calendar || !pair.current.schedule.calendar;
  const calendarChangeCount = changeRegister.changes.filter((change) => change.category === "calendar").length;
  checks.push(
    calendarMissing
      ? check("calendar-and-holidays", "review", "تعريف تقويم أحد التحديثين غير متاح محلياً؛ تعرض أي نتيجة بتحفظ واضح.", "A programme calendar is unavailable locally; any result requires an explicit limitation.")
      : calendarChangeCount
        ? check("calendar-and-holidays", "review", "تغيّر التقويم أو العطلات ظاهر ويعامل كتعديل برنامج قابل للمراجعة.", "Calendar or holiday changes are visible and treated as a reviewable programme revision.")
        : check("calendar-and-holidays", "pass", "التقويمان متاحان ولا يظهر فرق في أيام العمل أو العطلات.", "Both calendars are available with no working-week or holiday variance."),
  );

  const unsupportedConstraints = [...pair.previous.schedule.activities, ...pair.current.schedule.activities]
    .flatMap((activity) => activity.constraintAudit ?? [])
    .filter((constraint) => constraint.status === "review-required");
  checks.push(
    unsupportedConstraints.length
      ? check("constraints", "review", "توجد قيود مستوردة تحتاج مراجعة ولا يدّعي المحرك المحلي مطابقة P6 لها.", "Imported constraints require review; the local engine does not claim P6 parity for them.")
      : check("constraints", "pass", "لا تظهر قيود مستوردة موسومة للمراجعة في هذا الزوج.", "No imported constraints marked for review appear in this pair."),
  );

  checks.push(
    changeRegister.counts.blocker
      ? check("scope-and-activity-identity", "blocked", "توجد أنشطة مضافة/محذوفة بلا خريطة هوية؛ يتوقف التوزيع حتى توثيقها.", "Added or removed activities lack an identity map; allocation stops until documented.")
      : changeRegister.changes.some((change) => change.category === "scope-identity")
        ? check("scope-and-activity-identity", "review", "توجد تغيّرات تعريف/نطاق تحتاج مراجعة المحلل.", "Identity or scope changes require analyst review.")
        : check("scope-and-activity-identity", "pass", "لا توجد فجوة هوية أو نطاق غير موثقة في المطابقة الحالية.", "No undocumented identity or scope gap appears in the current match."),
  );

  checks.push(
    pair.target.kind === "project-completion" && pair.previous.schedule.activities.length && pair.current.schedule.activities.length
      ? check("analysis-target", "pass", "هدف القراءة هو نهاية المشروع المحسوبة محلياً.", "The analysis target is locally calculated project completion.")
      : check("analysis-target", "blocked", "لا يتوفر هدف زمني قابل للحساب لهذا الزوج.", "No calculable time target is available for this pair."),
  );

  const blockingReasons = checks.filter((item) => item.status === "blocked").map((item) => item.message);
  const reviewNotes = checks.filter((item) => item.status === "review").map((item) => item.message);
  const status: ReadinessStatus = blockingReasons.length ? "blocked" : reviewNotes.length ? "ready-with-review" : "ready";
  return { status, checks, blockingReasons, reviewNotes };
}

export function inspectUpdateToUpdatePair(pair: UpdateToUpdatePair): UpdateToUpdateInspection {
  const changeRegister = buildUpdateToUpdateChangeRegister(pair);
  return { pair, changeRegister, readiness: assessUpdateToUpdateReadiness(pair, changeRegister) };
}

export type HalfZeroStateKey = "A" | "H" | "Z" | "B";
export type HalfZeroPlanSource = "previous" | "current";
export type HalfZeroProgressSource = "previous" | "current";

export type HalfZeroState = {
  key: HalfZeroStateKey;
  title: LocalizedText;
  planSource: HalfZeroPlanSource;
  progressSource: HalfZeroProgressSource;
  schedule: Schedule;
  forecast: CpmResult;
  completionDate: string;
};

export type HalfZeroPath = {
  firstComponent: "progress" | "revision";
  secondComponent: "progress" | "revision";
  firstDays: number;
  secondDays: number;
  netDays: number;
  residualDays: number;
  balanced: boolean;
};

export type HalfZeroSensitivity = {
  progressAllocationDifferenceDays: number;
  revisionAllocationDifferenceDays: number;
  hasOrderSensitivity: boolean;
  disclosure: LocalizedText;
};

export type HalfZeroAnalystClassification = "progress" | "revision";

export type HalfZeroStepOptions = {
  /**
   * قرار محلل يدوي فقط لكل فرق يحتاج تصنيفاً، بمفتاح `${activityId ?? "schedule"}:${category}`.
   * لا يغير اللقطة أو يعتبر دليلاً على المسؤولية أو الاستحقاق.
   */
  analystClassifications?: Record<string, HalfZeroAnalystClassification>;
};

export type HalfZeroStepAnalysis = {
  status: "blocked" | "review-ready";
  pair: UpdateToUpdatePair;
  readiness: UpdateToUpdateReadinessReport;
  changeRegister: UpdateToUpdateChangeRegister;
  unresolvedChangeKeys: string[];
  blockingReasons: LocalizedText[];
  states?: Record<HalfZeroStateKey, HalfZeroState>;
  halfPath?: HalfZeroPath;
  zeroPath?: HalfZeroPath;
  sensitivity?: HalfZeroSensitivity;
  limitations: LocalizedText[];
};

function changeClassificationKey(change: UpdateToUpdateChange) {
  return `${change.activityId ?? "schedule"}:${change.category}`;
}

function reverseIdentityMapping(pair: UpdateToUpdatePair) {
  const reverse: Record<string, string> = {};
  for (const previousId of Object.keys(pair.activityIdentityMapping ?? {})) {
    const currentId = pair.activityIdentityMapping![previousId];
    if (reverse[currentId]) throw new Error(`Activity identity mapping is not one-to-one for ${currentId}.`);
    reverse[currentId] = previousId;
  }
  return reverse;
}

function matchingProgressActivityId(pair: UpdateToUpdatePair, planSource: HalfZeroPlanSource, progressSource: HalfZeroProgressSource, planActivityId: string, reverseMapping: Record<string, string>) {
  if (planSource === progressSource) return planActivityId;
  if (planSource === "previous" && progressSource === "current") return pair.activityIdentityMapping?.[planActivityId] ?? planActivityId;
  return reverseMapping[planActivityId] ?? planActivityId;
}

function copyProgressState(planActivity: Activity, progressActivity: Activity): Activity {
  return {
    ...planActivity,
    percentComplete: progressActivity.percentComplete,
    percentCompleteType: progressActivity.percentCompleteType,
    remainingDuration: progressActivity.remainingDuration,
    actualStart: progressActivity.actualStart,
    actualFinish: progressActivity.actualFinish,
  };
}

function remainingForecastDuration(activity: Activity) {
  if (activity.actualFinish) return 0;
  if (activity.remainingDuration !== undefined) return activity.remainingDuration;
  return activity.duration;
}

/**
 * يحول الخطة المختارة وحالة التقدم المختارة إلى forecast محلي عند Data Date لحالة التقدم.
 * هذا ليس تشغيل F9 أو محاكاة كاملة لسلوك P6؛ يبقى مرشحاً للمطابقة داخل P6.
 */
function composeHalfZeroForecastSchedule(
  pair: UpdateToUpdatePair,
  key: HalfZeroStateKey,
  planSource: HalfZeroPlanSource,
  progressSource: HalfZeroProgressSource,
): Schedule {
  const planSnapshot = pair[planSource];
  const progressSnapshot = pair[progressSource];
  const reverseMapping = reverseIdentityMapping(pair);
  const progressActivities = new Map(progressSnapshot.schedule.activities.map((activity) => [activity.id, activity]));
  const composed = cloneScheduleForUpdateToUpdate(planSnapshot.schedule, `${pair.id}-${key}`, `${planSnapshot.schedule.name} — Half/Zero ${key}`);
  composed.startDate = progressSnapshot.declaredDataDate!;
  composed.dataDate = progressSnapshot.declaredDataDate!;
  composed.activities = composed.activities.map((planActivity) => {
    const progressActivityId = matchingProgressActivityId(pair, planSource, progressSource, planActivity.id, reverseMapping);
    const progressActivity = progressActivities.get(progressActivityId);
    if (!progressActivity) throw new Error(`Missing mapped progress activity ${progressActivityId} for state ${key}.`);
    const merged = copyProgressState(planActivity, progressActivity);
    return { ...merged, duration: remainingForecastDuration(merged) };
  });
  return composed;
}

function utcCalendarDaysBetween(from: string, to: string) {
  const fromUtc = Date.parse(`${from}T00:00:00Z`);
  const toUtc = Date.parse(`${to}T00:00:00Z`);
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

function makeState(pair: UpdateToUpdatePair, key: HalfZeroStateKey, title: LocalizedText, planSource: HalfZeroPlanSource, progressSource: HalfZeroProgressSource): HalfZeroState {
  const schedule = composeHalfZeroForecastSchedule(pair, key, planSource, progressSource);
  const forecast = runCPM(schedule);
  return { key, title, planSource, progressSource, schedule, forecast, completionDate: forecast.completionDate };
}

function makePath(firstComponent: "progress" | "revision", secondComponent: "progress" | "revision", start: HalfZeroState, middle: HalfZeroState, end: HalfZeroState): HalfZeroPath {
  const firstDays = utcCalendarDaysBetween(start.completionDate, middle.completionDate);
  const secondDays = utcCalendarDaysBetween(middle.completionDate, end.completionDate);
  const netDays = utcCalendarDaysBetween(start.completionDate, end.completionDate);
  const residualDays = netDays - (firstDays + secondDays);
  return { firstComponent, secondComponent, firstDays, secondDays, netDays, residualDays, balanced: residualDays === 0 };
}

const halfZeroLimitations = [
  text("النتيجة قراءة فنية محلية قابلة للمراجعة وليست قرار EOT أو مسؤولية أو entitlement أو تكلفة.", "The result is a local, reviewable technical reading—not an EOT, liability, entitlement, or cost decision."),
  text("الإسقاط يستخدم CPM محلياً على النسخة المتبقية عند Data Date ولا يدّعي تشغيل F9 أو تطابقاً كاملاً مع Primavera P6.", "The forecast uses local CPM on the remaining copy at the Data Date; it does not claim F9 execution or full Primavera P6 parity."),
  text("يجب مطابقة زوج Updates متتالٍ داخل نسخة P6 غير إنتاجية قبل الاعتماد المهني أو التعاقدي.", "A consecutive update pair must be reconciled in a non-production P6 copy before professional or contractual reliance."),
];

/**
 * يحسب مساري Half وZero من الحالات A/H/Z/B فقط بعد اجتياز بوابة البيانات.
 * لا يعدل البيانات المستوردة ولا يقرر سبب التغيير أو مسؤوليته؛ فرق ترتيب المسارين
 * يعرض كحساسية/interaction يجب كشفها للمراجع.
 */
export function runHalfZeroStepAnalysis(pair: UpdateToUpdatePair, options: HalfZeroStepOptions = {}): HalfZeroStepAnalysis {
  const inspection = inspectUpdateToUpdatePair(pair);
  const unresolvedChangeKeys = inspection.changeRegister.changes
    .filter((change) => change.classification === "needs-analyst-review")
    .map(changeClassificationKey)
    .filter((key) => options.analystClassifications?.[key] === undefined);
  const blockingReasons = [
    ...inspection.readiness.blockingReasons,
    ...(unresolvedChangeKeys.length
      ? [text("توجد فروق مدة/هوية غير مصنفة من المحلل؛ لا يبدأ توزيع Half–Zero تلقائياً.", "Unclassified duration or identity differences remain; Half–Zero allocation does not start automatically.")]
      : []),
  ];
  if (blockingReasons.length) {
    return {
      status: "blocked",
      pair: inspection.pair,
      readiness: inspection.readiness,
      changeRegister: inspection.changeRegister,
      unresolvedChangeKeys,
      blockingReasons,
      limitations: halfZeroLimitations,
    };
  }

  try {
    const states: Record<HalfZeroStateKey, HalfZeroState> = {
      A: makeState(pair, "A", text("A — الخطة السابقة + التقدم السابق", "A — previous plan + previous progress"), "previous", "previous"),
      H: makeState(pair, "H", text("H — الخطة السابقة + التقدم الحالي", "H — previous plan + current progress"), "previous", "current"),
      Z: makeState(pair, "Z", text("Z — الخطة الحالية + التقدم السابق", "Z — current plan + previous progress"), "current", "previous"),
      B: makeState(pair, "B", text("B — الخطة الحالية + التقدم الحالي", "B — current plan + current progress"), "current", "current"),
    };
    const halfPath = makePath("progress", "revision", states.A, states.H, states.B);
    const zeroPath = makePath("revision", "progress", states.A, states.Z, states.B);
    const progressAllocationDifferenceDays = halfPath.firstDays - zeroPath.secondDays;
    const revisionAllocationDifferenceDays = halfPath.secondDays - zeroPath.firstDays;
    const hasOrderSensitivity = progressAllocationDifferenceDays !== 0 || revisionAllocationDifferenceDays !== 0;
    const sensitivity: HalfZeroSensitivity = {
      progressAllocationDifferenceDays,
      revisionAllocationDifferenceDays,
      hasOrderSensitivity,
      disclosure: hasOrderSensitivity
        ? text("اختلاف تقسيم Half وZero يكشف حساسية للترتيب/interaction؛ يعرض للمراجعة ولا يثبت سبباً أو مسؤولية.", "The Half/Zero allocation difference reveals order sensitivity/interaction; it is disclosed for review and proves neither cause nor responsibility.")
        : text("لا يظهر اختلاف تقسيم بين مساري Half وZero في هذا الإسقاط المحلي.", "No allocation difference appears between Half and Zero in this local forecast."),
    };
    const unbalanced = !halfPath.balanced || !zeroPath.balanced;
    if (unbalanced) {
      return {
        status: "blocked",
        pair: inspection.pair,
        readiness: inspection.readiness,
        changeRegister: inspection.changeRegister,
        unresolvedChangeKeys,
        blockingReasons: [text("فشلت تسوية Half أو Zero؛ لا تعرض نتيجة توزيع غير متزنة.", "Half or Zero reconciliation failed; no unbalanced allocation is presented.")],
        states,
        halfPath,
        zeroPath,
        sensitivity,
        limitations: halfZeroLimitations,
      };
    }
    return {
      status: "review-ready",
      pair: inspection.pair,
      readiness: inspection.readiness,
      changeRegister: inspection.changeRegister,
      unresolvedChangeKeys,
      blockingReasons: [],
      states,
      halfPath,
      zeroPath,
      sensitivity,
      limitations: halfZeroLimitations,
    };
  } catch (error) {
    return {
      status: "blocked",
      pair: inspection.pair,
      readiness: inspection.readiness,
      changeRegister: inspection.changeRegister,
      unresolvedChangeKeys,
      blockingReasons: [text(`تعذر بناء حالات Half–Zero محلياً: ${error instanceof Error ? error.message : "خطأ غير معروف"}.`, `Half–Zero states could not be built locally: ${error instanceof Error ? error.message : "Unknown error"}.`)],
      limitations: halfZeroLimitations,
    };
  }
}

/**
 * TIA Studio — XER schedule adapter
 * يحول جداول Primavera P6 النصية الضرورية لتحليل CPM محلياً دون رفع الملف.
 */
import { calendarDayCalendar, type Activity, type ActivityConstraintAudit, type Relationship, type RelationshipType, type ResourceAssignment, type Schedule, type WbsNode } from "./cpm";
import { decodeXerBytes, encodeUtf8XerText, parseXerTableRows, type DecodedXerBytes, type XerRow } from "./xer-format";

export type XerImportSummary = {
  projectName: string;
  activitiesRead: number;
  relationshipsRead: number;
  /** صفر عند الملفات المقروءة سابقاً قبل إضافة عداد الاستبعاد. */
  relationshipsSkipped?: number;
  wbsRead: number;
  resourcesRead: number;
  resourceAssignmentsRead: number;
  /** صفر عند الملفات المقروءة سابقاً قبل إضافة عداد الاستبعاد. */
  resourceAssignmentsSkipped?: number;
  assignmentsWithCosts: number;
  activitiesWithProgress: number;
  /** معرّفات TASK.clndr_id المميزة التي احتفظ بها المستورد؛ لا تعني فك نمط P6. */
  taskCalendarIds?: string[];
  taskCalendarCount?: number;
  activitiesWithoutCalendarId?: number;
  constraintsRead?: number;
  supportedConstraintsRead?: number;
  unsupportedConstraintsRead?: number;
  calendarName?: string;
  warnings: string[];
  tablesFound: string[];
};

export type XerImportResult = { schedule: Schedule; summary: XerImportSummary };

function firstValue(row: XerRow | undefined, ...keys: string[]) {
  if (!row) return "";
  for (const key of keys) {
    const value = row[key];
    if (value) return value;
  }
  return "";
}

function parseXerDate(value: string) {
  const iso = value.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const short = value.match(/(\d{1,2})-([A-Za-z]{3})-(\d{2,4})/);
  if (!short) return "";
  const month = new Map([["JAN", "01"], ["FEB", "02"], ["MAR", "03"], ["APR", "04"], ["MAY", "05"], ["JUN", "06"], ["JUL", "07"], ["AUG", "08"], ["SEP", "09"], ["OCT", "10"], ["NOV", "11"], ["DEC", "12"]]);
  const monthNumber = month.get(short[2].toUpperCase());
  if (!monthNumber) return "";
  const year = short[3].length === 2 ? `20${short[3]}` : short[3];
  return `${year}-${monthNumber}-${short[1].padStart(2, "0")}`;
}

function relationshipType(value: string): RelationshipType {
  const normalized = value.replace(/^PR_/, "").toUpperCase();
  return normalized === "SS" || normalized === "FF" || normalized === "SF" ? normalized : "FS";
}

function numeric(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percent(value: string) {
  const result = numeric(value);
  if (!result) return undefined;
  return Math.max(0, Math.min(100, result <= 1 ? result * 100 : result));
}

function resourceType(value: string): ResourceAssignment["resourceType"] {
  const normalized = value.replace(/[\s_-]/g, "").toLowerCase();
  if (normalized.includes("nonlabor") || normalized.includes("nonlabour")) return "nonlabor";
  if (normalized.includes("labor") || normalized.includes("labour")) return "labor";
  if (normalized.includes("material")) return "material";
  return "unknown";
}

function importedConstraint(task: XerRow, slot: "primary" | "secondary") {
  const code = firstValue(task, slot === "primary" ? "cstr_type" : "cstr_type2").toUpperCase();
  const rawDate = firstValue(task, slot === "primary" ? "cstr_date" : "cstr_date2");
  if (!code && !rawDate) return { audit: undefined, constraint: undefined };
  const date = parseXerDate(rawDate);
  const label = slot === "primary" ? "الأساسي" : "الثانوي";
  const audit = (status: ActivityConstraintAudit["status"], note: string): ActivityConstraintAudit => ({ slot, code: code || "(فارغ)", date: date || undefined, rawDate: rawDate || undefined, status, note });
  if (code === "CS_ASAP" && slot === "primary") return { audit: audit("not-applicable", "ASAP لا يضيف قيداً زمنياً صريحاً إلى الحساب المحلي."), constraint: undefined };
  if (slot === "primary" && (code === "CS_SNET" || code === "CS_FNET") && date) {
    return {
      audit: audit("supported", code === "CS_SNET" ? "قيد Start On or After محصور في التمرير الأمامي المحلي." : "قيد Finish On or After محصور في التمرير الأمامي المحلي."),
      constraint: { type: code === "CS_SNET" ? "start-on-or-after" as const : "finish-on-or-after" as const, date, sourceCode: code as "CS_SNET" | "CS_FNET" },
    };
  }
  const dateProblem = (code === "CS_SNET" || code === "CS_FNET") && !date ? " لكن تاريخه غير قابل للقراءة." : "";
  return { audit: audit("review-required", `قيد ${label} برمز ${code || "غير مقروء"} لا يحسبه محرك CPM المحلي${dateProblem}`), constraint: undefined };
}

function buildWbsNodes(rows: XerRow[]) {
  const rawNodes = rows.map((row, index) => ({
    id: firstValue(row, "wbs_id") || `WBS-${index + 1}`,
    code: firstValue(row, "wbs_short_name", "wbs_code"),
    name: firstValue(row, "wbs_name", "wbs_short_name") || `WBS ${index + 1}`,
    parentId: firstValue(row, "parent_wbs_id") || undefined,
  }));
  const byId = new Map(rawNodes.map((node) => [node.id, node]));
  const resolvePath = (node: typeof rawNodes[number], visited = new Set<string>()): string => {
    if (visited.has(node.id)) return node.code || node.name;
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    const label = node.code ? `${node.code} — ${node.name}` : node.name;
    return parent ? `${resolvePath(parent, new Set(Array.from(visited).concat(node.id)))} / ${label}` : label;
  };
  return rawNodes.map((node): WbsNode => ({ ...node, path: resolvePath(node) }));
}

/**
 * يقرأ بيانات الجدولة الأساسية وإسنادات TASKRSRC المتاحة في تصدير XER.
 * لا يفك نمط تقويم P6 المشفر تلقائياً؛ يتطلب ذلك مراجعة المستخدم داخل التطبيق.
 */
export function importXerSchedule(raw: string, fileName = "Primavera Schedule.xer"): XerImportResult {
  return importDecodedXerSchedule(encodeUtf8XerText(raw), fileName);
}

/** يستقبل البايتات الأصلية من File.arrayBuffer؛ لا يمر عبر File.text(). */
export function importXerBytes(raw: ArrayBuffer | Uint8Array, fileName = "Primavera Schedule.xer"): XerImportResult {
  return importDecodedXerSchedule(decodeXerBytes(raw), fileName);
}

function importDecodedXerSchedule(source: DecodedXerBytes, fileName: string): XerImportResult {
  const raw = source.rawText;
  const tables = parseXerTableRows(raw);
  const tasks = tables.get("TASK") ?? [];
  const predecessors = tables.get("TASKPRED") ?? [];
  const projects = tables.get("PROJECT") ?? [];
  const calendars = tables.get("CALENDAR") ?? [];
  const resourceRows = tables.get("RSRC") ?? [];
  const taskResources = tables.get("TASKRSRC") ?? [];
  if (!tasks.length) throw new Error("لم يعثر المستورد على جدول TASK داخل ملف XER.");

  const warnings: string[] = [];
  const wbsRows = tables.get("PROJWBS") ?? tables.get("WBS") ?? [];
  const wbsNodes = buildWbsNodes(wbsRows);
  const wbsNames = new Map(wbsNodes.map((node) => [node.id, node.path]));
  const earliestDates: string[] = [];
  const activities: Activity[] = tasks.map((task, index) => {
    const id = firstValue(task, "task_id") || `TASK-${index + 1}`;
    const code = firstValue(task, "task_code") || id;
    const title = firstValue(task, "task_name") || code;
    const start = parseXerDate(firstValue(task, "early_start_date", "target_start_date", "plan_start_date", "act_start_date"));
    if (start) earliestDates.push(start);
    const durationHours = numeric(firstValue(task, "target_drtn_hr_cnt", "orig_duration", "remain_drtn_hr_cnt"));
    const remainingDuration = numeric(firstValue(task, "remain_drtn_hr_cnt"));
    const progress = percent(firstValue(task, "phys_complete_pct", "complete_pct", "duration_pct", "percent_complete"));
    const percentTypeRaw = firstValue(task, "complete_pct_type", "percent_complete_type").toLowerCase();
    const primaryConstraint = importedConstraint(task, "primary");
    const secondaryConstraint = importedConstraint(task, "secondary");
    const constraintAudit = [primaryConstraint.audit, secondaryConstraint.audit].filter((item): item is ActivityConstraintAudit => Boolean(item));
    return {
      id,
      name: code === title ? title : `${code} — ${title}`,
      duration: Math.max(0, durationHours / 8),
      wbs: wbsNames.get(firstValue(task, "wbs_id")) || firstValue(task, "wbs_id") || undefined,
      wbsId: firstValue(task, "wbs_id") || undefined,
      owner: firstValue(task, "responsible_mgr_id") || undefined,
      percentComplete: progress,
      percentCompleteType: percentTypeRaw.includes("phys") ? "physical" : percentTypeRaw.includes("unit") ? "units" : progress === undefined ? undefined : "duration",
      remainingDuration: remainingDuration ? Math.max(0, remainingDuration / 8) : undefined,
      actualStart: parseXerDate(firstValue(task, "act_start_date")) || undefined,
      actualFinish: parseXerDate(firstValue(task, "act_end_date", "act_finish_date")) || undefined,
      calendarId: firstValue(task, "clndr_id") || undefined,
      constraint: primaryConstraint.constraint,
      constraintAudit: constraintAudit.length ? constraintAudit : undefined,
    };
  });

  const taskCalendarIds = Array.from(new Set(activities.map((activity) => activity.calendarId).filter((value): value is string => Boolean(value)))).sort();
  const activitiesWithoutCalendarId = activities.filter((activity) => !activity.calendarId).length;
  const constraintAudits = activities.flatMap((activity) => activity.constraintAudit ?? []);
  const supportedConstraintsRead = activities.filter((activity) => Boolean(activity.constraint)).length;
  const unsupportedConstraintsRead = constraintAudits.filter((item) => item.status === "review-required").length;

  const activityIds = new Set(activities.map((activity) => activity.id));
  const activityById = new Map(activities.map((activity) => [activity.id, activity]));
  const resourcesById = new Map(resourceRows.map((resource) => [firstValue(resource, "rsrc_id"), resource]));
  const resourceAssignments: ResourceAssignment[] = [];
  let resourceAssignmentsSkipped = 0;
  for (let index = 0; index < taskResources.length; index += 1) {
    const row = taskResources[index];
    const activityId = firstValue(row, "task_id");
    if (!activityIds.has(activityId)) {
      resourceAssignmentsSkipped += 1;
      warnings.push(`تم تجاهل إسناد مورد TASKRSRC رقم ${index + 1} لأنه لا يشير إلى نشاط مقروء.`);
      continue;
    }
    const resourceId = firstValue(row, "rsrc_id");
    const resource = resourcesById.get(resourceId);
    const activity = activityById.get(activityId);
    resourceAssignments.push({
      id: firstValue(row, "taskrsrc_id", "guid") || `XER-RSRC-${index + 1}`,
      activityId,
      resourceId: resourceId || undefined,
      resourceName: firstValue(resource, "rsrc_name", "rsrc_short_name") || undefined,
      resourceType: resourceType(firstValue(row, "rsrc_type") || firstValue(resource, "rsrc_type")),
      costAccountId: firstValue(row, "acct_id") || undefined,
      wbsId: firstValue(row, "wbs_id", "taskrsrc.task|wbs_id") || activity?.wbsId,
      targetQuantity: numeric(firstValue(row, "target_qty")),
      remainingQuantity: numeric(firstValue(row, "remain_qty")),
      actualRegularQuantity: numeric(firstValue(row, "act_reg_qty")),
      actualOvertimeQuantity: numeric(firstValue(row, "act_ot_qty")),
      targetCost: numeric(firstValue(row, "target_cost")),
      remainingCost: numeric(firstValue(row, "remain_cost")),
      actualRegularCost: numeric(firstValue(row, "act_reg_cost")),
      actualOvertimeCost: numeric(firstValue(row, "act_ot_cost")),
      costPerUnit: numeric(firstValue(row, "cost_per_qty")),
      targetQuantityPerHour: numeric(firstValue(row, "target_qty_per_hr")),
      remainingQuantityPerHour: numeric(firstValue(row, "remain_qty_per_hr")),
      activityRemainingDuration: activity?.remainingDuration ?? activity?.duration,
      source: "xer",
    });
  }
  const relationships: Relationship[] = [];
  let relationshipsSkipped = 0;
  for (let index = 0; index < predecessors.length; index += 1) {
    const row = predecessors[index];
    const predecessorId = firstValue(row, "pred_task_id");
    const successorId = firstValue(row, "task_id");
    if (!activityIds.has(predecessorId) || !activityIds.has(successorId)) {
      relationshipsSkipped += 1;
      warnings.push(`تم تجاهل علاقة XER رقم ${index + 1} لأنها تشير إلى نشاط خارج المشروع أو غير مقروء.`);
      continue;
    }
    relationships.push({
      id: firstValue(row, "task_pred_id") || `XER-REL-${index + 1}`,
      predecessorId,
      successorId,
      type: relationshipType(firstValue(row, "pred_type")),
      lag: numeric(firstValue(row, "lag_hr_cnt")) / 8,
    });
  }

  const project = projects[0];
  const projectId = firstValue(project, "proj_id") || undefined;
  const projectCalendarId = firstValue(project, "clndr_id") || undefined;
  const calendarIds = Array.from(new Set(calendars.map((row) => firstValue(row, "clndr_id")).filter(Boolean))).sort();
  const projectName = firstValue(project, "proj_short_name", "proj_name") || fileName.replace(/\.xer$/i, "") || "برنامج Primavera مستورد";
  const startDate = parseXerDate(firstValue(project, "plan_start_date", "proj_start_date")) || [...earliestDates].sort()[0];
  if (!startDate) throw new Error("ملف XER لا يحتوي تاريخ بدء يمكن قراءته؛ صدّر حقول المشروع أو تواريخ الأنشطة ثم أعد المحاولة.");
  const dataDate = parseXerDate(firstValue(project, "last_recalc_date", "data_date"));
  const calendar = calendars[0];
  const calendarName = firstValue(calendar, "clndr_name", "calendar_name");
  if (calendars.length) warnings.push("تم التعرف على سجل التقويم في XER، لكن نمط العمل المشفر في P6 لا يُفك تلقائياً؛ راجع التقويم واختر أيام العمل والعطل من التطبيق.");
  else warnings.push("لم يعثر المستورد على سجل CALENDAR؛ طُبق تقويم الأيام التقويمية حتى يراجعه المستخدم.");
  warnings.push("حُولت مدد P6 من ساعات إلى أيام عمل على أساس 8 ساعات/يوم؛ راجع الإعداد إذا كان المشروع يستخدم يوماً مختلفاً.");
  if (taskCalendarIds.length > 1) warnings.push(`يحتوي TASK على ${taskCalendarIds.length} معرفات تقويم مختلفة؛ الحساب الحالي يستخدم تقويم مراجعة واحداً ولا يفك تقاويم P6 لكل نشاط.`);
  else if (taskCalendarIds.length === 1) warnings.push(`احتُفظ بمعرف تقويم الأنشطة ${taskCalendarIds[0]}، لكن نمط P6 المشفر لا يُفك محلياً.`);
  else warnings.push("لم تُقرأ معرفات تقويم الأنشطة TASK.clndr_id؛ راجع تعيين التقويم داخل P6.");
  if (activitiesWithoutCalendarId) warnings.push(`يوجد ${activitiesWithoutCalendarId} نشاطاً بلا معرف تقويم مقروء.`);
  if (supportedConstraintsRead) warnings.push(`احتُفظ وطُبق محلياً ${supportedConstraintsRead} قيد/قيود SNET/FNET فقط؛ يلزم التحقق داخل P6.`);
  if (unsupportedConstraintsRead) warnings.push(`يوجد ${unsupportedConstraintsRead} قيد/قيود XER لا يحسبها المحرك المحلي وتحتاج مراجعة مانعة قبل اعتماد التحليل.`);
  if (!taskResources.length) warnings.push("لم يعثر المستورد على جدول TASKRSRC؛ ستبقى شاشة الأثر المالي بلا إسنادات موارد حتى تُستورد نسخة P6 تتضمن الموارد.");

  return {
    schedule: {
      id: `xer-${Date.now()}`,
      name: projectName,
      startDate,
      dataDate: dataDate || undefined,
      activities,
      relationships,
      calendar: { ...calendarDayCalendar, id: "xer-review-calendar", name: calendarName ? `${calendarName} — راجع النمط` : "تقويم XER — يحتاج مراجعة" },
      source: "xer",
      importNotes: warnings,
      wbsNodes,
      resourceAssignments,
      xerSource: {
        rawText: raw,
        rawBytes: source.rawBytes,
        sourceEncoding: source.sourceEncoding,
        sourceByteOffset: source.sourceByteOffset,
        sourceByteLength: source.rawBytes.length,
        preByteExact: source.preByteExact,
        originalFileName: fileName,
        tableNames: Array.from(tables.keys()),
        projectId,
        projectCalendarId,
        calendarIds,
        taskCalendarIds,
        importedAt: new Date().toISOString(),
      },
    },
    summary: { projectName, activitiesRead: activities.length, relationshipsRead: relationships.length, relationshipsSkipped, wbsRead: wbsNodes.length, resourcesRead: resourceRows.length, resourceAssignmentsRead: resourceAssignments.length, resourceAssignmentsSkipped, assignmentsWithCosts: resourceAssignments.filter((assignment) => Boolean(assignment.targetCost || assignment.remainingCost || assignment.actualRegularCost || assignment.actualOvertimeCost)).length, activitiesWithProgress: activities.filter((activity) => activity.percentComplete !== undefined).length, taskCalendarIds, taskCalendarCount: taskCalendarIds.length, activitiesWithoutCalendarId, constraintsRead: constraintAudits.length, supportedConstraintsRead, unsupportedConstraintsRead, calendarName: calendarName || undefined, warnings, tablesFound: Array.from(tables.keys()) },
  };
}

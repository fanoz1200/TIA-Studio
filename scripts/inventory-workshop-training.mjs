import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const projectRoot = path.resolve(import.meta.dirname, "..");
const docsDir = path.join(projectRoot, "docs");
const sourcePaths = {
  baselineXer: "/home/ubuntu/upload/Workshop-NO8TimeImpactAnalysisBaseline.xer",
  postTiaXer: "/home/ubuntu/upload/Workshop-NO8TimeImpactAnalysisPostTIA.xer",
  workbook: "/home/ubuntu/upload/Workshop-NO8TimeImpactAnalysis.xlsx",
};

for (const [label, sourcePath] of Object.entries(sourcePaths)) {
  if (!fs.existsSync(sourcePath)) throw new Error(`لم يُعثر على ملف التدريب ${label}: ${sourcePath}`);
}

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const fileInfo = (sourcePath) => ({
  filename: path.basename(sourcePath),
  bytes: fs.statSync(sourcePath).size,
  sha256: crypto.createHash("sha256").update(fs.readFileSync(sourcePath)).digest("hex"),
});

function parseXer(sourcePath) {
  const tables = new Map();
  let currentTable = null;
  let fields = [];

  for (const rawLine of fs.readFileSync(sourcePath, "utf8").split(/\r?\n/)) {
    if (!rawLine) continue;
    const [marker, ...values] = rawLine.split("\t");
    if (marker === "%T") {
      currentTable = values[0] ?? null;
      if (currentTable) tables.set(currentTable, []);
      fields = [];
    } else if (marker === "%F" && currentTable) {
      fields = values;
    } else if (marker === "%R" && currentTable && fields.length) {
      tables.get(currentTable).push(Object.fromEntries(fields.map((field, index) => [field, values[index] ?? ""])));
    }
  }

  const tasks = tables.get("TASK") ?? [];
  const relationships = tables.get("TASKPRED") ?? [];
  const calendars = tables.get("CALENDAR") ?? [];
  const projects = tables.get("PROJECT") ?? [];
  const wbs = tables.get("PROJWBS") ?? [];
  const taskById = new Map(tasks.map((task) => [task.task_id, task]));
  const activities = tasks.map((task) => ({
    id: task.task_id,
    code: task.task_code,
    name: task.task_name,
    wbsId: task.wbs_id,
    calendarId: task.clndr_id,
    type: task.task_type,
    status: task.status_code,
    durationHours: task.target_drtn_hr_cnt,
    remainingDurationHours: task.remain_drtn_hr_cnt,
    totalFloatHours: task.total_float_hr_cnt,
    earlyStart: task.early_start_date,
    earlyEnd: task.early_end_date,
    lateStart: task.late_start_date,
    lateEnd: task.late_end_date,
    constraintType: task.cstr_type,
    constraintDate: task.cstr_date,
  }));
  const activityByCode = new Map(activities.map((activity) => [activity.code, activity]));

  return {
    source: fileInfo(sourcePath),
    tables: Object.fromEntries([...tables.entries()].map(([name, rows]) => [name, rows.length])),
    project: projects[0]
      ? {
          id: projects[0].proj_id,
          code: projects[0].proj_short_name,
          plannedStart: projects[0].plan_start_date,
          plannedEnd: projects[0].plan_end_date,
          scheduledEnd: projects[0].scd_end_date,
          defaultCalendarId: projects[0].clndr_id,
          criticalPathType: projects[0].critical_path_type,
        }
      : null,
    activityCount: tasks.length,
    relationshipCount: relationships.length,
    calendarCount: calendars.length,
    wbsCount: wbs.length,
    activities,
    relationships: relationships.map((relationship) => ({
      id: relationship.task_pred_id,
      successorId: relationship.task_id,
      successorCode: taskById.get(relationship.task_id)?.task_code ?? "",
      predecessorId: relationship.pred_task_id,
      predecessorCode: taskById.get(relationship.pred_task_id)?.task_code ?? "",
      type: relationship.pred_type,
      lagHours: relationship.lag_hr_cnt,
    })),
    calendars: calendars.map((calendar) => ({
      id: calendar.clndr_id,
      name: calendar.clndr_name,
      type: calendar.clndr_type,
      dayHours: calendar.day_hr_cnt,
      weekHours: calendar.week_hr_cnt,
      monthHours: calendar.month_hr_cnt,
      yearHours: calendar.year_hr_cnt,
    })),
    activityByCode,
  };
}

function compareSchedules(baseline, postTia) {
  const baselineKeys = new Set(baseline.activities.map((activity) => activity.code));
  const postTiaKeys = new Set(postTia.activities.map((activity) => activity.code));
  const fields = ["name", "calendarId", "type", "status", "durationHours", "remainingDurationHours", "totalFloatHours", "earlyStart", "earlyEnd", "lateStart", "lateEnd", "constraintType", "constraintDate"];
  const addedActivities = postTia.activities.filter((activity) => !baselineKeys.has(activity.code));
  const removedActivities = baseline.activities.filter((activity) => !postTiaKeys.has(activity.code));
  const changedActivities = postTia.activities.flatMap((activity) => {
    const before = baseline.activityByCode.get(activity.code);
    if (!before) return [];
    const changes = fields.flatMap((field) => (String(before[field] ?? "") === String(activity[field] ?? "") ? [] : [{ field, before: before[field], after: activity[field] }]));
    return changes.length ? [{ code: activity.code, name: activity.name, changes }] : [];
  });

  const relationshipKey = (relationship) => `${relationship.predecessorCode}|${relationship.successorCode}|${relationship.type}|${relationship.lagHours}`;
  const baselineRelationships = new Set(baseline.relationships.map(relationshipKey));
  const postRelationships = new Set(postTia.relationships.map(relationshipKey));

  return {
    activity: { added: addedActivities, removed: removedActivities, changed: changedActivities },
    relationship: {
      added: postTia.relationships.filter((relationship) => !baselineRelationships.has(relationshipKey(relationship))),
      removed: baseline.relationships.filter((relationship) => !postRelationships.has(relationshipKey(relationship))),
    },
  };
}

function summarizeWorkbook(sourcePath) {
  const workbook = XLSX.readFile(sourcePath, { cellDates: false, cellFormula: true, cellHTML: false });
  const sheets = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
    const populated = rows.filter((row) => row.some((cell) => clean(cell)));
    return {
      name,
      populatedRows: populated.length,
      headers: (populated[0] ?? []).map(clean).filter(Boolean),
      formulaCount: Object.values(sheet).filter((cell) => cell && typeof cell === "object" && "f" in cell).length,
      preview: populated.slice(0, 5).map((row) => row.map(clean).filter(Boolean)),
    };
  });
  return { source: fileInfo(sourcePath), sheetCount: sheets.length, sheets };
}

function cellText(sheet, address) {
  const cell = sheet?.[address];
  return clean(cell?.w ?? cell?.v);
}

/**
 * Deliberately constrained training facts. This is not a raw workbook export:
 * only the baseline settings, the three stated delay events, and the workbook's
 * declared cumulative result are retained for a human-readable training report.
 */
function summarizeWorkshopFacts(sourcePath) {
  const workbook = XLSX.readFile(sourcePath, { cellDates: false, cellFormula: true, cellHTML: false });
  const workshop = workbook.Sheets["Workshop TIA"];
  const analysis = workbook.Sheets["TIA Delay Analysis Table"];

  return {
    baseline: {
      startDate: cellText(analysis, "I6"),
      finishDate: cellText(analysis, "I7"),
      durationDays: cellText(analysis, "I8"),
      calendar: cellText(workshop, "F7"),
    },
    delayEvents: [
      { reference: cellText(workshop, "C19"), description: cellText(workshop, "D19"), start: cellText(workshop, "E19"), finish: cellText(workshop, "F19"), durationDays: cellText(workshop, "G19"), affectedActivity: cellText(workshop, "H19"), classification: cellText(analysis, "G19") },
      { reference: cellText(workshop, "C20"), description: cellText(workshop, "D20"), start: cellText(workshop, "E20"), finish: cellText(workshop, "F20"), durationDays: cellText(workshop, "G20"), affectedActivity: cellText(workshop, "H20"), classification: cellText(analysis, "G22") },
      { reference: cellText(workshop, "C21"), description: cellText(workshop, "D21"), start: cellText(workshop, "E21"), finish: cellText(workshop, "F21"), durationDays: cellText(workshop, "G21"), affectedActivity: cellText(workshop, "H21"), classification: cellText(analysis, "G25") },
    ],
    declaredOutcome: {
      asPlannedCompletion: cellText(analysis, "L31"),
      workshopCompletion: cellText(analysis, "L32"),
      cumulativeImpactDays: cellText(analysis, "M29"),
      varianceDays: cellText(analysis, "L33"),
      employerDelayDays: cellText(analysis, "Q29"),
      neutralDelayDays: cellText(analysis, "R29"),
      concurrentDelayDays: cellText(analysis, "S29"),
    },
  };
}

const baseline = parseXer(sourcePaths.baselineXer);
const postTia = parseXer(sourcePaths.postTiaXer);
const workbook = summarizeWorkbook(sourcePaths.workbook);
const workbookFacts = summarizeWorkshopFacts(sourcePaths.workbook);
const comparison = compareSchedules(baseline, postTia);

const inventory = {
  generatedAt: new Date().toISOString(),
  readOnly: true,
  baseline: { ...baseline, activityByCode: undefined },
  postTia: { ...postTia, activityByCode: undefined },
  workbook,
  workbookFacts,
  comparison,
};

fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(path.join(docsDir, "workshop-no8-training-inventory.json"), `${JSON.stringify(inventory, null, 2)}\n`);

const tableRows = (tables) => Object.entries(tables).map(([table, rows]) => `| ${table} | ${rows} |`).join("\n");
const activityRows = (activities) => activities.map((activity) => `| \`${activity.code}\` | ${activity.name} | ${activity.durationHours || "0"} | ${activity.earlyStart || "—"} | ${activity.earlyEnd || "—"} |`).join("\n") || "| — | لا يوجد | — | — | — |";
const markdown = `# جرد تدريب Workshop NO8 — قراءة فقط

> **حد الاستخدام:** يصف هذا التقرير الملفات التدريبية المرفوعة محلياً كما هي. لا يعدّلها، ولا يرسلها إلى خدمة خارجية، ولا يثبت بمفرده أن TIA Studio أو ملف XER المُصدَّر مطابق تماماً لـ Primavera P6.

## مصدر التدريب وبصمته

| المصدر | الاسم | الحجم بالبايت | SHA-256 |
|---|---|---:|---|
| Baseline XER | \`${baseline.source.filename}\` | ${baseline.source.bytes} | \`${baseline.source.sha256}\` |
| Post‑TIA XER | \`${postTia.source.filename}\` | ${postTia.source.bytes} | \`${postTia.source.sha256}\` |
| Workshop Excel | \`${workbook.source.filename}\` | ${workbook.source.bytes} | \`${workbook.source.sha256}\` |

## ملخص برنامجَي XER

| المقياس | Baseline | Post‑TIA |
|---|---:|---:|
| رمز/اسم المشروع | ${baseline.project?.code ?? "—"} | ${postTia.project?.code ?? "—"} |
| تاريخ البداية المخطط | ${baseline.project?.plannedStart ?? "—"} | ${postTia.project?.plannedStart ?? "—"} |
| تاريخ النهاية المخطط | ${baseline.project?.plannedEnd ?? "—"} | ${postTia.project?.plannedEnd ?? "—"} |
| تاريخ النهاية المجدول | ${baseline.project?.scheduledEnd ?? "—"} | ${postTia.project?.scheduledEnd ?? "—"} |
| الأنشطة | ${baseline.activityCount} | ${postTia.activityCount} |
| العلاقات | ${baseline.relationshipCount} | ${postTia.relationshipCount} |
| التقاويم | ${baseline.calendarCount} | ${postTia.calendarCount} |
| WBS | ${baseline.wbsCount} | ${postTia.wbsCount} |
| وضع المسار الحرج | ${baseline.project?.criticalPathType ?? "—"} | ${postTia.project?.criticalPathType ?? "—"} |

### جداول Baseline

${tableRows(baseline.tables)}

### جداول Post‑TIA

${tableRows(postTia.tables)}

## الفروق التي اكتشفها الجرد

| نوع الفرق | العدد |
|---|---:|
| أنشطة أضيفت بعد TIA | ${comparison.activity.added.length} |
| أنشطة أزيلت بعد TIA | ${comparison.activity.removed.length} |
| أنشطة مشتركة تغيرت حقولها | ${comparison.activity.changed.length} |
| علاقات أضيفت | ${comparison.relationship.added.length} |
| علاقات أزيلت | ${comparison.relationship.removed.length} |

### الأنشطة المضافة بعد TIA

| النشاط | الاسم | المدة بالساعات | Early Start | Early Finish |
|---|---|---:|---|---|
${activityRows(comparison.activity.added)}

### تغييرات الأنشطة المشتركة

${comparison.activity.changed.map((item) => `- \`${item.code}\` — ${item.name}: ${item.changes.map((change) => `\`${change.field}\` (${change.before || "فارغ"} ← ${change.after || "فارغ"})`).join("؛ ")}`).join("\n") || "- لا توجد فروق في الحقول المقروءة بين الأنشطة المشتركة."}

### علاقات مضافة بعد TIA

${comparison.relationship.added.map((relationship) => `- \`${relationship.predecessorCode || relationship.predecessorId}\` → \`${relationship.successorCode || relationship.successorId}\` (${relationship.type}; lag=${relationship.lagHours} h)`).join("\n") || "- لا توجد علاقات مضافة."}

## ملف Excel

| الورقة | صفوف ذات محتوى | صيغ | رؤوس أول صف |
|---|---:|---:|---|
${workbook.sheets.map((sheet) => `| ${sheet.name} | ${sheet.populatedRows} | ${sheet.formulaCount} | ${sheet.headers.join("، ") || "—"} |`).join("\n")}

### خلاصة تدريبية مستخرجة من Excel (وليست حساب P6)

| العنصر | القيمة المصرح بها داخل النموذج |
|---|---|
| بداية Baseline | ${workbookFacts.baseline.startDate || "—"} |
| نهاية Baseline | ${workbookFacts.baseline.finishDate || "—"} |
| مدة Baseline | ${workbookFacts.baseline.durationDays || "—"} يوم |
| التقويم الوصفي | ${workbookFacts.baseline.calendar || "—"} |
| نهاية النموذج بعد الأحداث | ${workbookFacts.declaredOutcome.workshopCompletion || "—"} |
| الأثر التراكمي في النموذج | ${workbookFacts.declaredOutcome.cumulativeImpactDays || "—"} يوم |
| فرق النموذج | ${workbookFacts.declaredOutcome.varianceDays || "—"} يوم |
| ECD في النموذج | ${workbookFacts.declaredOutcome.employerDelayDays || "—"} يوم |
| END في النموذج | ${workbookFacts.declaredOutcome.neutralDelayDays || "—"} يوم |
| تزامن مسجل في النموذج | ${workbookFacts.declaredOutcome.concurrentDelayDays || "—"} يوم |

| الحدث | التصنيف في نموذج التحليل | الفترة | المدة | النشاط المتأثر |
|---|---|---|---:|---|
${workbookFacts.delayEvents.map((event) => `| ${event.description || event.reference || "—"} | ${event.classification || "—"} | ${event.start || "—"} → ${event.finish || "—"} | ${event.durationDays || "—"} | ${event.affectedActivity || "—"} |`).join("\n")}

> **مهم:** يصرّح النموذج نفسه بأن Excel قد يحسب التواريخ على نحو مختلف إذا استُخدمت تقاويم P6 معينة. لذلك تُستخدم هذه القيم لتحديد سيناريو التدريب فقط، ولا تحل محل إعادة الجدولة داخل P6.

## القرار التالي

يستخدم هذا الجرد كمرجع اختبار للقراءة والفروق والبصمات. ستُقارن حسابات محرك CPM/TIA المحلي بالـBaseline وPost‑TIA بوصفها **حالة تدريب**، ثم تُرفع النتائج داخل TIA Studio مع عبارة «مرجع تدريب محلي». لا يُخزَّن ملفا XER الأصليان أو ملف Excel داخل قاعدة بيانات المنصة أو حزمة التوزيع؛ يبقيهما المستخدم كمصادر، ويستوردها صراحةً عند التدريب أو التحقق.
`;

fs.writeFileSync(path.join(docsDir, "WORKSHOP_NO8_TRAINING_INVENTORY_AR.md"), `${markdown}\n`);
console.log(`تم جرد Workshop NO8: Baseline ${baseline.activityCount} نشاطاً/${baseline.relationshipCount} علاقة، Post‑TIA ${postTia.activityCount} نشاطاً/${postTia.relationshipCount} علاقة، و${workbook.sheetCount} أوراق Excel.`);

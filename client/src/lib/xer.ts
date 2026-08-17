/**
 * TIA Studio — XER schedule adapter
 * يحول جداول Primavera P6 النصية الضرورية لتحليل CPM محلياً دون رفع الملف.
 */
import { calendarDayCalendar, type Activity, type Relationship, type RelationshipType, type Schedule } from "./cpm";

type XerRow = Record<string, string>;

export type XerImportSummary = {
  projectName: string;
  activitiesRead: number;
  relationshipsRead: number;
  calendarName?: string;
  warnings: string[];
  tablesFound: string[];
};

export type XerImportResult = { schedule: Schedule; summary: XerImportSummary };

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function parseTables(raw: string) {
  const tables = new Map<string, XerRow[]>();
  let currentTable = "";
  let headers: string[] = [];
  for (const line of raw.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const cells = line.split("\t");
    const marker = cells[0]?.trim();
    if (marker === "%T") {
      currentTable = (cells[1] ?? "").trim().toUpperCase();
      if (currentTable && !tables.has(currentTable)) tables.set(currentTable, []);
      headers = [];
    } else if (marker === "%F") {
      headers = cells.slice(1).map(normalizeKey);
    } else if (marker === "%R" && currentTable && headers.length) {
      const row: XerRow = {};
      headers.forEach((header, index) => { row[header] = (cells[index + 1] ?? "").trim(); });
      tables.get(currentTable)?.push(row);
    } else if (marker === "%E") {
      currentTable = "";
      headers = [];
    }
  }
  return tables;
}

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

/**
 * يقرأ نطاقاً مقصوداً ومحدوداً من XER: PROJECT, TASK, TASKPRED وCALENDAR.
 * لا يحاول استيراد التكاليف أو الموارد أو بيانات التقويم المشفرة في P6.
 */
export function importXerSchedule(raw: string, fileName = "Primavera Schedule.xer"): XerImportResult {
  const tables = parseTables(raw);
  const tasks = tables.get("TASK") ?? [];
  const predecessors = tables.get("TASKPRED") ?? [];
  const projects = tables.get("PROJECT") ?? [];
  const calendars = tables.get("CALENDAR") ?? [];
  if (!tasks.length) throw new Error("لم يعثر المستورد على جدول TASK داخل ملف XER.");

  const warnings: string[] = [];
  const wbsRows = tables.get("PROJWBS") ?? tables.get("WBS") ?? [];
  const wbsNames = new Map(wbsRows.map((row) => [firstValue(row, "wbs_id"), firstValue(row, "wbs_short_name", "wbs_name")]));
  const earliestDates: string[] = [];
  const activities: Activity[] = tasks.map((task, index) => {
    const id = firstValue(task, "task_id") || `TASK-${index + 1}`;
    const code = firstValue(task, "task_code") || id;
    const title = firstValue(task, "task_name") || code;
    const start = parseXerDate(firstValue(task, "early_start_date", "target_start_date", "plan_start_date", "act_start_date"));
    if (start) earliestDates.push(start);
    const durationHours = numeric(firstValue(task, "target_drtn_hr_cnt", "remain_drtn_hr_cnt", "orig_duration"));
    return {
      id,
      name: code === title ? title : `${code} — ${title}`,
      duration: Math.max(0, durationHours / 8),
      wbs: wbsNames.get(firstValue(task, "wbs_id")) || firstValue(task, "wbs_id") || undefined,
      owner: firstValue(task, "responsible_mgr_id") || undefined,
    };
  });

  const activityIds = new Set(activities.map((activity) => activity.id));
  const relationships: Relationship[] = [];
  for (let index = 0; index < predecessors.length; index += 1) {
    const row = predecessors[index];
    const predecessorId = firstValue(row, "pred_task_id");
    const successorId = firstValue(row, "task_id");
    if (!activityIds.has(predecessorId) || !activityIds.has(successorId)) {
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
  const projectName = firstValue(project, "proj_short_name", "proj_name") || fileName.replace(/\.xer$/i, "") || "برنامج Primavera مستورد";
  const startDate = parseXerDate(firstValue(project, "plan_start_date", "proj_start_date")) || [...earliestDates].sort()[0];
  if (!startDate) throw new Error("ملف XER لا يحتوي تاريخ بدء يمكن قراءته؛ صدّر حقول المشروع أو تواريخ الأنشطة ثم أعد المحاولة.");
  const dataDate = parseXerDate(firstValue(project, "last_recalc_date", "data_date"));
  const calendar = calendars[0];
  const calendarName = firstValue(calendar, "clndr_name", "calendar_name");
  if (calendars.length) warnings.push("تم التعرف على سجل التقويم في XER، لكن نمط العمل المشفر في P6 لا يُفك تلقائياً؛ راجع التقويم واختر أيام العمل والعطل من التطبيق.");
  else warnings.push("لم يعثر المستورد على سجل CALENDAR؛ طُبق تقويم الأيام التقويمية حتى يراجعه المستخدم.");
  warnings.push("حُولت مدد P6 من ساعات إلى أيام عمل على أساس 8 ساعات/يوم؛ راجع الإعداد إذا كان المشروع يستخدم يوماً مختلفاً.");

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
    },
    summary: { projectName, activitiesRead: activities.length, relationshipsRead: relationships.length, calendarName: calendarName || undefined, warnings, tablesFound: Array.from(tables.keys()) },
  };
}

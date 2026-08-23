import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { importXerSchedule } from "../client/src/lib/xer.ts";
import { runCPM } from "../client/src/lib/cpm.ts";

const uploadsDir = "/home/ubuntu/upload";
const files = {
  baseline: resolve(uploadsDir, "Workshop-NO8TimeImpactAnalysisBaseline.xer"),
  postTia: resolve(uploadsDir, "Workshop-NO8TimeImpactAnalysisPostTIA.xer"),
};

function iso(value) {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function countBy(values, getKey) {
  return values.reduce((result, value) => {
    const key = getKey(value);
    result[key] = (result[key] ?? 0) + 1;
    return result;
  }, {});
}

async function inspect(label, filePath) {
  const source = await readFile(filePath, "utf8");
  const imported = importXerSchedule(source, filePath.split("/").pop() ?? `${label}.xer`);
  const cpm = runCPM(imported.schedule);
  return {
    label,
    import: {
      projectName: imported.summary.projectName,
      activitiesRead: imported.summary.activitiesRead,
      relationshipsRead: imported.summary.relationshipsRead,
      relationshipsSkipped: imported.summary.relationshipsSkipped ?? 0,
      wbsRead: imported.summary.wbsRead,
      resourcesRead: imported.summary.resourcesRead,
      resourceAssignmentsRead: imported.summary.resourceAssignmentsRead,
      resourceAssignmentsSkipped: imported.summary.resourceAssignmentsSkipped ?? 0,
      activitiesWithProgress: imported.summary.activitiesWithProgress,
      calendarName: imported.summary.calendarName ?? null,
      warnings: imported.summary.warnings,
      relationshipTypes: countBy(imported.schedule.relationships, (relationship) => relationship.type),
    },
    cpm: {
      startDate: iso(imported.schedule.startDate),
      dataDate: iso(imported.schedule.dataDate),
      projectDurationWorkingDays: cpm.projectDuration,
      completionDate: iso(cpm.completionDate),
      criticalActivityIds: cpm.criticalActivityIds,
      warnings: cpm.warnings,
    },
  };
}

const baseline = await inspect("Baseline", files.baseline);
const postTia = await inspect("Post-TIA", files.postTia);
const comparison = {
  baseline,
  postTia,
  delta: {
    activities: postTia.import.activitiesRead - baseline.import.activitiesRead,
    relationships: postTia.import.relationshipsRead - baseline.import.relationshipsRead,
    projectDurationWorkingDays: postTia.cpm.projectDurationWorkingDays - baseline.cpm.projectDurationWorkingDays,
    criticalActivitiesAdded: postTia.cpm.criticalActivityIds.filter((id) => !baseline.cpm.criticalActivityIds.includes(id)),
    criticalActivitiesRemoved: baseline.cpm.criticalActivityIds.filter((id) => !postTia.cpm.criticalActivityIds.includes(id)),
  },
  interpretation: [
    "هذه مقارنة محلية بين قارئ XER ومحرك CPM في TIA Studio، وليست دليلاً على تطابق Primavera P6.",
    "يطبق المستورد تقويماً للمراجعة ويحول ساعات P6 إلى أيام على أساس 8 ساعات/يوم؛ يجب مقارنة التقويم وإعدادات P6 قبل الاعتماد.",
    "لا يكتب هذا التحقق على ملفَي XER ولا يرسلهما لأي خدمة خارجية.",
  ],
};

const jsonPath = resolve("docs", "WORKSHOP_NO8_ENGINE_COMPARISON.json");
const markdownPath = resolve("docs", "WORKSHOP_NO8_ENGINE_COMPARISON_AR.md");
await writeFile(jsonPath, `${JSON.stringify(comparison, null, 2)}\n`);

const overview = [baseline, postTia].map((entry) => `| ${entry.label} | ${entry.import.activitiesRead} | ${entry.import.relationshipsRead} | ${entry.import.wbsRead} | ${entry.cpm.projectDurationWorkingDays} | ${entry.cpm.completionDate ?? "غير متاح"} |`).join("\n");
const details = [baseline, postTia].map((entry) => `### ${entry.label}\n\n- العلاقات حسب النوع: \`${JSON.stringify(entry.import.relationshipTypes)}\`\n- الأنشطة الحرجة من المحرك المحلي: \`${entry.cpm.criticalActivityIds.join(", ") || "لا يوجد"}\`\n- تحذيرات الاستيراد: ${entry.import.warnings.length ? entry.import.warnings.map((warning) => `\n  - ${warning}`).join("") : "لا يوجد"}\n- تحذيرات CPM: ${entry.cpm.warnings.length ? entry.cpm.warnings.map((warning) => `\n  - ${warning}`).join("") : "لا يوجد"}`).join("\n\n");
await writeFile(markdownPath, `# مقارنة محرك TIA Studio لعينة Workshop NO8\n\n**المصدر:** ملفا Baseline وPost‑TIA المرفوعان من المستخدم؛ قراءة محلية فقط.  \n**الحالة:** مرجع تحقق للمستورد ومحرك CPM، وليس اعتماداً لتوافق Primavera.\n\n| النسخة | الأنشطة المقروءة | العلاقات المقروءة | WBS | مدة CPM (يوم عمل) | نهاية CPM |\n|---|---:|---:|---:|---:|---|\n${overview}\n\n## الفرق المحسوب محلياً\n\n- فرق الأنشطة: **${comparison.delta.activities}**\n- فرق العلاقات: **${comparison.delta.relationships}**\n- فرق مدة CPM: **${comparison.delta.projectDurationWorkingDays} يوم عمل**\n- أنشطة حرجة مضافة: \`${comparison.delta.criticalActivitiesAdded.join(", ") || "لا يوجد"}\`\n- أنشطة حرجة محذوفة: \`${comparison.delta.criticalActivitiesRemoved.join(", ") || "لا يوجد"}\`\n\n${details}\n\n## حدود الاستعمال\n\n${comparison.interpretation.map((line) => `- ${line}`).join("\n")}\n\nلإثبات التوافق في حالة تدريبية، يستورد المستخدم Post‑TIA في P6 23.12 غير إنتاجي، يعيد حسابه، ثم يقارن العدادات والتقاويم وتاريخ النهاية والمسار الحرج مع هذا التقرير.\n`);

console.log(`Generated ${jsonPath} and ${markdownPath}`);
console.log(JSON.stringify(comparison, null, 2));

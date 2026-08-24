import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { buildIssueImportTemplateWorkbook, buildIssueRegisterWorkbook, ISSUE_EXCEL_COLUMNS, parseIssueRegisterExcel } from "./issue-excel";

const schedule = {
  activities: [{ id: "A-10", name: "نشاط" }],
  relationships: [{ id: "REL-10", predecessorId: "A-10", successorId: "A-20", type: "FS", lagDays: 0 }],
} as any;

function workbookBuffer(rows: unknown[][]) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([ISSUE_EXCEL_COLUMNS, ...rows]), "سجل القضايا");
  return XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

describe("تبادل Excel لسجل القضايا", () => {
  it("يقبل صفاً عربياً كاملاً يطابق البرنامج الحالي", () => {
    const result = parseIssueRegisterExcel(workbookBuffer([["ISS-01", "تعليمات تغيير", "2026-05-09", "البلانر", "employer", "employer", "critical", 3.5, "REL-10", "A-10", "وصف فني لتعطيل التسلسل بعد تعليمات التغيير.", "تأخير مبدئي في نشاط حرج لمدة 3.5 يوم.", "محضر الاجتماع رقم 11 وتعليمات الموقع."]]), schedule);
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({ issueNo: "ISS-01", proposedDurationDays: 3.5, affectedActivityIds: ["A-10"], impactSummary: "تأخير مبدئي في نشاط حرج لمدة 3.5 يوم.", referenceNotes: "محضر الاجتماع رقم 11 وتعليمات الموقع." });
  });

  it("يرفض الملف بالكامل عند غياب عمود أو قيمة أو معرف نشاط غير صحيح", () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["رقم القضية", "عنوان القضية"], ["ISS-02", "قضية"]]), "سجل القضايا");
    const missingColumns = parseIssueRegisterExcel(XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer, schedule);
    expect(missingColumns.errors[0]).toContain("أعمدة إلزامية مفقودة");

    const invalid = parseIssueRegisterExcel(workbookBuffer([["ISS-03", "قضية صحيحة", "2026-05-09", "", "employer", "employer", "critical", 2, "REL-99", "A-404", "وصف فني كافٍ للاختبار وتوضيح التسلسل.", "أثر زمني متوقع.", "محضر 12"]]), schedule);
    expect(invalid.errors.join(" ")).toContain("REL-99");
    expect(invalid.errors.join(" ")).toContain("A-404");
  });

  it("ينشئ ملف التصدير بأعمدة أثر ومراجع منفصلة وقيمهما محفوظة", () => {
    const workbook = buildIssueRegisterWorkbook([{ issueNo: "ISS-77", title: "تأخر اعتماد", occurrenceDate: "2026-06-01", reportedBy: "البلانر", responsibleParty: "employer", delayCause: "employer", criticality: "potentially_critical", proposedDurationDays: 4, replacedRelationshipId: "REL-10", affectedActivityIds: ["A-10"], description: "وصف فني لاختبار أعمدة تصدير السجل.", impactSummary: "أثر محتمل على التسلسل ونهاية المشروع.", referenceNotes: "خطاب ENG-17 ومحضر اجتماع 22." }]);
    const values = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets["سجل القضايا"], { header: 1, defval: "" });
    expect(values[0]).toContain("ملخص الأثر");
    expect(values[0]).toContain("المراجع");
    expect(values[1]).toContain("أثر محتمل على التسلسل ونهاية المشروع.");
    expect(values[1]).toContain("خطاب ENG-17 ومحضر اجتماع 22.");
  });

  it("ينشئ قالباً احترافياً يوضح الحقول الإلزامية ويضع قوائم اختيار وقواعد إدخال", async () => {
    const workbook = await buildIssueImportTemplateWorkbook();
    const sheet = workbook.getWorksheet("سجل القضايا");
    expect(sheet?.getCell("A1").note).toBe("حقل مطلوب للاستيراد.");
    expect(sheet?.getCell("D1").note).toBe("حقل اختياري؛ اتركه فارغاً إن لم يتوفر.");
    expect(sheet?.getCell("E2").dataValidation.formulae).toContain("\"employer,contractor,engineer,third_party,undetermined\"");
    expect(sheet?.getCell("H2").dataValidation.type).toBe("decimal");
    expect(workbook.getWorksheet("تعليمات")?.getCell("A1").value).toBe("دليل قالب سجل القضايا");
    expect(workbook.getWorksheet("القيم المسموحة")?.getCell("C2").value).toBe("صاحب العمل");
  });
});

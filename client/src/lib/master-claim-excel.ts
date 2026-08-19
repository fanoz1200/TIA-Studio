import * as XLSX from "xlsx";
import type { MasterClaimCase } from "./master-claim-cases";

export const MASTER_CLAIM_EXCEL_URL = "/manus-storage/Master_Claim_Intelligence_1461caf7.xlsx";

export type DetailedMasterClaimCase = MasterClaimCase & {
  recommended_solution: string;
  mitigation: string;
  fragnet_id: string;
  wbs_code: string;
  fragnet_activities: string;
  fragnet_protocol: string;
  tia_baseline_rule: string;
  calendar_rule: string;
  float_rule: string;
  update_procedure: string;
  recovery_procedure: string;
  source: "excel" | "html";
};

type ExcelRow = Record<string, unknown>;

const asText = (value: unknown) => String(value ?? "").trim();

const findCaseSheet = (workbook: XLSX.WorkBook) => {
  const sheetName = workbook.SheetNames.find(name => /case\s*library|مكتبة\s*الحالات/i.test(name));
  return sheetName ? workbook.Sheets[sheetName] : undefined;
};

/**
 * Reads only the uploaded workbook in the browser. It neither posts data to a
 * server nor writes it to the project database.
 */
export async function loadMasterClaimExcelCases(): Promise<DetailedMasterClaimCase[]> {
  const response = await fetch(MASTER_CLAIM_EXCEL_URL);
  if (!response.ok) throw new Error("تعذر قراءة ملف مكتبة الحالات المرجعي.");

  const workbook = XLSX.read(await response.arrayBuffer(), { type: "array" });
  const sheet = findCaseSheet(workbook);
  if (!sheet) throw new Error("لم تُعثر ورقة مكتبة الحالات داخل ملف Excel المرجعي.");

  const allRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  const headingRow = allRows.findIndex(row => asText(row[0]) === "Case ID");
  if (headingRow < 0) throw new Error("لم يُعثر صف العناوين الخاص بالحالات داخل ملف Excel المرجعي.");

  const cases = XLSX.utils.sheet_to_json<ExcelRow>(sheet, { range: headingRow, defval: "", raw: false });
  return cases
    .map(row => {
      const id = asText(row["Case ID"]);
      return {
        id,
        case_id: id,
        title_ar: asText(row["العنوان (AR)"]),
        title_en: asText(row["Title (EN)"]),
        category: asText(row["Category | التصنيف"]),
        delay_type: asText(row["Delay Type"]),
        methodology: asText(row["Methodology"]),
        description: asText(row["Description | الوصف"]),
        root_cause: asText(row["Root Cause | الأسباب الجذرية"]),
        schedule_impact: asText(row["Schedule Impact | الأثر"]),
        recommended_solution: asText(row["Recommended Solution | الحل"]),
        mitigation: asText(row["Mitigation | الوقاية"]),
        contractual_basis: asText(row["Contractual Basis | الأساس التعاقدي"]),
        fragnet_id: asText(row["Fragnet ID"]),
        wbs_code: asText(row["WBS Code"]),
        fragnet_activities: asText(row["Fragnet Activities | أنشطة الـ Fragnet"]),
        fragnet_protocol: asText(row["Fragnet Protocol | بروتوكول Fragnet"]),
        tia_baseline_rule: asText(row["TIA/Baseline Rule | قاعدة TIA"]),
        calendar_rule: asText(row["Calendar Rule | قاعدة التقويم"]),
        float_rule: asText(row["Float Rule | قاعدة الـ Float"]),
        burden_of_proof: asText(row["Burden of Proof (Required Evidence) | عبء الإثبات 🆕"]),
        update_procedure: asText(row["Update Procedure | إجراء التحديث (with Ongoing Event Block)"]),
        recovery_procedure: asText(row["Recovery Procedure | الاستدراك"]),
        source: "excel" as const,
      } satisfies DetailedMasterClaimCase;
    })
    .filter(item => /^D-\d+/i.test(item.id) && item.title_ar);
}

export function enrichHtmlCase(caseItem: MasterClaimCase): DetailedMasterClaimCase {
  return {
    ...caseItem,
    recommended_solution: "راجع ملف Excel المرجعي لمقترح الحل الكامل لهذه الواقعة.",
    mitigation: "راجع ملف Excel المرجعي لإجراءات الوقاية الكاملة لهذه الواقعة.",
    fragnet_id: "",
    wbs_code: "",
    fragnet_activities: "",
    fragnet_protocol: "",
    tia_baseline_rule: "",
    calendar_rule: "",
    float_rule: "",
    update_procedure: "",
    recovery_procedure: "",
    source: "html",
  };
}

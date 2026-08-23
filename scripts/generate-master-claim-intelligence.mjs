import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const projectRoot = path.resolve(import.meta.dirname, "..");
const sourcePath = "/home/ubuntu/upload/pasted_file_pJ8TCu_Master_Claim_Intelligence.xlsx";
const outputPath = path.join(projectRoot, "client", "src", "lib", "master-claim-intelligence-data.ts");

const clean = (value) => String(value ?? "").replace(/\r\n/g, "\n").trim();
const isCaseId = (value) => /^(?:D|DIS|CON|VAR|RES)-\d{3}$/u.test(clean(value));

function sheetRows(sheet) {
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false }).map((row) => row.map(clean));
}

function findHeaderIndex(rows, marker) {
  const index = rows.findIndex((row) => row.some((cell) => cell.toLowerCase().includes(marker.toLowerCase())));
  if (index < 0) throw new Error(`تعذر إيجاد صف العنوان: ${marker}`);
  return index;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function internalLinks(sheet) {
  const ref = sheet["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const links = [];
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const cellAddress = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[cellAddress];
      if (!cell?.l?.Target) continue;
      links.push({
        cell: cellAddress,
        label: clean(cell.v),
        target: cell.l.Target,
      });
    }
  }
  return links;
}

if (!fs.existsSync(sourcePath)) throw new Error(`ملف المصدر غير موجود: ${sourcePath}`);

const workbook = XLSX.readFile(sourcePath, { cellFormula: true, cellHTML: false, cellDates: false });
const caseSheetName = "02_Case_Library";
const caseSheet = workbook.Sheets[caseSheetName];
if (!caseSheet) throw new Error(`ورقة الحالات غير موجودة: ${caseSheetName}`);

const rows = sheetRows(caseSheet);
const headerRowIndex = findHeaderIndex(rows, "Case ID");
const headers = rows[headerRowIndex];
const rawCases = rows
  .slice(headerRowIndex + 1)
  .filter((row) => isCaseId(row[0]));

const cases = rawCases.map((row) => ({
  id: row[0],
  case_id: row[0],
  title_ar: row[1],
  title_en: row[2],
  category: row[3],
  delay_type: row[4],
  methodology: row[5],
  description: row[6],
  root_cause: row[7],
  schedule_impact: row[8],
  recommended_solution: row[9],
  mitigation: row[10],
  contractual_basis: row[11],
  fragnet_id: row[12],
  wbs_code: row[13],
  fragnet_activities: row[14],
  fragnet_protocol: row[15],
  tia_baseline_rule: row[16],
  calendar_rule: row[17],
  float_rule: row[18],
  burden_of_proof: row[19],
  update_procedure: row[20],
  recovery_procedure: row[21],
}));

const supportSheets = workbook.SheetNames
  .filter((sheetName) => sheetName !== caseSheetName)
  .map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rawRows = sheetRows(sheet).filter((row) => row.some(Boolean));
    return {
      id: sheetName,
      title: rawRows[0]?.filter(Boolean).join(" | ") ?? sheetName,
      rows: rawRows,
      links: internalLinks(sheet),
    };
  });

const groupedCaseCounts = Object.entries(cases.reduce((accumulator, entry) => {
  const prefix = entry.case_id.split("-")[0];
  accumulator[prefix] = (accumulator[prefix] ?? 0) + 1;
  return accumulator;
}, {})).sort(([left], [right]) => left.localeCompare(right, "en"));

const sourceMetadata = {
  filename: path.basename(sourcePath),
  sheetName: caseSheetName,
  headerRowNumber: headerRowIndex + 1,
  headers,
  caseCount: cases.length,
  caseIds: cases.map((entry) => entry.case_id),
  caseGroups: Object.fromEntries(groupedCaseCounts),
  supportSheetCount: supportSheets.length,
  internalLinkCount: supportSheets.reduce((sum, sheet) => sum + sheet.links.length, 0),
};

const output = `/**
 * Generated from the user-provided Master Claim Intelligence Excel workbook.
 * Source remains read-only at /home/ubuntu/upload; rerun pnpm content:master-claim to refresh.
 * This data is educational and evidential guidance only, not an automatic entitlement decision.
 */

export type MasterClaimIntelligenceCase = {
  id: string;
  case_id: string;
  title_ar: string;
  title_en: string;
  category: string;
  delay_type: string;
  methodology: string;
  description: string;
  root_cause: string;
  schedule_impact: string;
  recommended_solution: string;
  mitigation: string;
  contractual_basis: string;
  fragnet_id: string;
  wbs_code: string;
  fragnet_activities: string;
  fragnet_protocol: string;
  tia_baseline_rule: string;
  calendar_rule: string;
  float_rule: string;
  burden_of_proof: string;
  update_procedure: string;
  recovery_procedure: string;
};

export type MasterClaimSupportSheet = {
  id: string;
  title: string;
  rows: string[][];
  links: Array<{ cell: string; label: string; target: string }>;
};

export const masterClaimIntelligenceSource = ${JSON.stringify(sourceMetadata, null, 2)} as const;

export const masterClaimIntelligenceCases: MasterClaimIntelligenceCase[] = ${JSON.stringify(cases, null, 2)};

export const masterClaimSupportSheets: MasterClaimSupportSheet[] = ${JSON.stringify(supportSheets, null, 2)};
`;

fs.writeFileSync(outputPath, `${output}\n`);
console.log(`تم توليد ${cases.length} حالة (${groupedCaseCounts.map(([name, count]) => `${name}:${count}`).join("، ")}) و${supportSheets.length} أوراق دعم.`);

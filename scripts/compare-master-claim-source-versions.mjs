import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const projectRoot = path.resolve(import.meta.dirname, "..");
const sources = {
  olderHtml: "/home/ubuntu/upload/Master_Claim_Intelligence_HTML.html",
  laterHtml: "/home/ubuntu/upload/MasterClaimIntelligence—نظامذكاءالمطالباتالإنشائيةV3.0.html",
  workbook: "/home/ubuntu/upload/Master_Claim_Intelligence.xlsx",
};
const outputPath = path.join(projectRoot, "docs", "MASTER_CLAIM_SOURCE_VERSION_COMPARISON.json");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalize(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function extractCaseBlocks(html) {
  const keyPattern = /^\s{2}['"](D-\d{3})['"]:\s*\{/gm;
  const matches = [...html.matchAll(keyPattern)];
  const blocks = {};
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const nextMatch = matches[index + 1];
    const end = nextMatch ? nextMatch.index : html.indexOf("\n};", match.index);
    if (end < 0) continue;
    blocks[match[1]] = normalize(html.slice(match.index, end));
  }
  return blocks;
}

function extractWorkbookCases(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const rows = [];
  for (const sheetName of workbook.SheetNames) {
    const sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
    sheetRows.forEach((row, rowIndex) => {
      const serialized = JSON.stringify(row);
      const ids = [...serialized.matchAll(/\bD-\d{3}\b/g)].map((match) => match[0]);
      ids.forEach((id) => rows.push({ id, sheetName, rowNumber: rowIndex + 2, row }));
    });
  }
  return rows;
}

const olderHtml = fs.readFileSync(sources.olderHtml, "utf8");
const laterHtml = fs.readFileSync(sources.laterHtml, "utf8");
const olderBlocks = extractCaseBlocks(olderHtml);
const laterBlocks = extractCaseBlocks(laterHtml);
const unionIds = [...new Set([...Object.keys(olderBlocks), ...Object.keys(laterBlocks)])].sort((left, right) => left.localeCompare(right, "en"));
const onlyInOlder = unionIds.filter((id) => olderBlocks[id] && !laterBlocks[id]);
const onlyInLater = unionIds.filter((id) => laterBlocks[id] && !olderBlocks[id]);
const changedIds = unionIds.filter((id) => olderBlocks[id] && laterBlocks[id] && sha256(olderBlocks[id]) !== sha256(laterBlocks[id]));
const workbookRows = extractWorkbookCases(sources.workbook);
const workbookIds = [...new Set(workbookRows.map((entry) => entry.id))].sort((left, right) => left.localeCompare(right, "en"));

const report = {
  generatedAt: new Date().toISOString(),
  sourceFiles: sources,
  html: {
    older: { caseCount: Object.keys(olderBlocks).length, sha256: sha256(olderHtml) },
    later: { caseCount: Object.keys(laterBlocks).length, sha256: sha256(laterHtml) },
    onlyInOlder,
    onlyInLater,
    changedIds,
    unchangedCaseCount: unionIds.length - onlyInOlder.length - onlyInLater.length - changedIds.length,
  },
  workbook: {
    caseCount: workbookIds.length,
    caseIds: workbookIds,
    rowsWithCaseId: workbookRows.length,
  },
};

fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

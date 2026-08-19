import XLSX from 'xlsx';

const sourcePath = process.argv[2];
if (!sourcePath) {
  throw new Error('Usage: node scripts/inspect-claim-excel.mjs <excel-file>');
}

const workbook = XLSX.readFile(sourcePath, { cellDates: true });
const summary = workbook.SheetNames.map((name) => {
  const sheet = workbook.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  const caseIdentifiers = [...new Set(
    rows.flatMap((row) => Object.values(row).flatMap((value) =>
      String(value).match(/\bD-\d{3}\b/g) ?? [],
    )),
  )];
  return {
    sheet: name,
    rowCount: rows.length,
    fields: rows.length ? Object.keys(rows[0]) : [],
    caseIdentifiers,
    sample: rows.slice(0, 2),
  };
});

console.log(JSON.stringify({ file: sourcePath, sheets: summary }, null, 2));

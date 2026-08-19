import XLSX from 'xlsx';

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Usage: node scripts/count-case-ids-in-workbook.mjs <excel-file>');

const workbook = XLSX.readFile(sourcePath, { cellDates: true });
const result = workbook.SheetNames.map((sheetName) => {
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false });
  const cases = rows
    .filter((row) => /^D[-–—]\s*\d{1,3}$/i.test(String(row[0] ?? '').trim()))
    .map((row) => String(row[0]).trim());
  return { sheetName, count: cases.length, first: cases.slice(0, 3), last: cases.slice(-3) };
});
console.log(JSON.stringify(result, null, 2));

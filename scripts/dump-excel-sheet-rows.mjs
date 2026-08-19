import XLSX from 'xlsx';

const [sourcePath, sheetName, maxRowsArg = '100'] = process.argv.slice(2);
if (!sourcePath || !sheetName) {
  throw new Error('Usage: node scripts/dump-excel-sheet-rows.mjs <excel-file> <sheet-name> [max-rows]');
}

const workbook = XLSX.readFile(sourcePath, { cellDates: true });
const sheet = workbook.Sheets[sheetName];
if (!sheet) throw new Error(`Worksheet not found: ${sheetName}`);

const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
const maxRows = Number.parseInt(maxRowsArg, 10);
console.log(JSON.stringify(rows.slice(0, maxRows), null, 2));

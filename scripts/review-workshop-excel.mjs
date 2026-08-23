import XLSX from "xlsx";

const sourcePath = "/home/ubuntu/upload/Workshop-NO8TimeImpactAnalysis.xlsx";
const workbook = XLSX.readFile(sourcePath, { cellDates: false, cellFormula: true, cellHTML: false });

for (const name of workbook.SheetNames) {
  const sheet = workbook.Sheets[name];
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");
  console.log(`\n=== ${name} (${sheet["!ref"] ?? "A1"}) ===`);
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    const cells = [];
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      const cell = sheet[address];
      if (!cell || String(cell.w ?? cell.v ?? "").trim() === "") continue;
      cells.push(`${address}=${JSON.stringify(cell.w ?? cell.v)}${cell.f ? ` [formula: ${cell.f}]` : ""}`);
    }
    if (cells.length) console.log(cells.join(" | "));
  }
}

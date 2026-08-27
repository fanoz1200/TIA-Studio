/**
 * أدوات XER نصية محافظة: تفهم حدود الجداول والحقول من دون إعادة تسلسل الملف كله.
 * تستخدم نسخة Post تغييرات محددة فقط؛ أما Pre فيظل النص الأصلي كما اختاره المستخدم.
 */
export type XerRow = Record<string, string>;

export type XerDocumentRow = {
  values: XerRow;
  cells: string[];
  lineStart: number;
  lineEnd: number;
};

export type XerTableBlock = {
  name: string;
  tableStart: number;
  endStart?: number;
  headerFields: string[];
  rows: XerDocumentRow[];
};

export type XerDocument = {
  rawText: string;
  lineEnding: "\r\n" | "\n" | "\r";
  tables: XerTableBlock[];
};

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function readLine(rawText: string, start: number) {
  let index = start;
  while (index < rawText.length && rawText[index] !== "\r" && rawText[index] !== "\n") index += 1;
  const content = rawText.slice(start, index);
  if (index >= rawText.length) return { content, end: index, ending: "" };
  if (rawText[index] === "\r" && rawText[index + 1] === "\n") return { content, end: index + 2, ending: "\r\n" };
  return { content, end: index + 1, ending: rawText[index] };
}

/** يقرأ مواضع صفوف XER مع إبقاء النص الأصلي من دون تعديل أو تطبيع. */
export function parseXerDocument(rawText: string): XerDocument {
  const tables: XerTableBlock[] = [];
  let current: XerTableBlock | undefined;
  let offset = 0;
  let detectedEnding: "\r\n" | "\n" | "\r" | undefined;

  while (offset < rawText.length) {
    const lineStart = offset;
    const parsed = readLine(rawText, offset);
    offset = parsed.end;
    if (!detectedEnding && parsed.ending) detectedEnding = parsed.ending as "\r\n" | "\n" | "\r";
    const cells = parsed.content.split("\t");
    const marker = (cells[0] ?? "").replace(/^\uFEFF/, "").trim();

    if (marker === "%T") {
      const name = (cells[1] ?? "").trim().toUpperCase();
      current = { name, tableStart: lineStart, headerFields: [], rows: [] };
      tables.push(current);
      continue;
    }
    if (!current) continue;
    if (marker === "%F") {
      current.headerFields = cells.slice(1).map(normalizeKey);
    } else if (marker === "%R" && current.headerFields.length) {
      const values: XerRow = {};
      current.headerFields.forEach((field, index) => {
        values[field] = (cells[index + 1] ?? "").trim();
      });
      current.rows.push({ values, cells: cells.slice(1), lineStart, lineEnd: parsed.end });
    } else if (marker === "%E") {
      current.endStart = lineStart;
      current = undefined;
    }
  }

  return { rawText, lineEnding: detectedEnding ?? "\r\n", tables };
}

/** واجهة مبسطة لمستورد الجداول مع الاحتفاظ بمحلل واحد مشترك. */
export function parseXerTableRows(rawText: string) {
  const tables = new Map<string, XerRow[]>();
  for (const block of parseXerDocument(rawText).tables) {
    if (!block.name) continue;
    const rows = tables.get(block.name) ?? [];
    rows.push(...block.rows.map((row) => row.values));
    tables.set(block.name, rows);
  }
  return tables;
}

export function xerTableBlocks(document: XerDocument, name: string) {
  return document.tables.filter((table) => table.name === name.toUpperCase());
}

export function cleanXerCell(value: unknown) {
  return String(value ?? "").replace(/[\t\r\n]+/g, " ").trim();
}

export function createXerRowLine(cells: unknown[]) {
  return `%R\t${cells.map(cleanXerCell).join("\t")}`;
}

export type ConservativeXerPatch = {
  /** لا تُحذف إلا صفوف محددة صراحةً داخل TASKPRED؛ كل الجداول الأخرى تظل حرفياً كما هي. */
  removeRows?: XerDocumentRow[];
  appendRows?: Array<{ table: XerTableBlock; rows: unknown[][] }>;
};

/**
 * يطبق تعديلات نصية موضعية بترتيب عكسي. لا يعيد كتابة BOM أو ترتيب الجداول أو الصفوف
 * غير المتأثرة أو النهايات الأصلية، ويُستخدم فقط بعد فحص اكتمال الجداول المطلوبة.
 */
export function applyConservativeXerPatch(document: XerDocument, patch: ConservativeXerPatch) {
  const changes: Array<{ start: number; end: number; value: string }> = [];
  for (const row of patch.removeRows ?? []) changes.push({ start: row.lineStart, end: row.lineEnd, value: "" });
  for (const append of patch.appendRows ?? []) {
    if (append.table.endStart === undefined) throw new Error(`جدول XER ${append.table.name} لا يملك نهاية %E صالحة.`);
    if (!append.rows.length) continue;
    const preceding = document.rawText.slice(0, append.table.endStart);
    const needsLeadingEnding = !(preceding.endsWith("\r") || preceding.endsWith("\n"));
    const payload = append.rows.map(createXerRowLine).join(document.lineEnding);
    changes.push({
      start: append.table.endStart,
      end: append.table.endStart,
      value: `${needsLeadingEnding ? document.lineEnding : ""}${payload}${document.lineEnding}`,
    });
  }
  return changes
    .sort((left, right) => right.start - left.start || right.end - left.end)
    .reduce((result, change) => `${result.slice(0, change.start)}${change.value}${result.slice(change.end)}`, document.rawText);
}

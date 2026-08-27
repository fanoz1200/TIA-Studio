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

export type XerSourceEncoding = "utf-8" | "single-byte-8bit";

/**
 * تمثيل XER في الذاكرة: UTF-8 السليم يظل نصاً مفهوماً. أما المصدر غير UTF-8
 * فيتحول إلى عرض واحد-إلى-واحد (كل byte يصبح code unit واحداً) حتى تظل مواضع
 * الصفوف مساوية لمواضع البايتات ولا يفقد الـparser أي byte أثناء المراجعة.
 */
export type DecodedXerBytes = {
  rawBytes: Uint8Array;
  rawText: string;
  sourceEncoding: XerSourceEncoding;
  sourceByteOffset: number;
  preByteExact: boolean;
};

function hasUtf8Bom(bytes: Uint8Array) {
  return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

function singleByteView(bytes: Uint8Array) {
  const chunkSize = 0x8000;
  const chunks: string[] = [];
  for (let start = 0; start < bytes.length; start += chunkSize) {
    const end = Math.min(bytes.length, start + chunkSize);
    let chunk = "";
    for (let index = start; index < end; index += 1) chunk += String.fromCharCode(bytes[index]);
    chunks.push(chunk);
  }
  return chunks.join("");
}

/** يفك المصدر للقراءة فقط ويحفظ نسخة مستقلة من البايتات الأصلية داخل الجلسة. */
export function decodeXerBytes(raw: ArrayBuffer | Uint8Array): DecodedXerBytes {
  const rawBytes = raw instanceof Uint8Array ? new Uint8Array(raw) : new Uint8Array(raw.slice(0));
  const sourceByteOffset = hasUtf8Bom(rawBytes) ? 3 : 0;
  const body = rawBytes.subarray(sourceByteOffset);
  try {
    const rawText = new TextDecoder("utf-8", { fatal: true }).decode(body);
    return { rawBytes, rawText, sourceEncoding: "utf-8", sourceByteOffset, preByteExact: true };
  } catch {
    return { rawBytes, rawText: singleByteView(body), sourceEncoding: "single-byte-8bit", sourceByteOffset, preByteExact: true };
  }
}

/** مسار التوافق للنداءات النصية القديمة؛ لا يثبت أن هذا النص كان ملف المستخدم حرفياً. */
export function encodeUtf8XerText(rawText: string): DecodedXerBytes {
  return { rawBytes: new TextEncoder().encode(rawText), rawText, sourceEncoding: "utf-8", sourceByteOffset: 0, preByteExact: false };
}

export type P6CalendarDataReview = {
  state: "not-found" | "readable" | "malformed";
  hasDaysOfWeek: boolean;
  weekdayEntries: number;
  weekdayPeriodStartMarkers: number;
  weekdayPeriodFinishMarkers: number;
  hasExceptions: boolean;
  exceptionDateMarkers: number;
};

type CalendarDataNode = { name?: string; values: string[]; children: CalendarDataNode[] };

/** P6 يسبق الذرات أحياناً بمعرّف طبقة مثل `0||DaysOfWeek` أو `0||s`. */
function normalizeCalendarDataAtom(value: string) {
  return value.trim().replace(/^(?:\d+\|\|)+/, "");
}

/**
 * يفك أقواس بيانات التقويم لأغراض المراجعة البنيوية فقط. لا يفسر ساعات اليوم أو
 * الوراثة أو الاستثناءات إلى أيام عمل، ولا يجوز استخدامه لحساب CPM أو Float.
 */
export function reviewP6CalendarData(raw: string | undefined): P6CalendarDataReview {
  const empty: P6CalendarDataReview = { state: "not-found", hasDaysOfWeek: false, weekdayEntries: 0, weekdayPeriodStartMarkers: 0, weekdayPeriodFinishMarkers: 0, hasExceptions: false, exceptionDateMarkers: 0 };
  if (!raw?.trim()) return empty;
  // يستعمل P6 غالباً `|` كفاصل حقول، بينما تبقى `||` جزءاً من بادئة الطبقة.
  // لا نحول النص إلى قيم ساعات/تواريخ؛ هذه مجرد ذرات لمراجعة البنية.
  const tokens = raw.match(/[()]|[^()\s|]+(?:\|\|[^()\s|]+)*|\|/g)?.filter((token) => token !== "|") ?? [];
  const root: CalendarDataNode = { children: [], values: [] };
  const stack = [root];
  let malformed = false;
  for (const token of tokens) {
    if (token === "(") {
      const node: CalendarDataNode = { children: [], values: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    } else if (token === ")") {
      if (stack.length === 1) malformed = true;
      else stack.pop();
    } else {
      const current = stack[stack.length - 1];
      if (!current.name) current.name = token;
      else current.values.push(token);
    }
  }
  if (stack.length !== 1) malformed = true;
  const hasCalendarData = tokens.some((token) => normalizeCalendarDataAtom(token).toLowerCase() === "calendardata");
  if (!hasCalendarData) return empty;
  if (malformed) return { ...empty, state: "malformed" };

  const findAll = (node: CalendarDataNode, name: string) => {
    const matches: CalendarDataNode[] = [];
    const nodes = [node];
    while (nodes.length) {
      const current = nodes.pop()!;
      if (normalizeCalendarDataAtom(current.name ?? "").toLowerCase() === name.toLowerCase()) matches.push(current);
      for (const child of current.children) nodes.push(child);
    }
    return matches;
  };
  const atoms = (node: CalendarDataNode) => {
    const result: string[] = [];
    const nodes = [node];
    while (nodes.length) {
      const current = nodes.pop()!;
      if (current.name) result.push(normalizeCalendarDataAtom(current.name));
      for (const value of current.values) result.push(normalizeCalendarDataAtom(value));
      for (const child of current.children) nodes.push(child);
    }
    return result;
  };
  const daysOfWeek = findAll(root, "DaysOfWeek");
  const exceptions = findAll(root, "Exceptions");
  const weekdayEntries = daysOfWeek.flatMap((section) => section.children).filter((node) => {
    const normalizedName = normalizeCalendarDataAtom(node.name ?? "");
    const hasWeekdayValue = node.values.some((value) => /^[1-7]$/.test(normalizeCalendarDataAtom(value)));
    const childAtoms = atoms(node);
    const hasPeriodMarker = childAtoms.some((value) => value.toLowerCase() === "s" || value.toLowerCase() === "f");
    return /^[1-7]$/.test(normalizedName) || Boolean(hasWeekdayValue && /day/i.test(normalizedName)) || hasPeriodMarker;
  });
  const weekdayAtoms = weekdayEntries.flatMap(atoms);
  const exceptionAtoms = exceptions.flatMap(atoms);
  return {
    state: "readable",
    hasDaysOfWeek: daysOfWeek.length > 0,
    weekdayEntries: weekdayEntries.length,
    weekdayPeriodStartMarkers: weekdayAtoms.filter((token) => token.toLowerCase() === "s").length,
    weekdayPeriodFinishMarkers: weekdayAtoms.filter((token) => token.toLowerCase() === "f").length,
    hasExceptions: exceptions.length > 0,
    exceptionDateMarkers: exceptionAtoms.filter((token) => token.toLowerCase() === "d").length,
  };
}

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
    // لا تستخدم spread هنا: جداول P6 الواقعية قد تتجاوز حد مكدس الاستدعاء في JavaScript.
    for (const row of block.rows) rows.push(row.values);
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

type XerTextChange = { start: number; end: number; value: string };

function conservativeXerChanges(document: XerDocument, patch: ConservativeXerPatch): XerTextChange[] {
  const changes: XerTextChange[] = [];
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
  return changes.sort((left, right) => right.start - left.start || right.end - left.end);
}

/**
 * يطبق تعديلات نصية موضعية بترتيب عكسي. لا يعيد كتابة BOM أو ترتيب الجداول أو الصفوف
 * غير المتأثرة أو النهايات الأصلية، ويُستخدم فقط بعد فحص اكتمال الجداول المطلوبة.
 */
export function applyConservativeXerPatch(document: XerDocument, patch: ConservativeXerPatch) {
  return conservativeXerChanges(document, patch)
    .reduce((result, change) => `${result.slice(0, change.start)}${change.value}${result.slice(change.end)}`, document.rawText);
}

function asciiBytes(value: string) {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code > 0x7f) throw new Error("تعذر كتابة نص غير ASCII في ملف XER غير UTF-8؛ أوقف التصدير بدلاً من تغيير ترميز المصدر.");
    bytes[index] = code;
  }
  return bytes;
}

function utf8ByteOffset(text: string, codeUnitOffset: number) {
  return new TextEncoder().encode(text.slice(0, codeUnitOffset)).length;
}

/**
 * يطبق نفس patch المحافظ على rawBytes. الأجزاء الأصلية تنسخ من المصدر مباشرة؛
 * لا يعاد ترميزها. في ملفات 8-bit لا يسمح إلا بالصفوف الجديدة ASCII.
 */
export function applyConservativeXerBytePatch(
  document: XerDocument,
  source: Pick<DecodedXerBytes, "rawBytes" | "sourceEncoding" | "sourceByteOffset">,
  patch: ConservativeXerPatch,
) {
  const encoder = new TextEncoder();
  const changes = conservativeXerChanges(document, patch);
  const fragments: Uint8Array[] = [];
  let right = document.rawText.length;
  for (const change of changes) {
    const byteStart = source.sourceByteOffset + (source.sourceEncoding === "utf-8" ? utf8ByteOffset(document.rawText, change.start) : change.start);
    const byteEnd = source.sourceByteOffset + (source.sourceEncoding === "utf-8" ? utf8ByteOffset(document.rawText, change.end) : change.end);
    const unchangedStart = source.sourceByteOffset + (source.sourceEncoding === "utf-8" ? utf8ByteOffset(document.rawText, change.end) : change.end);
    const unchangedEnd = source.sourceByteOffset + (source.sourceEncoding === "utf-8" ? utf8ByteOffset(document.rawText, right) : right);
    if (unchangedEnd > unchangedStart) fragments.unshift(source.rawBytes.slice(unchangedStart, unchangedEnd));
    fragments.unshift(source.sourceEncoding === "utf-8" ? encoder.encode(change.value) : asciiBytes(change.value));
    right = change.start;
    if (byteEnd < byteStart) throw new Error("مواضع تعديل XER غير صالحة.");
  }
  const prefixEnd = source.sourceByteOffset + (source.sourceEncoding === "utf-8" ? utf8ByteOffset(document.rawText, right) : right);
  fragments.unshift(source.rawBytes.slice(0, prefixEnd));
  const total = fragments.reduce((sum, fragment) => sum + fragment.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const fragment of fragments) {
    output.set(fragment, offset);
    offset += fragment.length;
  }
  return output;
}

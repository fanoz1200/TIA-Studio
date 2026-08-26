import fs from "node:fs";
import path from "node:path";

const sourcePath = path.resolve(import.meta.dirname, "../docs/sources/qwen-case-intake-d056-d088.json");
const outputPath = path.resolve("client/src/lib/qwen-case-intake-data.ts");

function text(value) {
  return String(value ?? "").trim();
}

function sourceValue(value, fallback) {
  const result = text(value);
  return result || fallback;
}

function parseJsonAttachment(raw) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Qwen intake attachment does not contain a JSON object.");
  return JSON.parse(raw.slice(start, end + 1));
}

if (!fs.existsSync(sourcePath)) {
  throw new Error(`Qwen intake attachment was not found: ${sourcePath}`);
}

const attachment = parseJsonAttachment(fs.readFileSync(sourcePath, "utf8"));
const sourceCases = Array.isArray(attachment.cases)
  ? attachment.cases
  : Object.values(attachment.cases ?? {});

const seenIds = new Set();
const cases = sourceCases
  .map(raw => {
    const id = text(raw.id);
    if (!/^D-\d{3}$/i.test(id)) throw new Error(`Invalid Qwen case ID: ${id || "(empty)"}`);
    if (seenIds.has(id)) throw new Error(`Duplicate Qwen case ID: ${id}`);
    seenIds.add(id);

    const evidence = Array.isArray(raw.ev) ? raw.ev.map(text).filter(Boolean) : [];
    const p6 = Array.isArray(raw.p6) ? raw.p6.map(text).filter(Boolean) : [];
    const titleAr = sourceValue(raw.t_ar, `حالة ${id}`);
    const titleEn = sourceValue(raw.t_en, `Case ${id}`);
    const sourceLocator = [
      raw.f && `Source reference / مرجع المصدر: ${text(raw.f)}`,
      raw.law && `Legal locator as recorded / مؤشر قانوني كما ورد: ${text(raw.law)}`,
      raw.src && `Source locator as recorded / مؤشر المصدر كما ورد: ${text(raw.src)}`,
    ].filter(Boolean).join("\n\n");

    return {
      id,
      case_id: id,
      title_ar: titleAr,
      title_en: titleEn,
      category: sourceValue(raw.cat, "Qwen intake"),
      delay_type: sourceValue(raw.adj, "Responsibility marker not provided"),
      methodology: sourceValue(raw.meth, "Methodology requires project verification"),
      description: sourceValue(raw.ex, "No further narrative was included in the supplied intake."),
      root_cause: "Not independently verified; review the original cited material and project facts.",
      schedule_impact: `Fragnet cue as recorded: ${sourceValue(raw.frag, "Not provided")}`,
      recommended_solution: "Use this as an intake cue only; define the event, affected activities and links against the actual update before analysis.",
      mitigation: "Not provided in the supplied intake.",
      contractual_basis: sourceValue(sourceLocator, "No detailed contractual citation was included in the supplied intake."),
      fragnet_id: sourceValue(raw.frag, ""),
      wbs_code: "",
      fragnet_activities: "",
      fragnet_protocol: sourceValue(raw.frag, ""),
      tia_baseline_rule: "Verify the applicable baseline/update and data date against the project record.",
      calendar_rule: "Verify the project calendar before calculating any impact.",
      float_rule: "Verify total-float treatment against the contract and accepted programme.",
      burden_of_proof: evidence.join("\n\n") || "Evidence requirements were not listed in the supplied intake.",
      update_procedure: p6.join("\n\n") || "No P6 procedure was listed in the supplied intake.",
      recovery_procedure: "Not provided in the supplied intake.",
    };
  })
  .sort((a, b) => a.id.localeCompare(b.id, "en"));

const ids = cases.map(item => item.id);
const output = `/**\n * Generated from the user-provided Qwen intake attachment.\n * The original cited DOCX/reference was not supplied, so every entry is shown as a review intake—not a verified legal or contractual authority.\n * Source is archived locally in docs/sources/qwen-case-intake-d056-d088.json; rerun pnpm content:qwen-intake to refresh.\n */\n\nimport type { MasterClaimIntelligenceCase } from "./master-claim-intelligence-data";\n\nexport const qwenCaseIntakeSource = ${JSON.stringify({
  filename: path.basename(sourcePath),
  userConfirmedPurpose: "Complete the library with Qwen-supplied cases",
  reviewStatus: "user-provided intake; original cited source not independently verified",
  originalSourceAvailable: false,
  caseCount: cases.length,
  caseIds: ids,
}, null, 2)} as const;\n\nexport const qwenCaseIntakeCases: MasterClaimIntelligenceCase[] = ${JSON.stringify(cases, null, 2)};\n`;

fs.writeFileSync(outputPath, output, "utf8");
console.log(`Generated ${cases.length} Qwen intake cases at ${outputPath}`);

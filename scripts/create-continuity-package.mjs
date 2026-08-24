import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const defaultOutputDirectory = resolve(repositoryRoot, "..", "TIA-Studio-Handover");

function readOption(optionName) {
  const optionIndex = process.argv.indexOf(optionName);
  if (optionIndex === -1) return undefined;

  const value = process.argv[optionIndex + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`القيمة بعد ${optionName} مطلوبة.`);
  }

  return value;
}

function ensureOutsideRepository(outputDirectory) {
  const relation = relative(repositoryRoot, outputDirectory);
  const pointsInsideRepository = relation === "" || (!relation.startsWith("..") && !isAbsolute(relation));

  if (pointsInsideRepository) {
    throw new Error("مجلد حزمة الاستلام يجب أن يكون خارج مجلد المشروع حتى لا يدخل في Git أو حزمة النشر.");
  }
}

function runGit(argumentsList) {
  return execFileSync("git", argumentsList, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function createReadMe({ commit, sourceArchiveName, sourceArchiveSha256 }) {
  return `# TIA Studio — حزمة استلام يدوية

هذه الحزمة أُنشئت من commit نظيف ومحدد من المصدر. لا تحتاج منصة بعينها لتقرأ الكود أو تكمله لاحقاً.

| البند | القيمة |
|---|---|
| Git commit | \`${commit}\` |
| أرشيف المصدر | \`${sourceArchiveName}\` |
| SHA-256 للأرشيف | \`${sourceArchiveSha256}\` |
| مستودع المصدر | https://github.com/fanoz1200/TIA-Studio |

## البداية السريعة

1. احتفظ بهذا المجلد في مكانين يملكه المالك، مثل قرص مشفّر وحساب تخزين خاص.
2. افك \`${sourceArchiveName}\` في مجلد جديد.
3. اقرأ \`docs/CONTINUITY_AND_HANDOVER_AR.md\` و\`CONTRIBUTING.md\` داخل المصدر قبل أن يعمل مطور أو وكيل جديد.
4. ثبّت Node.js 22 وpnpm، ثم شغّل \`pnpm install --frozen-lockfile\` و\`pnpm test\` و\`pnpm check\` و\`pnpm build\`.
5. لبناء نسخة Windows جديدة استخدم \`pnpm desktop:pack:windows\` ثم اختبر Portable أولاً. لا تنسخ بيانات عميل أو ملفات \`.env\` إلى المستودع أو إلى أي prompt خارجي.

## ملفات التشغيل المعتمدة لإصلاح Windows الحالي

| الحزمة | الرابط | SHA-256 |
|---|---|---|
| Windows Setup | https://tiadelaytool-aq6zdeih.manus.space/manus-storage/TIA-Studio-1.0.7-Windows-x64-Setup_7327be86.exe | \`15dcc0c6c5523fe36c6363b6c0f09ab69afa46210f8b019f9922e10767cdbd83\` |
| Windows Portable | https://tiadelaytool-aq6zdeih.manus.space/manus-storage/TIA-Studio-1.0.7-Windows-x64-Portable_20a0a969.exe | \`c06896df092c43fafdfe8b788a679a3ca6ad91b033f498f4f33c2d24ff6ce224\` |

> هذه ليست آلية نسخ احتياطي مجدولة، ولا تحتوي أي ملفات عميل خام أو أسرار أو مخرجات مطالبة حقيقية.
`;
}

const requestedOutputDirectory = readOption("--output");
const outputDirectory = resolve(requestedOutputDirectory || defaultOutputDirectory);
ensureOutsideRepository(outputDirectory);

const worktreeStatus = runGit(["status", "--porcelain", "--untracked-files=all"]);
if (worktreeStatus) {
  throw new Error("أوقف إنشاء الحزمة لأن شجرة Git ليست نظيفة. احفظ أو انقل التغييرات المقصودة أولاً.\n" + worktreeStatus);
}

const commit = runGit(["rev-parse", "HEAD"]);
const shortCommit = runGit(["rev-parse", "--short", "HEAD"]);
const packageDirectory = resolve(outputDirectory, `TIA-Studio-Handover-${shortCommit}`);
const sourceArchiveName = `TIA-Studio-source-${shortCommit}.tar.gz`;
const sourceArchivePath = resolve(packageDirectory, sourceArchiveName);

rmSync(packageDirectory, { recursive: true, force: true });
mkdirSync(packageDirectory, { recursive: true });

try {
  execFileSync("git", ["archive", "--format=tar.gz", `--output=${sourceArchivePath}`, "HEAD"], {
    cwd: repositoryRoot,
    stdio: "pipe",
  });

  const sourceArchiveSha256 = sha256(sourceArchivePath);
  const handoverDocumentPath = resolve(repositoryRoot, "docs", "CONTINUITY_AND_HANDOVER_AR.md");
  if (!existsSync(handoverDocumentPath)) {
    throw new Error("دليل الاستمرارية غير موجود داخل المصدر.");
  }

  writeFileSync(
    resolve(packageDirectory, "README_FIRST_AR.md"),
    createReadMe({ commit, sourceArchiveName, sourceArchiveSha256 }),
    "utf8"
  );
  writeFileSync(
    resolve(packageDirectory, "handover-manifest.json"),
    JSON.stringify(
      {
        application: "TIA Studio",
        createdAtUtc: new Date().toISOString(),
        gitCommit: commit,
        sourceArchive: { fileName: sourceArchiveName, sha256: sourceArchiveSha256 },
        sourceRepository: "https://github.com/fanoz1200/TIA-Studio",
        intentionalExclusions: [".env files", "raw XER/XML/XLSX", "customer evidence", "release executables", "node_modules"],
        automaticBackup: false,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  console.log(`تم إنشاء حزمة الاستلام: ${packageDirectory}`);
  console.log(`المصدر: ${sourceArchiveName}`);
  console.log(`SHA-256: ${sourceArchiveSha256}`);
} catch (error) {
  rmSync(packageDirectory, { recursive: true, force: true });
  throw error;
}

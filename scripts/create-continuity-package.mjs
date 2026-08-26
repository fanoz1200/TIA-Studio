import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const defaultOutputDirectory = resolve(repositoryRoot, "..", "TIA-Studio-Manual-Backups");

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
    throw new Error("مجلد النسخ اليدوي يجب أن يكون خارج مجلد المشروع حتى لا يدخل في Git أو حزمة النشر.");
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

function findLatestWindowsArtifacts() {
  const releaseDirectory = resolve(repositoryRoot, "release");
  if (!existsSync(releaseDirectory)) return [];

  const candidates = readdirSync(releaseDirectory, { withFileTypes: true })
    .filter(entry => entry.isFile() && /^TIA-Studio-.*-Windows-x64-(Portable|Setup)\.exe$/i.test(entry.name))
    .map(entry => {
      const sourcePath = resolve(releaseDirectory, entry.name);
      const kind = entry.name.includes("-Portable") ? "portable" : "setup";
      return { fileName: entry.name, kind, sourcePath, modifiedAt: statSync(sourcePath).mtimeMs };
    });

  return ["portable", "setup"]
    .map(kind => candidates.filter(candidate => candidate.kind === kind).sort((a, b) => b.modifiedAt - a.modifiedAt)[0])
    .filter(Boolean);
}

function createReadMe({ commit, packageVersion, sourceArchiveName, sourceArchiveSha256, windowsArtifacts }) {
  const windowsRows = windowsArtifacts.length
    ? windowsArtifacts
        .map(
          artifact =>
            `| ${artifact.kind === "portable" ? "Windows Portable" : "Windows Setup"} | \`windows/${artifact.fileName}\` | \`${artifact.sha256}\` |`
        )
        .join("\n")
    : "| ملفات Windows | غير مضمّنة | — |";

  return `# TIA Studio — حزمة النسخ اليدوي المجانية

هذه الحزمة تساعد المالك على الاحتفاظ **بنسخة مصدر قابلة لإعادة البناء** و**نسخة Windows متاحة حالياً إن وُجدت**. لا تنشئ مزامنة دورية، ولا ترفع ملفات إلى خدمة خارجية، ولا تحتوي بيانات عميل أو أسراراً.

| البند | القيمة |
|---|---|
| Git commit للمصدر | \`${commit}\` |
| إصدار المصدر في package.json | \`${packageVersion}\` |
| أرشيف المصدر | \`${sourceArchiveName}\` |
| SHA-256 لأرشيف المصدر | \`${sourceArchiveSha256}\` |
| مستودع المصدر | https://github.com/fanoz1200/TIA-Studio |

## ابدأ بهذه الخطوات

1. افحص الحزمة بعد فك الضغط: على macOS/Linux شغّل \`sha256sum -c SHA256SUMS.txt\`. على Windows استخدم \`Get-FileHash\` كما هو موضح في \`RESTORE_GUIDE_AR.md\`.
2. احتفظ بملف ZIP الأصلي في مكانين يتحكم فيهما المالك، مثل قرص خارجي مشفّر ومجلد خاص على جهازه. هذه مسؤولية يدوية وليست خدمة نسخ تلقائي.
3. لفتح الكود: فك \`${sourceArchiveName}\` في مجلد جديد، ثم راجع \`RESTORE_GUIDE_AR.md\` قبل تثبيت أي اعتماد.
4. لإعادة بناء المصدر: ثبّت Node.js 22 وpnpm ثم شغّل \`pnpm install --frozen-lockfile\` و\`pnpm test\` و\`pnpm check\` و\`pnpm build\`.
5. لا تضع ملفات \`.env\` أو XER/XML/XLSX أو Evidence أو مراسلات العميل داخل هذه الحزمة أو داخل مستودع GitHub.

## ملفات Windows المتاحة داخل الحزمة

| العنصر | المسار | SHA-256 |
|---|---|---|
${windowsRows}

> **تنبيه مهم عن المطابقة:** أرشيف المصدر مربوط بالـcommit المذكور أعلاه. أي ملف Windows داخل هذه الحزمة هو آخر artifact متاح محلياً وقت الإنشاء فقط؛ لا يدّعي هذا الملف أنه بُني من نفس الـcommit. لإثبات التطابق، يجب إعادة بناء Windows من المصدر ثم تجربة Portable وSetup على Windows فعلياً وفق \`docs/TIA_STUDIO_DESKTOP_RELEASE_AR.md\`.

## ما لا تستعيده هذه الحزمة

- قاعدة البيانات أو بيانات المستخدمين أو الملفات في التخزين السحابي أو جلسات الدخول.
- أي مفتاح أو متغير بيئة أو بيانات عميل خام أو مخرجات مطالبة خاصة.
- حقاً قانونياً أو قرار EOT أو تطابقاً وظيفياً مع Primavera P6/F9.
`;
}

function writeChecksumManifest(packageDirectory, entries) {
  const checksumContents = entries
    .map(entry => `${entry.sha256} *${entry.relativePath}`)
    .join("\n")
    .concat("\n");
  writeFileSync(resolve(packageDirectory, "SHA256SUMS.txt"), checksumContents, "utf8");
}

const requestedOutputDirectory = readOption("--output");
const sourceOnly = process.argv.includes("--source-only");
const outputDirectory = resolve(requestedOutputDirectory || defaultOutputDirectory);
ensureOutsideRepository(outputDirectory);

const worktreeStatus = runGit(["status", "--porcelain", "--untracked-files=all"]);
if (worktreeStatus) {
  throw new Error("أوقف إنشاء الحزمة لأن شجرة Git ليست نظيفة. احفظ أو انقل التغييرات المقصودة أولاً.\n" + worktreeStatus);
}

const commit = runGit(["rev-parse", "HEAD"]);
const shortCommit = runGit(["rev-parse", "--short", "HEAD"]);
const packageVersion = JSON.parse(readFileSync(resolve(repositoryRoot, "package.json"), "utf8")).version;
const packageDirectoryName = `TIA-Studio-Manual-Backup-${shortCommit}`;
const packageDirectory = resolve(outputDirectory, packageDirectoryName);
const sourceArchiveName = `TIA-Studio-source-${shortCommit}.tar.gz`;
const sourceArchivePath = resolve(packageDirectory, sourceArchiveName);
const packageArchiveName = `${packageDirectoryName}.zip`;
const packageArchivePath = resolve(outputDirectory, packageArchiveName);
const windowsDirectory = resolve(packageDirectory, "windows");
const restoreGuidePath = resolve(repositoryRoot, "docs", "FREE_MANUAL_BACKUP_AND_RESTORE_AR.md");

rmSync(packageDirectory, { recursive: true, force: true });
rmSync(packageArchivePath, { force: true });
rmSync(`${packageArchivePath}.sha256`, { force: true });
mkdirSync(packageDirectory, { recursive: true });

try {
  if (!existsSync(restoreGuidePath)) {
    throw new Error("دليل النسخ والاستعادة اليدوي غير موجود داخل المصدر.");
  }

  execFileSync("git", ["archive", "--format=tar.gz", `--output=${sourceArchivePath}`, "HEAD"], {
    cwd: repositoryRoot,
    stdio: "pipe",
  });

  const sourceArchiveSha256 = sha256(sourceArchivePath);
  const windowsArtifacts = sourceOnly
    ? []
    : findLatestWindowsArtifacts().map(artifact => {
        mkdirSync(windowsDirectory, { recursive: true });
        const targetPath = resolve(windowsDirectory, artifact.fileName);
        copyFileSync(artifact.sourcePath, targetPath);
        return { ...artifact, sha256: sha256(targetPath) };
      });

  writeFileSync(
    resolve(packageDirectory, "README_FIRST_AR.md"),
    createReadMe({ commit, packageVersion, sourceArchiveName, sourceArchiveSha256, windowsArtifacts }),
    "utf8"
  );
  copyFileSync(restoreGuidePath, resolve(packageDirectory, "RESTORE_GUIDE_AR.md"));

  const checksumEntries = [
    { relativePath: sourceArchiveName, sha256: sourceArchiveSha256 },
    ...windowsArtifacts.map(artifact => ({ relativePath: `windows/${artifact.fileName}`, sha256: artifact.sha256 })),
  ];
  writeChecksumManifest(packageDirectory, checksumEntries);

  writeFileSync(
    resolve(packageDirectory, "backup-manifest.json"),
    JSON.stringify(
      {
        application: "TIA Studio",
        createdAtUtc: new Date().toISOString(),
        mode: "manual-free-local-backup",
        gitCommit: commit,
        packageVersion,
        sourceArchive: { fileName: sourceArchiveName, sha256: sourceArchiveSha256 },
        windowsArtifacts: windowsArtifacts.map(({ fileName, kind, sha256: artifactSha256 }) => ({
          fileName: `windows/${fileName}`,
          kind,
          sha256: artifactSha256,
          codeParityWithSourceCommit: "not asserted; rebuild and test to prove parity",
        })),
        sourceRepository: "https://github.com/fanoz1200/TIA-Studio",
        verificationFile: "SHA256SUMS.txt",
        automaticBackup: false,
        externalStorageConfigured: false,
        intentionalExclusions: [
          ".env files and secrets",
          "raw XER/XML/XLSX and customer evidence",
          "customer claim outputs and correspondence",
          "database data, cloud storage files, user accounts, sessions",
          "node_modules and transient build output",
        ],
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  execFileSync("zip", ["-q", "-r", packageArchiveName, packageDirectoryName], {
    cwd: outputDirectory,
    stdio: "pipe",
  });
  const packageArchiveSha256 = sha256(packageArchivePath);
  writeFileSync(resolve(outputDirectory, `${packageArchiveName}.sha256`), `${packageArchiveSha256} *${packageArchiveName}\n`, "utf8");

  console.log(`تم إنشاء حزمة النسخ اليدوي: ${packageDirectory}`);
  console.log(`ZIP: ${packageArchivePath}`);
  console.log(`SHA-256 للـZIP: ${packageArchiveSha256}`);
  console.log(sourceOnly ? "الوضع: مصدر فقط." : `ملفات Windows المضمّنة: ${windowsArtifacts.length}`);
} catch (error) {
  rmSync(packageDirectory, { recursive: true, force: true });
  rmSync(packageArchivePath, { force: true });
  rmSync(`${packageArchivePath}.sha256`, { force: true });
  throw error;
}

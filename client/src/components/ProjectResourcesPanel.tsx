import { useEffect, useState } from "react";
import React from "react";
import { BookOpenCheck, Boxes, Download, FileArchive, FileCode2, FileText, GitBranch, HardDriveDownload, Info, ListChecks, Network, ShieldCheck, WifiOff, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveResourceDownloadHref } from "@/lib/download-links";
import { bilingualUiLabel } from "@/lib/language";
import { ENGLISH_LOCAL_RELEASE, englishEngineGuide, englishMethodologyGuide, englishReleaseChanges, englishSystemLinks, englishWorkflowGuide, engineGuide, FINAL_SOURCE_PACKAGE, GITHUB_SOURCE_REFERENCE, LOCAL_RELEASE, methodologyGuide, releaseChanges, systemLinks, WINDOWS_PORTABLE_DOWNLOAD_URL, WINDOWS_SETUP_DOWNLOAD_URL, WINDOWS_SHA256_DOWNLOAD_URL, workflowGuide } from "@/lib/release-guide";
import { WORKSHOP_NO8_TRAINING_REFERENCE } from "@/lib/workshop-training-reference";
import { useAppLanguage } from "@/contexts/LanguageContext";
import "./project-resources.css";

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const resources = [
  { title: "الدليل التقني الكامل", description: "المعمارية، الجداول، محرك CPM، TIA، الاستيراد، الأدلة، الاختبارات، وطريقة إعادة البناء.", href: "/manus-storage/TIA_STUDIO_COMPLETE_AR_271d4e81.md", icon: FileCode2, kind: "Markdown" },
  { title: "دليل المستخدم وسير العمل", description: "خطوات العمل من ملف P6 إلى Fragnet، الـNotice، الاعتماد، والتقرير مع نقاط تحقق عملية.", href: "/manus-storage/TIA_STUDIO_USER_WORKFLOW_AR_284c5426.md", icon: BookOpenCheck, kind: "Markdown" },
  { title: "مرجع المنهجيات", description: "ارتباط واجهات التطبيق بمنهجية TIA وبروتوكول SCL وحدود النتيجة المهنية.", href: "/manus-storage/TIA_STUDIO_METHODOLOGY_AR_f914a14f.md", icon: FileText, kind: "Markdown" },
  { title: "الذكاء الاصطناعي والتشغيل المحلي", description: "توضيح ما يُحسب محلياً، وما يحتاج حساباً وخدمات تخزين، وما لا يستخدم نموذجاً ذكياً إطلاقاً.", href: "/manus-storage/TIA_STUDIO_AI_AND_LOCAL_USE_AR_edf36f0d.md", icon: Info, kind: "Markdown" },
  { title: "حزمة أمثلة التدريب", description: "برنامج أساس وتحديث وحدث تأخير وملف XER مصغر؛ ابدأ بدليل التشغيل ثم حمّل الملفات للتجربة.", href: "/manus-storage/README_AR_f843ef6f.md", icon: FileArchive, kind: "دليل الأمثلة" },
  { title: "حزمة المصدر النهائية — GitHub main", description: `ZIP نظيف من ${FINAL_SOURCE_PACKAGE.fileCount} ملفاً للمصدر والاختبارات والوثائق، مبني من commit ${FINAL_SOURCE_PACKAGE.commit.slice(0, 8)} وبصمة SHA-256 ${FINAL_SOURCE_PACKAGE.sha256.slice(0, 12)}…. لا يضم XER/XML/XLS/XLSX خاماً أو أدلة/مطالبات أو أسراراً أو media أو node_modules. نزّل ملف البصمة المنفصل من البطاقة التالية للتحقق.`, href: FINAL_SOURCE_PACKAGE.downloadUrl, icon: HardDriveDownload, kind: "ZIP · Final Source Handoff" },
  { title: "تحقق حزمة المصدر النهائية — SHA-256", description: `ملف البصمة لحزمة المصدر النهائية. القيمة المتوقعة: ${FINAL_SOURCE_PACKAGE.sha256}. طابقها قبل فك الضغط أو تسليم المصدر لمطور آخر.`, href: FINAL_SOURCE_PACKAGE.checksumUrl, icon: ShieldCheck, kind: "SHA-256 · Source" },
  { title: "دليل استمرارية المشروع وتسليمه", description: "خطوات حفظ المصدر، استعادة العمل، متابعة التطوير عبر GitHub أو من حزمة المصدر، وحدود ما يلزم اختباره قبل أي إصدار جديد.", href: "/manus-storage/PROJECT_CONTINUITY_AND_HANDOFF_AR_2338b203.md", icon: GitBranch, kind: "Markdown · Continuity" },
  { title: "نسخة سطح المكتب — Windows 1.0.12 Setup (الموصى بها)", description: "مثبّت Windows x64 يتضمن اختيار لغة الواجهة ولغة التقرير، وClaim Console وتدقيق تقاويم/قيود وحالة Update في XER: اضغط Download ثم شغّل ملف Setup مرة واحدة. يضيف اختصاراً في Start ويثبت التطبيق في مكانه الطبيعي؛ لا تحتاج Node.js أو فك ضغط. الحزمة غير موقّعة رقمياً: افحصها قبل التشغيل من هذا الرابط الرسمي فقط.", href: WINDOWS_SETUP_DOWNLOAD_URL, icon: HardDriveDownload, kind: "Windows x64 · Setup" },
  { title: "نسخة سطح المكتب — Windows 1.0.12 المحمولة", description: "ملف EXE مباشر يتضمن اختيار لغة الواجهة ولغة التقرير، وClaim Console وتدقيق تقاويم/قيود وحالة Update في XER ولا يثبت شيئاً ولا يضيف أيقونة Start؛ شغّله من مجلد تختاره أنت. مناسب للتجربة أو عند منع التثبيت في جهاز العمل، لكنه لا يوفر تثبيتاً مركزياً أو تحديثاً تلقائياً.", href: WINDOWS_PORTABLE_DOWNLOAD_URL, icon: HardDriveDownload, kind: "Windows x64 · EXE محمول" },
  { title: "بصمات Windows 1.0.12 — SHA-256", description: "ملف بصمات Setup وPortable. نزّله ثم طابق البصمة قبل التشغيل، ولا تخلط ملفاً من إصدار أو مصدر تنزيل مختلف.", href: WINDOWS_SHA256_DOWNLOAD_URL, icon: ShieldCheck, kind: "SHA-256" },
  { title: "نسخة سطح المكتب — Linux 1.0.7", description: "ملف AppImage واحد لـ Linux x64، ويشمل الحساب المحلي وفحوص الاستيراد وميزات 1.0.7 من دون ملفات P6 أو Excel الأصلية. امنحه صلاحية التنفيذ مرة واحدة، ثم جرّبه على مشروع تدريبي قبل الاستخدام المهني.", href: "/manus-storage/TIA-Studio-1.0.7-Linux-x64_8ef18634.AppImage", icon: HardDriveDownload, kind: "Linux x64 · AppImage" },
];

const examples = [
  { name: "01 — برنامج الأساس", href: "/manus-storage/01-baseline-schedule_1dcca83b.json", type: "JSON" },
  { name: "02 — تحديث بعد الأساسات", href: "/manus-storage/02-update-after-foundation_2683f709.json", type: "JSON" },
  { name: "03 — حدث تأخير الأساسات", href: "/manus-storage/03-foundation-delay-event_6dc05d49.json", type: "JSON" },
  { name: "04 — مورد P6 مصغر", href: "/manus-storage/04-minimal-p6-resource_b6c6c3e0.xer", type: "XER" },
];

const englishResources = [
  { title: "Complete technical guide", description: "Architecture, schedules, the CPM engine, TIA, import, evidence, tests, and the rebuild approach.", kind: "Markdown · Arabic source" },
  { title: "User guide and workflow", description: "The working path from a P6 file to a Fragnet, a Notice, approval, and a report, with practical checkpoints.", kind: "Markdown · Arabic source" },
  { title: "Methodology reference", description: "How the interface relates to the TIA method and SCL Protocol, with the professional limitations of any result.", kind: "Markdown · Arabic source" },
  { title: "AI and local operation", description: "What is calculated locally, what needs account or storage services, and what does not use an AI model at all.", kind: "Markdown · Arabic source" },
  { title: "Training examples package", description: "A baseline, update, delay event, and small XER file. Read the workflow guide first, then download the examples for practice.", kind: "Examples guide · Arabic source" },
  { title: "Final source package — GitHub main", description: `A clean ZIP of ${FINAL_SOURCE_PACKAGE.fileCount} source, test, and documentation files, built from commit ${FINAL_SOURCE_PACKAGE.commit.slice(0, 8)} with SHA-256 ${FINAL_SOURCE_PACKAGE.sha256.slice(0, 12)}…. It excludes raw XER/XML/XLS/XLSX, evidence and claims, secrets, media, node_modules, and build output. Download the separate checksum card to verify it.`, kind: "ZIP · Final source handoff" },
  { title: "Final source package verification — SHA-256", description: `Checksum file for the final source bundle. Expected SHA-256: ${FINAL_SOURCE_PACKAGE.sha256}. Compare it before extracting or handing the source to another developer.`, kind: "SHA-256 · Source" },
  { title: "Project continuity and handover guide", description: "How to preserve the source, restore work, continue through GitHub or the source package, and test a new release.", kind: "Markdown · Arabic source" },
  { title: "Desktop app — Windows 1.0.12 Setup (recommended)", description: "The Windows x64 installer includes interface and report language choices, Claim Console, and XER calendar/constraint/update checks. Download it, then run Setup once. It adds a Start shortcut and needs neither Node.js nor extraction. The package is not digitally signed: verify it before running and download only from this official link.", kind: "Windows x64 · Setup" },
  { title: "Desktop app — Windows 1.0.12 Portable", description: "A direct EXE with interface and report language choices, Claim Console, and XER calendar/constraint/update checks. It does not install anything or add a Start icon. Use it for trial work or where installation is blocked; it does not provide central installation or automatic updates.", kind: "Windows x64 · Portable EXE" },
  { title: "Windows 1.0.12 checksums — SHA-256", description: "Checksums for Setup and Portable. Download the file and compare the checksum before running; do not mix files from different releases or download sources.", kind: "SHA-256" },
  { title: "Desktop app — Linux 1.0.7", description: "A single AppImage for Linux x64 with local calculation, import checks, and the 1.0.7 features, without original P6 or Excel files. Grant execute permission once and test it on a training project before professional use.", kind: "Linux x64 · AppImage" },
] as const;

const englishExamples = [
  "01 — Baseline schedule",
  "02 — Update after foundations",
  "03 — Foundations delay event",
  "04 — Small P6 resource",
] as const;

const resourceCopy = {
  ar: {
    heroEyebrow: "DOCUMENTATION · EXAMPLES · LOCAL USE",
    heroTitle: "مركز المعرفة والتنزيل",
    heroDescription: "كل الأدلة وملفات التدريب محفوظة داخل نسخة المشروع وقابلة للتنزيل. استخدم الأمثلة قبل العمل على برنامج حقيقي، واحتفظ بملفات P6 الأصلية خارج التطبيق كسجل مرجعي.",
    installed: "تم التثبيت",
    installFromBrowser: "تثبيت من المتصفح",
    installTitle: "تثبيت PWA اختياري من المتصفح عند دعمه.",
    fallbackInstallTitle: "المتصفح لا يوفّر تثبيت PWA هنا؛ نزّل ملف Windows Setup بدلاً من ذلك.",
    fallbackInstall: "تحميل Setup لـ Windows",
    localTitle: "وضع الاستخدام المحلي",
    localDescription: "بعد فتح التطبيق عبر اتصال آمن وتشغيله مرة واحدة، يحفظ المتصفح واجهة التشغيل للاستخدام اللاحق. حساب CPM وTIA وقراءة ملفات XER/XML والتقرير تتم داخل المتصفح؛ أما الحسابات والأدلة والاعتمادات المحفوظة فتحتاج اتصالاً وخدمة الخادم. تتوفر أيضاً حزم Windows وLinux للتجربة المحلية؛ لا تُعد بديلاً عن المراجعة المهنية أو اختبار استيراد Primavera على نسخة غير إنتاجية.",
    desktopAria: "تنزيل نسخة الكمبيوتر",
    desktopTitle: "حمّل نسخة الكمبيوتر الآن",
    desktopDescription: "على Windows حمّل Setup أولاً للتثبيت الطبيعي وأيقونة Start. استخدم النسخة المحمولة فقط لو جهازك يمنع التثبيت.",
    setup: "Windows 1.0.12 — Setup",
    portable: "Windows 1.0.12 — محمول",
    releaseEyebrow: "LIVE RELEASE GUIDE",
    releaseTitle: "الدليل الحيّ: كيف يعمل البرنامج من البداية للنهاية؟",
    releaseDescription: "هذا الدليل مضمّن داخل التطبيق، ويرتبط بالإصدار الحالي حتى تعرف بالضبط ما الذي تغير وكيف ينتقل العمل بين الأقسام والمحركات.",
    releaseVersion: "الإصدار",
    launchTitle: "تشغيل محلي بنقرة واحدة",
    methodologyTitle: "المنهجيات: متى نستخدم ماذا؟",
    enginesTitle: "المحركات المختلفة",
    flowTitle: "سير العمل المعتمد",
    linksTitle: "كيف ترتبط الأقسام؟",
    changesTitle: "سجل تغييرات هذا الإصدار",
    changeRule: "قاعدة التحديث: أي تعديل يؤثر على الاستيراد أو CPM أو Fragnet أو الجودة أو التقرير يحدّث هذا الدليل ورقم الإصدار وسجل التغييرات، ثم يعاد الاختبار والبناء قبل إتاحة التنزيل.",
    resourcesAria: "ملفات التوثيق والتنزيل",
    download: "تنزيل",
    examplesEyebrow: "SANDBOX PROJECTS",
    examplesTitle: "ملفات تدريب قابلة للتجربة",
    examplesDescription: "حمّل برنامج الأساس أولاً، ثم استخدم التحديث في تبويب مقارنة التحديثات، وجرّب ملف XER في تبويب البرنامج والتقويم.",
    trainingDescription: "سُجل المثال في قاعدة البيانات كـ metadata خاصة بالمالك. يعرض هذا القسم حقائق مهيأة للتدريب فقط؛ لا ينشر أو يحمّل ملفات P6 أو Excel الأصلية.",
    trainingAria: "ملخص مثال Workshop",
    baseline: "برنامج الأساس",
    postTia: "بعد TIA",
    localDelta: "فرق CPM المحلي",
    activity: "نشاط",
    relationship: "علاقة",
    calendar: "تقويم",
    workingDays: "يوم عمل",
    verification: "حد التحقق:",
    reviewTitle: "قائمة مراجعة P6 قبل الاعتماد",
    boundaryEyebrow: "PROCESSING BOUNDARY",
    boundaryTitle: "هل البرنامج يعتمد على الذكاء الاصطناعي؟",
    boundaryDescription: "لا يعتمد المحرك الحالي على الذكاء الاصطناعي لاتخاذ نتيجة التحليل. حساب الشبكة، المسار الحرج، الـFragnets، التزامن، مقارنة التحديثات، واستيراد P6 هي عمليات برمجية حتمية قابلة للمراجعة. يمكن إضافة مساعد ذكي مستقبلاً لاقتراح صياغة أو فحص شكلي فقط، ولا ينبغي أن يحل محل الحكم المهني أو مستندات العقد.",
  },
  en: {
    heroEyebrow: "DOCUMENTATION · EXAMPLES · LOCAL USE",
    heroTitle: "Knowledge and download center",
    heroDescription: "All guides and training files are preserved with the project and available for download. Use the examples before working on a live schedule, and keep the original P6 files outside the app as reference records.",
    installed: "Installed",
    installFromBrowser: "Install from browser",
    installTitle: "Optional browser PWA installation, where supported.",
    fallbackInstallTitle: "This browser does not offer PWA installation here; download Windows Setup instead.",
    fallbackInstall: "Download Windows Setup",
    localTitle: "Local-use mode",
    localDescription: "After the app is opened over a secure connection and run once, the browser retains the operating interface for later use. CPM and TIA calculations, XER/XML reading, and reporting run in the browser; saved accounts, evidence, and approvals require a connection and server service. Windows and Linux packages are also available for local trial work; they do not replace professional review or a Primavera import test in a non-production copy.",
    desktopAria: "Computer download",
    desktopTitle: "Download the desktop app now",
    desktopDescription: "On Windows, download Setup first for normal installation and a Start icon. Use Portable only where the device blocks installation.",
    setup: "Windows 1.0.12 — Setup",
    portable: "Windows 1.0.12 — Portable",
    releaseEyebrow: "LIVE RELEASE GUIDE",
    releaseTitle: "Live guide: how does the app work end-to-end?",
    releaseDescription: "This guide is embedded in the app and tied to the current release, so you can see what changed and how work moves between sections and engines.",
    releaseVersion: "Release",
    launchTitle: "One-click local launch",
    methodologyTitle: "Methods: when do we use each one?",
    enginesTitle: "The engines",
    flowTitle: "Approved workflow",
    linksTitle: "How do the sections connect?",
    changesTitle: "Changes in this release",
    changeRule: "Update rule: any change affecting import, CPM, Fragnet, quality, or reporting must update this guide, the version number, and the change log, then be tested and built before a download is made available.",
    resourcesAria: "Project resources and downloads",
    download: "Download",
    examplesEyebrow: "SANDBOX PROJECTS",
    examplesTitle: "Training files to try",
    examplesDescription: "Download the baseline first, then use the update in the schedule-comparison tab and try the XER file in the schedule and calendar tab.",
    trainingDescription: "This example is recorded in the database as owner-only metadata. This section shows training-ready facts only; it does not publish or upload original P6 or Excel files.",
    trainingAria: "Workshop example summary",
    baseline: "Baseline schedule",
    postTia: "After TIA",
    localDelta: "Local CPM delta",
    activity: "activities",
    relationship: "relationships",
    calendar: "calendar",
    workingDays: "working days",
    verification: "Verification boundary:",
    reviewTitle: "P6 review checklist before reliance",
    boundaryEyebrow: "PROCESSING BOUNDARY",
    boundaryTitle: "Does the app rely on artificial intelligence?",
    boundaryDescription: "The current engine does not rely on artificial intelligence to reach an analysis result. Network calculation, critical-path analysis, Fragnets, concurrency, update comparison, and P6 import are reviewable deterministic software operations. A future assistant could help with wording or a format check only; it must not replace professional judgment or contract documents.",
  },
} as const;

export function ProjectResourcesPanel({ view }: { view: string }) {
  const { language, direction } = useAppLanguage();
  const bi = (arabic: string, english: string) => bilingualUiLabel(language, arabic, english);
  const [installEvent, setInstallEvent] = useState<DeferredInstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as DeferredInstallPrompt);
    };
    const markInstalled = () => { setInstalled(true); setInstallEvent(null); };
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  if (view !== "resources") return null;

  const requestInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallEvent(null);
  };
  const windowsSetupHref = resolveResourceDownloadHref(resources[8].href);
  const copy = resourceCopy[language];
  const visibleResources = language === "en" ? resources.map((resource, index) => ({ ...resource, ...englishResources[index] })) : resources;
  const visibleExamples = examples.map((example, index) => ({ ...example, name: language === "en" ? englishExamples[index] : example.name }));
  const visibleRelease = language === "en" ? ENGLISH_LOCAL_RELEASE : LOCAL_RELEASE;
  const visibleMethodologyGuide = language === "en" ? englishMethodologyGuide : methodologyGuide;
  const visibleEngineGuide = language === "en" ? englishEngineGuide : engineGuide;
  const visibleWorkflowGuide = language === "en" ? englishWorkflowGuide : workflowGuide;
  const visibleSystemLinks = language === "en" ? englishSystemLinks : systemLinks;
  const visibleReleaseChanges = language === "en" ? englishReleaseChanges : releaseChanges;

  return <div className="view-stack resources-view" dir={direction} aria-label={bi(copy.resourcesAria, resourceCopy.en.resourcesAria)}>
    <section className="page-heading resources-hero">
      <div>
        <p className="eyebrow">{copy.heroEyebrow}</p>
        <h1>{bi(copy.heroTitle, resourceCopy.en.heroTitle)}</h1>
        <p>{copy.heroDescription}</p>
      </div>
      <div className="heading-actions">
        <Button className="run-button" asChild title={bi(copy.fallbackInstallTitle, resourceCopy.en.fallbackInstallTitle)}><a href={windowsSetupHref}><HardDriveDownload size={16} />{bi(copy.fallbackInstall, resourceCopy.en.fallbackInstall)}</a></Button>
      </div>
    </section>

    <section className="local-use-banner">
      <WifiOff size={22} />
      <div><b>{bi(copy.localTitle, resourceCopy.en.localTitle)}</b><p>{copy.localDescription}</p></div>
    </section>

    <section className="desktop-download-quick" aria-label={bi(copy.desktopAria, resourceCopy.en.desktopAria)}>
      <div><HardDriveDownload size={24} /><div><b>{bi(copy.desktopTitle, resourceCopy.en.desktopTitle)}</b><p>{copy.desktopDescription}</p></div></div>
      <div className="desktop-download-quick__actions">
        <a className="desktop-download-quick__primary" href={windowsSetupHref}><Download size={17} />{bi(copy.setup, resourceCopy.en.setup)}</a>
        <a className="desktop-download-quick__secondary" href={resolveResourceDownloadHref(resources[9].href)}><Download size={17} />{bi(copy.portable, resourceCopy.en.portable)}</a>
      </div>
    </section>

    <section className="github-source-card" aria-label={language === "en" ? GITHUB_SOURCE_REFERENCE.englishTitle : GITHUB_SOURCE_REFERENCE.arabicTitle}>
      <GitBranch size={23} aria-hidden="true" />
      <div>
        <span>{language === "en" ? "SOURCE REFERENCE · PUBLIC REPOSITORY" : "مرجع المصدر · مستودع عام"}</span>
        <h2>{language === "en" ? GITHUB_SOURCE_REFERENCE.englishTitle : GITHUB_SOURCE_REFERENCE.arabicTitle}</h2>
        <p>{language === "en" ? GITHUB_SOURCE_REFERENCE.englishDescription : GITHUB_SOURCE_REFERENCE.arabicDescription}</p>
      </div>
      <a href={GITHUB_SOURCE_REFERENCE.repositoryUrl} target="_blank" rel="noreferrer" dir="ltr">GitHub · {GITHUB_SOURCE_REFERENCE.branch} <Download size={15} aria-hidden="true" /></a>
    </section>

    <section id="release-guide" className="panel release-guide" aria-labelledby="release-guide-title">
      <div className="release-guide__heading">
        <div><p className="eyebrow">{copy.releaseEyebrow} · {visibleRelease.version}</p><h2 id="release-guide-title">{bi(copy.releaseTitle, resourceCopy.en.releaseTitle)}</h2><p>{copy.releaseDescription}</p></div>
        <div className="release-stamp"><b>{bi(copy.releaseVersion, resourceCopy.en.releaseVersion)} {visibleRelease.version}</b><span>{visibleRelease.publishedOn}</span><small>{visibleRelease.channel}</small></div>
      </div>
      <div className="release-launcher"><HardDriveDownload size={20} /><div><b>{bi(copy.launchTitle, resourceCopy.en.launchTitle)}</b><p>{visibleRelease.launcher} {language === "en" ? "After download, open the file directly; you do not need to run Node.js or write commands. A protection message may appear because the packages are not digitally signed, so verify the file from the official link before allowing it to run." : "بعد التنزيل افتح الملف مباشرة؛ لا تحتاج إلى تشغيل Node.js أو كتابة أوامر. تظهر أي رسالة حماية لأنها حزم غير موقعة رقمياً؛ افحص الملف من الرابط الرسمي فقط قبل السماح له بالتشغيل."}</p></div></div>
      <div className="guide-card-grid">
        <article><div className="guide-card-title"><BookOpenCheck size={18} /><h3>{bi(copy.methodologyTitle, resourceCopy.en.methodologyTitle)}</h3></div>{visibleMethodologyGuide.map(method => <div className="guide-item" key={method.title}><b>{method.title}</b><p>{method.purpose}</p><small><strong>{language === "en" ? "Used when:" : "يستخدم عندما:"}</strong> {method.useWhen}</small></div>)}</article>
        <article><div className="guide-card-title"><Boxes size={18} /><h3>{bi(copy.enginesTitle, resourceCopy.en.enginesTitle)}</h3></div>{visibleEngineGuide.map(engine => <div className="engine-row" key={engine.name}><b>{engine.name}</b><span><strong>{language === "en" ? "Input:" : "يدخل:"}</strong> {engine.input}</span><span><strong>{language === "en" ? "Output:" : "ينتج:"}</strong> {engine.output}</span></div>)}</article>
      </div>
      <div className="guide-flow-grid">
        <article><div className="guide-card-title"><Workflow size={18} /><h3>{bi(copy.flowTitle, resourceCopy.en.flowTitle)}</h3></div><ol className="live-workflow">{visibleWorkflowGuide.map(step => <li key={step}>{step}</li>)}</ol></article>
        <article><div className="guide-card-title"><Network size={18} /><h3>{bi(copy.linksTitle, resourceCopy.en.linksTitle)}</h3></div><ul className="system-links">{visibleSystemLinks.map(link => <li key={link}>{link}</li>)}</ul></article>
      </div>
      <div className="release-changelog"><div className="guide-card-title"><GitBranch size={18} /><h3>{bi(copy.changesTitle, resourceCopy.en.changesTitle)}</h3></div><ul>{visibleReleaseChanges.map(change => <li key={change}>{change}</li>)}</ul><p><ListChecks size={16} />{copy.changeRule}</p></div>
    </section>

    <section className="resources-grid" aria-label={bi(copy.resourcesAria, resourceCopy.en.resourcesAria)}>
      {visibleResources.map((resource, index) => { const Icon = resource.icon; const href = resolveResourceDownloadHref(resource.href); const isExternal = /^https?:\/\//i.test(href); return <article className="resource-card" key={resource.href}><div className="resource-card__icon"><Icon size={21} /></div><div><span>{resource.kind}</span><h2>{bi(resource.title, englishResources[index].title)}</h2><p>{resource.description}</p></div><a className="resource-download" href={href} download={isExternal ? undefined : true}><Download size={16} />{bi(copy.download, resourceCopy.en.download)}</a></article>; })}
    </section>

    <section className="panel examples-panel">
      <div className="panel-heading"><div><p className="eyebrow">{copy.examplesEyebrow}</p><h2>{bi(copy.examplesTitle, resourceCopy.en.examplesTitle)}</h2><p>{copy.examplesDescription}</p></div></div>
      <div className="example-downloads">{visibleExamples.map((example) => <a key={example.href} href={resolveResourceDownloadHref(example.href)} download><FileArchive size={16} /><span>{example.name}</span><small>{example.type}</small><Download size={15} /></a>)}</div>
    </section>

    <section className="panel workshop-training-reference" aria-labelledby="workshop-training-title">
      <div className="panel-heading"><div><p className="eyebrow">{language === "en" ? "PRIVATE TRAINING REFERENCE · P6 23.12" : "مرجع تدريبي خاص · P6 23.12"}</p><h2 id="workshop-training-title">{WORKSHOP_NO8_TRAINING_REFERENCE.title}</h2><p>{copy.trainingDescription}</p></div><ShieldCheck size={24} /></div>
      <div className="workshop-training-reference__facts" aria-label={copy.trainingAria}>
        <div><span>{bi(copy.baseline, resourceCopy.en.baseline)}</span><b>{WORKSHOP_NO8_TRAINING_REFERENCE.baseline.activities} {bi(copy.activity, resourceCopy.en.activity)} / {WORKSHOP_NO8_TRAINING_REFERENCE.baseline.relationships} {bi(copy.relationship, resourceCopy.en.relationship)}</b><small>{WORKSHOP_NO8_TRAINING_REFERENCE.baseline.wbs} WBS · {WORKSHOP_NO8_TRAINING_REFERENCE.baseline.calendars} {bi(copy.calendar, resourceCopy.en.calendar)}</small></div>
        <div><span>{bi(copy.postTia, resourceCopy.en.postTia)}</span><b>{WORKSHOP_NO8_TRAINING_REFERENCE.postTia.activities} {bi(copy.activity, resourceCopy.en.activity)} / {WORKSHOP_NO8_TRAINING_REFERENCE.postTia.relationships} {bi(copy.relationship, resourceCopy.en.relationship)}</b><small>{WORKSHOP_NO8_TRAINING_REFERENCE.postTia.wbs} WBS · {WORKSHOP_NO8_TRAINING_REFERENCE.postTia.calendars} {bi(copy.calendar, resourceCopy.en.calendar)}</small></div>
        <div><span>{bi(copy.localDelta, resourceCopy.en.localDelta)}</span><b>+{WORKSHOP_NO8_TRAINING_REFERENCE.localEngine.durationDeltaDays} {bi(copy.workingDays, resourceCopy.en.workingDays)}</b><small>{WORKSHOP_NO8_TRAINING_REFERENCE.localEngine.baselineDurationDays} → {WORKSHOP_NO8_TRAINING_REFERENCE.localEngine.postTiaDurationDays} {language === "en" ? "days" : "يوم"}</small></div>
      </div>
      <p className="workshop-training-reference__boundary"><b>{copy.verification}</b> {WORKSHOP_NO8_TRAINING_REFERENCE.status} {language === "en" ? `The Excel declaration records planned completion on ${WORKSHOP_NO8_TRAINING_REFERENCE.excelDeclared.asPlannedCompletion}, completion on ${WORKSHOP_NO8_TRAINING_REFERENCE.excelDeclared.completion}, and a declared cumulative impact of ${WORKSHOP_NO8_TRAINING_REFERENCE.excelDeclared.cumulativeImpactDays} days; this does not replace scheduling results inside Primavera.` : `ملف Excel يبيّن اكتمالاً مخططاً في ${WORKSHOP_NO8_TRAINING_REFERENCE.excelDeclared.asPlannedCompletion} واكتمالاً في ${WORKSHOP_NO8_TRAINING_REFERENCE.excelDeclared.completion} وأثراً تراكمياً معلناً قدره ${WORKSHOP_NO8_TRAINING_REFERENCE.excelDeclared.cumulativeImpactDays} يوماً؛ لا يستبدل ذلك نتيجة الجدولة داخل Primavera.`}</p>
      <div className="workshop-training-reference__review" aria-labelledby="workshop-review-title">
        <div><ListChecks size={18} /><h3 id="workshop-review-title">{bi(copy.reviewTitle, resourceCopy.en.reviewTitle)}</h3></div>
        <p>{WORKSHOP_NO8_TRAINING_REFERENCE.calendarScope}</p>
        <ol>{WORKSHOP_NO8_TRAINING_REFERENCE.manualP6Checks.map((check) => <li key={check}>{check}</li>)}</ol>
      </div>
      <p className="workflow-subtle">{WORKSHOP_NO8_TRAINING_REFERENCE.sourceScope}</p>
    </section>

    <section className="panel resources-boundary">
      <div><p className="eyebrow">{copy.boundaryEyebrow}</p><h2>{bi(copy.boundaryTitle, resourceCopy.en.boundaryTitle)}</h2></div>
      <p><b>{language === "en" ? "The current engine does not rely on artificial intelligence to reach an analysis result." : "لا يعتمد المحرك الحالي على الذكاء الاصطناعي لاتخاذ نتيجة التحليل."}</b> {language === "en" ? "Network calculation, critical-path analysis, Fragnets, concurrency, update comparison, and P6 import are reviewable deterministic software operations. A future assistant could help with wording or a format check only; it must not replace professional judgment or contract documents." : "حساب الشبكة، المسار الحرج، الـFragnets، التزامن، مقارنة التحديثات، واستيراد P6 هي عمليات برمجية حتمية قابلة للمراجعة. يمكن إضافة مساعد ذكي مستقبلاً لاقتراح صياغة أو فحص شكلي فقط، ولا ينبغي أن يحل محل الحكم المهني أو مستندات العقد."}</p>
    </section>
  </div>;
}

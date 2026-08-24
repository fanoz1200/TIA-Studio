import { useEffect, useState } from "react";
import React from "react";
import { BookOpenCheck, Boxes, Download, FileArchive, FileCode2, FileText, GitBranch, HardDriveDownload, Info, ListChecks, Network, ShieldCheck, WifiOff, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveResourceDownloadHref } from "@/lib/download-links";
import { engineGuide, LOCAL_RELEASE, methodologyGuide, releaseChanges, systemLinks, workflowGuide } from "@/lib/release-guide";
import { WORKSHOP_NO8_TRAINING_REFERENCE } from "@/lib/workshop-training-reference";
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
  { title: "حزمة المصدر والاستمرارية — 1.0.7", description: "أرشيف TAR.GZ نظيف من المصدر والأدلة والأمثلة. يشمل تقويم مصر الافتراضي بستة أيام، بوابة الجودة المبكرة، عارض XER وقالب الأحداث المهني. لا يضم ملفات P6 أو Excel الأصلية للمستخدم.", href: "/manus-storage/TIA-Studio-1.0.7-Source.tar_2eb10450.gz", icon: HardDriveDownload, kind: "TAR.GZ · Source + Handoff" },
  { title: "دليل استمرارية المشروع وتسليمه", description: "خطوات حفظ المصدر، استعادة العمل، متابعة التطوير عبر GitHub أو من حزمة المصدر، وحدود ما يلزم اختباره قبل أي إصدار جديد.", href: "/manus-storage/PROJECT_CONTINUITY_AND_HANDOFF_AR_2338b203.md", icon: GitBranch, kind: "Markdown · Continuity" },
  { title: "نسخة سطح المكتب — Windows 1.0.12 Setup (الموصى بها)", description: "مثبّت Windows x64 يتضمن اختيار لغة الواجهة ولغة التقرير، وClaim Console وتدقيق تقاويم/قيود وحالة Update في XER: اضغط Download ثم شغّل ملف Setup مرة واحدة. يضيف اختصاراً في Start ويثبت التطبيق في مكانه الطبيعي؛ لا تحتاج Node.js أو فك ضغط. الحزمة غير موقّعة رقمياً: افحصها قبل التشغيل من هذا الرابط الرسمي فقط.", href: "https://github.com/fanoz1200/TIA-Studio/releases/download/v1.0.12/TIA-Studio-1.0.12-Windows-x64-Setup.exe", icon: HardDriveDownload, kind: "Windows x64 · Setup" },
  { title: "نسخة سطح المكتب — Windows 1.0.12 المحمولة", description: "ملف EXE مباشر يتضمن اختيار لغة الواجهة ولغة التقرير، وClaim Console وتدقيق تقاويم/قيود وحالة Update في XER ولا يثبت شيئاً ولا يضيف أيقونة Start؛ شغّله من مجلد تختاره أنت. مناسب للتجربة أو عند منع التثبيت في جهاز العمل، لكنه لا يوفر تثبيتاً مركزياً أو تحديثاً تلقائياً.", href: "https://github.com/fanoz1200/TIA-Studio/releases/download/v1.0.12/TIA-Studio-1.0.12-Windows-x64-Portable.exe", icon: HardDriveDownload, kind: "Windows x64 · EXE محمول" },
  { title: "بصمات Windows 1.0.12 — SHA-256", description: "ملف بصمات Setup وPortable. نزّله ثم طابق البصمة قبل التشغيل، ولا تخلط ملفاً من إصدار أو مصدر تنزيل مختلف.", href: "https://github.com/fanoz1200/TIA-Studio/releases/download/v1.0.12/TIA-Studio-1.0.12-Windows-x64-SHA256SUMS.txt", icon: ShieldCheck, kind: "SHA-256" },
  { title: "نسخة سطح المكتب — Linux 1.0.7", description: "ملف AppImage واحد لـ Linux x64، ويشمل الحساب المحلي وفحوص الاستيراد وميزات 1.0.7 من دون ملفات P6 أو Excel الأصلية. امنحه صلاحية التنفيذ مرة واحدة، ثم جرّبه على مشروع تدريبي قبل الاستخدام المهني.", href: "/manus-storage/TIA-Studio-1.0.7-Linux-x64_8ef18634.AppImage", icon: HardDriveDownload, kind: "Linux x64 · AppImage" },
];

const examples = [
  { name: "01 — برنامج الأساس", href: "/manus-storage/01-baseline-schedule_1dcca83b.json", type: "JSON" },
  { name: "02 — تحديث بعد الأساسات", href: "/manus-storage/02-update-after-foundation_2683f709.json", type: "JSON" },
  { name: "03 — حدث تأخير الأساسات", href: "/manus-storage/03-foundation-delay-event_6dc05d49.json", type: "JSON" },
  { name: "04 — مورد P6 مصغر", href: "/manus-storage/04-minimal-p6-resource_b6c6c3e0.xer", type: "XER" },
];

export function ProjectResourcesPanel({ view }: { view: string }) {
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
  const windowsSetupHref = resolveResourceDownloadHref(resources[7].href);

  return <div className="view-stack resources-view">
    <section className="page-heading resources-hero">
      <div>
        <p className="eyebrow">DOCUMENTATION · EXAMPLES · LOCAL USE</p>
        <h1>مركز المعرفة والتنزيل</h1>
        <p>كل الأدلة وملفات التدريب محفوظة داخل نسخة المشروع وقابلة للتنزيل. استخدم الأمثلة قبل العمل على برنامج حقيقي، واحتفظ بملفات P6 الأصلية خارج التطبيق كسجل مرجعي.</p>
      </div>
      <div className="heading-actions">
        {installEvent || installed ? (
          <Button className="run-button" disabled={!installEvent || installed} onClick={requestInstall} title="تثبيت PWA اختياري من المتصفح عند دعمه."><HardDriveDownload size={16} />{installed ? "تم التثبيت" : "تثبيت من المتصفح"}</Button>
        ) : (
          <Button className="run-button" asChild title="المتصفح لا يوفّر تثبيت PWA هنا؛ نزّل ملف Windows Setup بدلاً من ذلك."><a href={windowsSetupHref} target="_blank" rel="noreferrer"><HardDriveDownload size={16} />تحميل Setup لـ Windows</a></Button>
        )}
      </div>
    </section>

    <section className="local-use-banner">
      <WifiOff size={22} />
      <div><b>وضع الاستخدام المحلي</b><p>بعد فتح التطبيق عبر اتصال آمن وتشغيله مرة واحدة، يحفظ المتصفح واجهة التشغيل للاستخدام اللاحق. حساب CPM وTIA وقراءة ملفات XER/XML والتقرير تتم داخل المتصفح؛ أما الحسابات والأدلة والاعتمادات المحفوظة فتحتاج اتصالاً وخدمة الخادم. تتوفر أيضاً حزم Windows وLinux للتجربة المحلية؛ لا تُعد بديلاً عن المراجعة المهنية أو اختبار استيراد Primavera على نسخة غير إنتاجية.</p></div>
    </section>

    <section className="desktop-download-quick" aria-label="تنزيل نسخة الكمبيوتر">
      <div><HardDriveDownload size={24} /><div><b>حمّل نسخة الكمبيوتر الآن</b><p>على Windows حمّل Setup أولاً للتثبيت الطبيعي وأيقونة Start. استخدم النسخة المحمولة فقط لو جهازك يمنع التثبيت.</p></div></div>
      <div className="desktop-download-quick__actions">
        <a className="desktop-download-quick__primary" href={windowsSetupHref} target="_blank" rel="noreferrer"><Download size={17} />Windows 1.0.12 — Setup</a>
        <a className="desktop-download-quick__secondary" href={resolveResourceDownloadHref(resources[8].href)} target="_blank" rel="noreferrer"><Download size={17} />Windows 1.0.12 — محمول</a>
      </div>
    </section>

    <section id="release-guide" className="panel release-guide" aria-labelledby="release-guide-title">
      <div className="release-guide__heading">
        <div><p className="eyebrow">LIVE RELEASE GUIDE · {LOCAL_RELEASE.version}</p><h2 id="release-guide-title">الدليل الحيّ: كيف يعمل البرنامج من البداية للنهاية؟</h2><p>هذا الدليل مضمّن داخل التطبيق، ويرتبط بالإصدار الحالي حتى تعرف بالضبط ما الذي تغير وكيف ينتقل العمل بين الأقسام والمحركات.</p></div>
        <div className="release-stamp"><b>الإصدار {LOCAL_RELEASE.version}</b><span>{LOCAL_RELEASE.publishedOn}</span><small>{LOCAL_RELEASE.channel}</small></div>
      </div>
      <div className="release-launcher"><HardDriveDownload size={20} /><div><b>تشغيل محلي بنقرة واحدة</b><p>{LOCAL_RELEASE.launcher} بعد التنزيل افتح الملف مباشرة؛ لا تحتاج إلى تشغيل Node.js أو كتابة أوامر. تظهر أي رسالة حماية لأنها حزم غير موقعة رقمياً؛ افحص الملف من الرابط الرسمي فقط قبل السماح له بالتشغيل.</p></div></div>
      <div className="guide-card-grid">
        <article><div className="guide-card-title"><BookOpenCheck size={18} /><h3>المنهجيات: متى نستخدم ماذا؟</h3></div>{methodologyGuide.map(method => <div className="guide-item" key={method.title}><b>{method.title}</b><p>{method.purpose}</p><small><strong>يستخدم عندما:</strong> {method.useWhen}</small></div>)}</article>
        <article><div className="guide-card-title"><Boxes size={18} /><h3>المحركات المختلفة</h3></div>{engineGuide.map(engine => <div className="engine-row" key={engine.name}><b>{engine.name}</b><span><strong>يدخل:</strong> {engine.input}</span><span><strong>ينتج:</strong> {engine.output}</span></div>)}</article>
      </div>
      <div className="guide-flow-grid">
        <article><div className="guide-card-title"><Workflow size={18} /><h3>سير العمل المعتمد</h3></div><ol className="live-workflow">{workflowGuide.map(step => <li key={step}>{step}</li>)}</ol></article>
        <article><div className="guide-card-title"><Network size={18} /><h3>كيف ترتبط الأقسام؟</h3></div><ul className="system-links">{systemLinks.map(link => <li key={link}>{link}</li>)}</ul></article>
      </div>
      <div className="release-changelog"><div className="guide-card-title"><GitBranch size={18} /><h3>سجل تغييرات هذا الإصدار</h3></div><ul>{releaseChanges.map(change => <li key={change}>{change}</li>)}</ul><p><ListChecks size={16} />قاعدة التحديث: أي تعديل يؤثر على الاستيراد أو CPM أو Fragnet أو الجودة أو التقرير يحدّث هذا الدليل ورقم الإصدار وسجل التغييرات، ثم يعاد الاختبار والبناء قبل إتاحة التنزيل.</p></div>
    </section>

    <section className="resources-grid" aria-label="ملفات التوثيق والتنزيل">
      {resources.map((resource) => { const Icon = resource.icon; const href = resolveResourceDownloadHref(resource.href); const isExternal = /^https?:\/\//i.test(href); return <article className="resource-card" key={resource.href}><div className="resource-card__icon"><Icon size={21} /></div><div><span>{resource.kind}</span><h2>{resource.title}</h2><p>{resource.description}</p></div><a className="resource-download" href={href} download={isExternal ? undefined : true} target={isExternal ? "_blank" : undefined} rel={isExternal ? "noreferrer" : undefined}><Download size={16} />تنزيل</a></article>; })}
    </section>

    <section className="panel examples-panel">
      <div className="panel-heading"><div><p className="eyebrow">SANDBOX PROJECTS</p><h2>ملفات تدريب قابلة للتجربة</h2><p>حمّل برنامج الأساس أولاً، ثم استخدم التحديث في تبويب مقارنة التحديثات، وجرّب ملف XER في تبويب البرنامج والتقويم.</p></div></div>
      <div className="example-downloads">{examples.map((example) => <a key={example.href} href={resolveResourceDownloadHref(example.href)} download><FileArchive size={16} /><span>{example.name}</span><small>{example.type}</small><Download size={15} /></a>)}</div>
    </section>

    <section className="panel workshop-training-reference" aria-labelledby="workshop-training-title">
      <div className="panel-heading"><div><p className="eyebrow">PRIVATE TRAINING REFERENCE · P6 23.12</p><h2 id="workshop-training-title">{WORKSHOP_NO8_TRAINING_REFERENCE.title}</h2><p>سُجل المثال في قاعدة البيانات كـ metadata خاصة بالمالك. يعرض هذا القسم حقائق مهيأة للتدريب فقط؛ لا ينشر أو يحمّل ملفات P6 أو Excel الأصلية.</p></div><ShieldCheck size={24} /></div>
      <div className="workshop-training-reference__facts" aria-label="ملخص مثال Workshop">
        <div><span>برنامج الأساس</span><b>{WORKSHOP_NO8_TRAINING_REFERENCE.baseline.activities} نشاط / {WORKSHOP_NO8_TRAINING_REFERENCE.baseline.relationships} علاقة</b><small>{WORKSHOP_NO8_TRAINING_REFERENCE.baseline.wbs} WBS · {WORKSHOP_NO8_TRAINING_REFERENCE.baseline.calendars} تقويم</small></div>
        <div><span>بعد TIA</span><b>{WORKSHOP_NO8_TRAINING_REFERENCE.postTia.activities} نشاط / {WORKSHOP_NO8_TRAINING_REFERENCE.postTia.relationships} علاقة</b><small>{WORKSHOP_NO8_TRAINING_REFERENCE.postTia.wbs} WBS · {WORKSHOP_NO8_TRAINING_REFERENCE.postTia.calendars} تقويم</small></div>
        <div><span>فرق CPM المحلي</span><b>+{WORKSHOP_NO8_TRAINING_REFERENCE.localEngine.durationDeltaDays} يوم عمل</b><small>{WORKSHOP_NO8_TRAINING_REFERENCE.localEngine.baselineDurationDays} → {WORKSHOP_NO8_TRAINING_REFERENCE.localEngine.postTiaDurationDays} يوم</small></div>
      </div>
      <p className="workshop-training-reference__boundary"><b>حد التحقق:</b> {WORKSHOP_NO8_TRAINING_REFERENCE.status} ملف Excel يبيّن اكتمالاً مخططاً في {WORKSHOP_NO8_TRAINING_REFERENCE.excelDeclared.asPlannedCompletion} واكتمالاً في {WORKSHOP_NO8_TRAINING_REFERENCE.excelDeclared.completion} وأثراً تراكمياً معلناً قدره {WORKSHOP_NO8_TRAINING_REFERENCE.excelDeclared.cumulativeImpactDays} يوماً؛ لا يستبدل ذلك نتيجة الجدولة داخل Primavera.</p>
      <div className="workshop-training-reference__review" aria-labelledby="workshop-review-title">
        <div><ListChecks size={18} /><h3 id="workshop-review-title">قائمة مراجعة P6 قبل الاعتماد</h3></div>
        <p>{WORKSHOP_NO8_TRAINING_REFERENCE.calendarScope}</p>
        <ol>{WORKSHOP_NO8_TRAINING_REFERENCE.manualP6Checks.map((check) => <li key={check}>{check}</li>)}</ol>
      </div>
      <p className="workflow-subtle">{WORKSHOP_NO8_TRAINING_REFERENCE.sourceScope}</p>
    </section>

    <section className="panel resources-boundary">
      <div><p className="eyebrow">PROCESSING BOUNDARY</p><h2>هل البرنامج يعتمد على الذكاء الاصطناعي؟</h2></div>
      <p><b>لا يعتمد المحرك الحالي على الذكاء الاصطناعي لاتخاذ نتيجة التحليل.</b> حساب الشبكة، المسار الحرج، الـFragnets، التزامن، مقارنة التحديثات، واستيراد P6 هي عمليات برمجية حتمية قابلة للمراجعة. يمكن إضافة مساعد ذكي مستقبلاً لاقتراح صياغة أو فحص شكلي فقط، ولا ينبغي أن يحل محل الحكم المهني أو مستندات العقد.</p>
    </section>
  </div>;
}

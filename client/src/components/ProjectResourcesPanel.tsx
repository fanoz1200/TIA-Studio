import { useEffect, useState } from "react";
import React from "react";
import { BookOpenCheck, Download, FileArchive, FileCode2, FileText, HardDriveDownload, Info, ShieldCheck, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  { title: "حزمة مصدر التشغيل المحلي", description: "نسخة ZIP من المصدر والأدلة والأمثلة. فكّها، ثبّت الاعتمادات، ثم اتبع دليل التشغيل المحلي قبل استخدام السجل والأدلة المشتركة.", href: "/manus-storage/tia-studio-source-package_0a28a8d2.zip", icon: HardDriveDownload, kind: "ZIP · Source" },
  { title: "نسخة سطح المكتب — Windows", description: "حزمة محمولة بصيغة ZIP للاختبار على Windows x64. غير موقعة رقمياً؛ افحصها ببرنامج الحماية، ثم ابدأ بمشروع تدريبي مصطنع قبل أي ملف حقيقي.", href: "/manus-storage/TIA-Studio-1.0.0-windows-x64-portable_a9431577.zip", icon: HardDriveDownload, kind: "Windows x64 · Portable" },
  { title: "نسخة سطح المكتب — Linux", description: "حزمة AppImage للاختبار على Linux x64. امنح الملف صلاحية التنفيذ، واستخدم مشروعاً تدريبياً للتحقق من الاستيراد والتحليل والتقرير قبل الاستخدام المهني.", href: "/manus-storage/TIA-Studio-1.0.0-linux-x64_8ac9e8fe.AppImage", icon: HardDriveDownload, kind: "Linux x64 · AppImage" },
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

  return <div className="view-stack resources-view">
    <section className="page-heading resources-hero">
      <div>
        <p className="eyebrow">DOCUMENTATION · EXAMPLES · LOCAL USE</p>
        <h1>مركز المعرفة والتنزيل</h1>
        <p>كل الأدلة وملفات التدريب محفوظة داخل نسخة المشروع وقابلة للتنزيل. استخدم الأمثلة قبل العمل على برنامج حقيقي، واحتفظ بملفات P6 الأصلية خارج التطبيق كسجل مرجعي.</p>
      </div>
      <div className="heading-actions">
        <Button className="run-button" disabled={!installEvent || installed} onClick={requestInstall} title="يظهر الزر عند دعم المتصفح لتثبيت التطبيق."><HardDriveDownload size={16} />{installed ? "تم التثبيت" : installEvent ? "تثبيت على الجهاز" : "التثبيت من المتصفح"}</Button>
      </div>
    </section>

    <section className="local-use-banner">
      <WifiOff size={22} />
      <div><b>وضع الاستخدام المحلي</b><p>بعد فتح التطبيق عبر اتصال آمن وتشغيله مرة واحدة، يحفظ المتصفح واجهة التشغيل للاستخدام اللاحق. حساب CPM وTIA وقراءة ملفات XER/XML والتقرير تتم داخل المتصفح؛ أما الحسابات والأدلة والاعتمادات المحفوظة فتحتاج اتصالاً وخدمة الخادم. تتوفر أيضاً حزم Windows وLinux للتجربة المحلية؛ لا تُعد بديلاً عن المراجعة المهنية أو اختبار استيراد Primavera على نسخة غير إنتاجية.</p></div>
    </section>

    <section className="resources-grid" aria-label="ملفات التوثيق والتنزيل">
      {resources.map((resource) => { const Icon = resource.icon; return <article className="resource-card" key={resource.href}><div className="resource-card__icon"><Icon size={21} /></div><div><span>{resource.kind}</span><h2>{resource.title}</h2><p>{resource.description}</p></div><a className="resource-download" href={resource.href} download><Download size={16} />تنزيل</a></article>; })}
    </section>

    <section className="panel examples-panel">
      <div className="panel-heading"><div><p className="eyebrow">SANDBOX PROJECTS</p><h2>ملفات تدريب قابلة للتجربة</h2><p>حمّل برنامج الأساس أولاً، ثم استخدم التحديث في تبويب مقارنة التحديثات، وجرّب ملف XER في تبويب البرنامج والتقويم.</p></div></div>
      <div className="example-downloads">{examples.map((example) => <a key={example.href} href={example.href} download><FileArchive size={16} /><span>{example.name}</span><small>{example.type}</small><Download size={15} /></a>)}</div>
    </section>

    <section className="panel resources-boundary">
      <div><p className="eyebrow">PROCESSING BOUNDARY</p><h2>هل البرنامج يعتمد على الذكاء الاصطناعي؟</h2></div>
      <p><b>لا يعتمد المحرك الحالي على الذكاء الاصطناعي لاتخاذ نتيجة التحليل.</b> حساب الشبكة، المسار الحرج، الـFragnets، التزامن، مقارنة التحديثات، واستيراد P6 هي عمليات برمجية حتمية قابلة للمراجعة. يمكن إضافة مساعد ذكي مستقبلاً لاقتراح صياغة أو فحص شكلي فقط، ولا ينبغي أن يحل محل الحكم المهني أو مستندات العقد.</p>
    </section>
  </div>;
}

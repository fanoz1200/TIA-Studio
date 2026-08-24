import React, { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  CircleHelp,
  FileSpreadsheet,
  FileText,
  Flag,
  Layers3,
  Play,
  Route,
  ScanSearch,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import "./user-guide.css";

type GuideView =
  | "guided"
  | "schedule"
  | "issues"
  | "event"
  | "analysis"
  | "report"
  | "overview"
  | "quality"
  | "windows"
  | "financial"
  | "notices"
  | "review"
  | "members"
  | "compare"
  | "resources"
  | "learning";

type Props = {
  view: string;
  onNavigate: (view: GuideView) => void;
};

const steps: {
  id: number;
  title: string;
  view: GuideView;
  action: string;
  before: string;
  result: string;
  icon: typeof Play;
  screen: string;
  imageSrc: string;
}[] = [
  {
    id: 1,
    title: "ابدأ وعرّف الحالة",
    view: "guided",
    action: "افتح بداية التحليل",
    before: "حدد: عندك واقعة واحدة ولا سجل وقائع؟",
    result: "هتظهرلك رحلة 7 خطوات مرقمة، مش مطلوب تملأ كل حاجة مرة واحدة.",
    icon: Play,
    screen: "اختار المسار: تحليل مباشر لواقعة واحدة، أو سجل القضايا لو عندك كذا واقعة.",
    imageSrc: "/manus-storage/step-1-start_96400d27.png",
  },
  {
    id: 2,
    title: "ارفع نسخ البرنامج",
    view: "schedule",
    action: "افتح رفع P6",
    before: "جهّز Baseline المعتمد وUpdate قريب قبل تاريخ الحدث.",
    result: "البرنامج يقرأ XER أو P6 XML للقراءة فقط؛ الأصل بتاعك ما بيتغيرش.",
    icon: Layers3,
    screen: "بعد الرفع راجع عدد الأنشطة والعلاقات والتقويم وData Date قبل ما تكمل.",
    imageSrc: "/manus-storage/step-2-upload-p6_9aad4a23.png",
  },
  {
    id: 3,
    title: "سجّل الواقعة والدليل",
    view: "issues",
    action: "افتح سجل الواقعة",
    before: "اكتب تاريخ الحدث، المدة المقترحة، السبب، النشاط المتأثر، والمستندات اللي عندك.",
    result: "هتعرف إيه ناقص قبل زر الحفظ أو تجهيز الـ Fragnet؛ الزر مش هيشتغل ناقص بيانات من غير ما يقولك السبب.",
    icon: Flag,
    screen: "اختار العلاقة المنطقية من البرنامج المرفوع، مش من قائمة ثابتة؛ كده الاقتراح يبقى مربوط بشبكتك أنت.",
    imageSrc: "/manus-storage/step-3-issue_917541c8.png",
  },
  {
    id: 4,
    title: "راجع التقسيم وشغّل TIA",
    view: "event",
    action: "افتح نمذجة الحدث",
    before: "راجع النشاط المتأثر قبل / أثناء / بعد الحدث، والعلاقات اللي هتتغير.",
    result: "البرنامج يعمل نسخة تحليل محلية ويحسب فرق الإكمال. ده قياس زمني، مش حكم قانوني تلقائي.",
    icon: Route,
    screen: "لو الزر طالب بيانات، ارجع للخطوة اللي مكتوبة في التنبيه بدل ما تعيد البداية كلها.",
    imageSrc: "/manus-storage/step-4-fragnet_48dec003.png",
  },
  {
    id: 5,
    title: "افهم النتيجة",
    view: "analysis",
    action: "افتح النتيجة",
    before: "بص على تاريخ الإكمال قبل وبعد، المسار الحرج، التقويم، والتحذيرات.",
    result: "الفرق بالأيام هو نتيجة نموذج CPM المحلي. راجعه في P6 قبل استخدامه في مطالبة رسمية.",
    icon: ScanSearch,
    screen: "استخدم الجداول الجديدة للبحث والفلترة والترتيب بدل ما تدور وسط الأنشطة والعلاقات يدوي.",
    imageSrc: "/manus-storage/step-5-result_bad722a8.png",
  },
  {
    id: 6,
    title: "جهّز مستندات المطالبة",
    view: "report",
    action: "افتح التقرير",
    before: "راجع العناوين والأدلة والنتيجة. ما تعتمدش نص تلقائي من غير مراجعة العقد والوقائع.",
    result: "تقدر تنزّل Word أو PDF أو Excel. الـExcel فيه ملخص وأنشطة وعلاقات وأحداث وفحص جودة.",
    icon: FileText,
    screen: "التقرير يطلع Narrative فني قابل للتعديل، مش Notice أو Full Claim قانوني نهائي لوحده.",
    imageSrc: "/manus-storage/step-6-report_d3ec98bd.png",
  },
];

const documents = [
  {
    title: "Notice of Claim",
    view: "notices" as GuideView,
    text: "افتح سجل Notices بعد ما تسجل الواقعة. اكتب الإشعار في ميعاده حسب العقد واربطه بالحدث. البرنامج يساعدك في التنظيم، لكن لازم أنت تراجع المهلة والنص مع العقد.",
  },
  {
    title: "Delay Analysis Narrative",
    view: "report" as GuideView,
    text: "ده السرد الفني: إيه اللي حصل، أنهي نسخة برنامج استخدمت، إزاي اتعمل الـ Fragnet، والنتيجة والحدود. راجعه وعدّل صياغته قبل التصدير.",
  },
  {
    title: "Full Claim",
    view: "review" as GuideView,
    text: "ملف كامل يجمع الإشعارات والعقد والمراسلات والأدلة والسرد ونتيجة التحليل والأثر المالي. المنصة ترتّب أجزاء منه، لكن ما ينفعش تعتبره مطالبة قانونية مكتملة من غير مراجعة مختص وعقد المشروع.",
  },
];

const workspaceScreens: { title: string; view: GuideView; note: string; imageSrc: string }[] = [
  { title: "لوحة المتابعة", view: "overview", note: "صورة سريعة عن حالة المشروع والرحلة الحالية.", imageSrc: "/manus-storage/screen-overview_49c0b7a2.png" },
  { title: "فحص جودة البرنامج", view: "quality", note: "شوف المشاكل التي لازم تتراجع قبل الحساب.", imageSrc: "/manus-storage/screen-quality_8f0b8c00.png" },
  { title: "نوافذ وتزامن", view: "windows", note: "لو عندك أحداث متتالية أو تأخيرات متزامنة.", imageSrc: "/manus-storage/screen-windows_e397ee74.png" },
  { title: "الأثر المالي", view: "financial", note: "سجل موارد وتكاليف للمراجعة، مش حكم استحقاق تلقائي.", imageSrc: "/manus-storage/screen-financial_9c86aa6f.png" },
  { title: "سجل Notices", view: "notices", note: "جهّز إشعار مرتبط بالواقعة وراجع مهلة العقد بنفسك.", imageSrc: "/manus-storage/screen-notices_6cdd8a1b.png" },
  { title: "الاعتماد الإلكتروني", view: "review", note: "رتّب مراجعة فريقك قبل إصدار الملف النهائي.", imageSrc: "/manus-storage/screen-review_f87685dd.png" },
  { title: "أعضاء المشروع", view: "members", note: "دعوات وصلاحيات الفريق؛ دي خطوة إدارية اختيارية.", imageSrc: "/manus-storage/screen-members_5cd53c87.png" },
  { title: "مقارنة التحديثات", view: "compare", note: "قارن Baseline وUpdates بعد ما ترفع النسخ.", imageSrc: "/manus-storage/screen-compare_7de41af3.png" },
  { title: "الأدلة والملفات", view: "resources", note: "مكان التحميلات والأدلة ونسخة الكمبيوتر.", imageSrc: "/manus-storage/screen-resources_85759c42.png" },
  { title: "التدريب والشرح", view: "learning", note: "ابدأ بأسئلة شجرة القرار أو ابحث عن الحالة.", imageSrc: "/manus-storage/screen-learning_c556d3a3.png" },
];

function GuideShot({ number, title, imageSrc }: { number: number; title: string; imageSrc: string }) {
  return (
    <figure className="guide-shot" aria-label={`لقطة توضيحية للخطوة ${number}: ${title}`}>
      <img src={imageSrc} alt={`لقطة فعلية من TIA Studio: ${title}`} loading="lazy" />
      <figcaption>لقطة فعلية من داخل البرنامج — الشاشة اللي هتدخلها في الخطوة دي</figcaption>
    </figure>
  );
}

export function UserGuidePanel({ view, onNavigate }: Props) {
  const [activeStep, setActiveStep] = useState(0);
  if (view !== "guide") return null;

  const current = steps[activeStep];
  const Icon = current.icon;

  return (
    <section className="user-guide" dir="rtl">
      <header className="user-guide__hero">
        <div>
          <Badge>دليل استخدام بالصور</Badge>
          <h1>امشي معايا خطوة خطوة</h1>
          <p>دي خريطة استخدام البرنامج من أول ملف P6 لحد التقرير. كل زر تحت بيفتح الشاشة الحقيقية، ومكتوب قبله إيه اللي تجهزه وبعده إيه المفروض يطلع.</p>
        </div>
        <div className="user-guide__hero-icon"><CircleHelp size={36} /></div>
      </header>

      <section className="guide-start-card">
        <div><Sparkles size={22} /><div><b>لو دي أول مرة ليك</b><p>ابدأ بالرحلة المرقمة. ما تدخلش على Fragnet أو التقرير قبل ما ترفع النسخ وتسجل الواقعة.</p></div></div>
        <Button onClick={() => onNavigate("guided")}><Play size={16} fill="currentColor" />ابدأ حالة تدريبية</Button>
      </section>

      <section className="guide-layout" aria-label="خطوات استخدام TIA Studio">
        <nav className="guide-step-list" aria-label="خطوات الدليل">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            return <button type="button" key={step.id} className={index === activeStep ? "is-active" : ""} onClick={() => setActiveStep(index)} aria-pressed={index === activeStep}>
              <span>{step.id}</span><div><b>{step.title}</b><small>{step.action}</small></div><StepIcon size={17} />
            </button>;
          })}
        </nav>
        <article className="guide-step-detail" aria-live="polite">
          <div className="guide-step-detail__heading"><span><Icon size={20} /></span><div><p>الخطوة {current.id} من {steps.length}</p><h2>{current.title}</h2></div></div>
          <GuideShot number={current.id} title={current.title} imageSrc={current.imageSrc} />
          <div className="guide-what-grid"><section><b>قبل ما تدوس</b><p>{current.before}</p></section><section><b>هتلاقي إيه بعد كده</b><p>{current.result}</p></section></div>
          <div className="guide-step-detail__actions"><Button onClick={() => onNavigate(current.view)}>{current.action}<ArrowLeft size={16} /></Button><Button variant="outline" disabled={activeStep === steps.length - 1} onClick={() => setActiveStep(index => Math.min(index + 1, steps.length - 1))}>الخطوة اللي بعدها</Button></div>
        </article>
      </section>

      <section className="guide-example">
        <div><p className="eyebrow">مثال سريع: تأخير اعتماد رسم</p><h2>عندي اعتماد متأخر.. أعمل إيه؟</h2><p>١) ارفع Baseline وUpdate قبل يوم التأخير. ٢) سجّل تاريخ الطلب وتاريخ الاعتماد والمراسلات. ٣) اختار النشاط المتأثر وعلاقته. ٤) راجع Fragnet. ٥) شغّل TIA واقرأ فرق الإكمال. ٦) اكتب السرد الفني ونزّله مع Excel.</p></div>
        <div className="guide-example__result"><CheckCircle2 size={22} /><b>الناتج اللي تستهدفه</b><span>فرق زمني موثّق + سجل أدلة + Narrative قابل للمراجعة</span></div>
      </section>

      <section className="guide-workspace-map" aria-label="خريطة نوافذ البرنامج">
        <div><p className="eyebrow">كل نافذة بتعمل إيه؟</p><h2>خريطة البرنامج بالصور</h2><p>دوس على أي بطاقة عشان تفتح الشاشة الأصلية. لو لسه في البداية، امشِ بالخطوات الستة اللي فوق الأول.</p></div>
        <div className="guide-workspace-grid">{workspaceScreens.map(screen => <article key={screen.view}><button type="button" onClick={() => onNavigate(screen.view)} aria-label={`افتح ${screen.title}`}><img src={screen.imageSrc} alt={`لقطة فعلية من TIA Studio: ${screen.title}`} loading="lazy" /><span>افتح الشاشة <ArrowLeft size={14} /></span></button><h3>{screen.title}</h3><p>{screen.note}</p></article>)}</div>
      </section>

      <section className="guide-documents"><div><p className="eyebrow">بعد النتيجة</p><h2>أنهي مستند أعمله من جوه البرنامج؟</h2></div><div className="guide-document-grid">{documents.map(document => <article key={document.title}><FileSpreadsheet size={19} /><h3>{document.title}</h3><p>{document.text}</p><Button variant="outline" onClick={() => onNavigate(document.view)}>افتح المسار <ArrowLeft size={15} /></Button></article>)}</div></section>
    </section>
  );
}

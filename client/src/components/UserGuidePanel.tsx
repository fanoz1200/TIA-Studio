import React, { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
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
import { useAppLanguage } from "@/contexts/LanguageContext";
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

const englishStepCopy: Record<number, Pick<(typeof steps)[number], "title" | "action" | "before" | "result">> = {
  1: { title: "Start and define the case", action: "Open analysis start", before: "Decide whether you have one event or an issue log.", result: "You will see a numbered seven-step route; you do not need to complete everything at once." },
  2: { title: "Upload the programme versions", action: "Open P6 upload", before: "Prepare the approved Baseline and an Update close to the event date.", result: "The app reads XER or P6 XML locally and read-only; it does not alter your source file." },
  3: { title: "Record the event and evidence", action: "Open issue log", before: "Enter the event date, proposed duration, cause, affected activity, and available documents.", result: "You can see what is missing before saving or preparing the Fragnet." },
  4: { title: "Review the split and run TIA", action: "Open event modelling", before: "Review the affected activity before, during, and after the event, plus the links that change.", result: "The app creates a local analysis copy and measures completion difference; it is not an automatic legal decision." },
  5: { title: "Understand the result", action: "Open result", before: "Review completion before and after, the critical path, calendar, and warnings.", result: "The day difference is a local CPM model output; review it in P6 before a formal claim." },
  6: { title: "Prepare claim documents", action: "Open report", before: "Review titles, evidence, and results. Do not rely on generated wording without contract and fact review.", result: "You can download Word, PDF, or Excel; Excel includes summaries, activities, relationships, events, and quality checks." },
};

const englishWorkspaceCopy: Partial<Record<GuideView, Pick<(typeof workspaceScreens)[number], "title" | "note">>> = {
  overview: { title: "Project overview", note: "A quick picture of the project status and current route." },
  quality: { title: "Schedule quality", note: "Review issues that need attention before calculation." },
  windows: { title: "Windows and concurrency", note: "For sequential events or concurrent delays." },
  financial: { title: "Financial impact", note: "Resources and costs for review, not an automatic entitlement decision." },
  notices: { title: "Notice register", note: "Prepare an event-linked notice and review the contractual deadline yourself." },
  review: { title: "Electronic review", note: "Organise team review before issuing the final file." },
  members: { title: "Project members", note: "Team invitations and permissions; this is an optional administrative step." },
  compare: { title: "Update comparison", note: "Compare the Baseline and Updates after uploading versions." },
  resources: { title: "Evidence and files", note: "Downloads, guidance, and the local desktop version." },
  learning: { title: "Learning and guidance", note: "Start with decision-tree questions or search the case library." },
};

const englishDocumentCopy: Partial<Record<GuideView, Pick<(typeof documents)[number], "title" | "text">>> = {
  notices: { title: "Notice of Claim", text: "Open the Notice register after recording the event. Draft the notice within the contractual deadline and link it to the event. The app helps organise the record, but you must review the deadline and wording against the contract." },
  report: { title: "Delay Analysis Narrative", text: "This is the technical narrative: what happened, which programme version was used, how the Fragnet was developed, the result, and its limits. Review and edit the wording before export." },
  review: { title: "Full Claim", text: "A complete file bringing together notices, contract records, correspondence, evidence, the narrative, analysis results, and financial impact. The app organises parts of it, but it is not a complete legal claim without specialist and project-contract review." },
};

type GuideCopy = {
  badge: string;
  heading: string;
  intro: string;
  firstTime: string;
  firstTimeHint: string;
  startTraining: string;
  routeAria: string;
  stepsAria: string;
  step: string;
  of: string;
  prepare: string;
  after: string;
  next: string;
  exampleEyebrow: string;
  exampleTitle: string;
  exampleBody: string;
  target: string;
  targetBody: string;
  mapEyebrow: string;
  mapTitle: string;
  mapBody: string;
  openScreen: string;
  shotAria: string;
  shotCaption: string;
  documentsEyebrow: string;
  documentsTitle: string;
  openRoute: string;
};

const guideCopy: Record<"ar" | "en", GuideCopy> = {
  ar: {
    badge: "دليل استخدام بالصور", heading: "امشي معايا خطوة خطوة", intro: "دي خريطة استخدام البرنامج من أول ملف P6 لحد التقرير. كل زر تحت بيفتح الشاشة الحقيقية، ومكتوب قبله إيه اللي تجهزه وبعده إيه المفروض يطلع.", firstTime: "لو دي أول مرة ليك", firstTimeHint: "ابدأ بالرحلة المرقمة. ما تدخلش على Fragnet أو التقرير قبل ما ترفع النسخ وتسجل الواقعة.", startTraining: "ابدأ حالة تدريبية", routeAria: "خطوات استخدام TIA Studio", stepsAria: "خطوات الدليل", step: "الخطوة", of: "من", prepare: "قبل ما تدوس", after: "هتلاقي إيه بعد كده", next: "الخطوة اللي بعدها", exampleEyebrow: "مثال سريع: تأخير اعتماد رسم", exampleTitle: "عندي اعتماد متأخر.. أعمل إيه؟", exampleBody: "١) ارفع Baseline وUpdate قبل يوم التأخير. ٢) سجّل تاريخ الطلب وتاريخ الاعتماد والمراسلات. ٣) اختار النشاط المتأثر وعلاقته. ٤) راجع Fragnet. ٥) شغّل TIA واقرأ فرق الإكمال. ٦) اكتب السرد الفني ونزّله مع Excel.", target: "الناتج اللي تستهدفه", targetBody: "فرق زمني موثّق + سجل أدلة + Narrative قابل للمراجعة", mapEyebrow: "كل نافذة بتعمل إيه؟", mapTitle: "خريطة البرنامج بالصور", mapBody: "دوس على أي بطاقة عشان تفتح الشاشة الأصلية. لو لسه في البداية، امشِ بالخطوات الستة اللي فوق الأول.", openScreen: "افتح الشاشة", shotAria: "لقطة توضيحية للخطوة", shotCaption: "لقطة فعلية من داخل البرنامج — الشاشة اللي هتدخلها في الخطوة دي", documentsEyebrow: "بعد النتيجة", documentsTitle: "أنهي مستند أعمله من جوه البرنامج؟", openRoute: "افتح المسار",
  },
  en: {
    badge: "Illustrated user guide", heading: "Follow the route step by step", intro: "This is the route through the app—from the P6 file to the report. Each button opens the real screen and explains what to prepare and what to expect.", firstTime: "If this is your first time", firstTimeHint: "Start with the numbered route. Do not go to Fragnet or the report before uploading versions and recording the event.", startTraining: "Start a training case", routeAria: "TIA Studio usage steps", stepsAria: "Guide steps", step: "Step", of: "of", prepare: "Prepare before opening", after: "What comes next", next: "Next step", exampleEyebrow: "Quick example: delayed drawing approval", exampleTitle: "I have a late approval—what should I do?", exampleBody: "1) Upload the Baseline and an Update before the delay date. 2) Record the request, approval dates, and correspondence. 3) Select the affected activity and link. 4) Review the Fragnet. 5) Run TIA and read the completion difference. 6) Write the technical narrative and download it with Excel.", target: "Target output", targetBody: "Documented time difference + evidence register + reviewable Narrative", mapEyebrow: "What does each screen do?", mapTitle: "Illustrated workspace map", mapBody: "Select any card to open its original screen. If you are just starting, follow the six steps above first.", openScreen: "Open screen", shotAria: "Illustrative screenshot for step", shotCaption: "Actual in-app screenshot — the screen opened at this step", documentsEyebrow: "After the result", documentsTitle: "Which document should I prepare in the app?", openRoute: "Open route",
  },
};

function GuideShot({ number, title, imageSrc, copy }: { number: number; title: string; imageSrc: string; copy: GuideCopy }) {
  return (
    <figure className="guide-shot" aria-label={`${copy.shotAria} ${number}: ${title}`}>
      <img src={imageSrc} alt={`${copy.shotCaption}: ${title}`} loading="lazy" />
      <figcaption>{copy.shotCaption}</figcaption>
    </figure>
  );
}

export function UserGuidePanel({ view, onNavigate }: Props) {
  const { language, direction } = useAppLanguage();
  const [activeStep, setActiveStep] = useState(0);
  if (view !== "guide") return null;

  const copy = guideCopy[language];
  const localizedSteps = language === "en" ? steps.map(step => ({ ...step, ...englishStepCopy[step.id] })) : steps;
  const localizedWorkspace = language === "en" ? workspaceScreens.map(screen => ({ ...screen, ...englishWorkspaceCopy[screen.view] })) : workspaceScreens;
  const localizedDocuments = language === "en" ? documents.map(document => ({ ...document, ...englishDocumentCopy[document.view] })) : documents;
  const current = localizedSteps[activeStep];
  const Icon = current.icon;
  const NavArrow = direction === "rtl" ? ArrowLeft : ArrowRight;

  return (
    <section className="user-guide" dir={direction} aria-label={copy.heading}>
      <header className="user-guide__hero">
        <div>
          <Badge>{copy.badge}</Badge>
          <h1>{copy.heading}</h1>
          <p>{copy.intro}</p>
        </div>
        <div className="user-guide__hero-icon"><CircleHelp size={36} /></div>
      </header>

      <section className="guide-start-card">
        <div><Sparkles size={22} /><div><b>{copy.firstTime}</b><p>{copy.firstTimeHint}</p></div></div>
        <Button onClick={() => onNavigate("guided")}><Play size={16} fill="currentColor" />{copy.startTraining}</Button>
      </section>

      <section className="guide-layout" aria-label={copy.routeAria}>
        <nav className="guide-step-list" aria-label={copy.stepsAria}>
          {localizedSteps.map((step, index) => {
            const StepIcon = step.icon;
            return <button type="button" key={step.id} className={index === activeStep ? "is-active" : ""} onClick={() => setActiveStep(index)} aria-pressed={index === activeStep}>
              <span>{step.id}</span><div><b>{step.title}</b><small>{step.action}</small></div><StepIcon size={17} />
            </button>;
          })}
        </nav>
        <article className="guide-step-detail" aria-live="polite">
          <div className="guide-step-detail__heading"><span><Icon size={20} /></span><div><p>{copy.step} {current.id} {copy.of} {localizedSteps.length}</p><h2>{current.title}</h2></div></div>
          <GuideShot number={current.id} title={current.title} imageSrc={current.imageSrc} copy={copy} />
          <div className="guide-what-grid"><section><b>{copy.prepare}</b><p>{current.before}</p></section><section><b>{copy.after}</b><p>{current.result}</p></section></div>
          <div className="guide-step-detail__actions"><Button onClick={() => onNavigate(current.view)}>{current.action}<NavArrow size={16} /></Button><Button variant="outline" disabled={activeStep === localizedSteps.length - 1} onClick={() => setActiveStep(index => Math.min(index + 1, localizedSteps.length - 1))}>{copy.next}</Button></div>
        </article>
      </section>

      <section className="guide-example">
        <div><p className="eyebrow">{copy.exampleEyebrow}</p><h2>{copy.exampleTitle}</h2><p>{copy.exampleBody}</p></div>
        <div className="guide-example__result"><CheckCircle2 size={22} /><b>{copy.target}</b><span>{copy.targetBody}</span></div>
      </section>

      <section className="guide-workspace-map" aria-label={copy.mapTitle}>
        <div><p className="eyebrow">{copy.mapEyebrow}</p><h2>{copy.mapTitle}</h2><p>{copy.mapBody}</p></div>
        <div className="guide-workspace-grid">{localizedWorkspace.map(screen => <article key={screen.view}><button type="button" onClick={() => onNavigate(screen.view)} aria-label={`${copy.openScreen} ${screen.title}`}><img src={screen.imageSrc} alt={`${copy.shotCaption}: ${screen.title}`} loading="lazy" /><span>{copy.openScreen} <NavArrow size={14} /></span></button><h3>{screen.title}</h3><p>{screen.note}</p></article>)}</div>
      </section>

      <section className="guide-documents"><div><p className="eyebrow">{copy.documentsEyebrow}</p><h2>{copy.documentsTitle}</h2></div><div className="guide-document-grid">{localizedDocuments.map(document => <article key={document.title}><FileSpreadsheet size={19} /><h3>{document.title}</h3><p>{document.text}</p><Button variant="outline" onClick={() => onNavigate(document.view)}>{copy.openRoute} <NavArrow size={15} /></Button></article>)}</div></section>
    </section>
  );
}

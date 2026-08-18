import React, { useMemo } from "react";
import { ArrowLeft, BookOpenCheck, CheckCircle2, ClipboardList, FileCheck2, GitBranch, PlayCircle, ShieldCheck, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Schedule } from "@/lib/cpm";
import type { XerImportSummary } from "@/lib/xer";
import { buildP6ReadinessGate } from "@/lib/tia-readiness";
import "./guided-analysis.css";

type JourneyPath = "issue" | "direct" | null;

const steps = [
  ["اختر المسار", "سجل قضايا أو تحليل مباشر"],
  ["استيراد وفحص P6", "قراءة XER ومراجعة الفجوات"],
  ["تحديد الحدث", "التاريخ والعلاقة والنشاط المتأثر"],
  ["اعتماد النموذج", "Pre → Event → Post"],
  ["حساب النتيجة", "Post-TIA والسرد الفني"],
] as const;

export function GuidedAnalysisPanel({
  schedule, summary, step, journeyPath, approvedP6Gate, onP6GateApprovalChange, onJourneyPath, onStepChange, onNavigate,
}: {
  schedule: Schedule;
  summary: XerImportSummary | null;
  step: number;
  journeyPath: JourneyPath;
  approvedP6Gate: boolean;
  onP6GateApprovalChange: (approved: boolean) => void;
  onJourneyPath: (path: Exclude<JourneyPath, null>) => void;
  onStepChange: (step: number) => void;
  onNavigate: (view: "schedule" | "issues" | "event" | "analysis" | "learning") => void;
}) {
  const gate = useMemo(() => buildP6ReadinessGate(schedule, summary), [schedule, summary]);
  const [preTiaApproved, setPreTiaApproved] = React.useState(false);
  const importedP6 = schedule.source === "xer" || schedule.source === "p6-xml";
  const importMetrics = summary ? [
    ["الأنشطة", summary.activitiesRead],
    ["العلاقات", summary.relationshipsRead],
    ["WBS", summary.wbsRead],
    ["الموارد", summary.resourcesRead],
  ] : [];
  const openDirect = () => { onJourneyPath("direct"); onStepChange(2); onNavigate("schedule"); };
  const openIssues = () => { onJourneyPath("issue"); onStepChange(3); onNavigate("issues"); };
  const isCurrent = (value: number) => step === value;

  return <section className="guided-journey workflow-panel" aria-label="مسار التحليل المتسلسل">
    <div className="guided-hero">
      <div>
        <p className="eyebrow"><BookOpenCheck size={16} /> KNOWLEDGE → PRACTICE → CLAIM</p>
        <h1>تعلّم خطوة، ثم طبّقها على برنامجك</h1>
        <p>هذا المسار لا يغيّر ملف <b dir="ltr">XER</b> الأصلي. كل حساب يُبنى في نسخة تحليلية مستقلة قابلة للمراجعة، ثم يمر إلى السرد والـNotice فقط بعد اعتمادك.</p>
      </div>
      <div className="guided-hero-actions">
        <Button className="run-button" onClick={() => onNavigate("learning")}><BookOpenCheck size={16} />افتح الموسوعة والدروس</Button>
        <span><ShieldCheck size={15} />المصدر محفوظ بلا تعديل</span>
      </div>
    </div>

    <ol className="guided-steps">{steps.map(([title, detail], index) => {
      const stepNumber = index + 1;
      const complete = stepNumber < step;
      return <li key={title} className={isCurrent(stepNumber) ? "active" : complete ? "complete" : ""}><span>{complete ? <CheckCircle2 size={16} /> : stepNumber}</span><div><b>{title}</b><small>{detail}</small></div></li>;
    })}</ol>

    {step === 1 && <div className="guided-choice-grid">
      <article className="guided-choice"><span className="guided-icon"><ClipboardList size={22} /></span><p className="eyebrow">المسار المنضبط</p><h2>أبدأ من سجل القضايا</h2><p>للحالات التي يملأها Planner أو فريق المشروع: تسجّل الواقعة، الأدلة، المسؤولية، والنشاط/العلاقة المقترحة، ثم تعتمد Fragnet قبل تطبيقه.</p><Button className="run-button" onClick={openIssues}>سجل القضايا ثم التحليل <ArrowLeft size={16} /></Button></article>
      <article className="guided-choice"><span className="guided-icon"><PlayCircle size={22} /></span><p className="eyebrow">المسار السريع</p><h2>أدخل للتحليل المباشر</h2><p>لدى المحلل حدث موثق ويريد بناء TIA مباشرة: استيراد XER، اختيار Update قبل الحدث، تحديد المنطق، ثم مراجعة الـFragnet.</p><Button variant="outline" className="guided-outline" onClick={openDirect}>التحليل المباشر <ArrowLeft size={16} /></Button></article>
    </div>}

    {step === 2 && <div className="guided-stage">
      <div className="stage-heading"><div><p className="eyebrow">P6 IMPORT GATE</p><h2>تحقق من البرنامج قبل أن تحلله</h2><p>نقرأ الأنشطة والعلاقات، لكن لا نعطيك «اعتماداً» تلقائياً. راجع تقويم P6 وData Date وكل ملاحظة قبل إنشاء Pre‑TIA.</p></div><span className="stage-counter">{gate.readyCount}/{gate.checks.length} مكتمل</span></div>
      <div className="readiness-grid">{gate.checks.map(check => <div key={check.key} className={`readiness-row ${check.status}`}><FileCheck2 size={18} /><div><b>{check.title}</b><span>{check.detail}</span></div><em>{check.status === "ready" ? "مقروء" : check.status === "review" ? "راجع" : "ناقص"}</em></div>)}</div>
      {summary && <div className="p6-import-evidence" aria-label="ملخص قراءات برنامج P6">
        <div>{importMetrics.map(([label, count]) => <span key={String(label)}><b>{count}</b>{label}</span>)}</div>
        <p><b>التقويم المقروء:</b> {summary.calendarName ?? "لم يُحدد"} · <b>الحقول/الملاحظات غير المكتملة:</b> {summary.warnings.length}</p>
        {summary.warnings.length > 0 && <ul>{summary.warnings.slice(0, 3).map((warning) => <li key={warning}>{warning}</li>)}</ul>}
      </div>}
      {!importedP6 && <div className="stage-callout"><UploadCloud size={18} /><span>لم تُحمّل نسخة XER أو XML بعد. افتح شاشة البرنامج، ارفع الملف، ثم ارجع لهذه الخطوة.</span><Button variant="outline" onClick={() => onNavigate("schedule")}>رفع برنامج P6</Button></div>}
      {importedP6 && <label className="gate-acknowledgement"><input type="checkbox" checked={approvedP6Gate} onChange={event => onP6GateApprovalChange(event.target.checked)} />أقر بأنني راجعت التقويم وData Date وملاحظات الاستيراد، وأن هذه ليست موافقة تعاقدية تلقائية.</label>}
      <div className="stage-actions"><Button variant="outline" onClick={() => onStepChange(1)}>رجوع</Button><Button className="run-button" disabled={!importedP6 || (gate.requiresAcknowledgement && !approvedP6Gate)} onClick={() => { onStepChange(3); onNavigate(journeyPath === "issue" ? "issues" : "event"); }}>انتقل لتحديد الحدث <ArrowLeft size={16} /></Button></div>
    </div>}

    {step === 3 && <div className="guided-stage">
      <div className="stage-heading"><div><p className="eyebrow">PRE-TIA → EVENT MODELLING</p><h2>{journeyPath === "issue" ? "اختر نسخة Pre-TIA ثم حوّل القضية المعتمدة" : "اختر نسخة Pre-TIA ثم حدد الحدث والعلاقة المتأثرة"}</h2><p>{journeyPath === "issue" ? "سجل القضية يحافظ على الأدلة والمسؤولية واقتراح المنطق قبل أن يصبح حدثاً حسابياً." : "اختر علاقة منطقية، أدخل تاريخ الحدث ومدته، واربطهما بما هو مثبت في المستندات."}</p></div><GitBranch size={25} /></div>
      <fieldset className="pre-tia-selection"><legend>نسخة ما قبل الحدث المرجعية</legend><label><input type="radio" name="pre-tia-schedule" checked={preTiaApproved} onChange={() => setPreTiaApproved(true)} />أعتمد البرنامج المستورد الحالي كنسخة <b dir="ltr">Pre-TIA</b> مرجعية <span>({schedule.name} · Data Date: {schedule.dataDate ?? "غير مقروء"})</span></label><p>تُنشأ نسخة Post-TIA منفصلة بعد اعتماد النموذج؛ لا يُعدّل البرنامج المصدر ولا ملف XER الأصلي.</p></fieldset>
      <div className="split-lesson"><b>قاعدة الورقة العملية:</b><span dir="ltr">Pre-Activity → Event → Post-Activity</span><p>إذا وقع الحدث داخل نشاط، لا نضيفه إلى الملف الأصلي؛ نصنع نموذجاً مستقلاً يوضح ما قبل الحدث والحدث وما بعده، ثم يراجعه المحلل قبل الحساب.</p></div>
      <div className="stage-actions"><Button variant="outline" onClick={() => onStepChange(2)}>رجوع</Button><Button className="run-button" disabled={!preTiaApproved} onClick={() => { onStepChange(4); onNavigate(journeyPath === "issue" ? "issues" : "event"); }}>{journeyPath === "issue" ? "افتح سجل القضايا" : "افتح نموذج الحدث"}<ArrowLeft size={16} /></Button></div>
    </div>}

    {step >= 4 && <div className="guided-stage">
      <div className="stage-heading"><div><p className="eyebrow">REVIEW → POST-TIA</p><h2>اعتمد النموذج ثم اقرأ الفرق</h2><p>بعد أن تعتمد نموذج الحدث، يشغّل المحرك CPM على نسخة TIA منفصلة ويقارن تاريخ الإكمال مع Pre‑TIA. بعدها تراجع النافذة والتزامن قبل إنشاء السرد.</p></div><FileCheck2 size={25} /></div>
      <div className="pre-post-map" dir="ltr"><b>Original P6</b><i /> <b>Pre‑TIA</b><i /> <strong>Event</strong><i /> <b>Post‑TIA</b><i /> <b>Variance</b></div>
      <div className="stage-actions"><Button variant="outline" onClick={() => onStepChange(3)}>رجوع</Button><Button className="run-button" onClick={() => { onStepChange(5); onNavigate("analysis"); }}>افتح نتيجة التحليل <ArrowLeft size={16} /></Button></div>
    </div>}
  </section>;
}

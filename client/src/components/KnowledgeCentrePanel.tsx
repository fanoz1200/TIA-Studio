import React, { useMemo, useState } from "react";
import { ArrowLeft, BookOpenCheck, CheckCircle2, Download, FileText, LibraryBig, Search, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MasterClaimCase } from "@/lib/master-claim-cases";
import type { DetailedMasterClaimCase } from "@/lib/master-claim-excel";
import { masterClaimIntelligenceCases, masterClaimIntelligenceSource, masterClaimSupportSheets } from "@/lib/master-claim-intelligence-data";
import { claimTrainingScenarios, fidicClaimReferences } from "@/lib/user-claim-references";
import { useAppLanguage } from "@/contexts/LanguageContext";
import { bilingualUiLabel } from "@/lib/language";
import "./knowledge-centre.css";
import "./knowledge-centre-record-filters.css";
import "./knowledge-decision-tree.css";
import "./training-video.css";
import { qwenCaseIntakeCases, qwenCaseIntakeSource } from "@/lib/qwen-case-intake-data";

export type AnalysisMethod = "tia" | "windows" | "disruption" | "quantity";
type WorkbookRecordFamily = "all" | "delay" | "support";
type DecisionChoice = "single" | "period" | "disruption" | "quantity" | null;
type LibrarySection = "start" | "cases" | "references";
export type KnowledgeRoute = {
  method: AnalysisMethod;
  journeyPath: "issue" | "direct";
  caseId: string;
  caseTitle: string;
};

function methodsFor(language: "ar" | "en"): { id: AnalysisMethod; label: string; detail: string }[] {
  if (language === "en") {
    return [
      { id: "tia", label: "Time Impact Analysis (TIA)", detail: "For a defined event modelled on an update before the event, with its completion impact then measured." },
      { id: "windows", label: "Windows analysis", detail: "For a live project or overlapping events that need consecutive-update review." },
      { id: "disruption", label: "Disruption analysis", detail: "For productivity loss or disrupted sequencing, supported by operational records." },
      { id: "quantity", label: "Quantity / scope increase", detail: "Records the increase and time impact; financial and contractual entitlement remain for review." },
    ];
  }
  return [
    { id: "tia", label: "تحليل الأثر الزمني (TIA)", detail: "مناسب لحدث محدد يُنمذج على تحديث سابق للحدث ثم يقاس أثره على الإكمال." },
    { id: "windows", label: "تحليل النوافذ (Windows)", detail: "مناسب للمشروع المستمر أو الوقائع المتداخلة التي تتطلب قراءة تحديثات متتابعة." },
    { id: "disruption", label: "تحليل التعطيل (Disruption)", detail: "مناسب لانخفاض الإنتاجية أو اضطراب تسلسل التنفيذ، ويحتاج أدلة تشغيلية." },
    { id: "quantity", label: "زيادة الكميات / النطاق (Quantity)", detail: "يوثق الزيادة والأثر الزمني، ثم يترك تقرير الاستحقاق المالي والتعاقدي للمراجعة." },
  ];
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\w\u0600-\u06FF]+/g, " ")
    .trim();
}

function methodFromSource(value: string): AnalysisMethod {
  const source = value.toLowerCase();
  if (source.includes("window") || source.includes("period") || source.includes("concurrent")) return "windows";
  if (source.includes("disruption") || source.includes("productivity") || source.includes("measured mile")) return "disruption";
  if (source.includes("quantity") || source.includes("measured")) return "quantity";
  return "tia";
}

function selectedMethodLabel(caseItem: MasterClaimCase, methods: { id: AnalysisMethod; label: string; detail: string }[]) {
  return methods.find(method => method.id === methodFromSource(caseItem.methodology))?.label ?? methods[0]?.label ?? "TIA";
}

function journeyFor(method: AnalysisMethod): "issue" | "direct" {
  return method === "tia" ? "direct" : "issue";
}

const requestedCaseCount = 88;
const workbookCases: DetailedMasterClaimCase[] = masterClaimIntelligenceCases.map(item => ({ ...item, source: "excel" }));
const qwenIntakeCases: DetailedMasterClaimCase[] = qwenCaseIntakeCases.map(item => ({ ...item, source: "qwen-intake" }));

function sourceLabel(source: DetailedMasterClaimCase["source"], language: "ar" | "en") {
  if (source === "qwen-intake") {
    return language === "en"
      ? "Qwen user-provided intake — original citation pending verification"
      : "مادة Qwen المرفقة من المستخدم · Qwen user-provided intake — المصدر الأصلي قيد التحقق";
  }
  return language === "en"
    ? "Reference from the uploaded Excel library"
    : "مرجع من مكتبة Excel المرفوعة · Reference from the uploaded Excel library";
}

export function KnowledgeCentrePanel({ view, onBeginGuidedAnalysis }: { view: string; projectKey: string; isAuthenticated: boolean; onBeginGuidedAnalysis?: (route: KnowledgeRoute) => void }) {
  const { language, direction } = useAppLanguage();
  const txt = (ar: string, en: string) => language === "en" ? en : ar;
  const label = (ar: string, en: string) => bilingualUiLabel(language, ar, en);
  const methods = methodsFor(language);
  const [query, setQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState<AnalysisMethod | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [recordFamilyFilter, setRecordFamilyFilter] = useState<WorkbookRecordFamily>("all");
  const [selectedId, setSelectedId] = useState(workbookCases[0]?.id ?? "");
  const [methodOverride, setMethodOverride] = useState<AnalysisMethod | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [selectedFidicClause, setSelectedFidicClause] = useState(fidicClaimReferences[0]?.clause ?? "");
  const [selectedSupportSheetId, setSelectedSupportSheetId] = useState(masterClaimSupportSheets[0]?.id ?? "");
  const [decisionChoice, setDecisionChoice] = useState<DecisionChoice>(null);
  const [hasPreEventUpdate, setHasPreEventUpdate] = useState<boolean | null>(null);
  const [librarySection, setLibrarySection] = useState<LibrarySection>("start");

  const libraryCases = [...workbookCases, ...qwenIntakeCases];
  const verifiedWorkbookCaseCount = masterClaimIntelligenceSource.caseCount;
  const verifiedDCaseCount = masterClaimIntelligenceSource.caseGroups.D;
  const verifiedRelatedCaseCount = verifiedWorkbookCaseCount - verifiedDCaseCount;
  const qwenIntakeDCaseCount = qwenIntakeCases.filter(item => item.id.startsWith("D-")).length;
  const pendingDCaseCount = Math.max(0, requestedCaseCount - verifiedDCaseCount - qwenIntakeDCaseCount);

  const categories = useMemo(() => Array.from(new Set(libraryCases.map(item => item.category))).filter(Boolean).sort((a, b) => a.localeCompare(b, "ar")), [libraryCases]);
  const selectedCase = libraryCases.find(item => item.id === selectedId) ?? libraryCases[0];
  const selectedMethod = methodOverride ?? methodFromSource(selectedCase.methodology);
  const selectedMethodInfo = methods.find(item => item.id === selectedMethod) ?? methods[0];
  const selectedFidicReference = fidicClaimReferences.find(item => item.clause === selectedFidicClause) ?? fidicClaimReferences[0];
  const selectedSupportSheet = masterClaimSupportSheets.find(sheet => sheet.id === selectedSupportSheetId) ?? masterClaimSupportSheets[0];
  const decisionResult = decisionChoice === "single"
    ? hasPreEventUpdate === null ? null : {
      method: "tia" as AnalysisMethod,
      title: hasPreEventUpdate ? txt("المناسب كبداية: TIA", "Recommended starting point: TIA") : txt("جهّز تحديث قريب من تاريخ الحدث ثم ابدأ TIA", "Prepare an update near the event date, then start TIA"),
      detail: hasPreEventUpdate ? txt("عندك واقعة محددة ونسخة قبلها؛ هتدخل رحلة TIA المباشرة.", "You have a defined event and a preceding copy; the direct TIA journey is next.") : txt("تقدر تفتح رحلة TIA دلوقتي، لكن لازم تحدد Update قريب قبل الحدث وتراجع Data Date قبل الحساب.", "You can open the TIA journey now, but first identify an update near the event and review the Data Date before calculation."),
    }
    : decisionChoice === "period" ? {
      method: "windows" as AnalysisMethod,
      title: txt("المناسب كبداية: تحليل النوافذ", "Recommended starting point: Windows analysis"),
      detail: txt("عندك فترة أو أكتر من واقعة. ابدأ بسجل القضايا ثم رتّب التحديثات والنوافذ.", "You have a period or more than one event. Start with the Issue Log, then organise updates and windows."),
    }
    : decisionChoice === "disruption" ? {
      method: "disruption" as AnalysisMethod,
      title: txt("المناسب كبداية: تحليل التعطيل", "Recommended starting point: Disruption analysis"),
      detail: txt("ركز على الإنتاجية والسجلات اليومية والموارد؛ البرنامج لا يحوّل انخفاض الإنتاجية لأيام تلقائياً من غير أدلة.", "Focus on productivity, daily records and resources; the application does not convert productivity loss to days automatically without evidence."),
    }
    : decisionChoice === "quantity" ? {
      method: "quantity" as AnalysisMethod,
      title: txt("المناسب كبداية: زيادة كميات أو نطاق", "Recommended starting point: Quantity or scope increase"),
      detail: txt("سجّل أمر التغيير والكميات والنشاط المتأثر، وبعدها راجع الأثر الزمني والمالي كل واحد في مساره.", "Record the change order, quantities and affected activity, then review time and financial impact through their respective workflows."),
    }
    : null;

  const matchingCases = useMemo(() => {
    const terms = normalize(query).split(" ").filter(Boolean);
    return libraryCases.filter(item => {
      const sourceMethod = methodFromSource(item.methodology);
      const haystack = normalize([
        item.id,
        item.title_ar,
        item.title_en,
        item.category,
        item.delay_type,
        item.methodology,
        item.description,
        item.root_cause,
        item.schedule_impact,
        item.contractual_basis,
        item.burden_of_proof,
        item.recommended_solution,
        item.mitigation,
        item.fragnet_id,
        item.wbs_code,
        item.fragnet_activities,
        item.fragnet_protocol,
        item.tia_baseline_rule,
        item.calendar_rule,
        item.float_rule,
        item.update_procedure,
        item.recovery_procedure,
      ].join(" "));
      return (methodFilter === "all" || sourceMethod === methodFilter)
        && (categoryFilter === "all" || item.category === categoryFilter)
        && (recordFamilyFilter === "all" || (recordFamilyFilter === "delay" ? item.id.startsWith("D-") : !item.id.startsWith("D-")))
        && terms.every(term => haystack.includes(term));
    });
  }, [categoryFilter, libraryCases, methodFilter, query, recordFamilyFilter]);

  const chooseCase = (caseItem: DetailedMasterClaimCase) => {
    setSelectedId(caseItem.id);
    setMethodOverride(null);
  };

  const applyCase = () => {
    if (!onBeginGuidedAnalysis || isApplying) return;
    setIsApplying(true);
    toast.success(txt("جاري فتح رحلة التحليل للحالة المختارة…", "Opening the analysis journey for the selected case…"));
    onBeginGuidedAnalysis({
      method: selectedMethod,
      journeyPath: journeyFor(selectedMethod),
      caseId: selectedCase.id,
      caseTitle: selectedCase.title_ar,
    });
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    window.setTimeout(() => setIsApplying(false), 500);
  };

  const beginDecisionRoute = () => {
    if (!decisionResult || !onBeginGuidedAnalysis) return;
    onBeginGuidedAnalysis({
      method: decisionResult.method,
      journeyPath: journeyFor(decisionResult.method),
      caseId: "decision-tree-route",
      caseTitle: decisionResult.title,
    });
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  if (view !== "learning") return null;

  return (
    <section className="knowledge-centre workflow-panel" dir={direction} aria-label={txt("موسوعة المنهجيات والحالات", "Methodology and case library")}>
      <div className="workflow-heading">
        <div>
          <p className="eyebrow">MASTER CLAIM INTELLIGENCE · READ ONLY</p>
          <h2>{label("مكتبة المنهجيات والحالات العملية", "Methodology and practical case library")}</h2>
          <p>{txt("تجمع المكتبة السجل التفصيلي المقروء محلياً من ملف Excel: الحالات، إجراءات القرار، التدقيق الجنائي، الاعتراضات والردود، القوالب، الحسابات، وقائمة الإقفال. البحث يرشدك ولا يصدر حكماً تعاقدياً آلياً.", "This library gathers the detailed record read locally from the Excel workbook: cases, decision procedures, forensic checks, objections and replies, templates, calculations and close-out items. Search guides you; it does not issue an automated contractual decision.")}</p>
        </div>
        <LibraryBig size={26} />
      </div>

      <article className="master-library-status" aria-label={txt("حالة مصدر الموسوعة", "Library source status")}>
        <div><ShieldCheck size={19} /><span><b>{txt("المصدر المرجعي محمّل للقراءة فقط.", "The reference source is loaded read-only.")}</b> {txt("تُضمَّن بيانات ملف Excel المرفوع داخل النسخة وقت البناء؛ لا يُعدّل الأصل ولا يُرسل إلى خادم أو خدمة خارجية. المتاح: ", "The uploaded Excel data are embedded in the build; the original is not modified or sent to a server or external service. Available: ")}{verifiedWorkbookCaseCount}{txt(" سجلاً منظماً و", " structured records and ")}{masterClaimIntelligenceSource.supportSheetCount}{txt(" أوراق دعم.", " support sheets.")}</span></div>
        <span className="master-library-count">{verifiedWorkbookCaseCount} {txt("سجل Excel تفصيلي", "detailed Excel records")}</span>
      </article>
      <article className="case-source-note qwen-intake-note" aria-live="polite">
        <b>{label("ملحق حالات Qwen", "Qwen case intake")}</b>
        <span>{language === "en"
          ? `${qwenCaseIntakeSource.caseCount} D-series cases supplied by the user were added as review intake. Their cited original document was not supplied, so they are not presented as independently verified legal authority.`
          : `تمت إضافة ${qwenCaseIntakeSource.caseCount} حالة من سلسلة D من ملحق Qwen الذي أرسله المستخدم كمدخل مراجعة. المستند الأصلي المشار إليه لم يُرفق، ولذلك لا تُعرض الحالات كمرجع قانوني متحقق منه مستقلاً.`}</span>
      </article>
      <p className="case-source-note" aria-live="polite"><b>{label("حالة الفهرسة", "Index status")}</b> {language === "en"
        ? `The uploaded Excel workbook contains ${verifiedDCaseCount} D-series cases and ${verifiedRelatedCaseCount} related records (DIS/CON/VAR/RES). With the ${qwenIntakeDCaseCount} Qwen intake records, ${pendingDCaseCount} D-series cases remain pending an original documented source.`
        : `ملف Excel المرفوع يحتوي ${verifiedDCaseCount} حالة من سلسلة D و${verifiedRelatedCaseCount} سجلاً مرتبطاً فعلياً (DIS/CON/VAR/RES). ومع ${qwenIntakeDCaseCount} سجلات Qwen المرفقة، تبقى ${pendingDCaseCount} حالة من سلسلة D معلقة إلى أن يصل المصدر الأصلي الموثق.`}</p>

      <section className="library-start-menu" aria-label={txt("اختار أنت محتاج إيه من الموسوعة", "Choose what you need from the library")}>
        <div><p className="eyebrow">{txt("خدها خطوة خطوة", "TAKE IT STEP BY STEP")}</p><h3>{txt("إنت داخل تعمل إيه دلوقتي؟", "What are you here to do?")}</h3><p>{txt("اختار حاجة واحدة، والباقي هيفضل بعيد عنك لحد ما تحتاجه.", "Choose one task; the rest stays out of your way until you need it.")}</p></div>
        <div className="library-start-menu__choices" role="tablist" aria-label={txt("أقسام الموسوعة المبسطة", "Simplified library sections")}>
          <button type="button" role="tab" aria-selected={librarySection === "start"} className={librarySection === "start" ? "selected" : ""} onClick={() => setLibrarySection("start")}><BookOpenCheck size={18} /><span><b>{txt("مش عارف أبدأ", "I am not sure where to start")}</b><small>{txt("جاوب سؤالين وأنا أرشح لك الطريق", "Answer two questions and I will suggest a route")}</small></span></button>
          <button type="button" role="tab" aria-selected={librarySection === "cases"} className={librarySection === "cases" ? "selected" : ""} onClick={() => setLibrarySection("cases")}><Search size={18} /><span><b>{txt("بدور على حالة شبه مشكلتي", "I am looking for a similar case")}</b><small>{txt("ابحث وشوف الأدلة والخطوة اللي بعدها", "Search, then review the evidence and next step")}</small></span></button>
          <button type="button" role="tab" aria-selected={librarySection === "references"} className={librarySection === "references" ? "selected" : ""} onClick={() => setLibrarySection("references")}><FileText size={18} /><span><b>{txt("عايز المراجع والقوالب", "I need references and templates")}</b><small>{txt("FIDIC والسيناريوهات وأوراق الدعم", "FIDIC, scenarios and support sheets")}</small></span></button>
        </div>
      </section>

      {librarySection === "start" ? <>
      <section className="interactive-decision-tree" aria-labelledby="interactive-decision-tree-title">
        <div className="interactive-decision-tree__heading">
          <BookOpenCheck size={22} />
          <div><p className="eyebrow">{txt("ابدأ من سؤالك الحقيقي", "START WITH YOUR REAL QUESTION")}</p><h3 id="interactive-decision-tree-title">{txt("مش عارف أبدأ بأي طريقة؟ جاوب سؤالين بس", "Not sure which method to start with? Answer just two questions")}</h3><p>{txt("دي أداة توجيه، مش حكم تعاقدي. بعد الإجابة هتفتح لك الرحلة المناسبة في البرنامج بدل ما تدخل في جداول كتير.", "This is a guide, not a contractual decision. After answering, it opens the relevant journey instead of taking you through many tables.")}</p></div>
        </div>
        <div className="decision-question">
          <b>{txt("١) طبيعة المشكلة إيه؟", "1) What is the nature of the problem?")}</b>
          <div className="decision-options" role="group" aria-label={txt("طبيعة المشكلة", "Nature of the problem")}>
            <button type="button" className={decisionChoice === "single" ? "selected" : ""} onClick={() => { setDecisionChoice("single"); setHasPreEventUpdate(null); }}>{txt("واقعة واحدة بتاريخ معروف", "One event with a known date")}</button>
            <button type="button" className={decisionChoice === "period" ? "selected" : ""} onClick={() => { setDecisionChoice("period"); setHasPreEventUpdate(null); }}>{txt("تأخيرات متتابعة أو متزامنة", "Sequential or concurrent delays")}</button>
            <button type="button" className={decisionChoice === "disruption" ? "selected" : ""} onClick={() => { setDecisionChoice("disruption"); setHasPreEventUpdate(null); }}>{txt("إنتاجية وقعت أو التسلسل اتلخبط", "Productivity dropped or sequencing was disrupted")}</button>
            <button type="button" className={decisionChoice === "quantity" ? "selected" : ""} onClick={() => { setDecisionChoice("quantity"); setHasPreEventUpdate(null); }}>{txt("زيادة كميات أو تغيير نطاق", "Quantity increase or scope change")}</button>
          </div>
        </div>
        {decisionChoice === "single" ? <div className="decision-question decision-question--followup"><b>{txt("٢) معاك Update قريب قبل تاريخ الحدث؟", "2) Do you have an update near the date before the event?")}</b><div className="decision-options" role="group" aria-label={txt("وجود تحديث قبل الحدث", "Availability of a pre-event update")}><button type="button" className={hasPreEventUpdate === true ? "selected" : ""} onClick={() => setHasPreEventUpdate(true)}>{txt("أيوه، معايا", "Yes, I do")}</button><button type="button" className={hasPreEventUpdate === false ? "selected" : ""} onClick={() => setHasPreEventUpdate(false)}>{txt("لأ، محتاج أجهزه", "No, I need to prepare one")}</button></div></div> : null}
        {decisionResult ? <div className="decision-result" aria-live="polite"><CheckCircle2 size={22} /><div><b>{decisionResult.title}</b><p>{decisionResult.detail}</p></div><Button onClick={beginDecisionRoute} disabled={!onBeginGuidedAnalysis}>{txt("افتح الخطوات المناسبة", "Open the appropriate steps")} <ArrowLeft size={16} /></Button></div> : <p className="decision-empty">{txt("اختار وصف المشكلة الأول، وبعدها هقول لك تمشي في أنهي طريق جوه البرنامج.", "Choose the problem description first, then I will suggest the route inside the application.")}</p>}
      </section>
      <section className="library-next-step" aria-label={txt("بعد اختيار المسار", "After choosing a route")}>
        <h3>{txt("بعد ما تختار الطريق", "After choosing the route")}</h3>
        <ol><li>{txt("افتح رحلة التحليل المناسبة من الزر الأخضر.", "Open the relevant analysis journey from the green button.")}</li><li>{txt("ارفع النسخة الأساسية والـUpdate القريب من الواقعة.", "Upload the baseline and the update nearest to the event.")}</li><li>{txt("وثّق الواقعة والأدلة، وبعدها اطلع التقرير للمراجعة.", "Record the event and evidence, then produce the report for review.")}</li></ol>
        <Button type="button" variant="outline" onClick={() => setLibrarySection("cases")}>{txt("أو دور على حالة من المكتبة", "Or search for a case in the library")} <ArrowLeft size={16} /></Button>
      </section>
      </> : null}

      {librarySection === "references" ? <>
      <section className="fidic-reference-library" aria-label={txt("مرجع بنود FIDIC 2017", "FIDIC 2017 clause reference")}>
        <div className="reference-library-heading">
          <FileText size={20} />
          <div><p className="eyebrow">FIDIC 2017 · PLANNER REFERENCE</p><h3>{txt("مرجع بنود FIDIC 2017 للمخطط والمطالبة", "FIDIC 2017 clause reference for planning and claims")}</h3><p>{txt("يعرض ", "Shows ")}{fidicClaimReferences.length}{txt(" بنداً موثقاً من ملفك: قراءة عملية للمخطط، الإجراء، السجلات، والملاحظات. هذه المراجع مستقلة عن حالات D ولا تُنشئ استحقاقاً قانونياً تلقائياً.", " documented clauses from your source: a practical planner view, action, records and notes. These references are separate from D cases and do not create automated legal entitlement.")}</p></div>
        </div>
        <div className="fidic-clause-grid">
          {fidicClaimReferences.map(reference => <button type="button" key={reference.clause} className={`fidic-clause-card ${reference.clause === selectedFidicReference?.clause ? "selected" : ""}`} onClick={() => setSelectedFidicClause(reference.clause)} aria-pressed={reference.clause === selectedFidicReference?.clause}>
            <span>FIDIC {reference.clause}</span><b>{reference.title}</b><small>{txt("الأثر: ", "Effect: ")}{reference.adjustment || txt("غير مذكور", "Not specified")}</small>
          </button>)}
        </div>
        {selectedFidicReference ? <article className="fidic-reference-detail" aria-live="polite">
          <div><span>FIDIC {selectedFidicReference.clause}</span><h4>{selectedFidicReference.title}</h4><b>{selectedFidicReference.adjustment || txt("الأثر غير مذكور في الملف", "Effect not stated in the source")}</b></div>
          <div className="fidic-detail-grid">
            <section><h5>{txt("شرح البند للمخطط", "Planner summary")}</h5><p>{selectedFidicReference.plannerSummary || txt("لم يرد شرح مختصر في المصدر.", "No summary appears in the source.")}</p></section>
            <section><h5>{txt("إجراء عملي", "Practical action")}</h5><p>{selectedFidicReference.plannerAction || txt("لم يرد إجراء عملي في المصدر.", "No practical action appears in the source.")}</p></section>
            <section><h5>{txt("السجلات والأدلة", "Records and evidence")}</h5><p>{selectedFidicReference.evidence || txt("لم تحدد سجلات في المصدر.", "No records are specified in the source.")}</p></section>
            <section><h5>{txt("المرجع القانوني المصري المذكور", "Egyptian legal reference stated")}</h5><p>{selectedFidicReference.egyptianLawReference || txt("لم يرد مرجع قانوني مصري في المصدر.", "No Egyptian legal reference appears in the source.")}</p></section>
            <section className="fidic-practical-notes"><h5>{txt("ملاحظات تطبيقية", "Practical notes")}</h5><p>{selectedFidicReference.practicalNotes || txt("لم ترد ملاحظات تطبيقية إضافية في المصدر.", "No additional practical notes appear in the source.")}</p></section>
          </div>
          <small className="reference-provenance">{txt("المصدر: ", "Source: ")}{selectedFidicReference.source}{txt(". راجع العقد والشروط الخاصة والنص الأصلي قبل الاعتماد.", ". Review the contract, particular conditions and original text before relying on it.")}</small>
        </article> : null}
      </section>

      </> : null}

      {librarySection === "cases" ? <>
      <article className="case-search-gate master-case-catalog">
        <div className="case-search-header">
          <span><Search size={18} />{txt("ابحث في العناوين والوصف والأدلة والمساندات", "Search titles, descriptions, evidence and support")}</span>
          <b>{libraryCases.length} {txt("سجلاً فعلياً من ملفك", "actual records from your source")}</b>
        </div>
        <Input value={query} onChange={event => setQuery(event.target.value)} placeholder={txt("مثال: اعتماد، RFI، زيادة كميات، FIDIC، تعليق، توريد، تزامن…", "Example: approval, RFI, quantity increase, FIDIC, suspension, supply, concurrency…")} />
        <div className="case-catalog-toolbar">
          <div><Label><SlidersHorizontal size={14} />{txt("المنهج المرجح", "Suggested method")}</Label><Select value={methodFilter} onValueChange={value => setMethodFilter(value as AnalysisMethod | "all")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{txt("كل المناهج", "All methods")}</SelectItem>{methods.map(method => <SelectItem key={method.id} value={method.id}>{method.label}</SelectItem>)}</SelectContent></Select></div>
          <div><Label><FileText size={14} />{txt("تصنيف الواقعة", "Event category")}</Label><Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{txt("كل التصنيفات", "All categories")}</SelectItem>{categories.map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div>
          <div><Label><LibraryBig size={14} />{txt("نوع السجل", "Record type")}</Label><Select value={recordFamilyFilter} onValueChange={value => setRecordFamilyFilter(value as WorkbookRecordFamily)}><SelectTrigger aria-label={txt("نوع السجل", "Record type")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{txt("كل السجلات: ", "All records: ")}{libraryCases.length}</SelectItem><SelectItem value="delay">{txt("حالات التأخير D: ", "D delay cases: ")}{verifiedDCaseCount}</SelectItem><SelectItem value="support">{txt("سجلات داعمة DIS/CON/VAR/RES: ", "DIS/CON/VAR/RES support records: ")}{verifiedRelatedCaseCount}</SelectItem></SelectContent></Select></div>
          <p><b>{matchingCases.length}</b> {txt("نتيجة من أصل ", "results from ")}{libraryCases.length} {txt("سجل مفهرس", "indexed records")}</p>
        </div>
        <p className="catalog-record-legend"><b>{txt("كيف تقرأ القائمة:", "How to read the list:")}</b> {txt("سجلات ", "Records marked ")}<code>D</code>{txt(" هي حالات التأخير المنظمة في المصدر؛ أما ", " are structured delay cases in the source; ")}<code>DIS</code>{txt(" و", " and ")}<code>CON</code>{txt(" و", " and ")}<code>VAR</code>{txt(" و", " and ")}<code>RES</code>{txt(" فهي سجلات داعمة مرتبطة بالتعطيل أو التزامن أو التغيير أو الموارد، ولا تتحول تلقائياً إلى حالة TIA.", " are support records related to disruption, concurrency, change or resources, and do not automatically become TIA cases.")}</p>

        <div className="case-result-grid rich-case-grid">
          {matchingCases.length ? matchingCases.map(caseItem => {
            const method = methodFromSource(caseItem.methodology);
            return <button type="button" key={caseItem.id} onClick={() => chooseCase(caseItem)} className={`case-result ${caseItem.id === selectedCase.id ? "selected" : ""}`}>
              <span className="case-number">{caseItem.id}</span>
              <b>{caseItem.title_ar}</b>
              <span>{caseItem.category}</span>
              <em>{selectedMethodLabel(caseItem, methods)} · {caseItem.delay_type}</em>
              <small>{caseItem.description.slice(0, 150)}{caseItem.description.length > 150 ? "…" : ""}</small>
            </button>;
          }) : <p className="case-empty">{txt("لا توجد نتيجة مطابقة. امسح بعض كلمات البحث أو غيّر التصفية لعرض جميع حالات الموسوعة.", "No matching result. Clear some search terms or change the filter to show all library cases.")}</p>}
        </div>
      </article>

      <article className="case-detail-reader" aria-live="polite">
        <div className="case-detail-heading">
          <div><span className="case-number">{selectedCase.id}</span><div><h3>{selectedCase.title_ar}</h3><p dir="ltr">{selectedCase.title_en}</p></div></div>
          <span>{selectedCase.category}</span>
        </div>
        <div className="case-detail-meta"><span>{selectedCase.delay_type}</span><span>{selectedCase.methodology || "TIA"}</span><span>{sourceLabel(selectedCase.source, language)}</span></div>
        <div className="method-selection detail-method-selection">
          <div><Label>{txt("منهج التحليل الذي ستبدأ به", "Analysis method to start with")}</Label><Select value={selectedMethod} onValueChange={value => setMethodOverride(value as AnalysisMethod)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{methods.map(method => <SelectItem key={method.id} value={method.id}>{method.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="method-rationale"><b>{selectedMethodInfo.label}</b><p>{selectedMethodInfo.detail}</p><small><CheckCircle2 size={14} />{txt("المنهج الوارد في المصدر: ", "Method recorded in the source: ")}{selectedMethodLabel(selectedCase, methods)}{txt(". يمكنك تعديله بعد التحقق من العقد والوقائع.", ". You can change it after reviewing the contract and facts.")}</small></div>
        </div>
        <div className="case-detail-sections">
          <section><h4>{label("وصف الحالة", "Case description")}</h4><p>{selectedCase.description}</p></section>
          <section><h4>{label("الأسباب الجذرية", "Root causes")}</h4><p>{selectedCase.root_cause}</p></section>
          <section><h4>{label("الأثر المتوقع على البرنامج", "Expected schedule impact")}</h4><p>{selectedCase.schedule_impact}</p></section>
          <section className="contractual-reference"><h4>{label("المساند التعاقدي والقوانين المذكورة في المصدر", "Contractual support and laws stated in the source")}</h4><p>{selectedCase.contractual_basis}</p></section>
          <section className="evidence-reference"><h4>{label("الأدلة والمستندات المقترحة", "Suggested evidence and records")}</h4><p>{selectedCase.burden_of_proof}</p></section>
          {selectedCase.source === "excel" ? <>
            <section><h4>الحل المقترح</h4><p>{selectedCase.recommended_solution || "لم يرد حل تفصيلي لهذه الحالة في ملف Excel."}</p></section>
            <section><h4>إجراءات الوقاية</h4><p>{selectedCase.mitigation || "لم ترد إجراءات وقاية لهذه الحالة في ملف Excel."}</p></section>
            <section><h4>WBS و Fragnet وقواعد TIA</h4><p>{[selectedCase.fragnet_id && `Fragnet: ${selectedCase.fragnet_id}`, selectedCase.wbs_code && `WBS: ${selectedCase.wbs_code}`, selectedCase.fragnet_activities && `الأنشطة: ${selectedCase.fragnet_activities}`, selectedCase.fragnet_protocol && `بروتوكول الـ Fragnet: ${selectedCase.fragnet_protocol}`, selectedCase.tia_baseline_rule && `Baseline: ${selectedCase.tia_baseline_rule}`, selectedCase.calendar_rule && `التقويم: ${selectedCase.calendar_rule}`, selectedCase.float_rule && `Float: ${selectedCase.float_rule}`].filter(Boolean).join("\n\n") || "لم ترد قواعد Fragnet أو TIA إضافية لهذه الحالة في ملف Excel."}</p></section>
            <section><h4>إجراء التحديث والاستدراك</h4><p>{[selectedCase.update_procedure, selectedCase.recovery_procedure].filter(Boolean).join("\n\n") || "لم يرد إجراء تحديث أو استدراك إضافي لهذه الحالة في ملف Excel."}</p></section>
          </> : null}
        </div>
        <div className="case-search-actions">
          <span><ShieldCheck size={16} />{txt("هذه خلاصة مرجعية من ملفك؛ راجع نسخة العقد والشروط الخاصة قبل الاعتماد أو المطالبة.", "This is a reference summary from your source; review the contract copy and particular conditions before relying on it or making a claim.")}</span>
          <Button className="run-button" type="button" onClick={applyCase} disabled={isApplying} aria-busy={isApplying}>{isApplying ? txt("جاري فتح رحلة التحليل…", "Opening the analysis journey…") : txt("طبّق هذه الحالة الآن", "Apply this case now")} <ArrowLeft size={16} /></Button>
        </div>
      </article>
      </> : null}

      {librarySection === "references" ? <>
      {selectedSupportSheet ? <section className="master-support-sheets" aria-label={txt("أوراق الدعم من ملف Master Claim Intelligence", "Support sheets from the Master Claim Intelligence workbook")}>
        <div className="reference-library-heading"><FileText size={20} /><div><p className="eyebrow">MASTER CLAIM INTELLIGENCE · SUPPORT SHEETS</p><h3>{txt("إجراءات القرار، التدقيق، الاعتراضات، القوالب والحسابات", "Decision procedures, checks, objections, templates and calculations")}</h3><p>{txt("هذه الأوراق الثمانية مستنسخة للقراءة من الملف المرفوع مع أسماء الروابط الداخلية كما وردت فيه. الصفوف معروضة داخل مساحة تمرير مستقلة للحفاظ على قراءة الهاتف.", "These eight sheets are copied read-only from the uploaded workbook with their internal-link labels as recorded. Rows are shown in a separate scroll area to preserve mobile readability.")}</p></div></div>
        <div className="support-sheet-tabs" role="tablist" aria-label={txt("اختيار ورقة دعم", "Choose a support sheet")}>{masterClaimSupportSheets.map(sheet => <button key={sheet.id} type="button" role="tab" aria-selected={sheet.id === selectedSupportSheet.id} className={sheet.id === selectedSupportSheet.id ? "selected" : ""} onClick={() => setSelectedSupportSheetId(sheet.id)}>{sheet.title}</button>)}</div>
        <article className="support-sheet-reader" role="tabpanel">
          <div className="support-sheet-reader-heading"><div><span>{selectedSupportSheet.id}</span><h4>{selectedSupportSheet.title}</h4></div><small>{selectedSupportSheet.rows.length} {txt("صفاً", "rows")} · {selectedSupportSheet.links.length} {txt("رابطاً داخلياً", "internal links")}</small></div>
          <div className="support-sheet-table-wrap"><table><tbody>{selectedSupportSheet.rows.map((row, rowIndex) => <tr key={`${selectedSupportSheet.id}-${rowIndex}`}>{row.map((cell, cellIndex) => rowIndex === 0 ? <th key={`${rowIndex}-${cellIndex}`} scope="col">{cell || "—"}</th> : <td key={`${rowIndex}-${cellIndex}`}>{cell || "—"}</td>)}</tr>)}</tbody></table></div>
          {selectedSupportSheet.links.length ? <div className="support-sheet-links"><b>{txt("الروابط الداخلية الواردة في المصدر", "Internal links recorded in the source")}</b><ul>{selectedSupportSheet.links.map(link => <li key={`${link.cell}-${link.target}`}><code>{link.cell}</code><span>{link.label || txt("رابط داخلي", "Internal link")}</span><small>{link.target}</small></li>)}</ul></div> : <p className="support-sheet-empty">{txt("لا توجد روابط داخلية مسجلة لهذه الورقة.", "No internal links are recorded for this sheet.")}</p>}
        </article>
      </section> : null}

      <div className="learning-path-grid reference-paths">
        <article className="learning-path"><BookOpenCheck size={20} /><h3>{txt("كيف تستخدم المكتبة؟", "How do you use the library?")}</h3><p>{txt("ابحث عن الحالة، اقرأ الوصف والأثر والأدلة، ثم اضغط «طبّق هذه الحالة الآن» للانتقال إلى رحلة Workshop 8.", "Find the case, read the description, impact and evidence, then select “Apply this case now” to move to the Workshop 8 journey.")}</p></article>
        <article className="learning-path"><CheckCircle2 size={20} /><h3>{txt("ما الذي ينتقل إلى التحليل؟", "What moves into analysis?")}</h3><p>{txt("رقم الحالة والعنوان والمنهج المختار فقط. تبقى البيانات الحسابية مبنية على ملفات P6 وExcel التي ترفعها في الرحلة.", "Only the case number, title and chosen method. Calculation data remain based on the P6 and Excel files you upload in the journey.")}</p></article>
        <article className="learning-path"><ShieldCheck size={20} /><h3>{txt("حدود المكتبة", "Library limits")}</h3><p>{txt("الموسوعة دليل عملي وتعليمي. لا تستبدل العقد أو الرأي القانوني أو التحقق من شروط المشروع الخاصة.", "The library is a practical educational guide. It does not replace the contract, legal advice or review of project-specific conditions.")}</p></article>
      </div>

      <section className="claim-training-scenarios" aria-label={txt("سيناريوهات تدريب المطالبات", "Claim training scenarios")}>
        <div className="reference-library-heading"><BookOpenCheck size={20} /><div><p className="eyebrow">{txt("دليل تدريبي مستخرج من المصدر", "TRAINING GUIDE EXTRACTED FROM THE SOURCE")}</p><h3>{txt("خمسة سيناريوهات لتدريب عين المخطط", "Five scenarios to train the planner's eye")}</h3><p>{txt("أسئلة تطبيقية من الدليل العربي المرفوع تساعد على فهم المسار الحرج والـ Float والسببية والتزامن؛ لا تضيف وقائع إلى مشروعك ولا تستبدل فحص البرنامج الفعلي.", "Applied questions from the uploaded Arabic guide to help explain the critical path, float, causation and concurrency; they do not add facts to your project or replace an actual schedule check.")}</p></div></div>
        <div className="claim-scenario-grid">
          {claimTrainingScenarios.map((scenario, index) => <article key={scenario.id}><span>{txt("سيناريو ", "Scenario ")}{index + 1}</span><h4>{scenario.title}</h4><p>{scenario.content}</p><small>{txt("المصدر: ", "Source: ")}{scenario.source}</small></article>)}
        </div>
      </section>

      <section className="text-training-guides" aria-label={txt("إرشادات رفع P6 وإدخال Excel", "P6 upload and Excel-entry guidance")}>
        <div className="text-training-guides-heading"><FileText size={20} /><div><p className="eyebrow">{txt("تدريب عملي مكتوب", "WRITTEN PRACTICAL TRAINING")}</p><h3>{txt("دليل سريع حتى يتاح الفيديوان المستقلان", "A quick guide while the two standalone videos are unavailable")}</h3></div></div>
        <div className="text-training-guide-grid">
          <article>
            <span>01 · {txt("رفع برنامج P6", "P6 schedule upload")}</span>
            <h4>{txt("Baseline ثم Update قبل الحدث", "Baseline, then the update before the event")}</h4>
            <ol><li>{txt("من رحلة TIA اختر ملف Baseline بصيغة XER أو XML.", "From the TIA journey, choose a Baseline file in XER or XML format.")}</li><li>{txt("راجع عدادات الأنشطة والعلاقات والتقويم قبل الاعتماد.", "Review activity counts, relationships and calendar before relying on it.")}</li><li>{txt("أضف Update الأقرب قبل تاريخ الواقعة، ثم التحديثات اللاحقة عند وجودها.", "Add the update nearest before the event date, followed by later updates where available.")}</li></ol>
            <p>{txt("لا يُعدّل الملف الأصلي؛ يعمل المحرك على نسخ تحليلية مستقلة فقط.", "The original file is not changed; the engine uses independent analysis copies only.")}</p>
          </article>
          <article>
            <span>02 · {txt("إدخال واقعة Excel", "Excel event entry")}</span>
            <h4>{txt("وثّق الواقعة قبل إنشاء Fragnet", "Record the event before creating a Fragnet")}</h4>
            <ol><li>{txt("اكتب رقم القضية والوصف وتاريخ البدء والمدة والمسؤولية.", "Enter the case number, description, start date, duration and responsibility.")}</li><li>{txt("اختر الأنشطة ونقاط الربط من بيانات البرنامج المستورد، لا من أمثلة ثابتة.", "Choose activities and tie-in points from imported schedule data, not fixed examples.")}</li><li>{txt("راجع صفوف Excel ثم اعرض تقسيم Pre / Event / Post قبل الحساب.", "Review Excel rows, then show the Pre / Event / Post split before calculation.")}</li></ol>
            <p>{txt("لا تنتقل الرحلة عند نقص الحقول الجوهرية، حتى يبقى سجل الواقعة قابلاً للمراجعة.", "The journey does not proceed when key fields are missing, so the event record remains reviewable.")}</p>
          </article>
        </div>
      </section>

      <section className="training-resource-downloads" aria-label={txt("حزمة التدريب والبرومبتات", "Training and prompt package")}>
        <div className="training-resource-heading"><Download size={20} /><div><p className="eyebrow">{txt("موارد تدريب قابلة للتنزيل", "DOWNLOADABLE TRAINING RESOURCES")}</p><h3>{txt("حزمة آمنة للتجربة وإنتاج الفيديو خارج المنصة", "A safe package for practice and off-platform video production")}</h3><p>{txt("هذه ملفات تعليمية مصطنعة وليست برنامج مشروع أو مطالبة فعلية. لا ترفعها إلى Primavera؛ استخدمها داخل TIA Studio لفهم البيانات والحساب والتحقق فقط.", "These are synthetic training files, not a project schedule or an actual claim. Do not import them into Primavera; use them inside TIA Studio only to understand data, calculation and validation.")}</p></div></div>
        <div className="training-resource-grid">
          <article>
            <span>01 · {txt("برومبتات فيديو عربية", "Arabic video prompts")}</span>
            <h4>{txt("فيديو رفع P6 وفيديو Excel — 5 إلى 6 دقائق", "P6 upload and Excel videos — 5 to 6 minutes")}</h4>
            <p>{txt("نصوص مشهدية جاهزة لأداة فيديو خارجية، بصوت أنثوي مصري دافئ وحيوي وواضح مهنيًا، مع منع استخدام أي بيانات مشروع أو صياغة استحقاق قانوني قاطع.", "Scene scripts for an external video tool, with a warm, lively Egyptian female voice and clear professional delivery, while prohibiting project data and conclusive legal-entitlement language.")}</p>
            <a className="training-download-link" href="/manus-storage/google-video-prompts-ar_8d21a82e.md" download><Download size={15} />{txt("تنزيل حزمة البرومبتات", "Download the prompt package")}</a>
          </article>
          <article>
            <span>02 · {txt("مشروع TIA تدريبي", "Training TIA project")}</span>
            <h4>{txt("تأخير اعتماد بسيط بنتيجة متوقعة", "A simple approval delay with an expected result")}</h4>
            <p>{txt("استورد الـ Baseline بصيغة JSON من تبويب الاستيراد، ثم استخدم بطاقة الحدث في رحلة TIA. النتيجة المتوقعة موثقة ومغطاة باختبار انحدار.", "Import the JSON Baseline from the import tab, then use the event card in the TIA journey. The expected result is documented and covered by a regression test.")}</p>
            <div className="training-download-group"><a href="/manus-storage/05-training-tia-baseline_65e0778b.json" download>Baseline JSON</a><a href="/manus-storage/06-training-tia-event_7550a22f.json" download>{txt("بطاقة الحدث JSON", "Event card JSON")}</a></div>
          </article>
          <article>
            <span>03 · {txt("مشروع تزامن تدريبي", "Training concurrency project")}</span>
            <h4>{txt("حدثان متداخلان للفحص الفني", "Two overlapping events for technical review")}</h4>
            <p>{txt("نموذج مصطنع يوضح قراءة أثر حدثين متزامنين تقنيًا. هو مرشح فني تعليمي ولا يوزع المسؤولية أو الاستحقاق التعاقدي.", "A synthetic model showing the technical reading of two concurrent events. It is an educational technical screen and does not allocate responsibility or contractual entitlement.")}</p>
            <div className="training-download-group"><a href="/manus-storage/07-training-concurrency-baseline_98d84044.json" download>Baseline JSON</a><a href="/manus-storage/08-training-concurrency-events_8b000149.json" download>{txt("بطاقتا الحدث JSON", "Two event cards JSON")}</a></div>
          </article>
        </div>
      </section>

      <article className="training-video-card" aria-label={txt("فيديو تمهيدي لرحلة TIA", "Introductory video for the TIA journey")}>
        <div>
          <p className="eyebrow">{txt("فيديو تدريبي · Workshop 8", "TRAINING VIDEO · WORKSHOP 8")}</p>
          <h3>{txt("رحلة TIA في ثماني ثوانٍ", "TIA journey in eight seconds")}</h3>
          <p>{txt("شاهد التسلسل العملي: ابحث في الموسوعة، اختر المنهج، ثم ثبّت Baseline وUpdate وExcel وقسّم النشاط إلى Pre / Event / Post قبل الحساب.", "Watch the working sequence: search the library, choose a method, then set Baseline, Update and Excel, and split the activity into Pre / Event / Post before calculation.")}</p>
        </div>
        <video controls preload="metadata" className="training-video" aria-label={txt("فيديو توضيحي لمسار تحليل الأثر الزمني TIA", "Illustrative video for the TIA workflow")}>
          <source src="/manus-storage/tia-workshop8-guided-workflow_21ac3c32.mp4" type="video/mp4" />
          {txt("متصفحك لا يدعم تشغيل الفيديو.", "Your browser does not support video playback.")}
        </video>
      </article>
      </> : null}
    </section>
  );
}

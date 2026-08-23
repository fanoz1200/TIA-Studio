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
import "./knowledge-centre.css";
import "./knowledge-centre-record-filters.css";
import "./training-video.css";

export type AnalysisMethod = "tia" | "windows" | "disruption" | "quantity";
type WorkbookRecordFamily = "all" | "delay" | "support";
export type KnowledgeRoute = {
  method: AnalysisMethod;
  journeyPath: "issue" | "direct";
  caseId: string;
  caseTitle: string;
};

const methods: { id: AnalysisMethod; label: string; detail: string }[] = [
  { id: "tia", label: "تحليل الأثر الزمني (TIA)", detail: "مناسب لحدث محدد يُنمذج على تحديث سابق للحدث ثم يقاس أثره على الإكمال." },
  { id: "windows", label: "تحليل النوافذ (Windows)", detail: "مناسب للمشروع المستمر أو الوقائع المتداخلة التي تتطلب قراءة تحديثات متتابعة." },
  { id: "disruption", label: "تحليل التعطيل (Disruption)", detail: "مناسب لانخفاض الإنتاجية أو اضطراب تسلسل التنفيذ، ويحتاج أدلة تشغيلية." },
  { id: "quantity", label: "زيادة الكميات / النطاق (Quantity)", detail: "يوثق الزيادة والأثر الزمني، ثم يترك تقرير الاستحقاق المالي والتعاقدي للمراجعة." },
];

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

function selectedMethodLabel(caseItem: MasterClaimCase) {
  return methods.find(method => method.id === methodFromSource(caseItem.methodology))?.label ?? "تحليل الأثر الزمني (TIA)";
}

function journeyFor(method: AnalysisMethod): "issue" | "direct" {
  return method === "tia" ? "direct" : "issue";
}

const requestedCaseCount = 88;
const workbookCases: DetailedMasterClaimCase[] = masterClaimIntelligenceCases.map(item => ({ ...item, source: "excel" }));

export function KnowledgeCentrePanel({ view, onBeginGuidedAnalysis }: { view: string; projectKey: string; isAuthenticated: boolean; onBeginGuidedAnalysis?: (route: KnowledgeRoute) => void }) {
  const [query, setQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState<AnalysisMethod | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [recordFamilyFilter, setRecordFamilyFilter] = useState<WorkbookRecordFamily>("all");
  const [selectedId, setSelectedId] = useState(workbookCases[0]?.id ?? "");
  const [methodOverride, setMethodOverride] = useState<AnalysisMethod | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [selectedFidicClause, setSelectedFidicClause] = useState(fidicClaimReferences[0]?.clause ?? "");
  const [selectedSupportSheetId, setSelectedSupportSheetId] = useState(masterClaimSupportSheets[0]?.id ?? "");

  const libraryCases = workbookCases;
  const verifiedWorkbookCaseCount = masterClaimIntelligenceSource.caseCount;
  const verifiedDCaseCount = masterClaimIntelligenceSource.caseGroups.D;
  const verifiedRelatedCaseCount = verifiedWorkbookCaseCount - verifiedDCaseCount;
  const pendingDCaseCount = Math.max(0, requestedCaseCount - verifiedDCaseCount);

  const categories = useMemo(() => Array.from(new Set(libraryCases.map(item => item.category))).filter(Boolean).sort((a, b) => a.localeCompare(b, "ar")), [libraryCases]);
  const selectedCase = libraryCases.find(item => item.id === selectedId) ?? libraryCases[0];
  const selectedMethod = methodOverride ?? methodFromSource(selectedCase.methodology);
  const selectedMethodInfo = methods.find(item => item.id === selectedMethod) ?? methods[0];
  const selectedFidicReference = fidicClaimReferences.find(item => item.clause === selectedFidicClause) ?? fidicClaimReferences[0];
  const selectedSupportSheet = masterClaimSupportSheets.find(sheet => sheet.id === selectedSupportSheetId) ?? masterClaimSupportSheets[0];

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
    toast.success("جاري فتح رحلة التحليل للحالة المختارة…");
    onBeginGuidedAnalysis({
      method: selectedMethod,
      journeyPath: journeyFor(selectedMethod),
      caseId: selectedCase.id,
      caseTitle: selectedCase.title_ar,
    });
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    window.setTimeout(() => setIsApplying(false), 500);
  };

  if (view !== "learning") return null;

  return (
    <section className="knowledge-centre workflow-panel">
      <div className="workflow-heading">
        <div>
          <p className="eyebrow">MASTER CLAIM INTELLIGENCE · READ ONLY</p>
          <h2>مكتبة المنهجيات والحالات العملية</h2>
          <p>تجمع المكتبة السجل التفصيلي المقروء محلياً من ملف Excel: الحالات، إجراءات القرار، التدقيق الجنائي، الاعتراضات والردود، القوالب، الحسابات، وقائمة الإقفال. البحث يرشدك ولا يصدر حكماً تعاقدياً آلياً.</p>
        </div>
        <LibraryBig size={26} />
      </div>

      <article className="master-library-status" aria-label="حالة مصدر الموسوعة">
        <div><ShieldCheck size={19} /><span><b>المصدر المرجعي محمّل للقراءة فقط.</b> تُضمَّن بيانات ملف Excel المرفوع داخل النسخة وقت البناء؛ لا يُعدّل الأصل ولا يُرسل إلى خادم أو خدمة خارجية. المتاح: {verifiedWorkbookCaseCount} سجلاً منظماً و{masterClaimIntelligenceSource.supportSheetCount} أوراق دعم.</span></div>
        <span className="master-library-count">{verifiedWorkbookCaseCount} سجل Excel تفصيلي</span>
      </article>
      <p className="case-source-note" aria-live="polite"><b>حالة الفهرسة:</b> الملف يحتوي {verifiedDCaseCount} حالة من سلسلة D و{verifiedRelatedCaseCount} سجلاً مرتبطاً فعلياً (DIS/CON/VAR/RES). لا يظهر فيه D-056 إلى D-088 كسجلات منظمة؛ تبقى {pendingDCaseCount} حالة من سلسلة D معلقة إلى أن يصل مصدر موثق، ولن تُنشأ بدائل عنها.</p>

      <section className="fidic-reference-library" aria-label="مرجع بنود FIDIC 2017">
        <div className="reference-library-heading">
          <FileText size={20} />
          <div><p className="eyebrow">FIDIC 2017 · PLANNER REFERENCE</p><h3>مرجع بنود FIDIC 2017 للمخطط والمطالبة</h3><p>يعرض {fidicClaimReferences.length} بنداً موثقاً من ملفك: قراءة عملية للمخطط، الإجراء، السجلات، والملاحظات. هذه المراجع مستقلة عن حالات D ولا تُنشئ استحقاقاً قانونياً تلقائياً.</p></div>
        </div>
        <div className="fidic-clause-grid">
          {fidicClaimReferences.map(reference => <button type="button" key={reference.clause} className={`fidic-clause-card ${reference.clause === selectedFidicReference?.clause ? "selected" : ""}`} onClick={() => setSelectedFidicClause(reference.clause)} aria-pressed={reference.clause === selectedFidicReference?.clause}>
            <span>FIDIC {reference.clause}</span><b>{reference.title}</b><small>الأثر: {reference.adjustment || "غير مذكور"}</small>
          </button>)}
        </div>
        {selectedFidicReference ? <article className="fidic-reference-detail" aria-live="polite">
          <div><span>FIDIC {selectedFidicReference.clause}</span><h4>{selectedFidicReference.title}</h4><b>{selectedFidicReference.adjustment || "الأثر غير مذكور في الملف"}</b></div>
          <div className="fidic-detail-grid">
            <section><h5>شرح البند للمخطط</h5><p>{selectedFidicReference.plannerSummary || "لم يرد شرح مختصر في المصدر."}</p></section>
            <section><h5>إجراء عملي</h5><p>{selectedFidicReference.plannerAction || "لم يرد إجراء عملي في المصدر."}</p></section>
            <section><h5>السجلات والأدلة</h5><p>{selectedFidicReference.evidence || "لم تحدد سجلات في المصدر."}</p></section>
            <section><h5>المرجع القانوني المصري المذكور</h5><p>{selectedFidicReference.egyptianLawReference || "لم يرد مرجع قانوني مصري في المصدر."}</p></section>
            <section className="fidic-practical-notes"><h5>ملاحظات تطبيقية</h5><p>{selectedFidicReference.practicalNotes || "لم ترد ملاحظات تطبيقية إضافية في المصدر."}</p></section>
          </div>
          <small className="reference-provenance">المصدر: {selectedFidicReference.source}. راجع العقد والشروط الخاصة والنص الأصلي قبل الاعتماد.</small>
        </article> : null}
      </section>

      <article className="case-search-gate master-case-catalog">
        <div className="case-search-header">
          <span><Search size={18} />ابحث في العناوين والوصف والأدلة والمساندات</span>
          <b>70 سجلاً فعلياً من ملفك</b>
        </div>
        <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="مثال: اعتماد، RFI، زيادة كميات، FIDIC، تعليق، توريد، تزامن…" />
        <div className="case-catalog-toolbar">
          <div><Label><SlidersHorizontal size={14} />المنهج المرجح</Label><Select value={methodFilter} onValueChange={value => setMethodFilter(value as AnalysisMethod | "all")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل المناهج</SelectItem>{methods.map(method => <SelectItem key={method.id} value={method.id}>{method.label}</SelectItem>)}</SelectContent></Select></div>
          <div><Label><FileText size={14} />تصنيف الواقعة</Label><Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل التصنيفات</SelectItem>{categories.map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div>
          <div><Label><LibraryBig size={14} />نوع السجل</Label><Select value={recordFamilyFilter} onValueChange={value => setRecordFamilyFilter(value as WorkbookRecordFamily)}><SelectTrigger aria-label="نوع السجل"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل السجلات: 70</SelectItem><SelectItem value="delay">حالات التأخير D: 55</SelectItem><SelectItem value="support">سجلات داعمة DIS/CON/VAR/RES: 15</SelectItem></SelectContent></Select></div>
          <p><b>{matchingCases.length}</b> نتيجة من أصل {libraryCases.length} سجل مفهرس</p>
        </div>
        <p className="catalog-record-legend"><b>كيف تقرأ القائمة:</b> سجلات <code>D</code> هي حالات التأخير المنظمة في المصدر؛ أما <code>DIS</code> و<code>CON</code> و<code>VAR</code> و<code>RES</code> فهي سجلات داعمة مرتبطة بالتعطيل أو التزامن أو التغيير أو الموارد، ولا تتحول تلقائياً إلى حالة TIA.</p>

        <div className="case-result-grid rich-case-grid">
          {matchingCases.length ? matchingCases.map(caseItem => {
            const method = methodFromSource(caseItem.methodology);
            return <button type="button" key={caseItem.id} onClick={() => chooseCase(caseItem)} className={`case-result ${caseItem.id === selectedCase.id ? "selected" : ""}`}>
              <span className="case-number">{caseItem.id}</span>
              <b>{caseItem.title_ar}</b>
              <span>{caseItem.category}</span>
              <em>{selectedMethodLabel(caseItem)} · {caseItem.delay_type}</em>
              <small>{caseItem.description.slice(0, 150)}{caseItem.description.length > 150 ? "…" : ""}</small>
            </button>;
          }) : <p className="case-empty">لا توجد نتيجة مطابقة. امسح بعض كلمات البحث أو غيّر التصفية لعرض جميع حالات الموسوعة.</p>}
        </div>
      </article>

      <article className="case-detail-reader" aria-live="polite">
        <div className="case-detail-heading">
          <div><span className="case-number">{selectedCase.id}</span><div><h3>{selectedCase.title_ar}</h3><p dir="ltr">{selectedCase.title_en}</p></div></div>
          <span>{selectedCase.category}</span>
        </div>
        <div className="case-detail-meta"><span>{selectedCase.delay_type}</span><span>{selectedCase.methodology || "TIA"}</span><span>مرجع من الموسوعة المرفوعة</span></div>
        <div className="method-selection detail-method-selection">
          <div><Label>منهج التحليل الذي ستبدأ به</Label><Select value={selectedMethod} onValueChange={value => setMethodOverride(value as AnalysisMethod)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{methods.map(method => <SelectItem key={method.id} value={method.id}>{method.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="method-rationale"><b>{selectedMethodInfo.label}</b><p>{selectedMethodInfo.detail}</p><small><CheckCircle2 size={14} />المنهج الوارد في المصدر: {selectedMethodLabel(selectedCase)}. يمكنك تعديله بعد التحقق من العقد والوقائع.</small></div>
        </div>
        <div className="case-detail-sections">
          <section><h4>وصف الحالة</h4><p>{selectedCase.description}</p></section>
          <section><h4>الأسباب الجذرية</h4><p>{selectedCase.root_cause}</p></section>
          <section><h4>الأثر المتوقع على البرنامج</h4><p>{selectedCase.schedule_impact}</p></section>
          <section className="contractual-reference"><h4>المساند التعاقدي والقوانين المذكورة في المصدر</h4><p>{selectedCase.contractual_basis}</p></section>
          <section className="evidence-reference"><h4>الأدلة والمستندات المقترحة</h4><p>{selectedCase.burden_of_proof}</p></section>
          {selectedCase.source === "excel" ? <>
            <section><h4>الحل المقترح</h4><p>{selectedCase.recommended_solution || "لم يرد حل تفصيلي لهذه الحالة في ملف Excel."}</p></section>
            <section><h4>إجراءات الوقاية</h4><p>{selectedCase.mitigation || "لم ترد إجراءات وقاية لهذه الحالة في ملف Excel."}</p></section>
            <section><h4>WBS و Fragnet وقواعد TIA</h4><p>{[selectedCase.fragnet_id && `Fragnet: ${selectedCase.fragnet_id}`, selectedCase.wbs_code && `WBS: ${selectedCase.wbs_code}`, selectedCase.fragnet_activities && `الأنشطة: ${selectedCase.fragnet_activities}`, selectedCase.fragnet_protocol && `بروتوكول الـ Fragnet: ${selectedCase.fragnet_protocol}`, selectedCase.tia_baseline_rule && `Baseline: ${selectedCase.tia_baseline_rule}`, selectedCase.calendar_rule && `التقويم: ${selectedCase.calendar_rule}`, selectedCase.float_rule && `Float: ${selectedCase.float_rule}`].filter(Boolean).join("\n\n") || "لم ترد قواعد Fragnet أو TIA إضافية لهذه الحالة في ملف Excel."}</p></section>
            <section><h4>إجراء التحديث والاستدراك</h4><p>{[selectedCase.update_procedure, selectedCase.recovery_procedure].filter(Boolean).join("\n\n") || "لم يرد إجراء تحديث أو استدراك إضافي لهذه الحالة في ملف Excel."}</p></section>
          </> : null}
        </div>
        <div className="case-search-actions">
          <span><ShieldCheck size={16} />هذه خلاصة مرجعية من ملفك؛ راجع نسخة العقد والشروط الخاصة قبل الاعتماد أو المطالبة.</span>
          <Button className="run-button" type="button" onClick={applyCase} disabled={isApplying} aria-busy={isApplying}>{isApplying ? "جاري فتح رحلة التحليل…" : "طبّق هذه الحالة الآن"} <ArrowLeft size={16} /></Button>
        </div>
      </article>

      {selectedSupportSheet ? <section className="master-support-sheets" aria-label="أوراق الدعم من ملف Master Claim Intelligence">
        <div className="reference-library-heading"><FileText size={20} /><div><p className="eyebrow">MASTER CLAIM INTELLIGENCE · SUPPORT SHEETS</p><h3>إجراءات القرار، التدقيق، الاعتراضات، القوالب والحسابات</h3><p>هذه الأوراق الثمانية مستنسخة للقراءة من الملف المرفوع مع أسماء الروابط الداخلية كما وردت فيه. الصفوف معروضة داخل مساحة تمرير مستقلة للحفاظ على قراءة الهاتف.</p></div></div>
        <div className="support-sheet-tabs" role="tablist" aria-label="اختيار ورقة دعم">{masterClaimSupportSheets.map(sheet => <button key={sheet.id} type="button" role="tab" aria-selected={sheet.id === selectedSupportSheet.id} className={sheet.id === selectedSupportSheet.id ? "selected" : ""} onClick={() => setSelectedSupportSheetId(sheet.id)}>{sheet.title}</button>)}</div>
        <article className="support-sheet-reader" role="tabpanel">
          <div className="support-sheet-reader-heading"><div><span>{selectedSupportSheet.id}</span><h4>{selectedSupportSheet.title}</h4></div><small>{selectedSupportSheet.rows.length} صفاً · {selectedSupportSheet.links.length} رابطاً داخلياً</small></div>
          <div className="support-sheet-table-wrap"><table><tbody>{selectedSupportSheet.rows.map((row, rowIndex) => <tr key={`${selectedSupportSheet.id}-${rowIndex}`}>{row.map((cell, cellIndex) => rowIndex === 0 ? <th key={`${rowIndex}-${cellIndex}`} scope="col">{cell || "—"}</th> : <td key={`${rowIndex}-${cellIndex}`}>{cell || "—"}</td>)}</tr>)}</tbody></table></div>
          {selectedSupportSheet.links.length ? <div className="support-sheet-links"><b>الروابط الداخلية الواردة في المصدر</b><ul>{selectedSupportSheet.links.map(link => <li key={`${link.cell}-${link.target}`}><code>{link.cell}</code><span>{link.label || "رابط داخلي"}</span><small>{link.target}</small></li>)}</ul></div> : <p className="support-sheet-empty">لا توجد روابط داخلية مسجلة لهذه الورقة.</p>}
        </article>
      </section> : null}

      <div className="learning-path-grid reference-paths">
        <article className="learning-path"><BookOpenCheck size={20} /><h3>كيف تستخدم المكتبة؟</h3><p>ابحث عن الحالة، اقرأ الوصف والأثر والأدلة، ثم اضغط «طبّق هذه الحالة الآن» للانتقال إلى رحلة Workshop 8.</p></article>
        <article className="learning-path"><CheckCircle2 size={20} /><h3>ما الذي ينتقل إلى التحليل؟</h3><p>رقم الحالة والعنوان والمنهج المختار فقط. تبقى البيانات الحسابية مبنية على ملفات P6 وExcel التي ترفعها في الرحلة.</p></article>
        <article className="learning-path"><ShieldCheck size={20} /><h3>حدود المكتبة</h3><p>الموسوعة دليل عملي وتعليمي. لا تستبدل العقد أو الرأي القانوني أو التحقق من شروط المشروع الخاصة.</p></article>
      </div>

      <section className="claim-training-scenarios" aria-label="سيناريوهات تدريب المطالبات">
        <div className="reference-library-heading"><BookOpenCheck size={20} /><div><p className="eyebrow">دليل تدريبي مستخرج من المصدر</p><h3>خمسة سيناريوهات لتدريب عين المخطط</h3><p>أسئلة تطبيقية من الدليل العربي المرفوع تساعد على فهم المسار الحرج والـ Float والسببية والتزامن؛ لا تضيف وقائع إلى مشروعك ولا تستبدل فحص البرنامج الفعلي.</p></div></div>
        <div className="claim-scenario-grid">
          {claimTrainingScenarios.map((scenario, index) => <article key={scenario.id}><span>سيناريو {index + 1}</span><h4>{scenario.title}</h4><p>{scenario.content}</p><small>المصدر: {scenario.source}</small></article>)}
        </div>
      </section>

      <section className="text-training-guides" aria-label="إرشادات رفع P6 وإدخال Excel">
        <div className="text-training-guides-heading"><FileText size={20} /><div><p className="eyebrow">تدريب عملي مكتوب</p><h3>دليل سريع حتى يتاح الفيديوان المستقلان</h3></div></div>
        <div className="text-training-guide-grid">
          <article>
            <span>01 · رفع برنامج P6</span>
            <h4>Baseline ثم Update قبل الحدث</h4>
            <ol><li>من رحلة TIA اختر ملف Baseline بصيغة XER أو XML.</li><li>راجع عدادات الأنشطة والعلاقات والتقويم قبل الاعتماد.</li><li>أضف Update الأقرب قبل تاريخ الواقعة، ثم التحديثات اللاحقة عند وجودها.</li></ol>
            <p>لا يُعدّل الملف الأصلي؛ يعمل المحرك على نسخ تحليلية مستقلة فقط.</p>
          </article>
          <article>
            <span>02 · إدخال واقعة Excel</span>
            <h4>وثّق الواقعة قبل إنشاء Fragnet</h4>
            <ol><li>اكتب رقم القضية والوصف وتاريخ البدء والمدة والمسؤولية.</li><li>اختر الأنشطة ونقاط الربط من بيانات البرنامج المستورد، لا من أمثلة ثابتة.</li><li>راجع صفوف Excel ثم اعرض تقسيم Pre / Event / Post قبل الحساب.</li></ol>
            <p>لا تنتقل الرحلة عند نقص الحقول الجوهرية، حتى يبقى سجل الواقعة قابلاً للمراجعة.</p>
          </article>
        </div>
      </section>

      <section className="training-resource-downloads" aria-label="حزمة التدريب والبرومبتات">
        <div className="training-resource-heading"><Download size={20} /><div><p className="eyebrow">موارد تدريب قابلة للتنزيل</p><h3>حزمة آمنة للتجربة وإنتاج الفيديو خارج المنصة</h3><p>هذه ملفات تعليمية مصطنعة وليست برنامج مشروع أو مطالبة فعلية. لا ترفعها إلى Primavera؛ استخدمها داخل TIA Studio لفهم البيانات والحساب والتحقق فقط.</p></div></div>
        <div className="training-resource-grid">
          <article>
            <span>01 · برومبتات فيديو عربية</span>
            <h4>فيديو رفع P6 وفيديو Excel — 5 إلى 6 دقائق</h4>
            <p>نصوص مشهدية جاهزة لأداة فيديو خارجية، بصوت أنثوي مصري دافئ وحيوي وواضح مهنيًا، مع منع استخدام أي بيانات مشروع أو صياغة استحقاق قانوني قاطع.</p>
            <a className="training-download-link" href="/manus-storage/google-video-prompts-ar_8d21a82e.md" download><Download size={15} />تنزيل حزمة البرومبتات</a>
          </article>
          <article>
            <span>02 · مشروع TIA تدريبي</span>
            <h4>تأخير اعتماد بسيط بنتيجة متوقعة</h4>
            <p>استورد الـ Baseline بصيغة JSON من تبويب الاستيراد، ثم استخدم بطاقة الحدث في رحلة TIA. النتيجة المتوقعة موثقة ومغطاة باختبار انحدار.</p>
            <div className="training-download-group"><a href="/manus-storage/05-training-tia-baseline_65e0778b.json" download>Baseline JSON</a><a href="/manus-storage/06-training-tia-event_7550a22f.json" download>بطاقة الحدث JSON</a></div>
          </article>
          <article>
            <span>03 · مشروع تزامن تدريبي</span>
            <h4>حدثان متداخلان للفحص الفني</h4>
            <p>نموذج مصطنع يوضح قراءة أثر حدثين متزامنين تقنيًا. هو مرشح فني تعليمي ولا يوزع المسؤولية أو الاستحقاق التعاقدي.</p>
            <div className="training-download-group"><a href="/manus-storage/07-training-concurrency-baseline_98d84044.json" download>Baseline JSON</a><a href="/manus-storage/08-training-concurrency-events_8b000149.json" download>بطاقتا الحدث JSON</a></div>
          </article>
        </div>
      </section>

      <article className="training-video-card" aria-label="فيديو تمهيدي لرحلة TIA">
        <div>
          <p className="eyebrow">فيديو تدريبي · Workshop 8</p>
          <h3>رحلة TIA في ثماني ثوانٍ</h3>
          <p>شاهد التسلسل العملي: ابحث في الموسوعة، اختر المنهج، ثم ثبّت Baseline وUpdate وExcel وقسّم النشاط إلى Pre / Event / Post قبل الحساب.</p>
        </div>
        <video controls preload="metadata" className="training-video" aria-label="فيديو توضيحي لمسار تحليل الأثر الزمني TIA">
          <source src="/manus-storage/tia-workshop8-guided-workflow_21ac3c32.mp4" type="video/mp4" />
          متصفحك لا يدعم تشغيل الفيديو.
        </video>
      </article>
    </section>
  );
}

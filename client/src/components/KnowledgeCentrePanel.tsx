import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpenCheck, CheckCircle2, Download, FileText, LibraryBig, Search, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { masterClaimCases, type MasterClaimCase } from "@/lib/master-claim-cases";
import { enrichHtmlCase, loadMasterClaimExcelCases, type DetailedMasterClaimCase } from "@/lib/master-claim-excel";
import { claimTrainingScenarios, fidicClaimReferences } from "@/lib/user-claim-references";
import "./knowledge-centre.css";
import "./training-video.css";

export type AnalysisMethod = "tia" | "windows" | "disruption" | "quantity";
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
  if (source.includes("window") || source.includes("period")) return "windows";
  if (source.includes("disruption") || source.includes("productivity")) return "disruption";
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

export function KnowledgeCentrePanel({ view, onBeginGuidedAnalysis }: { view: string; projectKey: string; isAuthenticated: boolean; onBeginGuidedAnalysis?: (route: KnowledgeRoute) => void }) {
  const [query, setQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState<AnalysisMethod | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(masterClaimCases[0].id);
  const [methodOverride, setMethodOverride] = useState<AnalysisMethod | null>(null);
  const [excelCases, setExcelCases] = useState<DetailedMasterClaimCase[] | null>(null);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [selectedFidicClause, setSelectedFidicClause] = useState(fidicClaimReferences[0]?.clause ?? "");

  useEffect(() => {
    let mounted = true;
    loadMasterClaimExcelCases()
      .then(rows => {
        if (mounted) setExcelCases(rows);
      })
      .catch(() => {
        if (mounted) setExcelError("تعذر تحميل التفاصيل الإضافية من ملف Excel المرجعي حالياً؛ يبقى فهرس HTML متاحاً للقراءة.");
      });
    return () => { mounted = false; };
  }, []);

  const libraryCases = useMemo(() => {
    const combined = new Map<string, DetailedMasterClaimCase>();
    masterClaimCases.forEach(item => combined.set(item.id, enrichHtmlCase(item)));
    excelCases?.forEach(item => {
      const previous = combined.get(item.id);
      combined.set(item.id, {
        ...previous,
        ...item,
        title_ar: item.title_ar || previous?.title_ar || item.id,
        title_en: item.title_en || previous?.title_en || "",
        category: item.category || previous?.category || "غير مصنف",
        description: item.description || previous?.description || "",
        root_cause: item.root_cause || previous?.root_cause || "",
        schedule_impact: item.schedule_impact || previous?.schedule_impact || "",
        contractual_basis: item.contractual_basis || previous?.contractual_basis || "",
        burden_of_proof: item.burden_of_proof || previous?.burden_of_proof || "",
      });
    });
    return Array.from(combined.values()).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  }, [excelCases]);

  const verifiedExcelCount = excelCases?.length ?? 0;
  const pendingCaseCount = Math.max(0, requestedCaseCount - verifiedExcelCount);

  const categories = useMemo(() => Array.from(new Set(libraryCases.map(item => item.category))).filter(Boolean).sort((a, b) => a.localeCompare(b, "ar")), [libraryCases]);
  const selectedCase = libraryCases.find(item => item.id === selectedId) ?? libraryCases[0];
  const selectedMethod = methodOverride ?? methodFromSource(selectedCase.methodology);
  const selectedMethodInfo = methods.find(item => item.id === selectedMethod) ?? methods[0];
  const selectedFidicReference = fidicClaimReferences.find(item => item.clause === selectedFidicClause) ?? fidicClaimReferences[0];

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
      ].join(" "));
      return (methodFilter === "all" || sourceMethod === methodFilter)
        && (categoryFilter === "all" || item.category === categoryFilter)
        && terms.every(term => haystack.includes(term));
    });
  }, [categoryFilter, libraryCases, methodFilter, query]);

  const chooseCase = (caseItem: MasterClaimCase) => {
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
          <p>تجمع المكتبة فهرس الموسوعة مع السجل التفصيلي المقروء محلياً من ملف Excel: الوصف والأثر الزمني والمساند التعاقدي والأدلة وقواعد TIA وFragnet عند توافرها. البحث يرشدك ولا يصدر حكماً تعاقدياً آلياً.</p>
        </div>
        <LibraryBig size={26} />
      </div>

      <article className="master-library-status" aria-label="حالة مصدر الموسوعة">
        <div><ShieldCheck size={19} /><span><b>المصدر المرجعي محمّل للقراءة فقط.</b> فُهرست الحالات من HTML، وتُقرأ تفاصيل Excel في متصفحك دون تعديل الأصل أو إدخاله في قاعدة البيانات. {excelCases ? `المتاح في الملف الحالي: ${verifiedExcelCount} حالة موثقة.` : "يجري التحقق من سجل Excel الحالي."}</span></div>
        <span className="master-library-count">{excelCases ? `${verifiedExcelCount} حالة Excel تفصيلية` : "جارٍ قراءة تفاصيل Excel…"}</span>
      </article>
      {excelCases ? <p className="case-source-note" aria-live="polite"><b>حالة الفهرسة:</b> عرضنا جميع السجلات الموثقة من الملف الحالي. الهدف المرجعي 88 حالة؛ تنتظر {pendingCaseCount} حالة إضافية ملف المصدر الذي سيوفره فريق المشروع، ولن تُنشأ بيانات بديلة عنها.</p> : null}
      {excelError ? <p className="case-source-warning">{excelError}</p> : null}

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
          <b>الموسوعة الفعلية</b>
        </div>
        <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="مثال: اعتماد، RFI، زيادة كميات، FIDIC، تعليق، توريد، تزامن…" />
        <div className="case-catalog-toolbar">
          <div><Label><SlidersHorizontal size={14} />المنهج المرجح</Label><Select value={methodFilter} onValueChange={value => setMethodFilter(value as AnalysisMethod | "all")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل المناهج</SelectItem>{methods.map(method => <SelectItem key={method.id} value={method.id}>{method.label}</SelectItem>)}</SelectContent></Select></div>
          <div><Label><FileText size={14} />تصنيف الواقعة</Label><Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل التصنيفات</SelectItem>{categories.map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div>
          <p><b>{matchingCases.length}</b> نتيجة من أصل {libraryCases.length} حالة مفهرسة</p>
        </div>

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
            <section><h4>قواعد TIA وFragnet</h4><p>{[selectedCase.fragnet_id && `Fragnet: ${selectedCase.fragnet_id}`, selectedCase.fragnet_activities && `الأنشطة: ${selectedCase.fragnet_activities}`, selectedCase.tia_baseline_rule && `Baseline: ${selectedCase.tia_baseline_rule}`, selectedCase.calendar_rule && `التقويم: ${selectedCase.calendar_rule}`, selectedCase.float_rule && `Float: ${selectedCase.float_rule}`].filter(Boolean).join("\n") || "لم ترد قواعد Fragnet أو TIA إضافية لهذه الحالة في ملف Excel."}</p></section>
            <section><h4>إجراء التحديث والاستدراك</h4><p>{[selectedCase.update_procedure, selectedCase.recovery_procedure].filter(Boolean).join("\n\n") || "لم يرد إجراء تحديث أو استدراك إضافي لهذه الحالة في ملف Excel."}</p></section>
          </> : null}
        </div>
        <div className="case-search-actions">
          <span><ShieldCheck size={16} />هذه خلاصة مرجعية من ملفك؛ راجع نسخة العقد والشروط الخاصة قبل الاعتماد أو المطالبة.</span>
          <Button className="run-button" type="button" onClick={applyCase} disabled={isApplying} aria-busy={isApplying}>{isApplying ? "جاري فتح رحلة التحليل…" : "طبّق هذه الحالة الآن"} <ArrowLeft size={16} /></Button>
        </div>
      </article>

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

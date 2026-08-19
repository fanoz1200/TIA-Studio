import React, { useMemo, useState } from "react";
import { ArrowLeft, BookOpenCheck, CheckCircle2, FileText, LibraryBig, Search, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { masterClaimCases, type MasterClaimCase } from "@/lib/master-claim-cases";
import "./knowledge-centre.css";

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

export function KnowledgeCentrePanel({ view, onBeginGuidedAnalysis }: { view: string; projectKey: string; isAuthenticated: boolean; onBeginGuidedAnalysis?: (route: KnowledgeRoute) => void }) {
  const [query, setQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState<AnalysisMethod | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(masterClaimCases[0].id);
  const [methodOverride, setMethodOverride] = useState<AnalysisMethod | null>(null);

  const categories = useMemo(() => Array.from(new Set(masterClaimCases.map(item => item.category))).sort((a, b) => a.localeCompare(b, "ar")), []);
  const selectedCase = masterClaimCases.find(item => item.id === selectedId) ?? masterClaimCases[0];
  const selectedMethod = methodOverride ?? methodFromSource(selectedCase.methodology);
  const selectedMethodInfo = methods.find(item => item.id === selectedMethod) ?? methods[0];

  const matchingCases = useMemo(() => {
    const terms = normalize(query).split(" ").filter(Boolean);
    return masterClaimCases.filter(item => {
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
  }, [categoryFilter, methodFilter, query]);

  const chooseCase = (caseItem: MasterClaimCase) => {
    setSelectedId(caseItem.id);
    setMethodOverride(null);
  };

  const applyCase = () => onBeginGuidedAnalysis?.({
    method: selectedMethod,
    journeyPath: journeyFor(selectedMethod),
    caseId: selectedCase.id,
    caseTitle: selectedCase.title_ar,
  });

  if (view !== "learning") return null;

  return (
    <section className="knowledge-centre workflow-panel">
      <div className="workflow-heading">
        <div>
          <p className="eyebrow">MASTER CLAIM INTELLIGENCE · READ ONLY</p>
          <h2>مكتبة المنهجيات والحالات العملية</h2>
          <p>هذه المكتبة تعرض الآن <b>{masterClaimCases.length} حالة</b> فعلية من ملف الموسوعة الذي أرسلته، تشمل وصف الواقعة والأثر الزمني والمساند التعاقدي والأدلة المقترحة. البحث يرشدك ولا يصدر حكماً تعاقدياً آلياً.</p>
        </div>
        <LibraryBig size={26} />
      </div>

      <article className="master-library-status" aria-label="حالة مصدر الموسوعة">
        <div><ShieldCheck size={19} /><span><b>المصدر المرجعي محمّل للقراءة فقط.</b> فُهرست الحالات من ملف Master Claim Intelligence دون تعديل الأصل أو إدخاله في قاعدة البيانات.</span></div>
        <span className="master-library-count">{masterClaimCases.length} حالة مفهرسة</span>
      </article>

      <article className="case-search-gate master-case-catalog">
        <div className="case-search-header">
          <span><Search size={18} />ابحث في العناوين والوصف والأدلة والمساندات</span>
          <b>الموسوعة الفعلية</b>
        </div>
        <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="مثال: اعتماد، RFI، زيادة كميات، FIDIC، تعليق، توريد، تزامن…" />
        <div className="case-catalog-toolbar">
          <div><Label><SlidersHorizontal size={14} />المنهج المرجح</Label><Select value={methodFilter} onValueChange={value => setMethodFilter(value as AnalysisMethod | "all")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل المناهج</SelectItem>{methods.map(method => <SelectItem key={method.id} value={method.id}>{method.label}</SelectItem>)}</SelectContent></Select></div>
          <div><Label><FileText size={14} />تصنيف الواقعة</Label><Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل التصنيفات</SelectItem>{categories.map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div>
          <p><b>{matchingCases.length}</b> نتيجة من أصل {masterClaimCases.length} حالة</p>
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
          <section className="contractual-reference"><h4>المساند التعاقدي المذكور في الموسوعة</h4><p>{selectedCase.contractual_basis}</p></section>
          <section className="evidence-reference"><h4>الأدلة والمستندات المقترحة</h4><p>{selectedCase.burden_of_proof}</p></section>
        </div>
        <div className="case-search-actions">
          <span><ShieldCheck size={16} />هذه خلاصة مرجعية من ملفك؛ راجع نسخة العقد والشروط الخاصة قبل الاعتماد أو المطالبة.</span>
          <Button className="run-button" onClick={applyCase}>طبّق هذه الحالة الآن <ArrowLeft size={16} /></Button>
        </div>
      </article>

      <div className="learning-path-grid reference-paths">
        <article className="learning-path"><BookOpenCheck size={20} /><h3>كيف تستخدم المكتبة؟</h3><p>ابحث عن الحالة، اقرأ الوصف والأثر والأدلة، ثم اضغط «طبّق هذه الحالة الآن» للانتقال إلى رحلة Workshop 8.</p></article>
        <article className="learning-path"><CheckCircle2 size={20} /><h3>ما الذي ينتقل إلى التحليل؟</h3><p>رقم الحالة والعنوان والمنهج المختار فقط. تبقى البيانات الحسابية مبنية على ملفات P6 وExcel التي ترفعها في الرحلة.</p></article>
        <article className="learning-path"><ShieldCheck size={20} /><h3>حدود المكتبة</h3><p>الموسوعة دليل عملي وتعليمي. لا تستبدل العقد أو الرأي القانوني أو التحقق من شروط المشروع الخاصة.</p></article>
      </div>
    </section>
  );
}

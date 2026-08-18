import { AlertTriangle, CheckCircle2, CircleX, Info, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Fragnet, Schedule, TiaResult, WindowTiaResult } from "@/lib/cpm";
import { evaluateTiaResultQuality } from "@/lib/tia-result-validation";

type Props = {
  schedule: Schedule;
  selectedEvent: Fragnet | null;
  activeResult: TiaResult | WindowTiaResult | null;
  analystExpectedDays: string;
  onAnalystExpectedDaysChange: (value: string) => void;
};

export function TiaResultValidationPanel({ schedule, selectedEvent, activeResult, analystExpectedDays, onAnalystExpectedDaysChange }: Props) {
  const expected = analystExpectedDays.trim() === "" ? null : Number(analystExpectedDays);
  const quality = evaluateTiaResultQuality({ schedule, selectedEvent, analysis: activeResult, analystExpectedDays: Number.isFinite(expected) ? expected : null });
  const icon = (state: "pass" | "warning" | "rejected" | "info") => state === "pass" ? <CheckCircle2 size={17} /> : state === "rejected" ? <CircleX size={17} /> : state === "warning" ? <AlertTriangle size={17} /> : <Info size={17} />;
  const workflowClass = quality.state === "accepted" ? "pass" : quality.state === "rejected" ? "blocked" : "attention";
  const decision = quality.state === "accepted" ? "مقبولة آلياً" : quality.state === "rejected" ? "مرفوضة آلياً" : "قبول مشروط";

  return <section className="workflow-quality-gate result-validation-gate" aria-label="لوحة تحقق نتيجة TIA">
    <header><div><p className="eyebrow">TIA RESULT VALIDATION</p><h3>لوحة تحقق النتيجة وقواعد القرار</h3></div><span className={`result-validation-decision ${workflowClass}`}>{quality.state === "accepted" ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}{decision}</span></header>
    <p className="result-validation-summary">{quality.summary}</p>
    <div className="result-validation-input"><label htmlFor="analyst-expected-impact">تقدير المحلل (أيام عمل، اختياري)</label><Input id="analyst-expected-impact" type="number" min="0" step="1" dir="ltr" value={analystExpectedDays} onChange={(event) => onAnalystExpectedDaysChange(event.target.value)} placeholder="مثال: 6" /><small>للمقارنة فقط؛ لا يغيّر CPM أو قيمة الأثر المحسوبة.</small></div>
    {quality.analystExpectedDays !== null && <div className="result-validation-metrics"><span>المحرك <b dir="ltr">{quality.impactDays ?? 0} d</b></span><span>تقدير المحلل <b dir="ltr">{quality.analystExpectedDays} d</b></span><span>الانحراف <b dir="ltr">{quality.deviationDays ?? 0} d</b></span><span>السماحية <b dir="ltr">±{quality.toleranceDays ?? 0} d</b></span></div>}
    <div className="workflow-check-grid">{quality.checks.map((check) => <article key={check.id} className={`workflow-check workflow-check-${check.state === "pass" ? "pass" : check.state === "rejected" ? "blocked" : check.state === "warning" ? "attention" : "info"}`}><b aria-hidden="true">{icon(check.state)}</b><div><h4>{check.title}</h4><p>{check.detail}</p></div></article>)}</div>
  </section>;
}
